import { clearStudentPageCache } from "../../services/studentPageCache";
beforeEach(() => clearStudentPageCache());
import React, { lazy, Suspense } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";
import MainNavbar from "./MainNavbar";
import { APP_ROUTER_FUTURE } from "../../app/routerFuture";
import { useAuth } from "../../auth/AuthContext";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getGamificationSummary } from "../../services/gamificationService";
import { getStudentNotifications, markStudentNotificationRead } from "../../services/membershipService";
import { prefetchReviewDashboard } from "../../services/reviewService";

// These cases describe the prize shop switched on; the shipped default (off) is covered in rewardShopOff.test.jsx.
jest.mock("../../constants/rewardShop", () => ({ REWARD_SHOP_ENABLED: true }));

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/contentAccessService", () => ({ getAccessibleCatalog: jest.fn() }));
jest.mock("../../services/gamificationService", () => ({ getGamificationSummary: jest.fn() }));
jest.mock("../../services/membershipService", () => ({ getStudentNotifications: jest.fn(), markStudentNotificationRead: jest.fn() }));
jest.mock("../../services/reviewService", () => ({ prefetchReviewDashboard: jest.fn() }));
const mockOffcanvasRender = jest.fn();
jest.mock("react-bootstrap/Offcanvas", () => {
    const ReactModule = require("react");
    const Offcanvas = ({ show, children, className, id, placement }) => {
        mockOffcanvasRender({ show, placement });
        return show ? ReactModule.createElement("aside", { className, id, "data-placement": placement }, children) : null;
    };
    Offcanvas.Header = ({ children }) => ReactModule.createElement("header", null, children);
    Offcanvas.Body = ReactModule.forwardRef(({ children, ...props }, ref) => ReactModule.createElement("div", { ...props, ref }, children));
    return { __esModule: true, default: Offcanvas };
});

const basicReadingBooks = [400, 800, 1200].flatMap(level => [1, 2, 3].map(bookNumber => ({
    id: `basic-${level}-${bookNumber}`,
    code: `BasicReading_${level}_${bookNumber}`,
    name: `Basic Reading ${level} 第 ${bookNumber} 冊`,
    locked: false
})));

const LocationProbe = () => {
    const location = useLocation();
    return <output aria-label="目前路徑">{location.pathname}</output>;
};

const PersistentTestLayout = () => (
    <>
        <MainNavbar />
        <LocationProbe />
        <Suspense fallback={<div role="status">正在準備內容</div>}>
            <Outlet />
        </Suspense>
    </>
);

