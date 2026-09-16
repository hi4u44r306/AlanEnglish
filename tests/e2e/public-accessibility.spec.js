const { test, expect } = require("@playwright/test");
const axePath = require.resolve("axe-core/axe.min.js");

const expectNoSevereAxeViolations = async (page, route) => {
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
};

test.describe("公開頁 Accessibility 回歸", () => {
    for (const route of ["/", "/login"]) {
        test(`${route} 沒有 serious 或 critical axe 違規`, async ({ page }) => {
            await page.setViewportSize({ width: 390, height: 844 });
            await expectNoSevereAxeViolations(page, route);
        });
    }

    test("方案比較表可由鍵盤取得焦點並水平捲動", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/");
        const tableRegion = page.getByRole("region", { name: /方案比較表/ });

        await expect(tableRegion).toBeVisible();
        await tableRegion.focus();
        await expect(tableRegion).toBeFocused();
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => tableRegion.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    });

    test("手機選單按鈕使用中文可存取名稱", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/");
        await expect(page.getByRole("button", { name: "開啟導覽選單" })).toBeVisible();
    });
});
