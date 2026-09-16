const { test, expect } = require("@playwright/test");
const {
    expectHealthyPage,
    expectNoHorizontalOverflow
} = require("./support/navigation");

const viewports = [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 }
];

const routes = ["/", "/login", "/forgot-password", "/support", "/freetrial", "/materials", "/shop", "/links"];

for (const viewport of viewports) {
    test.describe(`${viewport.width}x${viewport.height} RWD`, () => {
        test.use({ viewport });

        for (const route of routes) {
            test(`${route} 沒有水平溢位或空白頁`, async ({ page }) => {
                const response = await page.goto(route);
                expect(response?.status()).toBeLessThan(400);
                await expectHealthyPage(page);
                await expectNoHorizontalOverflow(page);
            });
        }
    });
}
