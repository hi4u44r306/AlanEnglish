import { clearTeacherAssignmentDraft, readTeacherAssignmentDraft, saveTeacherAssignmentDraft } from "./teacherAssignmentDraft";
import { clearStudentPageCache } from "./studentPageCache";

beforeEach(() => { localStorage.clear(); clearTeacherAssignmentDraft(); });
test("retains authored fields across reads and isolates accounts", () => {
    saveTeacherAssignmentDraft("teacher-a", { form: { title: "新作業", target_class: "E1", assigned_date: "2026-10-08" }, trackIds: [3, 3], token: "forbidden", results: [{ name: "private" }] }, 100);
    expect(readTeacherAssignmentDraft("teacher-a", 101).draft).toMatchObject({ form: { title: "新作業", target_class: "E1" }, trackIds: [3] });
    expect(readTeacherAssignmentDraft("teacher-b", 101)).toBeNull();
    expect(localStorage.getItem("ae-teacher-assignment-draft-v1:teacher-a")).not.toMatch(/forbidden|private|token|results/);
});
test("expires old drafts and rejects future timestamps", () => {
    saveTeacherAssignmentDraft("a", { form: { title: "past" } }, 100);
    expect(readTeacherAssignmentDraft("a", 100 + 31 * 86400000)).toBeNull();
    saveTeacherAssignmentDraft("a", { form: { title: "future" } }, 200);
    expect(readTeacherAssignmentDraft("a", 100)).toBeNull();
});
test("malformed storage and unavailable storage never block editing", () => {
    localStorage.setItem("ae-teacher-assignment-draft-v1:a", "{invalid");
    expect(readTeacherAssignmentDraft("a")).toBeNull();
    const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(saveTeacherAssignmentDraft("a", { form: { title: "draft" } }).persistent).toBe(false);
    expect(readTeacherAssignmentDraft("a").draft.form.title).toBe("draft");
    spy.mockRestore();
});
test("logout clearing removes only the corresponding author draft", () => {
    saveTeacherAssignmentDraft("a", { form: { title: "a" } });
    saveTeacherAssignmentDraft("b", { form: { title: "b" } });
    clearStudentPageCache("a");
    expect(readTeacherAssignmentDraft("a")).toBeNull();
    expect(readTeacherAssignmentDraft("b").draft.form.title).toBe("b");
});
test("does not save an empty form or persist snapshots/answers in copied activities", () => {
    expect(saveTeacherAssignmentDraft("a", { form: { target_class: "E1" } })).toBeNull();
    saveTeacherAssignmentDraft("a", { copiedItems: [{ item_type: "ai_quiz", book_id: 1, ai_material_id: 2, page_content_ids: [3], question_snapshot: { answer: "secret-answer" } }] });
    expect(localStorage.getItem("ae-teacher-assignment-draft-v1:a")).not.toContain("secret-answer");
});
