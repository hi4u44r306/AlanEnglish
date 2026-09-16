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

    page.on("requestfailed", request => {
        const failure = request.failure()?.errorText || "unknown failure";
        if (!failure.includes("ERR_ABORTED")) {
            errors.push(`requestfailed: ${request.method()} ${request.url()} (${failure})`);
        }
    });

    return errors;
};

const expectInViewport = async locator => {
    await expect(locator).toBeVisible();
    await locator.scrollIntoViewIfNeeded();
    await expect(locator).toBeInViewport({ ratio: 0.9 });
    const box = await locator.boundingBox();
    expect(box, "元素沒有可點擊的 bounding box").not.toBeNull();

    const viewport = locator.page().viewportSize();
    expect(viewport, "測試沒有 viewport 資訊").not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
};

const expectNoHorizontalOverflow = async page => {
    const dimensions = await page.locator("html").evaluate(element => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth
    }));

    expect(
        dimensions.scrollWidth,
        `頁面出現水平溢位：scrollWidth=${dimensions.scrollWidth}, clientWidth=${dimensions.clientWidth}`
    ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
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
    expectInViewport,
    expectNoHorizontalOverflow,
    expectNoRuntimeErrors,
    getInternalLinks,
    startRuntimeAudit
};
