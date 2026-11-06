const cleanClass = (value: unknown) => String(value || "").trim().slice(0, 30) || null;

// Same masking as learning-progress/index.ts (kept identical on purpose).
export const maskStudentName = (name: unknown) => {
    const value = String(name || "").trim().slice(0, 80);
    if (!value) return "同學";
    if (/^[\u3400-\u9fff]+$/.test(value)) {
        return value.length === 1 ? `${value}同學` : `${value[0]}${"○".repeat(Math.min(2, value.length - 1))}`;
    }
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].length <= 2 ? parts[0] : `${parts[0].slice(0, 2)}${"•".repeat(Math.min(3, parts[0].length - 2))}`;
    }
    return `${parts[0]} ${parts.at(-1)?.slice(0, 1) || ""}.`;
};

// Other students' rows only carry a nickname, or a masked name when there is none, for
// non-staff callers: no real name, class, avatar, avatar path or points balance.
// The caller's own row and staff views are unchanged.
export const shapeLeaderboardRow = (
    row: any,
    { isSelf, isStaff, nickname }: { isSelf: boolean; isStaff: boolean; nickname: string | null }
) => {
    if (isSelf || isStaff) return { ...row, nickname, _show_avatar: true };
    return {
        rank_position: row.rank_position,
        student_id: row.student_id,
        student_name: nickname ? null : maskStudentName(row.student_name),
        class_name: null,
        period_xp: row.period_xp,
        total_xp: row.total_xp,
        nickname,
        _show_avatar: false
    };
};

export const resolveLeaderboardScope = ({
    role,
    ownClass,
    requestedScope,
    requestedClass
}: {
    role: unknown;
    ownClass: unknown;
    requestedScope: unknown;
    requestedClass: unknown;
}) => {
    const scope = String(requestedScope || "class").trim() === "overall" ? "overall" : "class";
    if (scope === "overall") return { scope, classCode: null };

    const normalizedRole = String(role || "").trim();
    const classCode = normalizedRole === "student"
        ? cleanClass(ownClass)
        : cleanClass(requestedClass);
    return { scope, classCode };
};
