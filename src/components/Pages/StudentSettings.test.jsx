import React from "react";
import { act, fireEvent, render as renderView, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import StudentSettings from "./StudentSettings";
import { useAuth } from "../../auth/AuthContext";
import { createSquareAvatarImage, getGamificationSummary, prepareAvatarImage, selectStudentAvatarPreset, uploadGamificationImage } from "../../services/gamificationService";
import {
    confirmGuardianEmailVerification,
    requestGuardianEmailVerification,
    updateStudentProfile
} from "../../services/membershipService";
import { loadStudentCommerceProfile } from "../../services/commerceService";
import { getNicknameSettings, updateNickname } from "../../services/studentSocialService";
import { disableWebPush, enableWebPush, getCurrentWebPushStatus, getWebPushAvailability, getWebPushConfig } from "../../services/webPushService";
import { clearStudentPageCache, invalidateStudentPageCache } from "../../services/studentPageCache";

const render = element => renderView(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{element}</MemoryRouter>);

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("./StudentProgressOverview", () => () => null);
jest.mock("../../services/gamificationService", () => ({
    getGamificationSummary: jest.fn(),
    createSquareAvatarImage: jest.fn(),
    prepareAvatarImage: jest.fn(),
    selectStudentAvatarPreset: jest.fn(),
    uploadGamificationImage: jest.fn()
}));
jest.mock("../../services/membershipService", () => ({
    confirmGuardianEmailVerification: jest.fn(),
    requestGuardianEmailVerification: jest.fn(),
    updateStudentProfile: jest.fn()
}));
jest.mock("../../services/commerceService", () => ({
    loadStudentCommerceProfile: jest.fn()
}));
jest.mock("../../services/studentSocialService", () => ({
    getNicknameSettings: jest.fn(),
    updateNickname: jest.fn()
}));
jest.mock("../../services/webPushService", () => ({
    disableWebPush: jest.fn(), enableWebPush: jest.fn(),
    getCurrentWebPushStatus: jest.fn(), getWebPushAvailability: jest.fn(), getWebPushConfig: jest.fn()
}));

describe("StudentSettings", () => {
    const setStudentProfile = jest.fn();
    const refreshStudentProfile = jest.fn();

    beforeEach(() => {
        clearStudentPageCache();
        localStorage.clear();
        jest.clearAllMocks();
        getWebPushAvailability.mockReturnValue({ supported: false, reason: "此裝置不支援推播" });
        getWebPushConfig.mockResolvedValue({ enabled: false });
        getCurrentWebPushStatus.mockResolvedValue({ supported: false, active: false });
        enableWebPush.mockResolvedValue();
        disableWebPush.mockResolvedValue();
        Object.defineProperty(window, "PointerEvent", { configurable: true, writable: true, value: MouseEvent });
        Object.defineProperty(URL, "createObjectURL", { writable: true, value: jest.fn(() => "blob:avatar-preview") });
        Object.defineProperty(URL, "revokeObjectURL", { writable: true, value: jest.fn() });
        useAuth.mockReturnValue({
            firebaseUser: { uid: "student-1" },
            role: "student",
            setStudentProfile,
            refreshStudentProfile,
            studentProfile: {
                name: "王小明",
                chinese_name: "王小明",
                english_name: "Ming Wang",
                class: "E5",
                learner_type: "academy_student",
                date_of_birth: "2015-05-12",
                membership: { effective_access: { plan_codes: ["academy_internal"], features: { ai_materials: true, pronunciation: true } } }
            }
        });
        getGamificationSummary.mockResolvedValue({
            profile: { avatar_url: null },
            balance: { level: 3, total_xp: 390, points_balance: 21, next_level_xp: 600, progress_percent: 30 }
        });
        loadStudentCommerceProfile.mockResolvedValue({
            profile: {
                enrollment_status: "active",
                current_enrollment: { enrolled_at: "2025-09-01" },
                enrollment_history: [],
                direct_entitlements: [],
                class_books: [],
                plans: [],
                guardian: {
                    email: "parent@example.com",
                    email_verified_at: "2026-09-01T00:00:00Z"
                }
            }
        });
        getNicknameSettings.mockResolvedValue({
            profile: { nickname: "Sunny Fox" },
            nickname_history: [{
                id: 1,
                previous_nickname: null,
                new_nickname: "Sunny Fox",
                change_source: "student_settings",
                changed_at: "2026-09-18T02:00:00Z"
            }]
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

    it("the profile page shows the picture and nickname only; notifications and account links live elsewhere", async () => {
        render(<StudentSettings view="profile" />);

        expect(await screen.findByRole("heading", { name: "個人資料" })).toBeInTheDocument();
        expect(screen.getByText(/Ming Wang/)).toBeInTheDocument();
        expect(screen.queryByText(/AI Premium/)).not.toBeInTheDocument();
        expect(screen.queryByText(/支援 JPG/)).not.toBeInTheDocument();
        expect(screen.queryByRole("switch", { name: "手機推播通知" })).not.toBeInTheDocument();
        ["帳號與密碼", "會員與功能", "聯絡客服"].forEach(name => expect(screen.queryByRole("link", { name })).not.toBeInTheDocument());
        for (const removed of ["成長與獎品", "教材與方案", "個人資料與紀錄", "基本資料", "出生年月日", "暱稱更改紀錄", "2015-05-12"]) {
            expect(screen.queryByText(removed)).not.toBeInTheDocument();
        }
    });

    it("keeps profile settings usable when growth data fails", async () => {
        getGamificationSummary.mockRejectedValue(new Error("讀取失敗"));
        render(<StudentSettings view="profile" />);
        await waitFor(() => expect(screen.getByLabelText("公開暱稱")).toHaveValue("Sunny Fox"));
        expect(screen.getByRole("button", { name: "更換學生頭像" })).toBeEnabled();
        expect(screen.queryByText("0 P")).not.toBeInTheDocument();
    });

    it("allows the student to change a nickname after confirming", async () => {
        const savedSettings = {
            profile: { nickname: "Brave Owl" },
            nickname_history: [
                {
                    id: 2,
                    previous_nickname: "Sunny Fox",
                    new_nickname: "Brave Owl",
                    change_source: "student_settings",
                    changed_at: "2026-09-18T03:00:00Z"
                },
                {
                    id: 1,
                    previous_nickname: null,
                    new_nickname: "Sunny Fox",
                    change_source: "student_settings",
                    changed_at: "2026-09-18T02:00:00Z"
                }
            ]
        };
        updateNickname.mockImplementation(async () => {
            getNicknameSettings.mockResolvedValue(savedSettings);
            return savedSettings;
        });
        render(<StudentSettings view="profile" />);

        const nicknameInput = await screen.findByLabelText("公開暱稱");
        await waitFor(() => expect(nicknameInput).toHaveValue("Sunny Fox"));
        expect(nicknameInput.closest(".student-settings-profile-card")).not.toBeNull();
        expect(screen.getByText("每 7 天可以改一次")).toBeInTheDocument();
        fireEvent.change(nicknameInput, { target: { value: "Brave Owl" } });
        fireEvent.click(screen.getByRole("button", { name: "儲存暱稱" }));
        expect(updateNickname).not.toHaveBeenCalled();
        expect(await screen.findByRole("alertdialog", { name: "確認修改公開暱稱" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "確認修改暱稱" }));

        await waitFor(() => expect(updateNickname).toHaveBeenCalledWith(
            { uid: "student-1" },
            "Brave Owl"
        ));
        await waitFor(() => expect(nicknameInput).toHaveValue("Brave Owl"));
        expect(screen.getByRole("heading", { name: "Brave Owl" })).toBeInTheDocument();
        expect(setStudentProfile).toHaveBeenCalled();
    });

    it("disables nickname editing and shows a live seven-day cooldown countdown", async () => {
        const availableAt = new Date(Date.now() + (2 * 24 * 60 * 60 * 1000) + (3 * 60 * 60 * 1000)).toISOString();
        getNicknameSettings.mockResolvedValue({
            profile: { nickname: "Brave Owl" },
            nickname_history: [{
                id: 2,
                previous_nickname: "Sunny Fox",
                new_nickname: "Brave Owl",
                change_source: "student_settings",
                changed_at: new Date(Date.now() - (4 * 24 * 60 * 60 * 1000) - (21 * 60 * 60 * 1000)).toISOString()
            }],
            nickname_change_available_at: availableAt
        });

        render(<StudentSettings view="profile" />);

        const nicknameInput = await screen.findByLabelText("公開暱稱");
        await waitFor(() => expect(nicknameInput).toHaveValue("Brave Owl"));
        expect(nicknameInput).toBeDisabled();
        expect(screen.getByRole("button", { name: "暫時無法改名" })).toBeDisabled();
        expect(screen.getByText(/距離下次修改還有/)).toHaveTextContent(/2 天 3 小時/);
        expect(screen.getByText(/可於台灣時間/)).toBeInTheDocument();
    });

    it("replaces the mobile browser Load failed message with a useful nickname error", async () => {
        getNicknameSettings.mockRejectedValue(new TypeError("Load failed"));

        render(<StudentSettings view="profile" />);

        expect(await screen.findByText("暱稱服務暫時無法連線，請確認網路後重新整理再試")).toBeInTheDocument();
        expect(screen.queryByText("Load failed")).not.toBeInTheDocument();
    });

    it("keeps the verified guardian email until the replacement code succeeds", async () => {
        requestGuardianEmailVerification.mockResolvedValue({
            request_id: 88,
            masked_email: "n***@example.com"
        });
        confirmGuardianEmailVerification.mockResolvedValue({ success: true });
        render(<StudentSettings view="notifications" />);

        expect(await screen.findByText("parent@example.com · 已驗證")).toBeInTheDocument();
        fireEvent.click(screen.getByText("家長 Email"));
        fireEvent.change(screen.getByLabelText("新的家長 Email"), {
            target: { value: "new-parent@example.com" }
        });
        fireEvent.click(screen.getByRole("button", { name: "寄送驗證碼" }));

        await waitFor(() => expect(requestGuardianEmailVerification).toHaveBeenCalledWith(
            { uid: "student-1" },
            "new-parent@example.com"
        ));
        expect(screen.getByText("parent@example.com · 已驗證")).toBeInTheDocument();
        fireEvent.change(await screen.findByLabelText("6 位數驗證碼"), { target: { value: "123456" } });
        fireEvent.click(screen.getByRole("button", { name: "確認驗證碼並更新" }));
        await waitFor(() => expect(confirmGuardianEmailVerification).toHaveBeenCalledWith(
            { uid: "student-1" },
            88,
            "123456"
        ));
        expect(refreshStudentProfile).toHaveBeenCalled();
    });

    it("requires final confirmation before applying one of twenty-five preset avatars", async () => {
        render(<StudentSettings view="profile" />);
        await screen.findByRole("heading", { name: "個人資料" });
        fireEvent.click(screen.getByText("選擇預設頭像"));
        const presets = screen.getByText("選擇預設頭像").closest("details");
        presets.open = true;
        fireEvent(presets, new Event("toggle"));

        expect(screen.getAllByRole("button", { name: /使用.+頭像/ })).toHaveLength(25);
        expect(screen.getByRole("button", { name: "使用好奇科學家頭像" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "使用藍光機器人頭像" })).toBeInTheDocument();
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
        await waitFor(() => expect(JSON.parse(localStorage.getItem("ae-userimage"))).toEqual(expect.objectContaining({
            ownerUid: "student-1",
            displayUrl: "/default-avatars/alan-owl.png"
        })));
        expect(setStudentProfile).toHaveBeenCalledWith(expect.objectContaining({
            avatar_url: "/default-avatars/alan-owl.png",
            user_image: "/default-avatars/alan-owl.png"
        }));
    });

    it("opens a square avatar adjustment window before uploading", async () => {
        const { container } = render(<StudentSettings view="profile" />);
        await screen.findByRole("heading", { name: "個人資料" });

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

    it("lets a student enable and disable device push later from settings", async () => {
        getWebPushAvailability.mockReturnValue({ supported: true, reason: "" });
        getWebPushConfig.mockResolvedValue({ enabled: true, public_key: "public-key" });
        getCurrentWebPushStatus
            .mockResolvedValueOnce({ supported: true, active: false })
            .mockResolvedValueOnce({ supported: true, active: true })
            .mockResolvedValueOnce({ supported: true, active: false });
        render(<StudentSettings view="notifications" />);

        const toggle = screen.getByRole("switch", { name: "手機推播通知" });
        await waitFor(() => expect(toggle).toBeEnabled());
        expect(toggle).toHaveAttribute("aria-checked", "false");
        expect(enableWebPush).not.toHaveBeenCalled();
        fireEvent.click(toggle);
        await waitFor(() => expect(enableWebPush).toHaveBeenCalledWith({ uid: "student-1" }, "public-key"));

        await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
        await waitFor(() => expect(toggle).toBeEnabled());
        fireEvent.click(toggle);
        await waitFor(() => expect(disableWebPush).toHaveBeenCalledWith({ uid: "student-1" }));
    });

    it("reuses commerce and nickname data immediately when returning", async () => {
        const first = render(<StudentSettings view="notifications" />);
        await screen.findByText("parent@example.com · 已驗證");
        await waitFor(() => expect(getNicknameSettings).toHaveBeenCalled());
        await act(async () => {});
        first.unmount();
        // The profile page opens from the same cached data, with nothing refetched.
        const second = render(<StudentSettings view="profile" />);
        expect(screen.getByLabelText("公開暱稱")).toHaveValue("Sunny Fox");
        second.unmount();
        render(<StudentSettings view="notifications" />);
        expect(screen.getByText("parent@example.com · 已驗證")).toBeInTheDocument();
        await act(async () => {});
        expect(getGamificationSummary).toHaveBeenCalledTimes(1);
        expect(loadStudentCommerceProfile).toHaveBeenCalledTimes(1);
        expect(getNicknameSettings).toHaveBeenCalledTimes(1);
    });

    it("restores snapshots on reload without persisting guardian contact details", async () => {
        const first = render(<StudentSettings view="notifications" />);
        await screen.findByText("parent@example.com · 已驗證");
        await waitFor(() => expect(getGamificationSummary).toHaveBeenCalled());
        await waitFor(() => expect(getNicknameSettings).toHaveBeenCalled());
        await act(async () => {});
        first.unmount();
        const records = Object.keys(localStorage).filter(key => key.startsWith("ae-student-pages-v1:")).map(key => [key, localStorage.getItem(key)]);
        expect(records.length).toBe(3);
        expect(JSON.stringify(records)).not.toContain("parent@example.com");
        clearStudentPageCache();
        records.forEach(([key, value]) => localStorage.setItem(key, value));
        getGamificationSummary.mockImplementation(() => new Promise(() => {}));
        loadStudentCommerceProfile.mockImplementation(() => new Promise(() => {}));
        getNicknameSettings.mockImplementation(() => new Promise(() => {}));
        const restored = render(<StudentSettings view="profile" />);
        expect(screen.getByLabelText("公開暱稱")).toHaveValue("Sunny Fox");
        restored.unmount();
        render(<StudentSettings view="notifications" />);
        expect(screen.queryByText(/parent@example.com/)).not.toBeInTheDocument();
        await act(async () => {});
        expect(loadStudentCommerceProfile).toHaveBeenCalledTimes(2);
    });

    it("keeps cached data after a network failure but clears a forbidden commerce response", async () => {
        render(<StudentSettings view="notifications" />);
        await screen.findByText("parent@example.com · 已驗證");
        loadStudentCommerceProfile.mockRejectedValue(new Error("offline"));
        act(() => invalidateStudentPageCache("student-1", ["settings:commerce"]));
        await screen.findByText(/部分設定暫時無法更新/);
        expect(screen.getByText("parent@example.com · 已驗證")).toBeInTheDocument();
        loadStudentCommerceProfile.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
        fireEvent.click(screen.getByRole("button", { name: "重新讀取設定" }));
        await waitFor(() => expect(screen.queryByText("parent@example.com · 已驗證")).not.toBeInTheDocument());
    });

    it("does not overwrite a nickname being edited when background data arrives", async () => {
        let finish;
        getNicknameSettings.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        render(<StudentSettings view="profile" />);
        const input = screen.getByLabelText("公開暱稱");
        fireEvent.change(input, { target: { value: "My New Name" } });
        await act(async () => finish({ profile: { nickname: "Previous Name" }, nickname_history: [] }));
        expect(input).toHaveValue("My New Name");
    });

    it("keeps the guardian email draft when its row is collapsed and reopened, without refetching", async () => {
        render(<StudentSettings view="notifications" />);
        await screen.findByText("家長 Email");
        await waitFor(() => expect(getNicknameSettings).toHaveBeenCalled());
        await act(async () => {});
        const calls = [getGamificationSummary.mock.calls.length, loadStudentCommerceProfile.mock.calls.length, getNicknameSettings.mock.calls.length, getCurrentWebPushStatus.mock.calls.length];
        const summary = screen.getByText("家長 Email").closest("summary");
        expect(summary.closest("details")).not.toHaveAttribute("open");
        fireEvent.click(summary);
        expect(summary.closest("details")).toHaveAttribute("open");
        fireEvent.change(screen.getByLabelText("新的家長 Email"), { target: { value: "draft@example.com" } });
        fireEvent.click(summary);
        expect(screen.getByLabelText("新的家長 Email")).not.toBeVisible();
        fireEvent.click(summary);
        expect(screen.getByLabelText("新的家長 Email")).toHaveValue("draft@example.com");
        expect([getGamificationSummary.mock.calls.length, loadStudentCommerceProfile.mock.calls.length, getNicknameSettings.mock.calls.length, getCurrentWebPushStatus.mock.calls.length]).toEqual(calls);
        expect(requestGuardianEmailVerification).not.toHaveBeenCalled();
    });

    it("loads preset thumbnails only after expanding the picker", async () => {
        const { container } = render(<StudentSettings view="profile" />);
        expect(container.querySelectorAll(".student-settings-avatar-preset-image img")).toHaveLength(0);
        const presets = screen.getByText("選擇預設頭像").closest("details");
        presets.open = true;
        fireEvent(presets, new Event("toggle"));
        const images = container.querySelectorAll(".student-settings-avatar-preset-image img");
        expect(images).toHaveLength(25);
        images.forEach(image => {
            expect(image.getAttribute("src")).toMatch(/^\/default-avatars\/thumbs-v1\/.+\.webp$/);
            expect(image).toHaveAttribute("loading", "lazy");
        });
        await act(async () => {});
    });

    it("我的進度 shows learning only: no picture, nickname or notification settings", async () => {
        render(<StudentSettings />);
        expect(await screen.findByRole("heading", { name: "我的進度" })).toBeInTheDocument();
        expect(screen.queryByRole("switch", { name: "手機推播通知" })).not.toBeInTheDocument();
        expect(screen.queryByText("選擇預設頭像")).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "個人資料" })).not.toBeInTheDocument();
    });

    it("通知設定 is its own page with push and the parent e-mail, and no profile card", async () => {
        render(<StudentSettings view="notifications" />);
        expect(await screen.findByRole("heading", { name: "通知設定" })).toBeInTheDocument();
        expect(screen.getByRole("switch", { name: "手機推播通知" })).toBeInTheDocument();
        expect(screen.getByText("家長 Email")).toBeInTheDocument();
        expect(screen.queryByText("選擇預設頭像")).not.toBeInTheDocument();
    });
});
