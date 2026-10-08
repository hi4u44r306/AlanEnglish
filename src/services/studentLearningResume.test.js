import { clearStudentLearningResume, findResumeBook, learningResumePath, readStudentLearningResume, saveStudentLearningResume } from "./studentLearningResume";
import { clearStudentPageCache } from "./studentPageCache";

const scope = "learner-a|student|123";
const book = { id: 10, code: "Workbook_1", name: "Workbook 1", payment: "private" };
const track = { id: 7, title: "Unit 1", page: "P.22", audio_url: "signed-url", firebase_token: "private" };
beforeEach(() => { clearStudentLearningResume(); localStorage.clear(); });
afterEach(() => jest.restoreAllMocks());

test("persists only a small navigation bookmark and restores it in the same context", () => {
    saveStudentLearningResume(scope, book, track);
    expect(readStudentLearningResume(scope)).toEqual({ bookId: "10", bookCode: "Workbook_1", trackId: "7", trackTitle: "Unit 1", page: "P.22", savedAt: expect.any(Number) });
    const value = JSON.parse(localStorage.getItem(`ae-learning-resume-v1:${encodeURIComponent(scope)}`));
    expect(Object.keys(value)).toHaveLength(6);
    expect(JSON.stringify(value)).not.toMatch(/signed-url|private/);
    expect(learningResumePath(book, value)).toBe("/student/books/Workbook_1?resume=7");
});

test("isolates accounts and membership contexts and clears bookmarks on existing logout cleanup", () => {
    saveStudentLearningResume(scope, book, track);
    saveStudentLearningResume("learner-b|student|123", book, track);
    expect(readStudentLearningResume("learner-a|student|456")).toBeNull();
    expect(readStudentLearningResume("learner-a|teacher|123")).toBeNull();
    clearStudentPageCache("learner-a");
    expect(readStudentLearningResume(scope)).toBeNull();
    expect(readStudentLearningResume("learner-b|student|123")).not.toBeNull();
});

test("requires a matching currently available catalog book instead of trusting saved names or codes", () => {
    saveStudentLearningResume(scope, book, track);
    const bookmark = readStudentLearningResume(scope);
    expect(findResumeBook(bookmark, [{ ...book, locked: true }])).toBeUndefined();
    expect(findResumeBook(bookmark, [{ ...book, canOpen: false }])).toBeUndefined();
    expect(findResumeBook(bookmark, [{ ...book, code: "renamed" }])).toBeUndefined();
    expect(findResumeBook(bookmark, [{ id: 99, code: book.code }])).toBeUndefined();
    expect(findResumeBook(bookmark, [book])).toBe(book);
});

test("ignores malformed, expired and future bookmarks and limits storage to eight contexts", () => {
    const key = `ae-learning-resume-v1:${encodeURIComponent(scope)}`;
    localStorage.setItem(key, "invalid json");
    expect(readStudentLearningResume(scope)).toBeNull();
    for (const savedAt of [Date.now() - 31 * 86400000, Date.now() + 100000]) {
        localStorage.setItem(key, JSON.stringify({ bookId: "10", bookCode: "Workbook_1", trackId: "7", savedAt }));
        expect(readStudentLearningResume(scope)).toBeNull();
    }
    for (let index = 0; index < 12; index += 1) saveStudentLearningResume(`user-${index}|student|1`, book, track);
    expect(Object.keys(localStorage).filter(item => item.startsWith("ae-learning-resume-v1:")).length).toBe(8);
});

test("storage failures retain the in-memory bookmark without interrupting learning", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(() => saveStudentLearningResume(scope, book, track)).not.toThrow();
    expect(readStudentLearningResume(scope)?.trackId).toBe("7");
});
