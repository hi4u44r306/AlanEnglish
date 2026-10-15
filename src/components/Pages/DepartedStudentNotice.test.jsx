import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getMembershipProfile, getPublicPlans } from "../../services/membershipService";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import MembershipCenter from "./MembershipCenter";
import DepartedStudentNotice from "./DepartedStudentNotice";

jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../../services/authEmailService", () => ({ sendBrandedVerificationEmail: jest.fn() }));
jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/billingService", () => ({ createBillingPortal: jest.fn(), createCheckoutSession: jest.fn() }));
jest.mock("../../services/membershipService", () => ({
    getMembershipProfile: jest.fn(), getPublicPlans: jest.fn(), redeemActivationCode: jest.fn()
}));
jest.mock("../../services/contentAccessService", () => ({ getAccessibleCatalog: jest.fn() }));

const renderCenter = () => render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><MembershipCenter /></MemoryRouter>
);
const departedProfile = membership => ({
    profile: { learner_type: "academy_student", role: "student", membership: { effective_access: { learner_type: "academy_student", plan_codes: [], grants: [] }, ...membership } }
});

describe("DepartedStudentNotice", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({ firebaseUser: { email: "alumni@example.com" }, setStudentProfile: jest.fn() });
        getPublicPlans.mockResolvedValue({ plans: [] });
        getAccessibleCatalog.mockResolvedValue({ books: [] });
    });

    it("tells a departed student the account stays, what is kept, what stops and how to continue", () => {
        render(<MemoryRouter><DepartedStudentNotice /></MemoryRouter>);

        expect(screen.getByRole("heading", { name: "你已經離開英文班，帳號會一直保留" })).toBeInTheDocument();
        expect(screen.getByText(/XP、等級與在校期間累積的進度/)).toBeInTheDocument();
        expect(screen.getByText("新的班級作業與點名")).toBeInTheDocument();
        expect(screen.getByText(/每月 NT\$299/)).toBeInTheDocument();
        // 線上扣款目前關閉：不叫學生自己付款，改引導聯絡客服。
        expect(screen.getByRole("link", { name: "聯絡客服" })).toHaveAttribute("href", "/support");
        expect(screen.getByText(/是否續用完全由你和家長決定/)).toBeInTheDocument();
    });

    it("shows on the membership page for a departed student without an active membership", async () => {
        getMembershipProfile.mockResolvedValue(departedProfile({ status: "expired", is_active: false, access_ends_at: "2026-08-30T00:00:00.000Z" }));
        renderCenter();
        expect(await screen.findByRole("heading", { name: "你已經離開英文班，帳號會一直保留" })).toBeInTheDocument();
    });

    it("stays hidden while the alumnus has an active self-study membership", async () => {
        getMembershipProfile.mockResolvedValue(departedProfile({
            status: "active", is_active: true, current_period_end: "2027-01-15T00:00:00.000Z",
            effective_access: { learner_type: "academy_student", plan_codes: ["basic_membership_monthly"], grants: [{ plan_code: "basic_membership_monthly", plan_name: "基本自主學習會員", source: "stripe", ends_at: "2027-01-15T00:00:00.000Z" }] }
        }));
        renderCenter();
        expect(await screen.findByText("英文班離校生")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "你已經離開英文班，帳號會一直保留" })).not.toBeInTheDocument();
    });

    it("never shows for ordinary members or active academy students", async () => {
        getMembershipProfile.mockResolvedValue({ profile: { learner_type: "textbook_customer", role: "student", membership: { status: "expired", is_active: false, effective_access: { learner_type: "textbook_customer", plan_codes: [], grants: [] } } } });
        renderCenter();
        expect(await screen.findByText("一般會員")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "你已經離開英文班，帳號會一直保留" })).not.toBeInTheDocument();
    });
});
