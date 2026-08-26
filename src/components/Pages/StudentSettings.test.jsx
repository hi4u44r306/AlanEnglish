import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import StudentSettings from "./StudentSettings";
import { useAuth } from "../../auth/AuthContext";
import { getGamificationSummary } from "../../services/gamificationService";
import { getStudentNotifications, updateStudentProfile } from "../../services/membershipService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/gamificationService", () => ({
    getGamificationSummary: jest.fn(),
    createSquareAvatarImage: jest.fn(),
    prepareAvatarImage: jest.fn(),
    uploadGamificationImage: jest.fn()
}));
jest.mock("../../services/membershipService", () => ({
    getStudentNotifications: jest.fn(),
    markStudentNotificationRead: jest.fn(),
    updateStudentProfile: jest.fn()
}));

describe("StudentSettings", () => {
    const setStudentProfile = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(URL, "createObjectURL", { writable: true, value: jest.fn(() => "blob:avatar-preview") });
        Object.defineProperty(URL, "revokeObjectURL", { writable: true, value: jest.fn() });
        useAuth.mockReturnValue({
            firebaseUser: { uid: "student-1" },
            setStudentProfile,
            studentProfile: {
                name: "王小明",
                chinese_name: "王小明",
                english_name: "Ming Wang",
                class: "E5",
                learner_type: "academy_student",
                date_of_birth: "2015-05-12",
                membership: { effective_access: { plan_codes: ["ai_materials_addon_monthly"], features: { ai_materials: true } } }
            }
        });
        getGamificationSummary.mockResolvedValue({
            profile: { avatar_url: null },
            balance: { level: 3, total_xp: 390, points_balance: 21 }
        });
        getStudentNotifications.mockResolvedValue({ notifications: [] });
    });

    it("shows student profile, protected learning honors, and birthday controls", async () => {
        render(<StudentSettings />);

        expect(await screen.findByRole("heading", { name: "我的設定" })).toBeInTheDocument();
        expect(screen.getByText("Ming Wang")).toBeInTheDocument();
        expect(await screen.findByText("Lv.3")).toBeInTheDocument();
        expect(screen.getByText("390 XP")).toBeInTheDocument();
        expect(screen.getByText("AI PREMIUM 已啟用")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("出生年月日"), { target: { value: "2015-06-01" } });
        updateStudentProfile.mockResolvedValue({ profile: { date_of_birth: "2015-06-01" } });
        fireEvent.click(screen.getByRole("button", { name: "儲存生日資料" }));

        await waitFor(() => expect(updateStudentProfile).toHaveBeenCalledWith(
            { uid: "student-1" },
            { date_of_birth: "2015-06-01" }
        ));
    });

    it("opens a square avatar adjustment window before uploading", async () => {
        const { container } = render(<StudentSettings />);
        await screen.findByRole("heading", { name: "我的設定" });

        const file = new File(["avatar"], "avatar.png", { type: "image/png" });
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });

        expect(screen.getByRole("dialog", { name: "調整正方形頭像" })).toBeInTheDocument();
        expect(screen.getByText("拖移照片")).toBeInTheDocument();
        expect(screen.getByLabelText("頭像縮放")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "關閉頭像調整視窗" }));
        expect(screen.queryByRole("dialog", { name: "調整正方形頭像" })).not.toBeInTheDocument();
    });
});
