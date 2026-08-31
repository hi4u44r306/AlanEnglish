import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
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
});
