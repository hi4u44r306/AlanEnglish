const { test, expect } = require("@playwright/test");
const {
    expectHealthyPage,
    expectInViewport,
    expectNoRuntimeErrors,
    startRuntimeAudit
} = require("./support/navigation");

const desktopLinks = [
    { name: "功能特色", url: /\/#features$/ },
    { name: "學習方式", url: /\/#learning-paths$/ },
    { name: "會員方案", url: /\/#plans$/ },
    { name: "常見問題", url: /\/#faq$/ },
    { name: "教材商城", url: /\/shop\/?$/ },
    { name: "登入", url: /\/login\/?$/ },
    { name: /免費試用\s*7\s*天/, url: /\/freetrial\/?$/ }
];

test.describe("公開 Navigation", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    for (const target of desktopLinks) {
        test(`Navbar「${target.name}」存在、可見且可導覽`, async ({ page }) => {
            const errors = startRuntimeAudit(page);
            await page.goto("/");
            const link = page.getByRole("link", { name: target.name, exact: typeof target.name === "string" }).first();
            await expectInViewport(link);
            await link.click();
            await expect(page).toHaveURL(target.url);
            await expectHealthyPage(page);
            expectNoRuntimeErrors(errors);
        });
    }

    test("瀏覽器返回可回到上一個公開流程", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("navigation").getByRole("link", { name: /教材商城/ }).first().click();
        await expect(page).toHaveURL(/\/shop\/?$/);
        await page.goBack();
        await expect(page).toHaveURL(/\/$/);
    });
});
