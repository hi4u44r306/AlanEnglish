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

module.exports = { login };
