import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import StudentSettings from "./StudentSettings";
import { useAuth } from "../../auth/AuthContext";
import { createSquareAvatarImage, getGamificationSummary, prepareAvatarImage, selectStudentAvatarPreset, uploadGamificationImage } from "../../services/gamificationService";
import { updateStudentProfile } from "../../services/membershipService";
import { loadStudentCommerceProfile } from "../../services/commerceService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/gamificationService", () => ({
    getGamificationSummary: jest.fn(),
    createSquareAvatarImage: jest.fn(),
    prepareAvatarImage: jest.fn(),
    selectStudentAvatarPreset: jest.fn(),
    uploadGamificationImage: jest.fn()
}));
jest.mock("../../services/membershipService", () => ({
    updateStudentProfile: jest.fn()
}));
jest.mock("../../services/commerceService", () => ({
    loadStudentCommerceProfile: jest.fn()
}));

describe("StudentSettings", () => {
    const setStudentProfile = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(window, "PointerEvent", { configurable: true, writable: true, value: MouseEvent });
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
        loadStudentCommerceProfile.mockResolvedValue({
            profile: {
                enrollment_status: "active",
                current_enrollment: { enrolled_at: "2025-09-01" },
                enrollment_history: [],
                direct_entitlements: [],
                class_books: [],
                plans: []
            }
        });
    });

    const firePointerEvent = (target, type, properties) => {
        const event = new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: properties.clientX,
            clientY: properties.clientY
        });
        Object.defineProperties(event, {
            pointerId: { value: properties.pointerId },
            pointerType: { value: properties.pointerType }
        });
        fireEvent(target, event);
    };

    it("shows student profile, protected learning honors, and birthday controls", async () => {
        render(<StudentSettings />);

        expect(await screen.findByRole("heading", { name: "我的設定" })).toBeInTheDocument();
        expect(screen.getByText("Ming Wang")).toBeInTheDocument();
        expect(await screen.findByText("Lv.3")).toBeInTheDocument();
        expect(screen.getByText("390 XP")).toBeInTheDocument();
        expect(screen.getByText("AI PREMIUM 已啟用")).toBeInTheDocument();

        expect(screen.queryByDisplayValue("2015-05-12")).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("出生月"), { target: { value: "06" } });
        fireEvent.change(screen.getByLabelText("出生日"), { target: { value: "01" } });
        updateStudentProfile.mockResolvedValue({ profile: { date_of_birth: "2015-06-01" } });
        fireEvent.click(screen.getByRole("button", { name: "儲存生日資料" }));

        await waitFor(() => expect(updateStudentProfile).toHaveBeenCalledWith(
            { uid: "student-1" },
            { date_of_birth: "2015-06-01" }
        ));
    });

    it("recognizes the general-member AI add-on as AI Premium", async () => {
        useAuth.mockReturnValue({
            firebaseUser: { uid: "student-2" },
            setStudentProfile,
            studentProfile: {
                name: "林小美",
                learner_type: "textbook_customer",
                membership: {
                    effective_access: {
                        plan_codes: ["basic_membership_monthly", "ai_materials_general_monthly"],
                        features: { ai_materials: true }
                    }
                }
            }
        });

        render(<StudentSettings />);

        expect(await screen.findByText("AI PREMIUM 已啟用")).toBeInTheDocument();
        expect(screen.getByText("AI 教材與發音練習可使用")).toBeInTheDocument();
    });

    it("shows the latest departure and excludes historical academy access from paid plans", async () => {
        loadStudentCommerceProfile.mockResolvedValue({
            profile: {
                enrollment_status: "departed",
                current_enrollment: null,
                enrollment_history: [{ enrolled_at: "2025-09-01", departed_at: "2026-08-31" }],
                direct_entitlements: [],
                class_books: [],
                plans: [
                    { id: 1, status: "expired", ends_at: "2026-09-01T00:00:00Z", subscription_plans: { code: "academy_internal", name: "英文班在學方案" } },
                    { id: 2, status: "active", current_period_end: "2026-09-30T00:00:00Z", subscription_plans: { code: "basic_membership_monthly", name: "基本自主學習會員" } },
                    { id: 3, status: "active", current_period_end: "2026-09-30T00:00:00Z", subscription_plans: { code: "ai_materials_addon_monthly", name: "舊 AI 方案名稱" } }
                ]
            }
        });

        render(<StudentSettings />);

        expect(await screen.findByText("離校")).toBeInTheDocument();
        expect(screen.getByText("2026-08-31")).toBeInTheDocument();
        expect(screen.queryByText("英文班在學方案")).not.toBeInTheDocument();
        expect(screen.getByText("基本自主學習會員")).toBeInTheDocument();
        expect(screen.getAllByText("AI 教材與發音練習")).toHaveLength(2);
        expect(screen.getAllByText("續訂日 2026-09-30")).toHaveLength(2);
    });

    it("does not label an expired paid grant as renewing", async () => {
        loadStudentCommerceProfile.mockResolvedValue({
            profile: {
                enrollment_status: "departed",
                enrollment_history: [{ departed_at: "2026-08-31" }],
                direct_entitlements: [],
                class_books: [],
                plans: [{
                    id: 4,
                    status: "expired",
                    current_period_end: "2026-08-30T00:00:00Z",
                    subscription_plans: { code: "basic_membership_monthly", name: "基本自主學習會員" }
                }]
            }
        });

        render(<StudentSettings />);

        expect(await screen.findByText("已結束（2026-08-30）")).toBeInTheDocument();
        expect(screen.queryByText("續訂日 2026-08-30")).not.toBeInTheDocument();
    });

    it("requires final confirmation before applying one of five preset avatars", async () => {
        render(<StudentSettings />);
        await screen.findByRole("heading", { name: "我的設定" });

        expect(screen.getAllByRole("button", { name: /使用.+頭像/ })).toHaveLength(5);
        selectStudentAvatarPreset.mockResolvedValue({
            path: "/default-avatars/alan-owl.png",
            image_url: "/default-avatars/alan-owl.png"
        });
        fireEvent.click(screen.getByRole("button", { name: "使用智慧貓頭鷹頭像" }));

        expect(await screen.findByRole("alertdialog", { name: "確認更換頭像" })).toBeInTheDocument();
        expect(screen.getByAltText("即將套用的智慧貓頭鷹頭像")).toBeInTheDocument();
        expect(selectStudentAvatarPreset).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "取消" }));
        expect(selectStudentAvatarPreset).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "使用智慧貓頭鷹頭像" }));
        fireEvent.click(screen.getByRole("button", { name: "確認更換頭像" }));
        await waitFor(() => expect(selectStudentAvatarPreset).toHaveBeenCalledWith(
            { uid: "student-1" },
            "/default-avatars/alan-owl.png"
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

        const preview = screen.getByAltText("頭像裁切預覽");
        Object.defineProperty(preview, "naturalWidth", { configurable: true, value: 1000 });
        Object.defineProperty(preview, "naturalHeight", { configurable: true, value: 700 });
        fireEvent.load(preview);
        await waitFor(() => expect(preview.style.width).toBe("400px"));
        const cropCanvas = container.querySelector(".student-avatar-crop-canvas");
        cropCanvas.setPointerCapture = jest.fn();
        firePointerEvent(cropCanvas, "pointerdown", { pointerId: 7, pointerType: "touch", clientX: 80, clientY: 120 });
        expect(cropCanvas.setPointerCapture).toHaveBeenCalledWith(7);
        firePointerEvent(cropCanvas, "pointermove", { pointerId: 7, pointerType: "touch", clientX: 120, clientY: 170 });
        await waitFor(() => expect(preview.style.left).toBe("calc(50% + 40px)"));
        firePointerEvent(cropCanvas, "pointerup", { pointerId: 7, pointerType: "touch", clientX: 120, clientY: 170 });
        createSquareAvatarImage.mockResolvedValue(file);
        prepareAvatarImage.mockResolvedValue(file);
        uploadGamificationImage.mockResolvedValue({ path: "avatars/student-1.webp", image_url: "https://example.com/avatar.webp" });
        fireEvent.click(screen.getByRole("button", { name: "預覽並確認" }));

        await waitFor(() => expect(createSquareAvatarImage).toHaveBeenCalledWith(file, expect.objectContaining({ previewSize: 280, zoom: 1, offsetX: 40, offsetY: 0 })));
        expect(await screen.findByRole("alertdialog", { name: "確認更換頭像" })).toBeInTheDocument();
        expect(uploadGamificationImage).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "返回調整" }));
        expect(uploadGamificationImage).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog", { name: "調整正方形頭像" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "預覽並確認" }));
        await screen.findByRole("alertdialog", { name: "確認更換頭像" });
        fireEvent.click(screen.getByRole("button", { name: "確認更換頭像" }));
        await waitFor(() => expect(uploadGamificationImage).toHaveBeenCalledWith(
            { uid: "student-1" },
            "avatar",
            file
        ));

        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
        fireEvent.click(screen.getByRole("button", { name: "關閉頭像調整視窗" }));
        expect(screen.queryByRole("dialog", { name: "調整正方形頭像" })).not.toBeInTheDocument();
    });
});
