import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "../../auth/AuthContext";
import { blockStudent, getSocialOverview, searchStudents, sendFriendRequest, updateSocialProfile } from "../../services/studentSocialService";
import StudentFriends from "./StudentFriends";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/studentSocialService", () => ({
    blockStudent: jest.fn(),
    getSocialOverview: jest.fn(),
    removeFriend: jest.fn(),
    reportStudent: jest.fn(),
    respondFriendRequest: jest.fn(),
    searchStudents: jest.fn(),
    sendFriendRequest: jest.fn(),
    sendSocialHeartbeat: jest.fn(() => Promise.resolve({ success: true })),
    unblockStudent: jest.fn(),
    updateSocialProfile: jest.fn()
}));

const firebaseUser = { uid: "student-1" };
const setStudentProfile = jest.fn();
const readyOverview = {
    profile: { student_id: 1, nickname: "Alan Fox", friend_code: "AE-ABCDEFGH", presence: "online", stats: { level: 3, total_xp: 300 } },
    settings: { stats_visibility: "friends", presence_visibility: "friends" },
    friends: [],
    incoming_requests: [],
    outgoing_requests: [],
    blocked: []
};

describe("StudentFriends", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({ firebaseUser, setStudentProfile });
        getSocialOverview.mockResolvedValue(readyOverview);
    });

    it("asks a new student to create a safe nickname before searching", async () => {
        getSocialOverview.mockResolvedValueOnce({ ...readyOverview, profile: null, settings: null });
        updateSocialProfile.mockResolvedValue({ success: true });
        render(<StudentFriends />);

        expect(await screen.findByRole("heading", { name: "先建立你的暱稱" })).toBeTruthy();
        expect(screen.queryByRole("heading", { name: "尋找好友" })).toBeNull();
        fireEvent.change(screen.getByLabelText("公開暱稱"), { target: { value: "Alan Fox" } });
        fireEvent.click(screen.getByRole("button", { name: "建立暱稱" }));

        await waitFor(() => expect(updateSocialProfile).toHaveBeenCalledWith(firebaseUser, {
            nickname: "Alan Fox",
            stats_visibility: "friends",
            presence_visibility: "friends"
        }));
    });

    it("blocks an unsuitable nickname before sending it to the service", async () => {
        render(<StudentFriends />);

        await screen.findByText("AE-ABCDEFGH");
        fireEvent.change(screen.getByLabelText("公開暱稱"), { target: { value: "色情測試" } });
        fireEvent.click(screen.getByRole("button", { name: "儲存設定" }));

        expect((await screen.findByRole("alert")).textContent).toContain("暱稱包含不適合公開顯示的內容");
        expect(updateSocialProfile).not.toHaveBeenCalled();
    });

    it("searches by exact nickname or friend code and sends a mutual request", async () => {
        searchStudents.mockResolvedValue({ result: { student_id: 9, nickname: "Amy Owl", avatar_url: "https://example.com/amy.jpg", relationship: null } });
        sendFriendRequest.mockResolvedValue({ success: true });
        render(<StudentFriends />);

        expect(await screen.findByText("AE-ABCDEFGH")).toBeTruthy();
        fireEvent.change(screen.getByPlaceholderText("完整暱稱或 AE-好友碼"), { target: { value: "Amy Owl" } });
        fireEvent.click(screen.getByRole("button", { name: /搜尋$/ }));
        expect(await screen.findByText("Amy Owl")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "查看 Amy Owl 的頭貼" }));
        expect(await screen.findByRole("dialog", { name: "Amy Owl" })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "關閉頭貼預覽" }));
        expect(screen.queryByRole("dialog")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "加好友" }));

        await waitFor(() => expect(sendFriendRequest).toHaveBeenCalledWith(firebaseUser, 9));
    });

    it("lets a student block a searched result without first becoming friends", async () => {
        jest.spyOn(window, "confirm").mockReturnValue(true);
        searchStudents.mockResolvedValue({ result: { student_id: 9, nickname: "Amy Owl", relationship: null } });
        blockStudent.mockResolvedValue({ success: true });
        render(<StudentFriends />);

        await screen.findByText("AE-ABCDEFGH");
        fireEvent.change(screen.getByPlaceholderText("完整暱稱或 AE-好友碼"), { target: { value: "Amy Owl" } });
        fireEvent.click(screen.getByRole("button", { name: /搜尋$/ }));
        expect(await screen.findByText("Amy Owl")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "封鎖" }));

        await waitFor(() => expect(blockStudent).toHaveBeenCalledWith(firebaseUser, 9));
    });
});
