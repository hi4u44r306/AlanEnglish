const { expect } = require("@playwright/test");

const APP_404_HEADING = "404";

const startRuntimeAudit = page => {
    const errors = [];

    page.on("pageerror", error => {
        errors.push(`pageerror: ${error.message}`);
    });

    page.on("console", message => {
        if (message.type() === "error") {
            errors.push(`console.error: ${message.text()}`);
        }
    });

    page.on("response", response => {
        const request = response.request();
        const importantResource = ["document", "script", "stylesheet", "image", "font"]
            .includes(request.resourceType());

        if (importantResource && response.status() >= 400) {
            errors.push(`${response.status()} ${request.resourceType()}: ${response.url()}`);
        }
    });

    return errors;
};

const expectHealthyPage = async page => {
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.getByRole("heading", { name: APP_404_HEADING, exact: true })).toHaveCount(0);
};

const expectNoRuntimeErrors = errors => {
    expect(errors, errors.join("\n")).toEqual([]);
};

const getInternalLinks = async page => {
    const baseOrigin = new URL(page.url()).origin;
    const hrefs = await page.locator("a[href]").evaluateAll(anchors => (
        anchors.map(anchor => anchor.href)
    ));

    return [...new Set(hrefs)]
        .map(href => new URL(href))
        .filter(url => url.origin === baseOrigin)
        .filter(url => !url.pathname.startsWith("/.netlify/"))
        .map(url => `${url.pathname}${url.search}`);
};

module.exports = {
    expectHealthyPage,
    expectNoRuntimeErrors,
    getInternalLinks,
    startRuntimeAudit
};
