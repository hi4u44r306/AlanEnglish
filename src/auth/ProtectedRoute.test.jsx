import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "./AuthContext";

jest.mock("./AuthContext", () => ({ useAuth: jest.fn() }));

const renderRoutes = ({ allowsIncompleteOnboarding = false } = {}) => render(
    <MemoryRouter initialEntries={["/student/settings"]}>
        <Routes>
            <Route
                path="/student/settings"
                element={(
                    <ProtectedRoute
                        allowedRoles={["student"]}
                        allowsIncompleteOnboarding={allowsIncompleteOnboarding}
                    >
                        <div>受保護內容</div>
                    </ProtectedRoute>
                )}
            />
            <Route path="/student/onboarding" element={<div>首次登入設定</div>} />
        </Routes>
    </MemoryRouter>
);

describe("ProtectedRoute onboarding gate", () => {
    beforeEach(() => {
        useAuth.mockReturnValue({
            authLoading: false,
            isAuthenticated: true,
            role: "student",
            studentProfile: {
                onboarding: { required: true },
                membership: { is_active: true }
            }
        });
    });

    it("redirects an incomplete student away from every normal student page", () => {
        renderRoutes();
        expect(screen.getByText("首次登入設定")).toBeInTheDocument();
        expect(screen.queryByText("受保護內容")).not.toBeInTheDocument();
    });

    it("allows the dedicated onboarding route to render", () => {
        renderRoutes({ allowsIncompleteOnboarding: true });
        expect(screen.getByText("受保護內容")).toBeInTheDocument();
    });
});

describe("student speaking entry access", () => {
    const renderSpeakingRoute = () => render(
        <MemoryRouter initialEntries={["/student/speaking-challenges"]}>
            <Routes>
                <Route path="/student/speaking-challenges" element={(
                    <ProtectedRoute allowedRoles={["student", "teacher", "admin"]} requiresActiveMembership>
                        <div>口說關卡列表</div>
                    </ProtectedRoute>
                )} />
                <Route path="/student/membership" element={<div>會員方案</div>} />
                <Route path="/student/onboarding" element={<div>首次登入設定</div>} />
                <Route path="/login" element={<div>登入頁</div>} />
            </Routes>
        </MemoryRouter>
    );

    beforeEach(() => {
        useAuth.mockReturnValue({
            authLoading: false, isAuthenticated: true, role: "student",
            studentProfile: { onboarding: { required: false }, membership: { is_active: true } }
        });
    });

    it("lets an active onboarded student reach the challenge page", () => {
        renderSpeakingRoute();
        expect(screen.getByText("口說關卡列表")).toBeInTheDocument();
    });

    it("keeps inactive students behind the membership gate", () => {
        useAuth.mockReturnValue({
            authLoading: false, isAuthenticated: true, role: "student",
            studentProfile: { membership: { is_active: false } }
        });
        renderSpeakingRoute();
        expect(screen.getByText("會員方案")).toBeInTheDocument();
        expect(screen.queryByText("口說關卡列表")).not.toBeInTheDocument();
    });

    it.each(["teacher", "admin"])("preserves %s preview without student membership", role => {
        useAuth.mockReturnValue({ authLoading: false, isAuthenticated: true, role, studentProfile: null });
        renderSpeakingRoute();
        expect(screen.getByText("口說關卡列表")).toBeInTheDocument();
    });

    it("still requires authentication", () => {
        useAuth.mockReturnValue({ authLoading: false, isAuthenticated: false, role: null });
        renderSpeakingRoute();
        expect(screen.getByText("登入頁")).toBeInTheDocument();
        expect(screen.queryByText("口說關卡列表")).not.toBeInTheDocument();
    });
});
