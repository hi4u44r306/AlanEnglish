import { getAssignmentState, getCurrentClassMaterials, getLearningTasks, getStudentMaterialCategories } from "./studentLearning";

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

test("current class list excludes historical grants and only opens authorized catalog matches", () => {
    const profile = { enrollment_status: "active", current_enrollment: { status: "active" },
        class_books: [{ id: 3, name: "Current" }, { id: 3, name: "Duplicate" }, { id: 4, code: "locked", name: "Locked" }],
        direct_entitlements: [{ books: { id: 5, name: "History" } }] };
    const categories = [{ name: "Workbook", books: [{ id: 3, code: "current", locked: false }, { id: 4, code: "locked", locked: true }, { id: 5, code: "history", locked: false }] }];
    expect(getCurrentClassMaterials(profile, categories)).toEqual([
        { id: 3, name: "Current", code: "current", categoryName: "Workbook", canOpen: true },
        { id: 4, name: "Locked", code: "locked", categoryName: "Workbook", canOpen: false }
    ]);
    expect(getCurrentClassMaterials({ ...profile, current_enrollment: { status: "paused" } }, categories)).toEqual([]);
    expect(getCurrentClassMaterials({ ...profile, enrollment_status: "departed" }, categories)).toEqual([]);
});
