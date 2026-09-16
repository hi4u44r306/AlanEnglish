const { test, expect } = require("@playwright/test");
const { login } = require("./support/auth");
const {
    expectHealthyPage,
    expectNoRuntimeErrors,
    startRuntimeAudit
} = require("./support/navigation");

const identifier = process.env.E2E_STUDENT_IDENTIFIER;
const password = process.env.E2E_STUDENT_PASSWORD;

test.describe("學生主要學習流程", () => {
    test.skip(!identifier || !password, "未提供 E2E_STUDENT_IDENTIFIER／E2E_STUDENT_PASSWORD");

    test("排行榜可進入口說大挑戰，且不啟用麥克風或寫入進度", async ({ page }) => {
        const errors = startRuntimeAudit(page);
        await login(page, identifier, password);

        await page.getByRole("button", { name: "開口說", exact: true }).click();
        const speakingLink = page.locator('a[href="/student/speaking-challenges"]').first();
        await expect(speakingLink).toBeVisible();
        await speakingLink.click();

        await expect(page).toHaveURL(/\/student\/speaking-challenges\/?$/);
        await expect(page.getByRole("heading", { name: "口說大挑戰" })).toBeVisible();
        await expectHealthyPage(page);
        expectNoRuntimeErrors(errors);
    });
});
