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

const BASE_PLAN_LABELS = {
    [BASIC_MEMBERSHIP_PLAN_CODE]: "基本自主學習會員",
    trial_7_day: "七天免費試用",
    textbook_access: "網購教材聽力方案",
    material_bonus_90_day: "教材附贈 90 天網站使用權",
    listening_monthly: "聽力月訂閱",
    all_access_monthly: "全方位月訂閱"
};

const BASE_PLAN_PRIORITY = [
    BASIC_MEMBERSHIP_PLAN_CODE,
    "trial_7_day",
    "material_bonus_90_day",
    "textbook_access",
    "listening_monthly",
    "all_access_monthly"
];

export const getPrimaryAccessPlanLabel = membership => {
    const access = membership?.effective_access || {};
    const planCodes = Array.isArray(access.plan_codes) ? access.plan_codes : [];
    const grants = Array.isArray(access.grants) ? access.grants : [];

    if (planCodes.includes("academy_internal")) return "英文班在學權限";

    for (const code of BASE_PLAN_PRIORITY) {
        if (!planCodes.includes(code)) continue;
        const grant = grants.find(item => item?.plan_code === code);
        return grant?.plan_name || BASE_PLAN_LABELS[code];
    }

    const baseGrant = grants.find(item => item?.plan_code && !isAiAddonPlanCode(item.plan_code));
    if (baseGrant?.plan_name) return baseGrant.plan_name;
    if (hasAiAddonPlan(planCodes)) return "AI Premium 使用中";
    return membership?.plan?.name || null;
};
