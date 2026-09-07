import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import MainNavbar from "./MainNavbar";
import { useAuth } from "../../auth/AuthContext";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getGamificationSummary } from "../../services/gamificationService";
import { getStudentNotifications } from "../../services/membershipService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/contentAccessService", () => ({ getAccessibleCatalog: jest.fn() }));
jest.mock("../../services/gamificationService", () => ({ getGamificationSummary: jest.fn() }));
jest.mock("../../services/membershipService", () => ({ getStudentNotifications: jest.fn(), markStudentNotificationRead: jest.fn() }));
jest.mock("react-bootstrap/Offcanvas", () => {
    const ReactModule = require("react");
    const Offcanvas = ({ show, children, id }) => show ? ReactModule.createElement("aside", { id }, children) : null;
    Offcanvas.Header = ({ children }) => ReactModule.createElement("header", null, children);
    Offcanvas.Body = ReactModule.forwardRef(({ children }, ref) => ReactModule.createElement("div", { ref }, children));
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
                learner_type: "academy_student",
                membership: { effective_access: { features: { ai_materials: false }, plan_codes: ["academy_internal"] } }
            }
        });
        getAccessibleCatalog.mockResolvedValue({
            categories: [{ id: "listening", name: "聽力本", books: [] }]
        });
        getGamificationSummary.mockResolvedValue({
            balance: { total_xp: 180, level: 2, next_level_xp: 250, progress_percent: 53 }
        });
        getStudentNotifications.mockResolvedValue({ notifications: [] });
    });

    it("keeps common links in the desktop bar and moves secondary links into the full menu", async () => {
        render(<MemoryRouter initialEntries={["/student/dashboard"]}><MainNavbar /></MemoryRouter>);

        expect(screen.getAllByRole("link", { name: "我的首頁" }).length).toBeGreaterThan(0);
        expect(screen.queryByRole("link", { name: "方案與功能" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "英文對話" })).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "口說大挑戰" })).toHaveAttribute("href", "/student/speaking-challenges");
        expect(screen.queryByRole("link", { name: "智慧複習" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "每週報告" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "學習排行榜" })).not.toBeInTheDocument();
        const mobileNotification = screen.getByRole("link", { name: "查看通知" });
        const mobileMenu = screen.getByRole("button", { name: "開啟全部功能選單" });
        expect(mobileNotification.parentElement).toBe(mobileMenu.parentElement);
        expect(mobileMenu.parentElement).toHaveClass("ae-mobile-actions");

        fireEvent.click(screen.getByRole("button", { name: "全部功能" }));

        expect(await screen.findByRole("link", { name: "方案與功能" })).toHaveAttribute("href", "/student/membership");
        expect(screen.getByText("開始學習")).toBeInTheDocument();
        expect(screen.getByText("學習成果")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "智慧複習" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "每週報告" })).toBeInTheDocument();
        expect(await screen.findByRole("link", { name: "學習排行榜" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "獎品商城" })).toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: "實體教材商城" }).some(link => link.getAttribute("href") === "/shop")).toBe(true);
        expect(screen.getAllByRole("link", { name: "我的設定" }).length).toBeGreaterThan(0);
        expect(await screen.findByText("Lv.2")).toBeInTheDocument();
        expect(screen.getByRole("progressbar", { name: "目前等級 Lv.2 的經驗值進度" })).toHaveAttribute("aria-valuenow", "53");
        await waitFor(() => expect(getAccessibleCatalog).toHaveBeenCalled());
        expect(screen.queryByText("聽力本")).not.toBeInTheDocument();
    });

    it("groups unlocked student materials into collapsible desktop and mobile categories", async () => {
        getAccessibleCatalog.mockResolvedValue({
            categories: [{
                id: "workbook",
                name: "習作本",
                books: [
                    { id: "book-1", code: "Workbook_1", name: "Workbook 1", locked: false },
                    { id: "book-2", code: "Workbook_2", name: "Workbook 2", locked: true }
                ]
            }, {
                id: "listening",
                name: "聽力本",
                books: [{ id: "listen-1", code: "Listening_1", name: "聽力本 1", locked: false }]
            }]
        });

        render(<MemoryRouter initialEntries={["/student/dashboard"]}><MainNavbar /></MemoryRouter>);

        const materialsMenu = await screen.findByRole("button", { name: "我的教材" });
        fireEvent.click(materialsMenu);
        const desktopMaterials = materialsMenu.closest(".dropdown");
        expect(within(desktopMaterials).getByText("共 2 本")).toBeInTheDocument();
        const desktopWorkbookToggle = within(desktopMaterials).getByLabelText("切換習作本，1 本教材");
        expect(desktopWorkbookToggle.closest("details")).not.toHaveAttribute("open");
        fireEvent.click(desktopWorkbookToggle);
        expect(desktopWorkbookToggle.closest("details")).toHaveAttribute("open");
        const desktopWorkbookLink = within(desktopMaterials).getByRole("link", { name: "Workbook 1" });
        expect(desktopWorkbookLink).toHaveAttribute("href", "/student/books/Workbook_1");
        expect(desktopWorkbookLink.querySelector("img")).toBeInTheDocument();
        fireEvent.click(within(desktopMaterials).getByLabelText("切換聽力本，1 本教材"));
        expect(within(desktopMaterials).getByRole("link", { name: "聽力本 1" })).toHaveAttribute("href", "/student/books/Listening_1");
        expect(within(desktopMaterials).queryByRole("link", { name: "Workbook 2" })).not.toBeInTheDocument();

        fireEvent.click(materialsMenu);
        fireEvent.click(screen.getByRole("button", { name: "全部功能" }));
        const mobileDrawer = await screen.findByRole("complementary");
        expect(within(mobileDrawer).getByText("我的教材 · 共 2 本")).toBeInTheDocument();
        const mobileWorkbookToggle = within(mobileDrawer).getByLabelText("切換習作本，1 本教材");
        expect(mobileWorkbookToggle.closest("details")).not.toHaveAttribute("open");
        fireEvent.click(mobileWorkbookToggle);
        expect(mobileWorkbookToggle.closest("details")).toHaveAttribute("open");
        const mobileWorkbookLink = within(mobileDrawer).getByRole("link", { name: "Workbook 1" });
        expect(mobileWorkbookLink).toHaveAttribute("href", "/student/books/Workbook_1");
        expect(mobileWorkbookLink.querySelector("img")).not.toBeInTheDocument();
        expect(within(mobileDrawer).queryByRole("link", { name: "Workbook 2" })).not.toBeInTheDocument();
    });

    it("shows the AI Premium title only for an active AI add-on", async () => {
        useAuth.mockReturnValue({
            firebaseUser: { uid: "ai-premium-student" },
            role: "student",
            isAuthenticated: true,
            logout: jest.fn(),
            studentProfile: {
                name: "AI 學生",
                membership: {
                    effective_access: {
                        features: { ai_materials: true },
                        plan_codes: ["ai_materials_addon_monthly"]
                    }
                }
            }
        });

        render(<MemoryRouter initialEntries={["/student/dashboard"]}><MainNavbar /></MemoryRouter>);

        expect(screen.getByText("AI Premium")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "全部功能" }));
        expect(await screen.findAllByText("AI Premium")).toHaveLength(2);
    });

    it("hides the rewards shop from students who are not actively enrolled", async () => {
        useAuth.mockReturnValue({
            firebaseUser: { uid: "general-student" },
            role: "student",
            isAuthenticated: true,
            logout: jest.fn(),
            studentProfile: {
                name: "一般會員",
                learner_type: "textbook_customer",
                membership: { effective_access: { features: { listening: true }, plan_codes: ["basic_membership_monthly"] } }
            }
        });

        render(<MemoryRouter initialEntries={["/student/dashboard"]}><MainNavbar /></MemoryRouter>);
        fireEvent.click(screen.getByRole("button", { name: "全部功能" }));

        expect(await screen.findByText("學習成果")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "獎品商城" })).not.toBeInTheDocument();
    });

    it("shows AI Premium and pronunciation to an active academy student without an add-on", async () => {
        useAuth.mockReturnValue({
            firebaseUser: { uid: "academy-all-access" },
            role: "student",
            isAuthenticated: true,
            logout: jest.fn(),
            studentProfile: {
                name: "在校學生",
                class: "E3",
                membership: {
                    effective_access: {
                        features: { ai_materials: true, pronunciation: true },
                        plan_codes: ["academy_internal"]
                    }
                }
            }
        });

        render(<MemoryRouter initialEntries={["/student/dashboard"]}><MainNavbar /></MemoryRouter>);

        expect(screen.getByText("AI Premium")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "發音教練" })).toHaveAttribute("href", "/student/pronunciation");
        expect(screen.getByRole("link", { name: "口說大挑戰" })).toHaveAttribute("href", "/student/speaking-challenges");
        fireEvent.click(screen.getByRole("button", { name: "全部功能" }));
        expect(await screen.findAllByText("AI Premium")).toHaveLength(2);
        expect(screen.getAllByRole("link", { name: "發音教練" })).toHaveLength(2);
        expect(screen.getAllByRole("link", { name: "口說大挑戰" })).toHaveLength(2);
    });

    it("shows one music-management link and the links admin entry to admins", async () => {
        useAuth.mockReturnValue({
            firebaseUser: { uid: "admin-test" },
            role: "admin",
            isAuthenticated: true,
            logout: jest.fn(),
            studentProfile: { name: "管理員" }
        });
        getAccessibleCatalog.mockResolvedValue({ categories: [] });

        render(<MemoryRouter initialEntries={["/admin/dashboard"]}><MainNavbar /></MemoryRouter>);
        fireEvent.click(screen.getByRole("button", { name: "音檔" }));

        const musicManagementLink = screen.getByRole("link", { name: "音檔管理" });
        expect(musicManagementLink).toHaveAttribute("href", "/teacher/music/manage");
        expect(screen.queryByRole("link", { name: "建立音檔" })).not.toBeInTheDocument();

        const linksAdminEntry = screen.getByRole("link", { name: "新增連結" });
        expect(linksAdminEntry).toHaveAttribute("href", "/admin/links");
        fireEvent.click(screen.getByRole("button", { name: "系統" }));
        expect(screen.getByRole("link", { name: "教材 AI 口說題庫" })).toHaveAttribute("href", "/admin/speaking-content");

        fireEvent.click(screen.getByRole("button", { name: "開啟全部功能選單" }));

        expect(await screen.findAllByRole("link", { name: "音檔管理" })).toHaveLength(2);
        expect(screen.getAllByRole("link", { name: "新增連結" })).toHaveLength(2);
        expect(screen.getAllByRole("link", { name: "教材 AI 口說題庫" })).toHaveLength(2);
        expect(screen.queryByRole("link", { name: "建立音檔" })).not.toBeInTheDocument();
    });

    it("does not show the links admin entry to teachers", async () => {
        useAuth.mockReturnValue({
            firebaseUser: { uid: "teacher-test" },
            role: "teacher",
            isAuthenticated: true,
            logout: jest.fn(),
            studentProfile: { name: "老師" }
        });
        getAccessibleCatalog.mockResolvedValue({ categories: [] });

        render(<MemoryRouter initialEntries={["/teacher/dashboard"]}><MainNavbar /></MemoryRouter>);
        await waitFor(() => expect(screen.queryByText("教材載入中...")).not.toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: "音檔" }));

        expect(screen.getByRole("link", { name: "音檔管理" })).toHaveAttribute("href", "/teacher/music/manage");
        expect(screen.queryByRole("link", { name: "新增連結" })).not.toBeInTheDocument();
    });

    it("highlights the active student route in the full menu", () => {
        render(<MemoryRouter initialEntries={["/student/membership"]}><MainNavbar /></MemoryRouter>);
        fireEvent.click(screen.getByRole("button", { name: "全部功能" }));
        expect(screen.getAllByRole("link", { name: "方案與功能" }).every(link => link.classList.contains("active"))).toBe(true);
        expect(screen.getAllByRole("link", { name: "我的首頁" }).every(link => !link.classList.contains("active"))).toBe(true);
    });
});
