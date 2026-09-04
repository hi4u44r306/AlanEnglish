import { getPrimaryAccessPlanLabel, hasAiPremiumAccess } from "./membershipPlans";

describe("getPrimaryAccessPlanLabel", () => {
    it("uses the active basic grant instead of a stale legacy plan", () => {
        expect(getPrimaryAccessPlanLabel({
            plan: { code: "all_access_monthly", name: "全方位月訂閱" },
            effective_access: {
                plan_codes: ["basic_membership_monthly", "ai_materials_addon_monthly"],
                grants: [{
                    plan_code: "basic_membership_monthly",
                    plan_name: "基本自主學習會員"
                }]
            }
        })).toBe("基本自主學習會員");
    });

    it("keeps active academy access as the primary label", () => {
        expect(getPrimaryAccessPlanLabel({
            effective_access: {
                plan_codes: ["academy_internal", "ai_materials_addon_monthly"]
            }
        })).toBe("英文班在學權限");
    });

    it("shows the current AI plan name when it is the only effective plan", () => {
        expect(getPrimaryAccessPlanLabel({
            plan: { code: "all_access_monthly", name: "全方位月訂閱" },
            effective_access: {
                plan_codes: ["ai_materials_general_monthly"]
            }
        })).toBe("AI 教材與發音練習（使用中）");
    });

    it("uses a neutral label for legacy access that has not been converted", () => {
        expect(getPrimaryAccessPlanLabel({
            plan: { code: "all_access_monthly", name: "全方位月訂閱" },
            effective_access: {
                plan_codes: ["all_access_monthly"],
                grants: [{
                    plan_code: "all_access_monthly",
                    plan_name: "全方位月訂閱"
                }]
            }
        })).toBe("歷史會員權限（待轉換）");
    });
});

describe("hasAiPremiumAccess", () => {
    it("recognizes AI and pronunciation included with an academy plan", () => {
        expect(hasAiPremiumAccess({
            plan_codes: ["academy_internal"],
            features: { ai_materials: true, pronunciation: true }
        })).toBe(true);
    });

    it("keeps legacy AI add-on responses compatible", () => {
        expect(hasAiPremiumAccess({
            plan_codes: ["ai_materials_addon_monthly"],
            features: { ai_materials: true }
        })).toBe(true);
    });

    it("does not label AI-only or pronunciation-only access as AI Premium", () => {
        expect(hasAiPremiumAccess({ features: { ai_materials: true } })).toBe(false);
        expect(hasAiPremiumAccess({ features: { pronunciation: true } })).toBe(false);
    });
});
