import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getAiMaterialUsage } from "../../services/aiMaterialService";
import { getStudentAssignments } from "../../services/assignmentService";
import { getReviewDashboard } from "../../services/reviewService";
import { getConversationProgress } from "../../services/learningActivityService";
import { getDashboardStats } from "../../services/listeningService";
import { getSpeakingLearningSummary } from "../../services/pronunciationCoachService";
import User from "./User";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("./Logout", () => () => <button type="button">登出</button>);
jest.mock("../../services/contentAccessService", () => ({ getAccessibleCatalog: jest.fn() }));
jest.mock("../../services/aiMaterialService", () => ({ getAiMaterialUsage: jest.fn() }));
jest.mock("../../services/assignmentService", () => ({ getStudentAssignments: jest.fn() }));
jest.mock("../../services/reviewService", () => ({ getReviewDashboard: jest.fn() }));
jest.mock("../../services/learningActivityService", () => ({ getConversationProgress: jest.fn() }));
jest.mock("../../services/listeningService", () => ({ getDashboardStats: jest.fn() }));
jest.mock("../../services/pronunciationCoachService", () => ({ getSpeakingLearningSummary: jest.fn() }));

const renderDashboard = assignments => {
    useAuth.mockReturnValue({
        firebaseUser: { uid: "student-1" },
        authLoading: false,
        studentProfile: {
            role: "student",
            name: "測試學生",
            membership: {
                is_active: true,
                effective_access: {
                    plan_codes: [],
                    features: {
                        assignments,
                        ai_materials: false,
                        pronunciation: assignments
                    }
                }
            }
        }
    });

    return render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <User />
        </MemoryRouter>
    );
};

describe("student dashboard assignment loading", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getDashboardStats.mockResolvedValue({ daily_count: 0, monthly_count: 0, total_count: 0 });
        getReviewDashboard.mockResolvedValue({ stats: {} });
        getAiMaterialUsage.mockResolvedValue({ usage: { used: 0, limit: 5, remaining: 5 } });
        getConversationProgress.mockResolvedValue({ progress: {} });
        getAccessibleCatalog.mockResolvedValue({ categories: [] });
        getSpeakingLearningSummary.mockResolvedValue({ summary: { learned_sentences: 4, learned_words: 12, saved_recordings: 2 } });
    });

    test("does not request academy assignments or show a false warning without assignment access", async () => {
        getStudentAssignments.mockRejectedValue(new Error("只有在校英文班學生可以查看作業"));

        renderDashboard(false);

        expect(await screen.findByRole("heading", { name: "測試學生，今天先完成這些！" })).toBeInTheDocument();
        expect(getStudentAssignments).not.toHaveBeenCalled();
        expect(screen.queryByText("部分學習資料暫時無法更新，其餘內容仍可正常使用。")).not.toBeInTheDocument();
    });

    test("still reports a real assignment service failure for an eligible student", async () => {
        getStudentAssignments.mockRejectedValue(new Error("作業服務暫時無法使用"));

        renderDashboard(true);

        await waitFor(() => expect(getStudentAssignments).toHaveBeenCalledTimes(1));
        expect(await screen.findByText("部分學習資料暫時無法更新，其餘內容仍可正常使用。")).toBeInTheDocument();
    });

    test("shows completed speaking sentences and unique words for eligible students", async () => {
        getStudentAssignments.mockResolvedValue({ assignments: [] });
        renderDashboard(true);

        expect(await screen.findByText("已學口說")).toBeInTheDocument();
        expect(screen.getByText("口說單字")).toBeInTheDocument();
        expect(screen.getByText("12")).toBeInTheDocument();
        expect(getSpeakingLearningSummary).toHaveBeenCalledTimes(1);
    });
});
