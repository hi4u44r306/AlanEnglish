jest.mock("./AuthContext", () => ({ useAuth: jest.fn() }));

import { getRoleHome } from "./RoleHomeRedirect";

describe("getRoleHome", () => {
    test("sends students to today's learning and preserves staff dashboards", () => {
        expect(getRoleHome("student")).toBe("/student/dashboard");
        expect(getRoleHome("teacher")).toBe("/teacher/dashboard");
        expect(getRoleHome("admin")).toBe("/admin/dashboard");
    });
});

describe("RoleHomeRedirect (PWA entry /userinfo)", () => {
    const React = require("react");
    const { render, screen } = require("@testing-library/react");
    const { MemoryRouter, Routes, Route } = require("react-router-dom");
    const { useAuth } = require("./AuthContext");
    const RoleHomeRedirect = require("./RoleHomeRedirect").default;

    const open = auth => {
        useAuth.mockReturnValue(auth);
        render(
            <MemoryRouter initialEntries={["/userinfo?source=pwa"]}>
                <Routes>
                    <Route path="/userinfo" element={<RoleHomeRedirect />} />
                    <Route path="*" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>
        );
    };
    function LocationProbe() {
        return <div data-testid="where">{require("react-router-dom").useLocation().pathname}</div>;
    }

    test("logged out outside the PWA launch still goes to /login", () => {
        useAuth.mockReturnValue({ authLoading: false, isAuthenticated: false });
        render(
            <MemoryRouter initialEntries={["/userinfo"]}>
                <Routes>
                    <Route path="/userinfo" element={<RoleHomeRedirect />} />
                    <Route path="*" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>
        );
        expect(screen.getByTestId("where").textContent).toBe("/login");
    });

    test("shows the branded splash while auth loads", () => {
        open({ authLoading: true });
        expect(screen.getByRole("status")).toBeTruthy();
    });

    test.each([
        ["logged out (PWA launch)", { authLoading: false, isAuthenticated: false }, "/"],
        ["student", { authLoading: false, isAuthenticated: true, role: "student", studentProfile: { membership: { is_active: true } } }, "/student/dashboard"],
        ["teacher", { authLoading: false, isAuthenticated: true, role: "teacher" }, "/teacher/dashboard"],
        ["admin", { authLoading: false, isAuthenticated: true, role: "admin" }, "/admin/dashboard"]
    ])("routes %s to the right home", (_name, auth, expected) => {
        open(auth);
        expect(screen.getByTestId("where").textContent).toBe(expected);
    });
});
