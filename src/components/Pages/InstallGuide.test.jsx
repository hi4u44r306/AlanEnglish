import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import InstallGuide from "./InstallGuide";
import InstallEntry from "../fragment/InstallEntry";
import { detectInstallEnvironment, externalBrowserUrl } from "../../utils/installGuide";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const IPHONE_LINE = `${IPHONE_SAFARI} Line/14.9.0`;

const useUserAgent = userAgent => {
    Object.defineProperty(window.navigator, "userAgent", { value: userAgent, configurable: true });
};

const renderGuide = () => render(<MemoryRouter><InstallGuide /></MemoryRouter>);

describe("detectInstallEnvironment", () => {
    it("recognises phones, in-app browsers, and iPad desktop mode", () => {
        expect(detectInstallEnvironment({ userAgent: IPHONE_SAFARI })).toMatchObject({ platform: "ios", browser: "safari" });
        expect(detectInstallEnvironment({ userAgent: ANDROID_CHROME })).toMatchObject({ platform: "android", browser: "chrome" });
        expect(detectInstallEnvironment({ userAgent: IPHONE_LINE })).toMatchObject({ platform: "ios", browser: "line", inAppName: "LINE" });
        expect(detectInstallEnvironment({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", maxTouchPoints: 5 }).platform).toBe("ios");
        expect(detectInstallEnvironment({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36" }).platform).toBe("desktop");
    });

    it("builds a LINE external-browser link", () => {
        expect(externalBrowserUrl("https://alanenglish.com.tw/install")).toBe("https://alanenglish.com.tw/install?openExternalBrowser=1");
    });
});

describe("InstallGuide", () => {
    const originalUserAgent = window.navigator.userAgent;
    afterEach(() => useUserAgent(originalUserAgent));

    it("shows the three iPhone steps on an iPhone", () => {
        useUserAgent(IPHONE_SAFARI);
        renderGuide();

        expect(screen.getByRole("heading", { level: 1, name: "把 Alan English 放到手機桌面" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "iPhone／iPad" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: /點「分享」按鈕/ })).toBeInTheDocument();
        expect(screen.getByText("往下滑，點「加入主畫面」")).toBeInTheDocument();
        expect(screen.getByText("點右上角的「加入」")).toBeInTheDocument();
        expect(screen.queryByText("先用手機打開這一頁")).not.toBeInTheDocument();
    });

    it("shows Android steps on Android and lets the parent switch device", () => {
        useUserAgent(ANDROID_CHROME);
        renderGuide();

        expect(screen.getByRole("button", { name: /點右上角的「⋮」/ })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "iPhone／iPad" }));
        expect(screen.getByRole("button", { name: /點「分享」按鈕/ })).toBeInTheDocument();
    });

    it("tells LINE visitors to open the real browser first", () => {
        useUserAgent(IPHONE_LINE);
        renderGuide();

        expect(screen.getByRole("heading", { name: "先換一個地方打開" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Safari/ })).toHaveAttribute("href", expect.stringContaining("openExternalBrowser=1"));
    });

    it("asks desktop visitors to open the page on a phone", () => {
        renderGuide();

        expect(screen.getByRole("heading", { name: "先用手機打開這一頁" })).toBeInTheDocument();
    });

    it("highlights the step a parent taps", () => {
        useUserAgent(IPHONE_SAFARI);
        renderGuide();

        const second = screen.getByText("往下滑，點「加入主畫面」").closest("button");
        fireEvent.click(second);
        expect(second).toHaveAttribute("aria-current", "step");
        expect(screen.getByRole("button", { name: "▶ 播放示範" })).toBeInTheDocument();
    });
});

describe("InstallEntry", () => {
    it("links to the guide, and hides once opened from the home screen", () => {
        const { unmount } = render(<MemoryRouter><InstallEntry /></MemoryRouter>);
        expect(screen.getByRole("link", { name: /加到手機桌面/ })).toHaveAttribute("href", "/install");
        unmount();

        window.matchMedia = jest.fn().mockReturnValue({ matches: true });
        render(<MemoryRouter><InstallEntry /></MemoryRouter>);
        expect(screen.queryByRole("link", { name: /加到手機桌面/ })).not.toBeInTheDocument();
        delete window.matchMedia;
    });
});
