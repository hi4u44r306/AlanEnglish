const { test, expect } = require("@playwright/test");
const { expectHealthyPage } = require("./support/navigation");
const { login } = require("./support/auth");

const credentials = [
    { role: "student", identifier: process.env.E2E_STUDENT_IDENTIFIER, password: process.env.E2E_STUDENT_PASSWORD, home: /\/student\/(leaderboard|dashboard)/ },
    { role: "teacher", identifier: process.env.E2E_TEACHER_IDENTIFIER, password: process.env.E2E_TEACHER_PASSWORD, home: /\/teacher\/dashboard/ },
    { role: "admin", identifier: process.env.E2E_ADMIN_IDENTIFIER, password: process.env.E2E_ADMIN_PASSWORD, home: /\/admin\/dashboard/ }
];

test.describe("Authentication", () => {
    test("未登入進入 protected route 會導向登入頁", async ({ page }) => {
        await page.goto("/student/settings");
        await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
        await expect(page.getByRole("heading", { name: /歡迎回來/ })).toBeVisible();
    });

    test("錯誤密碼會留在登入頁並顯示錯誤", async ({ page }) => {
        await page.goto("/login");
        await page.getByLabel("帳號或 Email").fill("qa-invalid-user@example.invalid");
        await page.getByLabel("密碼", { exact: true }).fill("NotTheRightPassword123!");
        await page.getByRole("button", { name: "登入", exact: true }).click();

        await expect(page).toHaveURL(/\/login\/?$/);
        await expect(page.locator(".Toastify__toast--error").first()).toBeVisible({ timeout: 20_000 });
    });

    for (const account of credentials) {
        test(`${account.role} 登入、重新整理與角色首頁`, async ({ page }) => {
            test.skip(!account.identifier || !account.password, `缺少 ${account.role} E2E 測試帳密`);
            await login(page, account.identifier, account.password);
            await expect(page).toHaveURL(account.home);
            await expectHealthyPage(page);

            const currentUrl = page.url();
            await page.reload();
            await expect(page).toHaveURL(currentUrl);
            await expectHealthyPage(page);
        });
    }
});
