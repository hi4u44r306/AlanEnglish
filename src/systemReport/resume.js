// 重新整理後回到同一頁、同一個捲動位置，並簡短提示。網址本來就會保留，所以只需要記捲動位置。
const KEY = "ae-resume";
const MAX_AGE_MS = 3 * 60 * 1000;

export const saveResume = () => {
    try {
        window.sessionStorage.setItem(KEY, JSON.stringify({ path: window.location.pathname + window.location.search, scrollY: Math.round(window.scrollY || 0), at: Date.now() }));
    } catch (error) { /* 存不了就算了，還是會回到同一個網址 */ }
};

const showBanner = text => {
    const banner = document.createElement("div");
    banner.setAttribute("role", "status");
    banner.textContent = text;
    banner.style.cssText = "position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2500;max-width:calc(100% - 32px);padding:12px 18px;border-radius:14px;background:#17365d;color:#fff;font:700 15px/1.4 sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);text-align:center";
    document.body.appendChild(banner);
    window.setTimeout(() => banner.remove(), 4500);
};

export const restoreResume = () => {
    let record = null;
    try {
        record = JSON.parse(window.sessionStorage.getItem(KEY) || "null");
        window.sessionStorage.removeItem(KEY);
    } catch (error) { return false; }
    if (!record || Date.now() - record.at > MAX_AGE_MS) return false;
    if (record.path !== window.location.pathname + window.location.search) return false;
    // 頁面是延遲載入的，晚一點再捲動才不會被覆蓋。
    [400, 1200].forEach(delay => window.setTimeout(() => window.scrollTo(0, record.scrollY || 0), delay));
    window.setTimeout(() => showBanner("已重新整理，繼續剛才的內容"), 600);
    return true;
};
