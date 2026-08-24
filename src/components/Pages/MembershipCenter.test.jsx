import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getMembershipProfile, getPublicPlans } from "../../services/membershipService";
import MembershipCenter from "./MembershipCenter";

jest.mock("firebase/auth", () => ({ sendEmailVerification: jest.fn() }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/billingService", () => ({
    createBillingPortal: jest.fn(),
    createCheckoutSession: jest.fn()
}));
jest.mock("../../services/membershipService", () => ({
    getMembershipProfile: jest.fn(),
    getPublicPlans: jest.fn(),
    redeemActivationCode: jest.fn()
}));

describe("MembershipCenter AI add-on", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({
            firebaseUser: { email: "academy@example.com" },
            setStudentProfile: jest.fn()
        });
        getMembershipProfile.mockResolvedValue({
            profile: {
                membership: {
                    status: "active",
                    is_active: true,
                    has_stripe_customer: true,
                    effective_access: { plan_codes: ["academy_internal", "ai_materials_addon_monthly"] }
                }
            }
        });
        getPublicPlans.mockResolvedValue({
            plans: [{
                id: 99,
                code: "ai_materials_addon_monthly",
                name: "AI 教材加購",
                description: "英文班學生專屬",
                price_twd: 99,
                trial_days: 0,
                access_model: "addon",
                is_public: true,
                checkout_ready: true,
                features: { ai_materials: true, ai_monthly_limit: 150 }
            }]
        });
    });

    it("shows the active add-on and prevents a duplicate checkout", async () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <MembershipCenter />
            </MemoryRouter>
        );

        expect(await screen.findByText("AI 教材加購已啟用")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "方案已啟用" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "管理目前訂閱" })).toBeEnabled();
        expect(screen.getByText(/每月最多/, { selector: "li" })).toHaveTextContent("每月最多 150 次");
    });
});
