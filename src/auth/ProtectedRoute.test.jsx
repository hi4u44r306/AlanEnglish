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