describe("MainNavbar student navigation", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        useAuth.mockReturnValue({
            firebaseUser: { uid: "student-test" },
            role: "student",
            isAuthenticated: true,
            logout: jest.fn(),
            studentProfile: {
                name: "測試學生",
                class: "E1",
                learner_type: "academy_student",
                membership: { is_active: true, effective_access: { features: { ai_materials: false, assignments: true, review: true }, plan_codes: ["academy_internal"] } }
            }
        });
        getAccessibleCatalog.mockResolvedValue({
            categories: [{ id: "listening", name: "聽力本", books: [] }]
        });
        getGamificationSummary.mockResolvedValue({
            balance: { total_xp: 180, level: 2, next_level_xp: 250, progress_percent: 53 }
        });
        getStudentNotifications.mockResolvedValue({ notifications: [] });
        markStudentNotificationRead.mockResolvedValue({ success: true });
    });

    it("shares the summary with the header and refreshes XP and points after a reward event", async () => {
        getGamificationSummary.mockResolvedValueOnce({ balance: { level: 2, total_xp: 180, next_level_xp: 250, progress_percent: 53, points_balance: 100 } });
        render(<MemoryRouter><MainNavbar /></MemoryRouter>);
        await screen.findByRole("button", { name: /可用 AE Points 100 點/ });
        expect(getGamificationSummary).toHaveBeenCalledTimes(1);
        getGamificationSummary.mockResolvedValue({ balance: { level: 3, total_xp: 260, next_level_xp: 450, progress_percent: 5, points_balance: 150 } });
        act(() => window.dispatchEvent(new Event("ae:gamification-updated")));
        await screen.findByRole("button", { name: /可用 AE Points 150 點/ });
        expect(screen.getByText("Lv.3")).toBeInTheDocument();
        expect(getGamificationSummary).toHaveBeenCalledTimes(2);
    });

    it("clears the previous account's header and details before a new summary arrives", async () => {
        getGamificationSummary.mockResolvedValueOnce({ balance: { level: 12, total_xp: 1860, next_level_xp: 2000, points_balance: 1280 } });
        const view = render(<MemoryRouter><MainNavbar /></MemoryRouter>);
        await screen.findByRole("button", { name: /1,280 點/ });
        fireEvent.click(screen.getByRole("button", { name: /查看點數詳情/ }));
        expect(screen.getByLabelText("1,280 AE Points")).toBeInTheDocument();
        useAuth.mockReturnValue({ ...useAuth(), firebaseUser: { uid: "different-student" } });
        getGamificationSummary.mockReturnValue(new Promise(() => {}));
        view.rerender(<MemoryRouter><MainNavbar /></MemoryRouter>);
        expect(screen.queryByText("Lv.12")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("1,280 AE Points")).not.toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /查看點數詳情，可用 AE Points 讀取中/ })).toBeInTheDocument();
    });

    it.each(["teacher", "admin"])("keeps the %s navbar without a student's growth header", role => {
        useAuth.mockReturnValue({ firebaseUser: { uid: "staff" }, role, isAuthenticated: true, logout: jest.fn(), studentProfile: {} });
        render(<MemoryRouter><MainNavbar /></MemoryRouter>);
        expect(screen.queryByRole("button", { name: "查看成長詳情" })).not.toBeInTheDocument();
        expect(getGamificationSummary).not.toHaveBeenCalled();
    });

    it("keeps only the child-friendly primary destinations in the student navbar", async () => {
        render(<MemoryRouter initialEntries={["/student/dashboard"]}><MainNavbar /></MemoryRouter>);

        // 教材 and 冒險 are ordinary pages now, reached by links in both bars.
        expect(screen.getAllByRole("link", { name: "教材" })).toHaveLength(2);
        screen.getAllByRole("link", { name: "教材" }).forEach(link => expect(link).toHaveAttribute("href", "/student/books"));
        expect(screen.queryByRole("link", { name: "方案與功能" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "英文對話" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "口說大挑戰" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "智慧複習" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "每週報告" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "學習排行榜" })).not.toBeInTheDocument();
        // This student has no speaking entitlement, so 冒險 is shown locked in both bars.
        expect(screen.getAllByRole("button", { name: "冒險，需要口說方案" })).toHaveLength(2);
        expect(screen.queryByRole("button", { name: "我的學習" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "開啟功能選單" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "開啟設定" })).toHaveAttribute("aria-controls", "student-navigation-drawer");
        screen.getAllByRole("link", { name: "我的進度" }).forEach(link => expect(link).toHaveAttribute("href", "/student/settings"));
        expect([...screen.getByRole("navigation", { name: "學生主要導覽" }).children].map(item => item.getAttribute("aria-label") || item.textContent)).toEqual(["我的進度", "作業", "教材", "冒險，需要口說方案"]);
        screen.getAllByRole("link", { name: "作業" }).forEach(link => expect(link).toHaveAttribute("href", "/student/assignments"));
        expect(screen.getAllByRole("link", { name: "作業" })).toHaveLength(2);
        const bottomNavigation = screen.getByRole("navigation", { name: "學生主要導覽" });
        expect(bottomNavigation).toBeInTheDocument();
        expect(bottomNavigation.parentElement).toBe(document.body);

        fireEvent.click(screen.getByRole("button", { name: "開啟功能選單" }));

        const mobileMenu = await screen.findByRole("complementary");
        expect(within(mobileMenu).getByRole("link", { name: "會員與功能" })).toHaveAttribute("href", "/student/membership");
        expect(prefetchReviewDashboard).not.toHaveBeenCalled();
        expect(within(mobileMenu).queryByRole("link", { name: "好友" })).not.toBeInTheDocument();
        expect(within(mobileMenu).queryByRole("link", { name: "智慧複習" })).not.toBeInTheDocument();
        expect(within(mobileMenu).queryByRole("link", { name: "AI 練習教材" })).not.toBeInTheDocument();
        expect(within(mobileMenu).getByRole("link", { name: "個人資料" })).toHaveAttribute("href", "/student/profile");
        expect(within(mobileMenu).getByRole("link", { name: "通知設定" })).toHaveAttribute("href", "/student/notification-settings");
        expect(within(mobileMenu).getByRole("link", { name: "帳號與密碼" })).toHaveAttribute("href", "/account/security");
        ["每週報告", "排行榜", "我的作業", "獎品商城", "我的進度"].forEach(name => expect(within(mobileMenu).queryByRole("link", { name })).not.toBeInTheDocument());
        expect(within(mobileMenu).queryByRole("link", { name: "實體教材商城" })).not.toBeInTheDocument();
        await waitFor(() => expect(getAccessibleCatalog).toHaveBeenCalled());
        expect(screen.queryByText("聽力本")).not.toBeInTheDocument();
    });

    it("offers the same three destinations on desktop and marks 我的進度 on its pages", () => {
        render(<MemoryRouter initialEntries={["/student/settings"]}><MainNavbar /><LocationProbe /></MemoryRouter>);
        const desktop = screen.getByRole("navigation", { name: "學生桌面導覽" });
        expect(within(desktop).getByRole("link", { name: "我的進度" })).toHaveClass("active");
        expect(within(desktop).getByRole("link", { name: "教材" })).toHaveAttribute("href", "/student/books");
        expect(within(desktop).getByRole("button", { name: "冒險，需要口說方案" })).toHaveAttribute("aria-disabled", "true");
        expect(within(screen.getByRole("navigation", { name: "學生主要導覽" })).getByRole("link", { name: "我的進度" })).toHaveClass("active");
    });

    it("教材 and 冒險 open pages, not drawers; other screens asking for them are sent to the page", async () => {
        render(<MemoryRouter initialEntries={["/student/dashboard"]} future={APP_ROUTER_FUTURE}><MainNavbar /><LocationProbe /></MemoryRouter>);
        const bottom = screen.getByRole("navigation", { name: "學生主要導覽" });
        expect(within(bottom).getByRole("link", { name: "教材" })).not.toHaveAttribute("aria-expanded");
        fireEvent.click(within(bottom).getByRole("link", { name: "教材" }));
        expect(screen.getByRole("status", { name: "目前路徑" })).toHaveTextContent("/student/books");
        expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
        act(() => { window.dispatchEvent(new CustomEvent("ae:open-student-menu", { detail: "speaking" })); });
        expect(screen.getByRole("status", { name: "目前路徑" })).toHaveTextContent("/student/speaking-challenges");
        act(() => { window.dispatchEvent(new CustomEvent("ae:open-student-menu", { detail: "materials" })); });
        expect(screen.getByRole("status", { name: "目前路徑" })).toHaveTextContent("/student/books");
        expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    });

    it("keeps 教材 selected on a material page", () => {
        render(<MemoryRouter initialEntries={["/student/books/Workbook_1"]}><MainNavbar /></MemoryRouter>);
        const bottom = screen.getByRole("navigation", { name: "學生主要導覽" });
        expect(within(bottom).getByRole("link", { name: "教材" })).toHaveClass("active");
        expect(within(bottom).getByRole("link", { name: "我的進度" })).not.toHaveClass("active");
    });

    it("selects the role section on reward and report pages", () => {
        render(<MemoryRouter initialEntries={["/student/weekly-report"]}><MainNavbar /></MemoryRouter>);
        const bottom = screen.getByRole("navigation", { name: "學生主要導覽" });
        expect(within(bottom).getByRole("link", { name: "我的進度" })).toHaveClass("active");
        expect(within(bottom).getByRole("link", { name: "教材" })).not.toHaveClass("active");
    });

    it("shows logout on the desktop top bar and as the last item of the settings menu", async () => {
        render(<MemoryRouter initialEntries={["/student/dashboard"]}><MainNavbar /></MemoryRouter>);

        // 電腦版頂端列有一顆看得到的登出（手機寬度用 CSS 隱藏，選單裡的登出仍在）。
        const topBarLogout = screen.getByRole("button", { name: "登出" });
        expect(topBarLogout).toHaveClass("ae-student-desktop-logout");

        fireEvent.click(screen.getByRole("button", { name: "開啟設定" }));
        const logoutButtons = await screen.findAllByRole("button", { name: "登出" });
        expect(logoutButtons).toHaveLength(2);
        expect(logoutButtons.some(button => button.classList.contains("ae-student-drawer-logout"))).toBe(true);
    });

    it("uses client-side routing when a mobile offcanvas destination is selected", async () => {
        render(
            <MemoryRouter initialEntries={["/student/dashboard"]}>
                <MainNavbar />
                <LocationProbe />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole("button", { name: "開啟功能選單" }));
        const mobileMenu = await screen.findByRole("complementary");
        expect(mobileMenu).toHaveAttribute("data-placement", "end");
        fireEvent.click(within(mobileMenu).getByRole("link", { name: "會員與功能" }));

        expect(screen.getByRole("status", { name: "目前路徑" })).toHaveTextContent("/student/membership");
        expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
        expect(mockOffcanvasRender).toHaveBeenLastCalledWith({ show: false, placement: "end" });
    });

    it("keeps the navbar mounted while a lazy route loads inside the persistent app shell", async () => {
        let resolveReviewPage;
        const LazyReviewPage = lazy(() => new Promise(resolve => {
            resolveReviewPage = () => resolve({ default: () => <h1>每週報告頁面</h1> });
        }));

        render(
            <MemoryRouter initialEntries={["/student/dashboard"]} future={APP_ROUTER_FUTURE}>
                <Routes>
                    <Route element={<PersistentTestLayout />}>
                        <Route path="/student/dashboard" element={<h1>學習首頁</h1>} />
                        <Route path="/student/membership" element={<LazyReviewPage />} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole("button", { name: "開啟功能選單" }));
        fireEvent.click(within(await screen.findByRole("complementary")).getByRole("link", { name: "會員與功能" }));

        expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "開啟功能選單" })).toBeInTheDocument();
        expect(screen.queryByText("頁面載入中...")).not.toBeInTheDocument();

        await act(async () => {
            resolveReviewPage();
        });

        expect(await screen.findByRole("heading", { name: "每週報告頁面" })).toBeInTheDocument();
    });

    it("starts teacher and admin navigation while the offcanvas closes", async () => {
        useAuth.mockReturnValue({
            firebaseUser: { uid: "admin-test" },
            role: "admin",
            isAuthenticated: true,
            logout: jest.fn(),
            studentProfile: { name: "管理員" }
        });

        render(
            <MemoryRouter initialEntries={["/admin/dashboard"]} future={APP_ROUTER_FUTURE}>
                <MainNavbar />
                <LocationProbe />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole("button", { name: "開啟全部功能選單" }));
        fireEvent.click(within(await screen.findByRole("complementary")).getByRole("link", { name: "每週學習報告" }));

        expect(screen.getByRole("status", { name: "目前路徑" })).toHaveTextContent("/admin/reports");
        expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    });

    it("keeps plan badges out of the settings menu, even with an active AI add-on", async () => {
        useAuth.mockReturnValue({
            firebaseUser: { uid: "ai-premium-student" },
            role: "student",
            isAuthenticated: true,
            logout: jest.fn(),
            studentProfile: {
                name: "AI 學生",
                membership: {
                    is_active: true,
                    effective_access: {
                        features: { ai_materials: true, review: true },
                        plan_codes: ["ai_materials_addon_monthly"]
                    }
                }
            }
        });

        render(<MemoryRouter initialEntries={["/student/dashboard"]}><MainNavbar /></MemoryRouter>);

        fireEvent.click(screen.getByRole("button", { name: "開啟功能選單" }));
        expect(await screen.findByRole("link", { name: "會員與功能" })).toBeInTheDocument();
        expect(screen.queryByText("AI Premium")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "AI 練習教材" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "智慧複習" })).not.toBeInTheDocument();
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
        fireEvent.click(screen.getByRole("button", { name: "開啟功能選單" }));

        expect(within(await screen.findByRole("complementary")).getByRole("link", { name: "個人資料" })).toHaveAttribute("href", "/student/profile");
        // Homework is for enrolled class students; a textbook customer has no 作業 entry anywhere.
        expect(screen.queryByRole("link", { name: "作業" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "獎品商城" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "每週報告" })).not.toBeInTheDocument();
    });

    it.each(["desktop", "mobile"])("opens entitled student challenges with no unfinished coach entry on %s", async surface => {
        useAuth.mockReturnValue({
            firebaseUser: { uid: "academy-all-access" },
            role: "student",
            isAuthenticated: true,
            logout: jest.fn(),
            studentProfile: {
                name: "在校學生",
                class: "E3",
                membership: {
                    is_active: true,
                    effective_access: {
                        features: { ai_materials: true, pronunciation: true },
                        plan_codes: ["academy_internal"]
                    }
                }
            }
        });

        render(<MemoryRouter initialEntries={["/student/dashboard"]}><MainNavbar /></MemoryRouter>);

        const bar = screen.getByRole("navigation", { name: surface === "desktop" ? "學生桌面導覽" : "學生主要導覽" });
        expect(within(bar).getByRole("link", { name: "冒險" })).toHaveAttribute("href", "/student/speaking-challenges");
        expect(screen.queryByRole("button", { name: /口說教練/, hidden: true })).not.toBeInTheDocument();
        expect(screen.queryByText("準備中，完成測試後開放")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /口說教練/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "開啟功能選單" }));
        expect(await screen.findByRole("link", { name: "個人資料" })).toBeInTheDocument();
    });

    it.each([
        ["no pronunciation entitlement", true, false, "desktop"],
        ["no pronunciation entitlement", true, false, "mobile"],
        ["inactive membership", false, true, "desktop"],
        ["inactive membership", false, true, "mobile"]
    ])("keeps challenges disabled for students with %s (case %#)", async (_label, isActive, pronunciation, surface) => {
        useAuth.mockReturnValue({
            firebaseUser: { uid: "speaking-entry-test" },
            role: "student",
            isAuthenticated: true,
            logout: jest.fn(),
            studentProfile: {
                name: "測試學生",
                membership: {
                    is_active: isActive,
                    effective_access: { features: { pronunciation } }
                }
            }
        });

        render(<MemoryRouter initialEntries={["/student/dashboard"]}><MainNavbar /></MemoryRouter>);
        const bar = screen.getByRole("navigation", { name: surface === "desktop" ? "學生桌面導覽" : "學生主要導覽" });
        expect(within(bar).getByRole("button", { name: "冒險，需要口說方案" })).toHaveAttribute("aria-disabled", "true");
        expect(within(bar).queryByRole("link", { name: "冒險" })).not.toBeInTheDocument();
        expect(screen.queryByText("口說教練")).not.toBeInTheDocument();
        // Clicking the locked entry only explains why; it never opens the adventure.
        fireEvent.click(within(bar).getByRole("button", { name: "冒險，需要口說方案" }));
        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByText("冒險需要「口說方案」。請問老師或家長。")).toBeInTheDocument();
        expect(within(dialog).getByRole("link", { name: "看會員與功能" })).toHaveAttribute("href", "/student/membership");
        fireEvent.click(within(dialog).getByRole("button", { name: "知道了" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it.each(["admin", "teacher"])("preserves the coach destination in desktop and mobile menus for %s", async role => {
        useAuth.mockReturnValue({ firebaseUser: { uid: `${role}-coach-test` }, role, isAuthenticated: true, logout: jest.fn(), studentProfile: { name: "教職員" } });
        getAccessibleCatalog.mockResolvedValue({ categories: [] });
        render(<MemoryRouter initialEntries={[`/${role}/dashboard`]}><MainNavbar /></MemoryRouter>);
        const coachName = "發音教練示範";
        fireEvent.click(await screen.findByRole("button", { name: "教材" }));
        expect(screen.getByRole("link", { name: coachName })).toHaveAttribute("href", "/student/pronunciation");
        fireEvent.click(screen.getByRole("button", { name: "開啟全部功能選單" }));
        expect(await screen.findAllByRole("link", { name: coachName })).toHaveLength(2);
    });

    it("gives admins 學生／作業／教材／設定 and no entry for switched-off pages", async () => {
        useAuth.mockReturnValue({
            firebaseUser: { uid: "admin-test" },
            role: "admin",
            isAuthenticated: true,
            logout: jest.fn(),
            studentProfile: { name: "管理員" }
        });
        getAccessibleCatalog.mockResolvedValue({ categories: [] });

        render(<MemoryRouter initialEntries={["/admin/dashboard"]}><MainNavbar /></MemoryRouter>);
        expect(screen.getByRole("link", { name: "作業" })).toHaveAttribute("href", "/teacher/assignments");
        fireEvent.click(screen.getByRole("button", { name: "教材" }));
        expect(screen.getByRole("link", { name: "口說大挑戰預覽" })).toHaveAttribute("href", "/student/speaking-challenges");

        const musicManagementLink = screen.getByRole("link", { name: "音檔管理" });
        expect(musicManagementLink).toHaveAttribute("href", "/teacher/music/manage");
        expect(screen.queryByRole("link", { name: "建立音檔" })).not.toBeInTheDocument();

        expect(screen.getByRole("link", { name: "口說題庫" })).toHaveAttribute("href", "/admin/speaking-content");
        fireEvent.click(screen.getByRole("button", { name: "設定" }));
        expect(screen.getByRole("link", { name: "會員與啟用碼" })).toHaveAttribute("href", "/admin/membership");
        fireEvent.click(screen.getByRole("button", { name: "學生" }));
        expect(screen.getByRole("link", { name: "在校／離校管理" })).toHaveAttribute("href", "/admin/student-lifecycle");

        fireEvent.click(screen.getByRole("button", { name: "開啟全部功能選單" }));

        expect(await screen.findAllByRole("link", { name: "音檔管理" })).toHaveLength(2);
        expect(screen.getAllByRole("link", { name: "口說題庫" })).toHaveLength(2);
        ["新增連結", "獎品與兌換管理", "教材商品包", "商城訂單與出貨", "等級與晉級測驗", "班級排行榜"].forEach(name => expect(screen.queryByRole("link", { name })).not.toBeInTheDocument());
        expect(screen.queryByRole("link", { name: "建立音檔" })).not.toBeInTheDocument();
    });

    it.each(["admin", "teacher"])("uses the same hierarchical materials navigator for %s", async role => {
        useAuth.mockReturnValue({
            firebaseUser: { uid: `${role}-materials-test` },
            role,
            isAuthenticated: true,
            logout: jest.fn(),
            studentProfile: { name: role === "admin" ? "管理員" : "老師" }
        });
        getAccessibleCatalog.mockResolvedValue({
            categories: [{ id: "workbook", name: "習作本", books: [{ id: 1, code: "Workbook_1", name: "Workbook 1", locked: false }] }, {
                id: "textbook", code: "textbook", name: "課本", books: basicReadingBooks
            }, { id: "listening", name: "聽力本", books: [{ id: 99, code: "Listening_1", name: "聽力本 1", locked: false }] }]
        });

        render(<MemoryRouter initialEntries={[`/${role}/dashboard`]}><MainNavbar /></MemoryRouter>);

        const materialsMenu = await screen.findByRole("button", { name: "教材" });
        fireEvent.click(materialsMenu);
        const materialsDropdown = materialsMenu.closest(".dropdown");
        expect(within(materialsDropdown).queryByText("聽力本")).not.toBeInTheDocument();
        expect(within(materialsDropdown).getByRole("button", { name: "開啟Basic Reading，9 本教材" })).toHaveClass("ae-student-material-entry");
        expect(within(materialsDropdown).getByRole("button", { name: "開啟習作本，1 本教材" })).toHaveClass("ae-student-material-entry");
        fireEvent.click(within(materialsDropdown).getByRole("button", { name: "開啟習作本，1 本教材" }));
        expect(within(materialsDropdown).getByRole("link", { name: /Workbook 1/ })).toHaveAttribute("href", "/student/books/Workbook_1");
    });

    it("keeps admin-only entries out of the teacher menu", async () => {
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
        fireEvent.click(screen.getByRole("button", { name: "教材" }));
        expect(screen.getByRole("link", { name: "口說大挑戰預覽" })).toHaveAttribute("href", "/student/speaking-challenges");
        expect(screen.getByRole("link", { name: "音檔管理" })).toHaveAttribute("href", "/teacher/music/manage");
        expect(screen.queryByRole("link", { name: "口說題庫" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "設定" })).not.toBeInTheDocument();
    });

    it("uses the public nickname and clears the unread badge when notifications are marked read elsewhere", async () => {
        useAuth.mockReturnValue({
            firebaseUser: { uid: "nickname-student" },
            role: "student",
            isAuthenticated: true,
            logout: jest.fn(),
            studentProfile: { nickname: "Sunny Fox", name: "真實姓名", membership: { effective_access: { features: {}, plan_codes: [] } } }
        });
        getStudentNotifications.mockResolvedValue({ notifications: [{ id: 9, title: "新消息", body: "通知內容", read_at: null }] });

        render(<MemoryRouter initialEntries={["/student/dashboard"]}><MainNavbar /></MemoryRouter>);

        expect((await screen.findAllByText("Sunny Fox")).length).toBeGreaterThan(0);
        expect(document.querySelector(".ae-growth-header__name")).toHaveTextContent("Sunny Fox");
        expect(screen.getByRole("link", { name: "查看通知，目前有 1 則未讀" })).toBeInTheDocument();
        act(() => window.dispatchEvent(new CustomEvent("ae:notifications-read", { detail: { notificationIds: "all" } })));
        await waitFor(() => expect(screen.getByRole("link", { name: "查看通知" })).toBeInTheDocument());

        act(() => window.dispatchEvent(new CustomEvent("ae:notifications-read", { detail: { notificationIds: { unreadIds: [9] } } })));
        await waitFor(() => expect(screen.getByRole("link", { name: "查看通知，目前有 1 則未讀" })).toBeInTheDocument());
    });

    it("keeps a retired social notification readable without linking to the removed friends page", async () => {
        getStudentNotifications.mockResolvedValue({ notifications: [{
            id: 10,
            notification_type: "social",
            title: "新的好友邀請",
            body: "Amy 想加你為好友",
            read_at: null
        }] });

        render(
            <MemoryRouter initialEntries={["/student/dashboard"]}>
                <Routes>
                    <Route path="*" element={<><MainNavbar /><LocationProbe /></>} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => expect(document.querySelector(".ae-notification-dropdown .dropdown-toggle")).toBeInTheDocument());
        fireEvent.click(document.querySelector(".ae-notification-dropdown .dropdown-toggle"));
        expect(screen.queryByRole("link", { name: /新的好友邀請/ })).not.toBeInTheDocument();
        fireEvent.click(await screen.findByRole("button", { name: /新的好友邀請/ }));

        expect(screen.getByLabelText("目前路徑")).toHaveTextContent("/student/dashboard");
        expect(markStudentNotificationRead).toHaveBeenCalledWith({ uid: "student-test" }, 10);
    });

    it.each([["admin", "/admin/class-materials"], ["teacher", "/teacher/class-materials"]])("links %s to the appropriate class materials page in both menus", async (role, path) => {
        useAuth.mockReturnValue({ firebaseUser: { uid: `${role}-test` }, role, isAuthenticated: true, logout: jest.fn(), studentProfile: { name: "教職員" } });
        render(<MemoryRouter><MainNavbar /></MemoryRouter>);
        fireEvent.click(screen.getByRole("button", { name: "教材" }));
        expect(screen.getByRole("link", { name: "班級教材設定" })).toHaveAttribute("href", path);
        fireEvent.click(screen.getByRole("button", { name: "開啟全部功能選單" }));
        const links = await screen.findAllByRole("link", { name: "班級教材設定" });
        expect(links).toHaveLength(2);
        links.forEach(link => expect(link).toHaveAttribute("href", path));
    });

    it("highlights the active student route in the full menu", () => {
        render(<MemoryRouter initialEntries={["/student/membership"]}><MainNavbar /></MemoryRouter>);
        fireEvent.click(screen.getByRole("button", { name: "開啟功能選單" }));
        expect(screen.getAllByRole("link", { name: "會員與功能" }).every(link => link.classList.contains("active"))).toBe(true);
        expect(within(screen.getByRole("navigation", { name: "學生主要導覽" })).getByRole("link", { name: "教材" })).not.toHaveClass("active");
    });
});
