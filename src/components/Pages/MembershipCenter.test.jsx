import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { createCheckoutSession } from "../../services/billingService";
import { getMembershipProfile, getPublicPlans } from "../../services/membershipService";
import { getAccessibleCatalog } from "../../services/contentAccessService";
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
jest.mock("../../services/contentAccessService", () => ({ getAccessibleCatalog: jest.fn() }));

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
                name: "AI 教材與發音練習",
                description: "AI 教材生成與發音教練",
                price_twd: 499,
                trial_days: 0,
                access_model: "addon",
                is_public: true,
                checkout_ready: true,
                features: { ai_materials: true, ai_monthly_limit: 150 }
            }]
        });
        getAccessibleCatalog.mockResolvedValue({
            categories: [{
                id: "workbook",
                name: "習作本",
                books: [{ id: "book-1", code: "Workbook_1", name: "Workbook 1", locked: false }, { id: "book-2", code: "Workbook_2", name: "Workbook 2", locked: true, lock_reason: "book_entitlement_required" }]
            }]
        });
    });

    it("shows available features and separates usable books from locked books", async () => {
        getMembershipProfile.mockResolvedValue({
            profile: {
                membership: {
                    status: "active",
                    is_active: true,
                    effective_access_end: "2026-10-15T00:00:00.000Z",
                    effective_access: {
                        plan_codes: ["material_bonus_90_day"],
                        grants: [{
                            plan_code: "material_bonus_90_day",
                            plan_name: "教材附贈 90 天網站使用權",
                            source: "store_purchase",
                            ends_at: "2026-10-15T00:00:00.000Z"
                        }],
                        features: { listening: true, conversation: true, review: true, assignments: false, ai_materials: false }
                    }
                }
            }
        });

        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <MembershipCenter />
            </MemoryRouter>
        );

        expect(await screen.findByRole("heading", { name: "我的教材與功能" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "目前可用功能" })).toBeInTheDocument();
        expect(screen.getByText("教材附贈 90 天網站使用權")).toBeInTheDocument();
        expect(screen.getByText("一般會員")).toBeInTheDocument();
        expect(screen.getByText("使用中")).toBeInTheDocument();
        expect(screen.getByText("2026年10月15日")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Workbook 1/ })).toHaveAttribute("href", "/student/books/Workbook_1");
        expect(screen.getByText("已取得使用權")).toBeInTheDocument();
        expect(screen.getByText("另有 1 本教材尚未取得使用權")).toBeInTheDocument();
        expect(screen.getByText(/英文班作業為在校生專屬/)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "查看可解鎖方案" })).toHaveAttribute("href", "#plans");
    });

    it("keeps permanent base access unlimited when a separate add-on has an end date", async () => {
        getMembershipProfile.mockResolvedValue({
            profile: {
                membership: {
                    status: "active",
                    is_active: true,
                    effective_access_end: "2026-09-24T00:00:00.000Z",
                    effective_access: {
                        learner_type: "textbook_customer",
                        plan_codes: ["material_owned", "ai_materials_addon_monthly"],
                        grants: [{
                            plan_code: "material_owned",
                            plan_name: "已購教材永久權限",
                            source: "store_purchase",
                            ends_at: null
                        }, {
                            plan_code: "ai_materials_addon_monthly",
                            plan_name: "AI 教材與發音練習",
                            source: "stripe",
                            ends_at: "2026-09-24T00:00:00.000Z"
                        }],
                        features: { listening: true, review: true, ai_materials: true }
                    }
                }
            }
        });

        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <MembershipCenter />
            </MemoryRouter>
        );

        expect(await screen.findByText("已購教材永久權限")).toBeInTheDocument();
        expect(screen.getByText("無期限")).toBeInTheDocument();
        expect(screen.getByText("永久保留")).toBeInTheDocument();
    });

    it("shows the active add-on and prevents a duplicate checkout", async () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <MembershipCenter />
            </MemoryRouter>
        );

        expect(await screen.findByText("你的 AI 學習力已升級")).toBeInTheDocument();
        expect(screen.getByText("AI Premium")).toBeInTheDocument();
        expect(screen.getByText(/每月 24 日續訂/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "AI 教材與發音練習使用中" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "管理目前訂閱" })).toBeEnabled();
        expect(screen.getByRole("link", { name: "AI 教材" })).toHaveAttribute("href", "/student/ai-generator");
        expect(screen.getByRole("link", { name: "發音練習" })).toHaveAttribute("href", "/student/pronunciation");
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

        expect(await screen.findByText("英文班在校生")).toBeInTheDocument();
        expect(screen.getByText("使用中")).toBeInTheDocument();
        expect(screen.getByText("英文班在學方案")).toBeInTheDocument();
        expect(screen.getByText("在校期間有效")).toBeInTheDocument();
        expect(screen.getByText("不需另外續費")).toBeInTheDocument();
        expect(screen.queryByText("贈送使用權")).not.toBeInTheDocument();
        expect(screen.queryByText("全方位月訂閱")).not.toBeInTheDocument();
        expect(screen.queryByText("0 天")).not.toBeInTheDocument();
    });

    it("separates alumni identity from an active self-study membership status", async () => {
        getMembershipProfile.mockResolvedValue({
            profile: {
                learner_type: "academy_student",
                role: "student",
                membership: {
                    status: "active",
                    is_active: true,
                    current_period_end: "2026-10-15T00:00:00.000Z",
                    plan: { name: "基本自主學習會員" },
                    effective_access: {
                        learner_type: "academy_student",
                        plan_codes: ["basic_membership_monthly"],
                        grants: [{
                            plan_code: "basic_membership_monthly",
                            plan_name: "基本自主學習會員",
                            source: "stripe",
                            ends_at: "2026-10-15T00:00:00.000Z"
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

        expect(await screen.findByText("英文班離校生")).toBeInTheDocument();
        expect(screen.getByText("使用中")).toBeInTheDocument();
        expect(screen.getAllByText("基本自主學習會員").length).toBeGreaterThan(0);
    });

    it("shows the recorded end date for an expired alumni membership", async () => {
        getMembershipProfile.mockResolvedValue({
            profile: {
                learner_type: "academy_student",
                role: "student",
                membership: {
                    status: "expired",
                    is_active: false,
                    access_ends_at: "2026-08-30T00:00:00.000Z",
                    effective_access_end: null,
                    plan: { name: "基本自主學習會員" },
                    effective_access: {
                        learner_type: "academy_student",
                        plan_codes: [],
                        grants: [],
                        features: {
                            listening: false,
                            conversation: false,
                            review: false,
                            assignments: false,
                            ai_materials: false
                        }
                    }
                }
            }
        });

        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <MembershipCenter />
            </MemoryRouter>
        );

        expect(await screen.findByText("英文班離校生")).toBeInTheDocument();
        expect(screen.getAllByText("基本自主學習會員").length).toBeGreaterThan(0);
        expect(screen.getAllByText("已到期").length).toBeGreaterThan(0);
        expect(screen.getByText("2026年8月30日")).toBeInTheDocument();
        expect(screen.getByText("0／6")).toBeInTheDocument();
        expect(screen.queryByText("無期限")).not.toBeInTheDocument();
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

        expect(await screen.findByText(/使用至 2026年9月24日/)).toBeInTheDocument();
        expect(screen.getByText(/到期後不再扣款/)).toBeInTheDocument();
        expect(screen.queryByText("自動續訂")).not.toBeInTheDocument();
    });

    it("shows the active NT$299 base membership and the NT$499 AI and pronunciation add-on", async () => {
        getMembershipProfile.mockResolvedValue({
            profile: {
                membership: {
                    status: "active",
                    is_active: true,
                    plan: { name: "基本自主學習會員" },
                    effective_access: {
                        learner_type: "textbook_customer",
                        plan_codes: ["basic_membership_monthly"],
                        grants: []
                    }
                }
            }
        });
        getPublicPlans.mockResolvedValue({
            plans: [{
                id: 299,
                code: "basic_membership_monthly",
                name: "基本自主學習會員",
                description: "使用全部正式聽力教材",
                price_twd: 299,
                trial_days: 0,
                access_model: "subscription",
                offer_label: "基本會員",
                is_public: true,
                checkout_ready: true,
                features: { listening: true, review: true, requires_book_entitlement: false }
            }, {
                id: 499,
                code: "ai_materials_addon_monthly",
                name: "AI 教材與發音練習",
                description: "需搭配基本會員；包含 AI 教材與發音教練",
                price_twd: 499,
                trial_days: 0,
                access_model: "addon",
                offer_label: "AI 教材與發音練習",
                is_public: true,
                checkout_ready: true,
                features: { ai_materials: true, ai_monthly_limit: 150 }
            }]
        });

        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <MembershipCenter />
            </MemoryRouter>
        );

        const generalAiHeading = await screen.findByRole("heading", { name: "AI 教材與發音練習" });
        expect(screen.getByText("基本會員")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "目前方案使用中" })).toBeDisabled();
        expect(screen.getAllByText(/全部正式聽力教材/).length).toBeGreaterThan(0);
        expect(generalAiHeading.closest("article")).toHaveTextContent("NT$ 499／月");

        expect(screen.getByRole("button", { name: "選擇方案" })).toBeEnabled();
    });
});
