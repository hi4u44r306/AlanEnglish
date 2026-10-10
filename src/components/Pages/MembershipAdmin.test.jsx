import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { useAuth } from "../../auth/AuthContext";
import { getGuardianEmailStatus } from "../../services/guardianEmailService";
import { getMembershipAdminDashboard } from "../../services/membershipService";
import MembershipAdmin from "./MembershipAdmin";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/guardianEmailService", () => ({
    getGuardianEmailStatus: jest.fn(),
    sendGuardianReportBatch: jest.fn()
}));
jest.mock("../../services/membershipService", () => ({
    generateActivationCodes: jest.fn(),
    getMembershipAdminDashboard: jest.fn(),
    grantMembershipAccess: jest.fn(),
    setMembershipStatus: jest.fn(),
    updateGuardianEmailSettings: jest.fn(),
    updateSubscriptionPlan: jest.fn()
}));

describe("MembershipAdmin", () => {
    beforeEach(() => {
        useAuth.mockReturnValue({ firebaseUser: { getIdToken: jest.fn() } });
        getGuardianEmailStatus.mockResolvedValue({ provider_configured: false });
        getMembershipAdminDashboard.mockResolvedValue({
            summary: { total: 1, active_total: 1 },
            plans: [
                { id: 2, code: "all_access_monthly", name: "全方位月訂閱", enabled: true },
                { id: 7, code: "basic_membership_monthly", name: "基本自主學習會員", enabled: true }
            ],
            members: [{
                id: 19,
                name: "離校 AI 測試學生",
                email: "alumni@example.com",
                role: "student",
                class: null,
                membership: {
                    status: "expired",
                    is_active: true,
                    days_remaining: 30,
                    plan: { code: "all_access_monthly", name: "全方位月訂閱" },
                    effective_access: {
                        plan_codes: ["basic_membership_monthly", "ai_materials_addon_monthly"],
                        grants: [{
                            plan_code: "basic_membership_monthly",
                            plan_name: "基本自主學習會員"
                        }]
                    }
                }
            }],
            codes: [],
            books: [],
            email_settings: null
        });
    });

    it("hides legacy plans and summarizes members from effective access", async () => {
        render(<MembershipAdmin />);

        expect(await screen.findByText("離校 AI 測試學生")).toBeInTheDocument();
        expect(screen.queryByText("全方位月訂閱")).not.toBeInTheDocument();
        expect(screen.queryByText("all_access_monthly")).not.toBeInTheDocument();
        expect(screen.getAllByText("基本自主學習會員").length).toBeGreaterThan(0);
        expect(screen.getByText("使用中")).toBeInTheDocument();
        expect(screen.getByText("30 天")).toBeInTheDocument();
    });

    it("starts with member status, switches by keyboard and retains unsaved report fields", async () => {
        render(<MembershipAdmin />); await screen.findByText("離校 AI 測試學生");
        expect(screen.getByRole("tab", { name: "會員狀態" })).toHaveAttribute("aria-selected", "true");
        fireEvent.keyDown(screen.getByRole("tab", { name: "會員狀態" }), { key: "End" });
        expect(screen.getByRole("tab", { name: "家長週報" })).toHaveFocus();
        fireEvent.change(screen.getByLabelText("回覆 Email"), { target: { value: "draft@example.com" } });
        fireEvent.click(screen.getByRole("tab", { name: "會員狀態" }));
        fireEvent.click(screen.getByRole("tab", { name: "家長週報" }));
        expect(screen.getByLabelText("回覆 Email")).toHaveValue("draft@example.com");
    });
});
