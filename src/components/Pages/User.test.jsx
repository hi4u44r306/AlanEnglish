import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

    test("shows no more than five clear launch actions without the legacy learning route", () => {
        renderDashboard({ listening: true, pronunciation: true, assignments: true, ai_materials: true });

        expect(screen.getByRole("heading", { name: "測試學生，想學什麼？" })).toBeInTheDocument();
        expect(screen.queryByText(/繼續今天的學習|今天的學習路線|NEXT STEP/)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /我的教材/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /開口說/ })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /我的作業/ })).toHaveAttribute("href", "/student/assignments");
        expect(screen.getByRole("link", { name: /AI 教材/ })).toHaveAttribute("href", "/student/ai-generator");
        expect(screen.getByRole("button", { name: /更多功能/ })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "學習功能" }).children).toHaveLength(5);
    });

    test("hides unavailable actions and asks the navbar to open the selected menu", () => {
        const onMenuRequest = jest.fn();
        window.addEventListener("ae:open-student-menu", onMenuRequest);
        renderDashboard({ listening: true, assignments: false, ai_materials: false });

        expect(screen.queryByRole("link", { name: /我的作業/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /AI 教材/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /我的教材/ }));
        expect(onMenuRequest).toHaveBeenCalledWith(expect.objectContaining({ detail: "materials" }));

        window.removeEventListener("ae:open-student-menu", onMenuRequest);
    });
});
