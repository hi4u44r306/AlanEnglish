// Teacher class scope (AGENTS §7): a teacher only handles the classes granted in
// teacher_class_permissions; an admin handles every class. Every check here runs on the
// server, so hiding a button in the front end is never the only protection.
export const SCOPE_CLASS_CODES = new Set(["E1", "E3", "E5", "E7"]);

const taiwanDate = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
}).format(new Date());

const joined = (value: any) => Array.isArray(value) ? value[0] : value;

// Same rule as assignment-manager and attendance-manager: an active, publishable permission.
export const getManagedClassCodes = async (admin: any, caller: any): Promise<string[]> => {
    if (caller?.role === "admin") return [...SCOPE_CLASS_CODES];
    if (caller?.role !== "teacher") return [];
    const today = taiwanDate();
    const { data, error } = await admin.from("teacher_class_permissions")
        .select("can_publish,starts_at,ends_at,academy_classes(code)")
        .eq("teacher_id", caller.id).eq("can_publish", true).lte("starts_at", today)
        .or(`ends_at.is.null,ends_at.gte.${today}`);
    if (error) throw error;
    return [...new Set((data || []).map((row: any) => joined(row.academy_classes)?.code)
        .filter((code: string) => SCOPE_CLASS_CODES.has(code)))] as string[];
};

// null means "every class" (admin). Otherwise the academy_classes ids the caller manages.
export const getManagedClassIds = async (admin: any, caller: any): Promise<number[] | null> => {
    if (caller?.role === "admin") return null;
    const codes = await getManagedClassCodes(admin, caller);
    if (!codes.length) return [];
    const { data, error } = await admin.from("academy_classes").select("id,code").in("code", codes);
    if (error) throw error;
    return (data || []).map((row: any) => Number(row.id)).filter(Number.isFinite);
};

// null means "every student" (admin). Otherwise the ids of students whose active
// academy_enrollments row is in one of the caller's classes.
export const getManagedStudentIds = async (admin: any, caller: any): Promise<Set<number> | null> => {
    const classIds = await getManagedClassIds(admin, caller);
    if (classIds === null) return null;
    if (!classIds.length) return new Set();
    const { data, error } = await admin.from("academy_enrollments")
        .select("student_id,class_id")
        .in("class_id", classIds)
        .eq("status", "active");
    if (error) throw error;
    return new Set((data || []).map((row: any) => Number(row.student_id)).filter(Number.isFinite));
};

export const canManageStudent = async (admin: any, caller: any, studentId: unknown) => {
    if (caller?.role === "admin") return true;
    const id = Number(studentId);
    if (!Number.isFinite(id) || id <= 0) return false;
    const managed = await getManagedStudentIds(admin, caller);
    return managed === null || managed.has(id);
};
