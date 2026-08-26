import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import StudentNotifications from "./StudentNotifications";
import { useAuth } from "../../auth/AuthContext";
import { getStudentNotifications, markStudentNotificationRead } from "../../services/membershipService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/membershipService", () => ({
    getStudentNotifications: jest.fn(),
    markStudentNotificationRead: jest.fn()
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
});
