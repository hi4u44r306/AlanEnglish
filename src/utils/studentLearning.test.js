import { getAssignmentState, getLearningTasks, getStudentMaterialCategories } from "./studentLearning";

test("distinguishes overdue from completed and tolerates missing or invalid deadlines", () => {
    const now = Date.parse("2026-10-06T00:00:00Z");
    expect(getAssignmentState({ due_at: "2026-10-05T23:59:59Z" }, now)).toBe("overdue");
    expect(getAssignmentState({ due_at: "2020-01-01", progress: { completed: true } }, now)).toBe("completed");
    expect(getAssignmentState({ due_at: "invalid" }, now)).toBe("pending");
    expect(getAssignmentState({}, now)).toBe("pending");
});

test("keeps legacy and mixed identifiers distinct and orders pending tasks before overdue", () => {
    const tasks = getLearningTasks([{ id: 7, due_at: "2020-01-01" }], [{ id: 7, due_at: "2099-01-01" }]);
    expect(tasks.map(item => item.taskKey)).toEqual(["v2-7", "v1-7"]);
});

test("matches student catalog visibility and filters locked content before grouping", () => {
    const result = getStudentMaterialCategories([
        { code: "listening", books: [{ code: "hidden" }] },
        { code: "textbook", books: [{ code: "BasicReading_400_1" }, { code: "BasicReading_800_1", locked: true }, { code: "hidden-textbook" }] },
        { code: "workbook", books: [{ code: "Workbook_1" }] }
    ]);
    expect(result.flatMap(category => category.books.map(book => book.code))).toEqual(["BasicReading_400_1", "Workbook_1"]);
});
