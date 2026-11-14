import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
    getGamificationLeaderboard,
    getGamificationSummary
} from "../../services/gamificationService";
import LearningLeaderboard from "./LearningLeaderboard";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/gamificationService", () => ({
    getGamificationClasses: jest.fn(),
    getGamificationLeaderboard: jest.fn(),
    getGamificationSummary: jest.fn()
}));

const firebaseUser = { uid: "student-1" };

describe("LearningLeaderboard", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        useAuth.mockReturnValue({
            firebaseUser,
            role: "student",
            studentProfile: { class: "E1", name: "Alan Chen", learner_type: "academy_student" }
        });
        getGamificationSummary.mockResolvedValue({
            profile: { name: "Alan Chen", nickname: "Alan Fox" },
            balance: { level: 3, total_xp: 320, points_balance: 20 }
        });
        getGamificationLeaderboard.mockImplementation((user, period, classCode, scope) => Promise.resolve({
            scope,
            class_code: scope === "class" ? "E1" : null,
            leaderboard: [{
                rank_position: 1,
                student_id: 1,
                nickname: "Alan Fox",
                display_name: "陳〇倫",
                student_name: "陳〇倫",
                class_name: "E1",
                level: 3,
                period_xp: 120,
                total_xp: 320,
                is_current_user: true
            }, {
                rank_position: 2,
                student_id: 2,
                nickname: "性愛",
                display_name: "李〇美",
                student_name: "李〇美",
                avatar_url: null,
                class_name: null,
                level: 2,
                period_xp: 100,
                total_xp: 300,
                is_current_user: false
            }]
        }));
    });

    it("顯示遮罩後的姓名與暱稱小字；頭貼只用圖示，不取暱稱或姓名的字", async () => {
        const { container } = render(<MemoryRouter><LearningLeaderboard /></MemoryRouter>);

        expect(await screen.findByText("陳〇倫 · 你")).toBeInTheDocument();
        expect(screen.getByText("李〇美")).toBeInTheDocument();
        expect(screen.getByText("暱稱：性愛")).toBeInTheDocument();
        const fallbacks = container.querySelectorAll(".gamification-row-avatar .gamification-avatar--fallback");
        expect(fallbacks).toHaveLength(2);
        fallbacks.forEach(node => expect(node.textContent).toBe(""));
        expect(container.querySelector(".gamification-row-avatar").textContent).not.toMatch(/[性陳A]/);
    });

    it("自己的暱稱不過關時，頂端提示更換並連到設定；正常時不顯示", async () => {
        const { unmount } = render(<MemoryRouter><LearningLeaderboard /></MemoryRouter>);
        await screen.findByText("陳〇倫 · 你");
        expect(screen.queryByText("你的暱稱需要更換")).not.toBeInTheDocument();
        unmount();

        window.localStorage.clear();
        getGamificationSummary.mockResolvedValue({
            profile: { name: "Alan Chen", nickname: "靠北王", nickname_needs_change: true },
            balance: { level: 3, total_xp: 320, points_balance: 20 }
        });
        render(<MemoryRouter><LearningLeaderboard /></MemoryRouter>);
        expect(await screen.findByText("你的暱稱需要更換")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "去修改暱稱" })).toHaveAttribute("href", "/student/settings");
    });

    it("可從自己的班級切換到綜合排行", async () => {
        render(<MemoryRouter><LearningLeaderboard /></MemoryRouter>);

        expect(await screen.findByRole("heading", { name: "E1 班排行榜" })).toBeInTheDocument();
        expect(await screen.findByText("陳〇倫 · 你")).toBeInTheDocument();
        expect(getGamificationLeaderboard).toHaveBeenCalledWith(firebaseUser, "week", null, "class");

        fireEvent.click(screen.getByRole("button", { name: "綜合排行" }));

        expect(await screen.findByRole("heading", { name: "綜合排行榜" })).toBeInTheDocument();
        await waitFor(() => expect(getGamificationLeaderboard).toHaveBeenCalledWith(
            firebaseUser, "week", null, "overall"
        ));
    });
});
