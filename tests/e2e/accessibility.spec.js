const { test, expect } = require("@playwright/test");
const axePath = require.resolve("axe-core/axe.min.js");

test.describe("基本 Accessibility", () => {
    test("登入欄位有可存取名稱且可用鍵盤操作", async ({ page }) => {
        await page.goto("/login");
        const identifier = page.getByLabel("帳號或 Email");
        const password = page.getByLabel("密碼", { exact: true });
        const submit = page.getByRole("button", { name: "登入", exact: true });

        await expect(identifier).toBeVisible();
        await expect(password).toBeVisible();
        await expect(submit).toBeVisible();

        await identifier.focus();
        await expect(identifier).toBeFocused();
        for (let attempt = 0; attempt < 4; attempt += 1) {
            if (await password.evaluate(element => element === document.activeElement)) break;
            await page.keyboard.press("Tab");
        }
        await expect(password).toBeFocused();
    });

    test("首頁可見 icon-only buttons 都有 accessible name", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/");
        const buttons = page.locator("button:visible");
        const count = await buttons.count();

        for (let index = 0; index < count; index += 1) {
            const name = await buttons.nth(index).getAttribute("aria-label")
                || (await buttons.nth(index).innerText()).trim()
                || await buttons.nth(index).getAttribute("title");
            expect(name, `第 ${index + 1} 個可見按鈕沒有 accessible name`).toBeTruthy();
        }
    });

    for (const route of ["/", "/login"]) {
        test(`${route} 沒有 serious 或 critical axe 違規`, async ({ page }) => {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.goto(route);
            await page.addScriptTag({ path: axePath });
            const results = await page.evaluate(async () => window.axe.run(document, {
                resultTypes: ["violations"],
                rules: {
                    "color-contrast": { enabled: true }
                }
            }));
            const severeViolations = results.violations.filter(violation => (
                violation.impact === "serious" || violation.impact === "critical"
            ));

            expect(
                severeViolations,
                severeViolations.map(violation => `${violation.id}: ${violation.help} (${violation.nodes.length})`).join("\n")
            ).toEqual([]);
        });
    }

    test("手機首頁主要操作的觸控範圍至少 44px", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto("/");
        const controls = [
            page.getByRole("link", { name: "登入", exact: true }).first(),
            page.getByRole("button", { name: "Toggle navigation" }),
            page.getByRole("link", { name: /免費試用\s*7\s*天/ }).first()
        ];

        for (const control of controls) {
            await expect(control).toBeVisible();
            const box = await control.boundingBox();
            expect(box, "主要操作沒有觸控範圍").not.toBeNull();
            expect(box.height, "主要操作高度小於 44px").toBeGreaterThanOrEqual(44);
        }
    });
});
