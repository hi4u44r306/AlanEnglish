const cleanClass = (value: unknown) => String(value || "").trim().slice(0, 30) || null;

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
