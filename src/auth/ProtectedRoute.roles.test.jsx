import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import reducers from "../reducers/reducer";
import { ThemeProvider } from "../theme/ThemeContext";
import App from "../app/App";
import ProtectedRoute from "./ProtectedRoute";

// The real App route tree and the real ProtectedRoute/RoleHomeRedirect run. Only the session
// (useAuth), the layout shell and the page bodies are replaced: each page renders a marker, so
// a guard failure shows the protected page's marker instead of the redirect target.
let mockAuthState;
jest.mock("./AuthContext", () => ({
    AuthProvider: ({ children }) => children,
    useAuth: () => mockAuthState
}));
jest.mock("../components/Pages/firebase-config", () => ({ authentication: {} }));
// Pages import Firebase Auth at module load; nothing here signs in, so every export is inert.
jest.mock("firebase/auth", () => new Proxy({ __esModule: true }, {
    get: (target, key) => (key in target ? target[key] : (target[key] = jest.fn()))
}));
jest.mock("../components/fragment/Containerfull", () => ({ __esModule: true, default: ({ children }) => children }));

function mockPage(name) {
    const ReactModule = require("react");
    return { __esModule: true, default: () => ReactModule.createElement("main", null, `PAGE:${name}`) };
}
jest.mock("../components/Pages/AccountManagement", () => mockPage("AccountManagement"));
jest.mock("../components/Pages/AdminCreateStaff", () => mockPage("AdminCreateStaff"));
jest.mock("../components/Pages/AcademyStudentCsvImport", () => mockPage("AcademyStudentCsvImport"));
jest.mock("../components/Pages/ApiUsageAdmin", () => mockPage("ApiUsageAdmin"));
jest.mock("../components/Pages/TeamBossSpeakingPreview/Preview", () => mockPage("TeamBossSpeakingPreview"));
jest.mock("../components/Pages/CatalogAdmin", () => mockPage("CatalogAdmin"));
jest.mock("../components/Pages/AdminClassMaterials", () => mockPage("AdminClassMaterials"));
jest.mock("../components/Pages/ManagementDashboard", () => mockPage("ManagementDashboard"));
jest.mock("../components/Pages/LearningLeaderboard", () => mockPage("LearningLeaderboard"));
jest.mock("../components/Pages/LevelAdmin", () => mockPage("LevelAdmin"));
jest.mock("../components/Pages/LinkAdmin", () => mockPage("LinkAdmin"));
jest.mock("../components/Pages/AdminMaterialPackages", () => mockPage("AdminMaterialPackages"));
jest.mock("../components/Pages/MembershipAdmin", () => mockPage("MembershipAdmin"));
jest.mock("../components/Pages/WeeklyReport", () => mockPage("WeeklyReport"));
jest.mock("../components/Pages/RewardsAdmin", () => mockPage("RewardsAdmin"));
jest.mock("../components/Pages/SpeakingContentAdmin", () => mockPage("SpeakingContentAdmin"));
jest.mock("../components/Pages/AdminStoreOrders", () => mockPage("AdminStoreOrders"));
jest.mock("../components/Pages/AdminStudentLifecycle", () => mockPage("AdminStudentLifecycle"));
jest.mock("../components/Pages/AdminSupport", () => mockPage("AdminSupport"));
jest.mock("../components/Pages/TeacherAssignments", () => mockPage("TeacherAssignments"));
jest.mock("../components/Pages/TeacherAttendance", () => mockPage("TeacherAttendance"));
jest.mock("../components/Pages/AddMusicV3", () => mockPage("AddMusic"));
jest.mock("../components/Pages/Signup", () => mockPage("Signup"));
jest.mock("../components/Pages/StudentSettings", () => mockPage("StudentSettings"));
jest.mock("../components/Pages/MembershipCenter", () => mockPage("MembershipCenter"));
jest.mock("../components/Pages/StudentOnboarding", () => mockPage("StudentOnboarding"));
jest.mock("../components/Pages/Login", () => mockPage("Login"));
jest.mock("../components/Pages/Showcase", () => mockPage("Showcase"));

