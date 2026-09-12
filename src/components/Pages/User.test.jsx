import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import User from "./User";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("./Logout", () => () => <button type="button">登出</button>);

const renderDashboard = features => {
    useAuth.mockReturnValue({
        authLoading: false,
        studentProfile: {
            role: "student",
            name: "測試學生",
            membership: {
                is_active: true,
                effective_access: {
                    plan_codes: features.pronunciation ? [] : ["academy_internal"],
                    features
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

describe("child-friendly student dashboard", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("uses the homepage for a greeting and assignment instead of duplicating navbar actions", () => {
        renderDashboard({ listening: true, pronunciation: true, assignments: true, ai_materials: true });

        expect(screen.getByRole("heading", { name: "嗨，測試學生！" })).toBeInTheDocument();
        expect(screen.queryByText(/繼續今天的學習|今天的學習路線|NEXT STEP/)).not.toBeInTheDocument();
        expect(screen.queryByText("我的教材")).not.toBeInTheDocument();
        expect(screen.queryByText("開口說")).not.toBeInTheDocument();
        expect(screen.queryByText("AI 教材")).not.toBeInTheDocument();
        expect(screen.queryByText("更多功能")).not.toBeInTheDocument();
        expect(screen.getByRole("region", { name: "今天的任務" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /查看作業/ })).toHaveAttribute("href", "/student/assignments");
        expect(screen.getByRole("heading", { name: "聽清楚，再勇敢說" })).toBeInTheDocument();
    });

    test("hides the assignment mission when the student has no assignment access", () => {
        renderDashboard({ listening: true, assignments: false, ai_materials: false });

        expect(screen.queryByRole("region", { name: "今天的任務" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /查看作業/ })).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "聽清楚，再勇敢說" })).toBeInTheDocument();
    });
});
