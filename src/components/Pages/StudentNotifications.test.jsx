import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StudentNotifications from "./StudentNotifications";
import { useAuth } from "../../auth/AuthContext";
import { getStudentNotifications, markAllStudentNotificationsRead, markStudentNotificationRead } from "../../services/membershipService";
import { disableWebPush, enableWebPush, getCurrentWebPushStatus, getWebPushAvailability, getWebPushConfig } from "../../services/webPushService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/membershipService", () => ({
    getStudentNotifications: jest.fn(),
    markAllStudentNotificationsRead: jest.fn(),
    markStudentNotificationRead: jest.fn()
}));
jest.mock("../../services/webPushService", () => ({
    disableWebPush: jest.fn(), enableWebPush: jest.fn(),
    getCurrentWebPushStatus: jest.fn(), getWebPushAvailability: jest.fn(), getWebPushConfig: jest.fn()
}));

describe("StudentNotifications", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({ firebaseUser: { uid: "student-1" } });
        getStudentNotifications
            .mockResolvedValueOnce({
                notifications: [
                    { id: 8, title: "作業提醒", body: "今天有新的聽力作業", created_at: "2026-08-26T03:00:00.000Z", read_at: null },
                    { id: 7, title: "獎勵已入帳", body: "你獲得 20 XP", created_at: "2026-08-25T03:00:00.000Z", read_at: "2026-08-25T04:00:00.000Z" }
                ],
                has_more: true,
                next_before: "2026-08-25T03:00:00.000Z"
            })
            .mockResolvedValueOnce({
                notifications: [{ id: 6, title: "較早通知", body: "保留通知紀錄", created_at: "2026-08-24T03:00:00.000Z", read_at: null }],
                has_more: false,
                next_before: null
            });
        markStudentNotificationRead.mockResolvedValue({ success: true });
        markAllStudentNotificationsRead.mockResolvedValue({ success: true });
        getWebPushAvailability.mockReturnValue({ supported: false, reason: "此瀏覽器不支援" });
        getWebPushConfig.mockResolvedValue({ enabled: false });
        getCurrentWebPushStatus.mockResolvedValue({ supported: false, active: false });
        enableWebPush.mockResolvedValue();
        disableWebPush.mockResolvedValue();
    });

    it("shows all loaded notifications, marks one read, and loads earlier notifications", async () => {
        render(<MemoryRouter><StudentNotifications /></MemoryRouter>);

        expect(await screen.findByRole("heading", { name: "所有通知" })).toBeInTheDocument();
        expect(await screen.findByText("作業提醒")).toBeInTheDocument();
        expect(screen.getByText("獎勵已入帳")).toBeInTheDocument();
        expect(getStudentNotifications).toHaveBeenCalledWith({ uid: "student-1" }, { limit: 30 });

        fireEvent.click(screen.getByRole("button", { name: "標示已讀" }));
        await waitFor(() => expect(markStudentNotificationRead).toHaveBeenCalledWith({ uid: "student-1" }, 8));

        fireEvent.click(screen.getByRole("button", { name: "載入更早的通知" }));
        await waitFor(() => expect(getStudentNotifications).toHaveBeenLastCalledWith(
            { uid: "student-1" },
            { limit: 30, before: "2026-08-25T03:00:00.000Z" }
        ));
        expect(await screen.findByText("較早通知")).toBeInTheDocument();
    });

    it("announces read notifications so the navbar badge updates immediately", async () => {
        const readEvents = [];
        const listener = event => readEvents.push(event.detail.notificationIds);
        window.addEventListener("ae:notifications-read", listener);
        render(<MemoryRouter><StudentNotifications /></MemoryRouter>);

        await screen.findByText("作業提醒");
        fireEvent.click(screen.getByRole("button", { name: "全部標示已讀" }));

        await waitFor(() => expect(markAllStudentNotificationsRead).toHaveBeenCalledWith({ uid: "student-1" }));
        expect(readEvents).toContain("all");
        window.removeEventListener("ae:notifications-read", listener);
    });

    it("opens the related friends page when a social notification is clicked", async () => {
        getStudentNotifications.mockReset();
        getStudentNotifications.mockResolvedValue({
            notifications: [{
                id: 12,
                notification_type: "social",
                title: "新的好友邀請",
                body: "Amy 想加你為好友",
                metadata: { friendship_id: 5 },
                created_at: "2026-09-23T03:00:00.000Z",
                read_at: null
            }],
            has_more: false,
            next_before: null
        });

        render(
            <MemoryRouter initialEntries={["/student/notifications"]}>
                <Routes>
                    <Route path="/student/notifications" element={<StudentNotifications />} />
                    <Route path="/student/friends" element={<h1>好友與戰績</h1>} />
                </Routes>
            </MemoryRouter>
        );

        const notificationLink = await screen.findByRole("link", { name: /新的好友邀請/ });
        fireEvent.click(notificationLink);

        expect(await screen.findByRole("heading", { name: "好友與戰績" })).toBeInTheDocument();
        await waitFor(() => expect(markStudentNotificationRead).toHaveBeenCalledWith({ uid: "student-1" }, 12));
    });

    it("only enables device push after an explicit click and can turn it off", async () => {
        getWebPushAvailability.mockReturnValue({ supported: true, reason: "" });
        getWebPushConfig.mockResolvedValue({ enabled: true, public_key: "public-key" });
        getCurrentWebPushStatus
            .mockResolvedValueOnce({ supported: true, active: false })
            .mockResolvedValueOnce({ supported: true, active: true })
            .mockResolvedValueOnce({ supported: true, active: false });
        render(<MemoryRouter><StudentNotifications /></MemoryRouter>);
        const enable = await screen.findByRole("button", { name: "開啟此裝置推播" });
        await waitFor(() => expect(enable).toBeEnabled());
        expect(enableWebPush).not.toHaveBeenCalled();
        fireEvent.click(enable);
        await waitFor(() => expect(enableWebPush).toHaveBeenCalledWith({ uid: "student-1" }, "public-key"));
        const disable = await screen.findByRole("button", { name: "關閉此裝置推播" });
        fireEvent.click(disable);
        await waitFor(() => expect(disableWebPush).toHaveBeenCalledWith({ uid: "student-1" }));
    });
});
