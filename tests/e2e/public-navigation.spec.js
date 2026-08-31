const { test, expect } = require("@playwright/test");
const {
    expectHealthyPage,
    expectNoRuntimeErrors,
    getInternalLinks,
    startRuntimeAudit
} = require("./support/navigation");

const APP_404_HEADING = "404";

const publicRoutes = [
    { path: "/", heading: /教材音檔/ },
    { path: "/home", heading: /每天聽一點.*讓孩子聽懂英文.*也更有自信說出來/ },
    { path: "/login", heading: /歡迎回來/ },
    { path: "/forgot-password", heading: "忘記密碼" },
    { path: "/support", heading: "聯絡客服" },
    { path: "/freetrial", heading: "免費體驗 Alan English" }
];

const legacyRedirects = [
    { from: "/links", to: "/" },
    { from: "/showcase", to: "/home" },
    { from: "/solve", to: "/forgot-password" },
    { from: "/linksadmin", to: "/login" },
    { from: "/teacher/add-music", to: "/login" },
    { from: "/editnavbar", to: "/login" }
];

const protectedRoutes = [
    "/student/dashboard",
    "/student/assignments",
    "/student/review",
    "/student/weekly-report",
    "/student/membership",
    "/student/settings",
    "/student/notifications",
    "/student/level",
    "/student/leaderboard",
    "/student/rewards",
    "/student/conversation",
    "/student/ai-generator",
    "/billing/success",
    "/account/security",
    "/teacher/dashboard",
    "/teacher/reports",
    "/teacher/assignments",
    "/teacher/accounts",
    "/teacher/accounts/create",
    "/teacher/music/manage",
    "/teacher/leaderboard",
    "/admin/dashboard",
    "/admin/reports",
    "/admin/accounts",
    "/admin/accounts/import",
    "/admin/leaderboard",
    "/admin/rewards",
    "/admin/links",
    "/admin/membership",
    "/admin/api-usage",
    "/admin/levels",
    "/admin/catalog",
    "/admin/legacy-cleanup",
    "/admin/support"
];

test.describe("公開頁面導覽", () => {
    for (const route of publicRoutes) {
        test(`${route.path} 可以開啟且沒有執行期錯誤`, async ({ page }) => {
            const runtimeErrors = startRuntimeAudit(page);

            const response = await page.goto(route.path);

            expect(response?.status()).toBeLessThan(400);
            await expectHealthyPage(page);
            await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
            expectNoRuntimeErrors(runtimeErrors);
        });
    }

    test("公開頁面的站內連結不會進入 404", async ({ page }) => {
        const sourceRoutes = ["/", "/home", "/login"];
        const discoveredLinks = new Set();

        for (const sourceRoute of sourceRoutes) {
            await page.goto(sourceRoute);
            for (const link of await getInternalLinks(page)) {
                discoveredLinks.add(link);
            }
        }

        expect(discoveredLinks.size).toBeGreaterThan(0);

        for (const link of discoveredLinks) {
            const response = await page.goto(link);
            expect(response?.status(), `站內連結 ${link} 回傳錯誤狀態`).toBeLessThan(400);
            await expectHealthyPage(page);
        }
    });
});

test.describe("重新導向與路由保護", () => {
    for (const redirect of legacyRedirects) {
        test(`${redirect.from} 重新導向至 ${redirect.to}`, async ({ page }) => {
            await page.goto(redirect.from);
            await expect(page).toHaveURL(new RegExp(`${redirect.to.replace("/", "\\/")}(?:\\?.*)?$`));
            await expectHealthyPage(page);
        });
    }

    test("未登入時所有受保護路由都回到登入頁", async ({ page }) => {
        for (const route of protectedRoutes) {
            await page.goto(route);
            await expect(page, `${route} 沒有正確套用登入保護`).toHaveURL(/\/login(?:\?.*)?$/);
            await expect(page.getByRole("heading", { name: /歡迎回來/ })).toBeVisible();
        }
    });

    test("未知網址顯示正式 404 頁面", async ({ page }) => {
        await page.goto("/__playwright_unknown_route__");
        await expect(page.getByRole("heading", { name: APP_404_HEADING, exact: true })).toBeVisible();
        await expect(page.getByText("頁面不存在", { exact: true })).toBeVisible();
    });
});
