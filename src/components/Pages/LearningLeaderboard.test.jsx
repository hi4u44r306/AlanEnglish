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
                student_name: "Alan Chen",
                class_name: "E1",
                level: 3,
                period_xp: 120,
                total_xp: 320,
                is_current_user: true
            }]
        }));
    });

    it("顯示暱稱與原名，並可從自己的班級切換到綜合排行", async () => {
        render(<MemoryRouter><LearningLeaderboard /></MemoryRouter>);

        expect(await screen.findByRole("heading", { name: "E1 班排行榜" })).toBeInTheDocument();
        expect(await screen.findByText("原名：Alan Chen")).toBeInTheDocument();
        expect(screen.getAllByText(/Alan Fox/).length).toBeGreaterThan(0);
        expect(getGamificationLeaderboard).toHaveBeenCalledWith(firebaseUser, "week", null, "class");

        fireEvent.click(screen.getByRole("button", { name: "綜合排行" }));

        expect(await screen.findByRole("heading", { name: "綜合排行榜" })).toBeInTheDocument();
        await waitFor(() => expect(getGamificationLeaderboard).toHaveBeenCalledWith(
            firebaseUser, "week", null, "overall"
        ));
    });
});
