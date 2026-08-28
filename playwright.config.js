const { defineConfig, devices } = require("@playwright/test");

const port = Number(process.env.E2E_PORT || 4173);
const localBaseUrl = `http://127.0.0.1:${port}`;
const baseURL = process.env.E2E_BASE_URL || localBaseUrl;

module.exports = defineConfig({
    testDir: "./tests/e2e",
    outputDir: "test-results",
    fullyParallel: true,
    timeout: 30_000,
    expect: {
        timeout: 10_000
    },
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        [process.env.CI ? "line" : "list"],
        ["html", { open: "never" }]
    ],
    use: {
        baseURL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure"
    },
    projects: [
        {
            name: "desktop-chromium",
            use: {
                ...devices["Desktop Chrome"],
                viewport: { width: 1600, height: 900 }
            }
        },
        {
            name: "mobile-chromium",
            use: {
                ...devices["Pixel 5"],
                browserName: "chromium",
                viewport: { width: 412, height: 915 }
            }
        }
    ],
    webServer: process.env.E2E_BASE_URL ? undefined : {
        command: "npm start",
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
            BROWSER: "none",
            HOST: "127.0.0.1",
            PORT: String(port)
        }
    }
});
