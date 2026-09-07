export const BASIC_MEMBERSHIP_PLAN_CODE = "basic_membership_monthly";
export const ACADEMY_AI_ADDON_PLAN_CODE = "ai_materials_addon_monthly";
export const GENERAL_AI_ADDON_PLAN_CODE = "ai_materials_general_monthly";
export const LEGACY_MEMBERSHIP_PLAN_CODES = [
    "listening_monthly",
    "all_access_monthly"
];

export const AI_ADDON_PLAN_CODES = [
    ACADEMY_AI_ADDON_PLAN_CODE,
    GENERAL_AI_ADDON_PLAN_CODE
];

export const isAiAddonPlanCode = code => AI_ADDON_PLAN_CODES.includes(code);

export const isLegacyMembershipPlanCode = code => (
    LEGACY_MEMBERSHIP_PLAN_CODES.includes(code)
);

export const hasAiAddonPlan = planCodes => (
    Array.isArray(planCodes) && planCodes.some(isAiAddonPlanCode)
);

export const hasAiPremiumAccess = effectiveAccess => {
    const access = effectiveAccess && typeof effectiveAccess === "object" ? effectiveAccess : {};
    const features = access.features && typeof access.features === "object" ? access.features : {};
    const planCodes = Array.isArray(access.plan_codes) ? access.plan_codes : [];
    if (hasAiAddonPlan(planCodes)) return true;
    const hasPronunciation = features.pronunciation === true
        || features.pronunciation_practice === true;
    return features.ai_materials === true && hasPronunciation;
};

const BASE_PLAN_LABELS = {
    [BASIC_MEMBERSHIP_PLAN_CODE]: "基本自主學習會員",
    trial_7_day: "七天免費試用",
    textbook_access: "網購教材聽力方案",
    material_bonus_90_day: "教材附贈 90 天網站使用權"
};

const BASE_PLAN_PRIORITY = [
    BASIC_MEMBERSHIP_PLAN_CODE,
    "trial_7_day",
    "material_bonus_90_day",
    "textbook_access"
];

export const getPrimaryAccessPlanCode = membership => {
    const access = membership?.effective_access || {};
    const planCodes = Array.isArray(access.plan_codes) ? access.plan_codes : [];
    const grants = Array.isArray(access.grants) ? access.grants : [];

    if (planCodes.includes("academy_internal")) return "academy_internal";

    const currentCode = BASE_PLAN_PRIORITY.find(code => planCodes.includes(code));
    if (currentCode) return currentCode;

    const baseGrant = grants.find(item => (
        item?.plan_code
        && !isAiAddonPlanCode(item.plan_code)
        && !isLegacyMembershipPlanCode(item.plan_code)
    ));
    if (baseGrant?.plan_code) return baseGrant.plan_code;

    const legacyCode = planCodes.find(isLegacyMembershipPlanCode);
    if (legacyCode) return "legacy_membership";
    if (hasAiAddonPlan(planCodes)) return "ai_premium";
    if (isLegacyMembershipPlanCode(membership?.plan?.code)) return "legacy_membership";
    return membership?.plan?.code || null;
};

export const getPrimaryAccessPlanLabel = membership => {
    const access = membership?.effective_access || {};
    const grants = Array.isArray(access.grants) ? access.grants : [];
    const primaryCode = getPrimaryAccessPlanCode(membership);

    if (primaryCode === "academy_internal") return "英文班在學權限";

    for (const code of BASE_PLAN_PRIORITY) {
        if (primaryCode !== code) continue;
        const grant = grants.find(item => item?.plan_code === code);
        return grant?.plan_name || BASE_PLAN_LABELS[code];
    }

    const baseGrant = grants.find(item => item?.plan_code === primaryCode);
    if (baseGrant?.plan_name) return baseGrant.plan_name;
    if (primaryCode === "legacy_membership") return "歷史會員權限（待轉換）";
    if (primaryCode === "ai_premium") return "AI 教材與發音練習（使用中）";
    return membership?.plan?.name || null;
};
