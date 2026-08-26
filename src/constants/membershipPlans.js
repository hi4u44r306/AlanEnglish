export const BASIC_MEMBERSHIP_PLAN_CODE = "basic_membership_monthly";
export const ACADEMY_AI_ADDON_PLAN_CODE = "ai_materials_addon_monthly";
export const GENERAL_AI_ADDON_PLAN_CODE = "ai_materials_general_monthly";

export const AI_ADDON_PLAN_CODES = [
    ACADEMY_AI_ADDON_PLAN_CODE,
    GENERAL_AI_ADDON_PLAN_CODE
];

export const isAiAddonPlanCode = code => AI_ADDON_PLAN_CODES.includes(code);

export const hasAiAddonPlan = planCodes => (
    Array.isArray(planCodes) && planCodes.some(isAiAddonPlanCode)
);