const ADMIN_ROUTES = [
    "/admin/dashboard", "/admin/reports", "/admin/accounts", "/admin/accounts/create-staff", "/admin/accounts/import",
    "/admin/leaderboard", "/admin/rewards", "/admin/boss-preview", "/admin/links", "/admin/membership", "/admin/api-usage",
    "/admin/levels", "/admin/catalog", "/admin/support", "/admin/class-materials", "/admin/material-packages",
    "/admin/store-orders", "/admin/student-lifecycle", "/admin/speaking-content"
];
const TEACHER_ROUTES = [
    "/teacher/dashboard", "/teacher/reports", "/teacher/assignments", "/teacher/attendance", "/teacher/accounts",
    "/teacher/accounts/create", "/teacher/music/create", "/teacher/music/manage", "/teacher/leaderboard", "/teacher/class-materials"
];

const activeStudent = { authLoading: false, isAuthenticated: true, role: "student", studentProfile: { onboarding: { required: false }, membership: { is_active: true } } };
const staff = role => ({ authLoading: false, isAuthenticated: true, role, studentProfile: { role } });

const renderApp = async (path, auth) => {
    mockAuthState = auth;
    window.history.replaceState({}, "", path);
    const store = configureStore({ reducer: reducers });
    render(<Provider store={store}><ThemeProvider><App /></ThemeProvider></Provider>);
    await act(async () => {});
};
const expectLanding = async (pathname, marker) => {
    await waitFor(() => expect(window.location.pathname).toBe(pathname));
    expect(await screen.findByText(marker)).toBeInTheDocument();
};

beforeAll(() => {
    window.scrollTo = jest.fn();
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
});
beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("real App route tree", () => {
    it.each([...ADMIN_ROUTES, ...TEACHER_ROUTES])("a logged-in student opening %s lands on the student home", async path => {
        await renderApp(path, activeStudent);
        await expectLanding("/student/settings", "PAGE:StudentSettings");
    });

    it.each(ADMIN_ROUTES)("a teacher opening %s is sent to the teacher home", async path => {
        await renderApp(path, staff("teacher"));
        await expectLanding("/teacher/dashboard", "PAGE:ManagementDashboard");
    });

    it.each(TEACHER_ROUTES)("an admin may open %s", async path => {
        await renderApp(path, staff("admin"));
        await waitFor(() => expect(window.location.pathname).toBe(path));
        expect(await screen.findByText(/^PAGE:/)).toBeInTheDocument();
    });

    it("a student whose membership expired is sent to the membership page, not the admin page", async () => {
        await renderApp("/admin/accounts", { ...activeStudent, studentProfile: { onboarding: { required: false }, membership: { is_active: false } } });
        await expectLanding("/student/membership", "PAGE:MembershipCenter");
    });

    it("a visitor who is not logged in is sent to login", async () => {
        await renderApp("/admin/accounts", { authLoading: false, isAuthenticated: false, role: null, studentProfile: null });
        await expectLanding("/login", "PAGE:Login");
    });

    it("an authenticated account with an unknown role cannot open staff pages", async () => {
        await renderApp("/teacher/accounts", { authLoading: false, isAuthenticated: true, role: "guest", studentProfile: {} });
        await waitFor(() => expect(window.location.pathname).not.toBe("/teacher/accounts"));
        expect(screen.queryByText("PAGE:AccountManagement")).not.toBeInTheDocument();
    });
});

describe("ProtectedRoute allowedRoles matrix", () => {
    const renderGuard = (allowedRoles, auth) => {
        mockAuthState = auth;
        return render(
            <MemoryRouter initialEntries={["/guarded"]}>
                <Routes>
                    <Route path="/guarded" element={<ProtectedRoute allowedRoles={allowedRoles}><div>protected</div></ProtectedRoute>} />
                    <Route path="/student/dashboard" element={<div>home:student</div>} />
                    <Route path="/teacher/dashboard" element={<div>home:teacher</div>} />
                    <Route path="/admin/dashboard" element={<div>home:admin</div>} />
                </Routes>
            </MemoryRouter>
        );
    };
    const cases = [
        [["admin"], "student", "home:student"], [["admin"], "teacher", "home:teacher"], [["admin"], "admin", "protected"],
        [["teacher", "admin"], "student", "home:student"], [["teacher", "admin"], "teacher", "protected"], [["teacher", "admin"], "admin", "protected"],
        [["student"], "teacher", "home:teacher"], [["student"], "admin", "home:admin"], [["student"], "student", "protected"]
    ];
    it.each(cases)("allowedRoles %j with role %s shows %s", (allowedRoles, role, expected) => {
        renderGuard(allowedRoles, role === "student" ? activeStudent : staff(role));
        expect(screen.getByText(expected)).toBeInTheDocument();
    });
});
