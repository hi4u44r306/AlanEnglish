import { getPrimaryAccessPlanLabel } from "./membershipPlans";

describe("getPrimaryAccessPlanLabel", () => {
    it("uses the active basic grant instead of a stale legacy plan", () => {
        expect(getPrimaryAccessPlanLabel({
            plan: { name: "全方位月訂閱" },
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

    it("shows AI Premium when it is the only effective plan", () => {
        expect(getPrimaryAccessPlanLabel({
            plan: { name: "全方位月訂閱" },
            effective_access: {
                plan_codes: ["ai_materials_general_monthly"]
            }
        })).toBe("AI Premium 使用中");
    });
});
