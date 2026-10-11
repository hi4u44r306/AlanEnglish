// 「加入主畫面」教學用的裝置判斷與一鍵安裝事件。
// 只讀取瀏覽器資訊，不送出任何資料。

export const INSTALL_GUIDE_PATH = "/install";

const IN_APP_BROWSERS = [
    ["line", /\bLine\//i, "LINE"],
    ["facebook", /FBAN|FBAV|FB_IAB/i, "Facebook"],
    ["instagram", /Instagram/i, "Instagram"],
    ["messenger", /Messenger/i, "Messenger"]
];

export const detectInstallEnvironment = (nav = typeof navigator === "undefined" ? {} : navigator) => {
    const ua = nav.userAgent || "";
    const isIPadDesktopMode = /Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1;
    const isIOS = /iPhone|iPad|iPod/.test(ua) || isIPadDesktopMode;
    const isAndroid = /Android/i.test(ua);
    const inApp = IN_APP_BROWSERS.find(([, pattern]) => pattern.test(ua));

    let browser = "other";
    if (inApp) browser = inApp[0];
    else if (isIOS) browser = /CriOS/.test(ua) ? "ios-chrome" : /FxiOS|EdgiOS|OPiOS/.test(ua) ? "ios-other" : "safari";
    else if (/SamsungBrowser/i.test(ua)) browser = "samsung";
    else if (/Chrome\//.test(ua)) browser = "chrome";

    return {
        platform: isIOS ? "ios" : isAndroid ? "android" : "desktop",
        browser,
        inAppName: inApp ? inApp[2] : ""
    };
};

export const isRunningAsInstalledApp = () => {
    if (typeof window === "undefined") return false;
    return Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches) || window.navigator?.standalone === true;
};

// LINE 內建瀏覽器支援用這個參數改以手機預設瀏覽器開啟。
export const externalBrowserUrl = href => {
    const url = new URL(href);
    url.searchParams.set("openExternalBrowser", "1");
    return url.toString();
};

// Android Chrome 的安裝事件可能在教學頁載入前就觸發，所以在模組載入時先接住。
let deferredInstallPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach(listener => listener(deferredInstallPrompt));

if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        deferredInstallPrompt = event;
        notify();
    });
    window.addEventListener("appinstalled", () => {
        deferredInstallPrompt = null;
        notify();
    });
}

export const getInstallPrompt = () => deferredInstallPrompt;

export const subscribeInstallPrompt = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const runInstallPrompt = async () => {
    const promptEvent = deferredInstallPrompt;
    if (!promptEvent) return "unavailable";
    deferredInstallPrompt = null;
    notify();
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    return choice?.outcome || "dismissed";
};
