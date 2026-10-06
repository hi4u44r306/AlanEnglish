import { createBasicReadingCategory, isBasicReadingBook } from "../constants/basicReadingCatalog";

// Match the existing student menu: only the backend-authorized, visible catalog.
export const getStudentMaterialCategories = (categories = []) => {
    const regular = [];
    const basic = [];
    categories.forEach(category => {
        const code = String(category.code || "").trim().toLowerCase();
        const name = String(category.name || "").trim();
        if (code === "listening" || name === "聽力本") return;
        const books = (category.books || []).filter(book => !book.locked);
        if (code === "textbook" || name === "課本" || code === "basic-reading" || category.navigationType === "basic-reading") {
            basic.push(...books.filter(isBasicReadingBook));
        } else if (books.length) regular.push({ ...category, books });
    });
    return basic.length ? [createBasicReadingCategory(basic), ...regular] : regular;
};

export const getAssignmentState = (assignment, now = Date.now()) => {
    if (assignment.progress?.completed) return "completed";
    const deadline = assignment.due_at ? new Date(assignment.due_at).getTime() : NaN;
    return Number.isFinite(deadline) && deadline < now ? "overdue" : "pending";
};

export const assignmentStateLabel = { pending: "進行中", overdue: "已逾期", completed: "已完成" };

export const getLearningTasks = (legacy = [], mixed = [], now = Date.now()) => (
    [...legacy.map(item => ({ ...item, taskKey: `v1-${item.id}` })),
        ...mixed.map(item => ({ ...item, taskKey: `v2-${item.id}` }))]
        .map(item => ({ ...item, state: getAssignmentState(item, now) }))
        .sort((a, b) => {
            const order = { pending: 0, overdue: 1, completed: 2 };
            if (a.state !== b.state) return order[a.state] - order[b.state];
            const due = item => Number.isFinite(Date.parse(item.due_at)) ? Date.parse(item.due_at) : Infinity;
            return (due(a) - due(b)) || String(a.taskKey).localeCompare(String(b.taskKey));
        })
);
