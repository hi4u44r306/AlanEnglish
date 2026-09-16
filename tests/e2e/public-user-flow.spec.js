const { test, expect } = require("@playwright/test");
const {
    expectHealthyPage,
    expectNoRuntimeErrors,
    startRuntimeAudit
} = require("./support/navigation");

test.describe("新使用者與公開商城流程", () => {
    test("首頁可找到試用註冊，表單欄位與返回登入入口完整", async ({ page }) => {
        const errors = startRuntimeAudit(page);
        await page.goto("/");
        await page.getByRole("link", { name: /免費試用\s*7\s*天/ }).first().click();

        await expect(page).toHaveURL(/\/freetrial\/?$/);
        await expect(page.getByRole("heading", { name: "免費體驗 Alan English" })).toBeVisible();
        await expect(page.getByLabel("登入與收信 Email")).toBeVisible();
        await expect(page.getByRole("button", { name: "開始 7 天免費試用" })).toBeVisible();
        await expect(page.getByRole("link", { name: /登入/ }).first()).toBeVisible();
        expectNoRuntimeErrors(errors);
    });

    test("商城註冊頁清楚說明 Email 驗證與帳號分流", async ({ page }) => {
        const errors = startRuntimeAudit(page);
        const response = await page.goto("/shop/register");
        expect(response?.status()).toBeLessThan(400);
        await expectHealthyPage(page);
        await expect(page.getByRole("heading", { name: "建立商城帳號" })).toBeVisible();
        await expect(page.getByText(/商城帳號和聽力平台帳號完全分開/)).toBeVisible();
        await expect(page.getByRole("heading", { name: /尚未完成驗證/ })).toBeVisible();
        expectNoRuntimeErrors(errors);
    });

    test("公開販售暫停時不會誤導使用者進入正式付款", async ({ page }) => {
        const errors = startRuntimeAudit(page);
        await page.goto("/shop/checkout");
        await expect(page.getByRole("heading", { name: "教材包暫未開放販售" })).toBeVisible();
        await expect(page.getByText(/目前無法加入購物車或結帳/)).toBeVisible();
        await expect(page.getByRole("button", { name: /付款|Stripe/ })).toHaveCount(0);
        expectNoRuntimeErrors(errors);
    });
});
