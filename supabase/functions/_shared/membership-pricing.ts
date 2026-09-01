export const BASIC_MEMBERSHIP_PLAN_CODE = "basic_membership_monthly";
export const ACADEMY_AI_ADDON_PLAN_CODE = "ai_materials_addon_monthly";
export const GENERAL_AI_ADDON_PLAN_CODE = "ai_materials_general_monthly";
export const LEGACY_MEMBERSHIP_PLAN_CODES = [
    "listening_monthly",
    "all_access_monthly"
] as const;

export const AI_ADDON_PLAN_CODES = [
    ACADEMY_AI_ADDON_PLAN_CODE,
    GENERAL_AI_ADDON_PLAN_CODE
] as const;

export const isAiAddonPlanCode = (value: unknown) => (
    typeof value === "string"
    && AI_ADDON_PLAN_CODES.some(code => code === value)
);

export const isLegacyMembershipPlanCode = (value: unknown) => (
    typeof value === "string"
    && LEGACY_MEMBERSHIP_PLAN_CODES.some(code => code === value)
);

type PricingEligibilityInput = {
    role: string;
    learnerType: string | null;
    hasActiveAcademyEnrollment: boolean;
    hasAcademyHistory: boolean;
    hasActiveBasicMembership: boolean;
};

export const getMembershipPricingEligibility = ({
    role,
    learnerType,
    hasActiveAcademyEnrollment,
    hasAcademyHistory,
    hasActiveBasicMembership
}: PricingEligibilityInput) => {
    if (role === "admin") {
        return {
            canUseBasicMembership: true,
            canUseAcademyAiAddon: true,
            canUseGeneralAiAddon: true
        };
    }

    return {
        canUseBasicMembership: role === "student" && !hasActiveAcademyEnrollment,
        canUseAcademyAiAddon: role === "student"
            && (hasActiveAcademyEnrollment || hasActiveBasicMembership),
        canUseGeneralAiAddon: role === "student"
            && hasActiveBasicMembership
    };
};
