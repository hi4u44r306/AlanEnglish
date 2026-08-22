export type EffectiveAccessFeatures = {
    listening: boolean;
    ai_materials: boolean;
    conversation: boolean;
    assignments: boolean;
    review: boolean;
    requires_book_entitlement: boolean;
};

export type EffectiveAccess = {
    student_id: number;
    role: string;
    learner_type: string | null;
    is_active: boolean;
    effective_access_end: string | null;
    days_remaining: number | null;
    ai_daily_limit: number;
    plan_codes: string[];
    features: EffectiveAccessFeatures;
    grants: Record<string, unknown>[];
};

const DEFAULT_FEATURES: EffectiveAccessFeatures = {
    listening: false,
    ai_materials: false,
    conversation: false,
    assignments: false,
    review: false,
    requires_book_entitlement: false
};

export const loadEffectiveAccess = async (
    admin: any,
    studentId: number
): Promise<EffectiveAccess> => {
    const normalizedStudentId = Number(studentId);
    if (!Number.isInteger(normalizedStudentId) || normalizedStudentId <= 0) {
        throw new Error("student_id 不正確");
    }

    const { data, error } = await admin.rpc("get_student_effective_access", {
        p_student_id: normalizedStudentId
    });
    if (error) throw error;

    const value: any = data && typeof data === "object" ? data : {};
    const features: any = value.features && typeof value.features === "object"
        ? value.features
        : {};

    return {
        student_id: normalizedStudentId,
        role: String(value.role || "student"),
        learner_type: value.learner_type ? String(value.learner_type) : null,
        is_active: value.is_active === true,
        effective_access_end: value.effective_access_end
            ? String(value.effective_access_end)
            : null,
        days_remaining: Number.isInteger(Number(value.days_remaining))
            ? Number(value.days_remaining)
            : null,
        ai_daily_limit: Math.max(0, Number(value.ai_daily_limit || 0)),
        plan_codes: Array.isArray(value.plan_codes)
            ? value.plan_codes.map((code: unknown) => String(code))
            : [],
        features: {
            ...DEFAULT_FEATURES,
            listening: features.listening === true,
            ai_materials: features.ai_materials === true,
            conversation: features.conversation === true,
            assignments: features.assignments === true,
            review: features.review === true,
            requires_book_entitlement: features.requires_book_entitlement === true
        },
        grants: Array.isArray(value.grants) ? value.grants : []
    };
};
