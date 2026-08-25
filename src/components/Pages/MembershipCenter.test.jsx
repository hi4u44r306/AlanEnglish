import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { createCheckoutSession } from "../../services/billingService";
import { getMembershipProfile, getPublicPlans } from "../../services/membershipService";
import MembershipCenter from "./MembershipCenter";

jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../../services/authEmailService", () => ({ sendBrandedVerificationEmail: jest.fn() }));
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
                    ai_addon_subscription: {
                        current_period_end: "2026-09-24T00:00:00.000Z",
                        cancel_at_period_end: false
                    },
                    effective_access: {
                        plan_codes: ["academy_internal", "ai_materials_addon_monthly"],
                        grants: [{
                            id: 42,
                            plan_code: "ai_materials_addon_monthly",
                            source: "stripe",
                            ends_at: "2026-09-24T00:00:00.000Z"
                        }]
                    }
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

        expect(await screen.findByText("你的 AI 學習力已升級")).toBeInTheDocument();
        expect(screen.getByText("每月 24 日")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "AI Premium 使用中" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "管理目前訂閱" })).toBeEnabled();
        expect(screen.getByRole("link", { name: "開始使用 AI 教材" })).toHaveAttribute("href", "/student/ai-generator");
        expect(screen.getByText(/每月最多/, { selector: "li" })).toHaveTextContent("每月最多 150 次");
    });

    it("shows a spinner while opening Stripe Checkout", async () => {
        getMembershipProfile.mockResolvedValue({
            profile: {
                membership: {
                    status: "active",
                    is_active: true,
                    effective_access: { plan_codes: ["academy_internal"], grants: [] }
                }
            }
        });
        createCheckoutSession.mockReturnValue(new Promise(() => {}));

        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <MembershipCenter />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByRole("button", { name: "選擇方案" }));

        const loadingButton = await screen.findByRole("button", { name: "正在開啟安全付款…" });
        expect(loadingButton).toBeDisabled();
        expect(loadingButton).toHaveAttribute("aria-busy", "true");
        expect(createCheckoutSession).toHaveBeenCalledWith(expect.anything(), 99);
    });

    it("labels active academy access as an in-school plan instead of complimentary access", async () => {
        getMembershipProfile.mockResolvedValue({
            profile: {
                membership: {
                    status: "complimentary",
                    is_active: true,
                    days_remaining: 0,
                    effective_access_end: null,
                    plan: { name: "全方位月訂閱" },
                    effective_access: {
                        learner_type: "academy_student",
                        plan_codes: ["academy_internal"],
                        grants: [{
                            plan_code: "academy_internal",
                            plan_name: "英文班在學方案",
                            ends_at: null
                        }]
                    }
                }
            }
        });

        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <MembershipCenter />
            </MemoryRouter>
        );

        expect(await screen.findByRole("heading", { name: "英文班在校生" })).toBeInTheDocument();
        expect(screen.getByText("英文班在學方案")).toBeInTheDocument();
        expect(screen.getByText("在校期間有效")).toBeInTheDocument();
        expect(screen.getByText("已啟用")).toBeInTheDocument();
        expect(screen.queryByText("贈送使用權")).not.toBeInTheDocument();
        expect(screen.queryByText("全方位月訂閱")).not.toBeInTheDocument();
        expect(screen.queryByText("0 天")).not.toBeInTheDocument();
    });

    it("does not describe a subscription pending cancellation as an automatic renewal", async () => {
        getMembershipProfile.mockResolvedValue({
            profile: {
                membership: {
                    status: "active",
                    is_active: true,
                    ai_addon_subscription: {
                        current_period_end: "2026-09-24T00:00:00.000Z",
                        cancel_at_period_end: true
                    },
                    effective_access: {
                        plan_codes: ["academy_internal", "ai_materials_addon_monthly"],
                        grants: [{
                            id: 42,
                            plan_code: "ai_materials_addon_monthly",
                            source: "stripe",
                            ends_at: "2026-09-24T00:00:00.000Z"
                        }]
                    }
                }
            }
        });

        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <MembershipCenter />
            </MemoryRouter>
        );

        expect(await screen.findByText("方案使用至")).toBeInTheDocument();
        expect(screen.getByText("到期後不會再次扣款")).toBeInTheDocument();
        expect(screen.queryByText("自動續訂")).not.toBeInTheDocument();
    });
});
