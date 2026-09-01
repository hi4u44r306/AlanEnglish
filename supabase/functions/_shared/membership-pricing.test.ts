import {
    getMembershipPricingEligibility,
    isAiAddonPlanCode,
    isLegacyMembershipPlanCode
} from "./membership-pricing.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    }
};

Deno.test("active academy students can buy the NT$499 AI and pronunciation add-on without a basic membership", () => {
    const result = getMembershipPricingEligibility({
        role: "student",
        learnerType: "academy_student",
        hasActiveAcademyEnrollment: true,
        hasAcademyHistory: true,
        hasActiveBasicMembership: false
    });

    assertEquals(result, {
        canUseBasicMembership: false,
        canUseAcademyAiAddon: true,
        canUseGeneralAiAddon: false
    });
});

Deno.test("alumni need the NT$299 membership before buying the NT$499 AI and pronunciation add-on", () => {
    const withoutMembership = getMembershipPricingEligibility({
        role: "student",
        learnerType: "academy_student",
        hasActiveAcademyEnrollment: false,
        hasAcademyHistory: true,
        hasActiveBasicMembership: false
    });
    const withMembership = getMembershipPricingEligibility({
        role: "student",
        learnerType: "academy_student",
        hasActiveAcademyEnrollment: false,
        hasAcademyHistory: true,
        hasActiveBasicMembership: true
    });

    assertEquals(withoutMembership.canUseAcademyAiAddon, false);
    assertEquals(withMembership.canUseAcademyAiAddon, true);
});

Deno.test("general members need the NT$299 membership before buying the NT$499 AI and pronunciation add-on", () => {
    const withoutMembership = getMembershipPricingEligibility({
        role: "student",
        learnerType: "textbook_customer",
        hasActiveAcademyEnrollment: false,
        hasAcademyHistory: false,
        hasActiveBasicMembership: false
    });
    const withMembership = getMembershipPricingEligibility({
        role: "student",
        learnerType: "textbook_customer",
        hasActiveAcademyEnrollment: false,
        hasAcademyHistory: false,
        hasActiveBasicMembership: true
    });

    assertEquals(withoutMembership.canUseGeneralAiAddon, false);
    assertEquals(withMembership.canUseGeneralAiAddon, true);
    assertEquals(withMembership.canUseAcademyAiAddon, true);
});

Deno.test("the current and legacy AI add-on codes remain recognizable for billing history", () => {
    assertEquals(isAiAddonPlanCode("ai_materials_addon_monthly"), true);
    assertEquals(isAiAddonPlanCode("ai_materials_general_monthly"), true);
    assertEquals(isAiAddonPlanCode("unknown_addon"), false);
});

Deno.test("legacy membership plans remain readable but are not current offers", () => {
    assertEquals(isLegacyMembershipPlanCode("listening_monthly"), true);
    assertEquals(isLegacyMembershipPlanCode("all_access_monthly"), true);
    assertEquals(isLegacyMembershipPlanCode("basic_membership_monthly"), false);
});
