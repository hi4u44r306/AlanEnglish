import {
    ACADEMY_AI_ADDON_PLAN_CODE,
    BASIC_MEMBERSHIP_PLAN_CODE,
    GENERAL_AI_ADDON_PLAN_CODE,
    getMembershipPricingEligibility,
    isAiAddonPlanCode
} from "./membership-pricing.ts";

export type EffectiveAccessFeatures = {
    listening: boolean;
    ai_materials: boolean;
    pronunciation: boolean;
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
    pronunciation: false,
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

    let planCodes = Array.isArray(value.plan_codes)
        ? value.plan_codes.map((code: unknown) => String(code))
        : [];
    let grants = Array.isArray(value.grants) ? value.grants : [];
    let isActive = value.is_active === true;
    let effectiveAccessEnd = value.effective_access_end
        ? String(value.effective_access_end)
        : null;
    let daysRemaining = value.days_remaining !== null
        && value.days_remaining !== undefined
        && value.days_remaining !== ""
        && Number.isInteger(Number(value.days_remaining))
        ? Number(value.days_remaining)
        : null;
    let aiDailyLimit = Math.max(0, Number(value.ai_daily_limit || 0));
    let normalizedFeatures: EffectiveAccessFeatures = {
        ...DEFAULT_FEATURES,
        listening: features.listening === true,
        ai_materials: features.ai_materials === true,
        pronunciation: features.pronunciation === true
            || features.pronunciation_practice === true
            || features.ai_materials === true,
        conversation: features.conversation === true,
        assignments: features.assignments === true,
        review: features.review === true,
        requires_book_entitlement: features.requires_book_entitlement === true
    };

    const dependentAiPlanCodes = planCodes.filter(isAiAddonPlanCode);
    if (String(value.role || "student") === "student" && dependentAiPlanCodes.length > 0) {
        let academyEnrollments: any[] = [];
        if (dependentAiPlanCodes.includes(ACADEMY_AI_ADDON_PLAN_CODE)) {
            const { data: enrollmentData, error: enrollmentError } = await admin
                .from("academy_enrollments")
                .select("id,status")
                .eq("student_id", normalizedStudentId);
            if (enrollmentError) throw enrollmentError;
            academyEnrollments = Array.isArray(enrollmentData) ? enrollmentData : [];
        }

        const eligibility = getMembershipPricingEligibility({
            role: "student",
            learnerType: value.learner_type ? String(value.learner_type) : null,
            hasActiveAcademyEnrollment: academyEnrollments.some(item => item?.status === "active"),
            hasAcademyHistory: academyEnrollments.length > 0,
            hasActiveBasicMembership: planCodes.includes(BASIC_MEMBERSHIP_PLAN_CODE)
        });
        const invalidAiPlanCodes = new Set<string>();
        if (
            dependentAiPlanCodes.includes(ACADEMY_AI_ADDON_PLAN_CODE)
            && !eligibility.canUseAcademyAiAddon
        ) invalidAiPlanCodes.add(ACADEMY_AI_ADDON_PLAN_CODE);
        if (
            dependentAiPlanCodes.includes(GENERAL_AI_ADDON_PLAN_CODE)
            && !eligibility.canUseGeneralAiAddon
        ) invalidAiPlanCodes.add(GENERAL_AI_ADDON_PLAN_CODE);

        if (invalidAiPlanCodes.size > 0) {
            planCodes = planCodes.filter(code => !invalidAiPlanCodes.has(code));
            grants = grants.filter((grant: any) => !invalidAiPlanCodes.has(String(grant?.plan_code || "")));

            const { data: activePlans, error: activePlansError } = planCodes.length > 0
                ? await admin
                    .from("subscription_plans")
                    .select("code,ai_daily_limit,features")
                    .in("code", planCodes)
                : { data: [], error: null };
            if (activePlansError) throw activePlansError;
            const remainingPlans = Array.isArray(activePlans) ? activePlans : [];
            const enabled = (feature: keyof EffectiveAccessFeatures) => remainingPlans.some(
                plan => plan?.features?.[feature] === true
            );

            normalizedFeatures = {
                listening: enabled("listening"),
                ai_materials: enabled("ai_materials"),
                pronunciation: enabled("pronunciation")
                    || remainingPlans.some(plan => plan?.features?.pronunciation_practice === true)
                    || enabled("ai_materials"),
                conversation: enabled("conversation"),
                assignments: enabled("assignments") && value.learner_type === "academy_student",
                review: enabled("review"),
                requires_book_entitlement: remainingPlans.length > 0
                    && remainingPlans.every(plan => plan?.features?.requires_book_entitlement === true)
            };
            aiDailyLimit = remainingPlans
                .filter(plan => plan?.features?.ai_materials === true)
                .reduce((maximum, plan) => Math.max(maximum, Number(plan?.ai_daily_limit || 0)), 0);
            isActive = grants.length > 0;

            if (!isActive || grants.some((grant: any) => !grant?.ends_at)) {
                effectiveAccessEnd = null;
                daysRemaining = null;
            } else {
                const maximumEnd = Math.max(...grants
                    .map((grant: any) => new Date(String(grant?.ends_at || "")).getTime())
                    .filter(Number.isFinite));
                effectiveAccessEnd = Number.isFinite(maximumEnd) ? new Date(maximumEnd).toISOString() : null;
                daysRemaining = effectiveAccessEnd
                    ? Math.max(0, Math.ceil((new Date(effectiveAccessEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
                    : null;
            }
        }
    }

    return {
        student_id: normalizedStudentId,
        role: String(value.role || "student"),
        learner_type: value.learner_type ? String(value.learner_type) : null,
        is_active: isActive,
        effective_access_end: effectiveAccessEnd,
        days_remaining: daysRemaining,
        ai_daily_limit: aiDailyLimit,
        plan_codes: planCodes,
        features: normalizedFeatures,
        grants
    };
};
