import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import MainNavbar from "./MainNavbar";
import { useAuth } from "../../auth/AuthContext";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getGamificationSummary } from "../../services/gamificationService";
import { getStudentNotifications } from "../../services/membershipService";
import { isStudentStagingSite } from "../../utils/siteEnvironment";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/contentAccessService", () => ({ getAccessibleCatalog: jest.fn() }));
jest.mock("../../services/gamificationService", () => ({ getGamificationSummary: jest.fn() }));
jest.mock("../../services/membershipService", () => ({ getStudentNotifications: jest.fn(), markStudentNotificationRead: jest.fn() }));
jest.mock("../../utils/siteEnvironment", () => ({ isStudentStagingSite: jest.fn() }));
jest.mock("react-bootstrap/Offcanvas", () => {
    const ReactModule = require("react");
    const Offcanvas = ({ show, children, id }) => show ? ReactModule.createElement("aside", { id }, children) : null;
    Offcanvas.Header = ({ children }) => ReactModule.createElement("header", null, children);
    Offcanvas.Body = ({ children }) => ReactModule.createElement("div", null, children);
    return { __esModule: true, default: Offcanvas };
});

describe("MainNavbar student navigation", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({
            firebaseUser: { uid: "student-test" },
            role: "student",
            isAuthenticated: true,
            logout: jest.fn(),
            studentProfile: {
                name: "測試學生",
                class: "E1",
                membership: { effective_access: { features: { ai_materials: false }, plan_codes: [] } }
            }
        });
        getAccessibleCatalog.mockResolvedValue({
            categories: [{ id: "listening", name: "聽力本", books: [] }]
        });
        getGamificationSummary.mockResolvedValue({
            balance: { total_xp: 180, level: 2, next_level_xp: 250, progress_percent: 53 }
        });
        getStudentNotifications.mockResolvedValue({ notifications: [] });
        isStudentStagingSite.mockReturnValue(false);
    });

    it("keeps common links in the desktop bar and moves secondary links into the full menu", async () => {
        render(<MemoryRouter initialEntries={["/student/dashboard"]}><MainNavbar /></MemoryRouter>);

        expect(screen.getByRole("link", { name: "我的首頁" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "智慧複習" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "每週報告" })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "學習排行榜" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "全部功能" }));

        expect(await screen.findByRole("link", { name: "學習排行榜" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "獎品商城" })).toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: "我的設定" }).length).toBeGreaterThan(0);
        expect(await screen.findByText("Lv.2")).toBeInTheDocument();
        expect(screen.getByRole("progressbar", { name: "目前等級 Lv.2 的經驗值進度" })).toHaveAttribute("aria-valuenow", "53");
        await waitFor(() => expect(screen.getByText("聽力本")).toBeInTheDocument());
    });

    it("clearly labels the fixed student staging site", () => {
        isStudentStagingSite.mockReturnValue(true);
        const { unmount } = render(<MemoryRouter initialEntries={["/student/dashboard"]}><MainNavbar /></MemoryRouter>);

        expect(screen.getByRole("status")).toHaveTextContent("學生測試站");
        expect(screen.getByRole("status")).toHaveTextContent("請勿測試付款或建立真實學生");
        expect(document.documentElement).toHaveClass("ae-staging-environment");

        unmount();
        expect(document.documentElement).not.toHaveClass("ae-staging-environment");
    });
});
