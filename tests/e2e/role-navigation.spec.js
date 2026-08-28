const { test, expect } = require("@playwright/test");
const { expectHealthyPage } = require("./support/navigation");

const roleCases = [
    {
        role: "student",
        label: "學生",
        identifierEnv: "E2E_STUDENT_IDENTIFIER",
        passwordEnv: "E2E_STUDENT_PASSWORD",
        allowedRoute: "/student/settings",
        allowedLink: "/student/review",
        absentLink: "/teacher/music/manage",
        forbiddenRoute: "/admin/dashboard",
        redirectedHome: /\/student\/(?:dashboard|membership)$/
    },
    {
        role: "teacher",
        label: "老師",
        identifierEnv: "E2E_TEACHER_IDENTIFIER",
        passwordEnv: "E2E_TEACHER_PASSWORD",
        allowedRoute: "/teacher/accounts",
        allowedLink: "/teacher/music/manage",
        absentLink: "/admin/links",
        forbiddenRoute: "/admin/dashboard",
        redirectedHome: /\/teacher\/dashboard$/
    },
    {
        role: "admin",
        label: "管理員",
        identifierEnv: "E2E_ADMIN_IDENTIFIER",
        passwordEnv: "E2E_ADMIN_PASSWORD",
        allowedRoute: "/admin/links",
        allowedLink: "/admin/links",
        absentLink: "/student/review",
        forbiddenRoute: null,
        redirectedHome: /\/admin\/dashboard$/
    }
];

const login = async (page, identifier, password) => {
    await page.goto("/login");
    await page.getByLabel("帳號或 Email").fill(identifier);
    const passwordInput = page.getByLabel("密碼", { exact: true });
    await passwordInput.fill(password);
    await page.getByRole("button", { name: "登入", exact: true }).click();

    await passwordInput.evaluate(input => {
        const valueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
        )?.set;

        valueSetter?.call(input, "");
        input.dispatchEvent(new Event("input", { bubbles: true }));
    }).catch(() => {});

    const outcome = await Promise.race([
        page.waitForURL(url => !/\/login\/?$/.test(url.pathname), { timeout: 20_000 })
            .then(() => ({ type: "success" })),
        page.locator(".Toastify__toast--error").first().waitFor({ state: "visible", timeout: 20_000 })
            .then(async () => ({
                type: "error",
                message: (await page.locator(".Toastify__toast--error").first().innerText()).trim()
            }))
    ]);

    if (outcome.type === "error") {
        throw new Error(`登入失敗：${outcome.message}`);
    }
};

for (const roleCase of roleCases) {
    test.describe(`${roleCase.label}角色導覽`, () => {
        const identifier = process.env[roleCase.identifierEnv];
        const password = process.env[roleCase.passwordEnv];

        test.skip(!identifier || !password, `未提供 ${roleCase.identifierEnv}／${roleCase.passwordEnv}`);

        test("登入後只顯示符合角色的導覽入口", async ({ page }) => {
            await login(page, identifier, password);

            await expect(page.locator(`a[href="${roleCase.allowedLink}"]`).first()).toBeAttached();
            await expect(page.locator(`a[href="${roleCase.absentLink}"]`)).toHaveCount(0);
        });

        test("可進入角色允許的頁面", async ({ page }) => {
            await login(page, identifier, password);

            await page.goto(roleCase.allowedRoute);
            await expect(page).toHaveURL(new RegExp(`${roleCase.allowedRoute.replaceAll("/", "\\/")}$`));
            await expectHealthyPage(page);
        });

        if (roleCase.forbiddenRoute) {
            test("直接輸入未授權網址會回到角色首頁", async ({ page }) => {
                await login(page, identifier, password);

                await page.goto(roleCase.forbiddenRoute);
                await expect(page).toHaveURL(roleCase.redirectedHome);
                await expectHealthyPage(page);
            });
        }
    });
}
