import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { blockStudent, cancelFriendRequest, getSocialOverview, searchStudents, sendFriendRequest, updateSocialProfile } from "../../services/studentSocialService";
import StudentFriends from "./StudentFriends";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/studentSocialService", () => ({
    blockStudent: jest.fn(),
    cancelFriendRequest: jest.fn(),
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
const renderFriends = () => render(<MemoryRouter><StudentFriends /></MemoryRouter>);
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

    it("sends a student without a public nickname to My Settings", async () => {
        getSocialOverview.mockResolvedValueOnce({ ...readyOverview, profile: null, settings: null });
        renderFriends();

        expect(await screen.findByRole("heading", { name: "先建立公開暱稱" })).toBeTruthy();
        expect(screen.queryByRole("heading", { name: "尋找好友" })).toBeNull();
        expect(screen.getByRole("link", { name: /前往我的設定/ }).getAttribute("href")).toBe("/student/settings");
        expect(updateSocialProfile).not.toHaveBeenCalled();
    });

    it("updates only social visibility settings from the friends page", async () => {
        updateSocialProfile.mockResolvedValue({ success: true, profile: readyOverview.profile });
        renderFriends();

        await screen.findByText("AE-ABCDEFGH");
        fireEvent.change(screen.getByLabelText("誰能看戰績"), { target: { value: "self" } });
        fireEvent.click(screen.getByRole("button", { name: "儲存設定" }));

        await waitFor(() => expect(updateSocialProfile).toHaveBeenCalledWith(firebaseUser, {
            stats_visibility: "self",
            presence_visibility: "friends"
        }));
    });

    it("searches by exact nickname or friend code and sends a mutual request", async () => {
        searchStudents.mockResolvedValue({ result: { student_id: 9, nickname: "Amy Owl", avatar_url: "https://example.com/amy.jpg", relationship: null } });
        sendFriendRequest.mockResolvedValue({ success: true });
        renderFriends();

        expect(await screen.findByText("AE-ABCDEFGH")).toBeTruthy();
        fireEvent.change(screen.getByPlaceholderText("完整暱稱或 AE-好友碼"), { target: { value: "Amy Owl" } });
        fireEvent.click(screen.getByRole("button", { name: /搜尋$/ }));
        expect(await screen.findByText("Amy Owl")).toBeTruthy();
        expect(screen.getByRole("button", { name: "查看 Amy Owl 的頭貼" }).className).toContain("student-friends-search-avatar");
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
        renderFriends();

        await screen.findByText("AE-ABCDEFGH");
        fireEvent.change(screen.getByPlaceholderText("完整暱稱或 AE-好友碼"), { target: { value: "Amy Owl" } });
        fireEvent.click(screen.getByRole("button", { name: /搜尋$/ }));
        expect(await screen.findByText("Amy Owl")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "封鎖" }));

        await waitFor(() => expect(blockStudent).toHaveBeenCalledWith(firebaseUser, 9));
    });

    it("shows an outgoing request avatar and lets the sender cancel it", async () => {
        getSocialOverview.mockResolvedValue({
            ...readyOverview,
            outgoing_requests: [{
                id: 42,
                person: { student_id: 9, nickname: "Amy Owl", avatar_url: "https://example.com/amy.jpg", presence: "hidden" }
            }]
        });
        cancelFriendRequest.mockResolvedValue({ success: true });
        renderFriends();

        expect(await screen.findByRole("button", { name: "查看 Amy Owl 的頭貼" })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "取消邀請" }));
        await waitFor(() => expect(cancelFriendRequest).toHaveBeenCalledWith(firebaseUser, 42));
    });

    it("shows a blocked avatar in an expandable section and opens its preview", async () => {
        getSocialOverview.mockResolvedValue({
            ...readyOverview,
            blocked: [{ student_id: 9, nickname: "Amy Owl", avatar_url: "https://example.com/amy.jpg", presence: "hidden" }]
        });
        renderFriends();

        const blockedSummary = await screen.findByText("已封鎖 1 人");
        expect(blockedSummary.closest("summary")?.querySelector("svg")).toBeTruthy();
        fireEvent.click(blockedSummary);
        fireEvent.click(screen.getByRole("button", { name: "查看 Amy Owl 的頭貼" }));
        expect(await screen.findByRole("dialog", { name: "Amy Owl" })).toBeTruthy();
    });

    it("marks a blocked friend with a red already-blocked button", async () => {
        getSocialOverview.mockResolvedValue({
            ...readyOverview,
            friends: [{ id: 8, person: { student_id: 9, nickname: "Amy Owl", presence: "hidden", stats: { level: 1, total_xp: 5 } } }],
            blocked: [{ student_id: 9, nickname: "Amy Owl", presence: "hidden" }]
        });
        renderFriends();

        const blockedButton = await screen.findByRole("button", { name: "已封鎖" });
        expect(blockedButton.className).toContain("is-blocked");
        expect(blockedButton.disabled).toBe(true);
    });
});
