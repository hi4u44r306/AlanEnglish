const { test, expect } = require("@playwright/test");
const {
    expectInViewport,
    expectNoHorizontalOverflow
} = require("./support/navigation");

const mobileViewports = [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 }
];

const menuButtonName = /Toggle navigation|開啟.*選單|選單|menu/i;

for (const viewport of mobileViewports) {
    test.describe(`${viewport.width}x${viewport.height} 行動導覽`, () => {
        test.use({ viewport });

        test("漢堡選單可開啟、所有主要入口可見、可用 ESC 關閉", async ({ page }) => {
            await page.goto("/");
            await expectNoHorizontalOverflow(page);

            const menuButton = page.getByRole("button", { name: menuButtonName }).first();
            await expectInViewport(menuButton);
            await menuButton.click();

            for (const name of ["功能特色", "學習方式", "會員方案", "常見問題", "教材商城", "登入"]) {
                await expectInViewport(page.getByRole("link", { name: new RegExp(name) }).last());
            }

            await page.keyboard.press("Escape");
            await expect(page.getByRole("link", { name: /功能特色/ }).last()).not.toBeVisible();
        });

        test("手機選單的登入入口可點擊並正確收合", async ({ page }) => {
            await page.goto("/");
            await page.getByRole("button", { name: menuButtonName }).first().click();
            await page.getByRole("link", { name: "登入", exact: true }).last().click();
            await expect(page).toHaveURL(/\/login\/?$/);
            await expect(page.getByRole("heading", { name: /歡迎回來/ })).toBeVisible();
        });
    });
}

test.describe("1440x900 桌面導覽", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("桌面 Navbar 顯示完整主要入口且不顯示漢堡按鈕", async ({ page }) => {
        await page.goto("/");
        await expectNoHorizontalOverflow(page);
        await expectInViewport(page.getByRole("link", { name: "功能特色", exact: true }));
        await expectInViewport(page.getByRole("navigation").getByRole("link", { name: "登入", exact: true }).first());
        await expect(page.getByRole("button", { name: menuButtonName })).toHaveCount(0);
    });
});
