// 讓網站符合「可安裝」條件。同一支 worker 也負責推播；不快取任何頁面或 API。
export const registerServiceWorker = () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) return;
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/web-push-sw.js", { scope: "/" }).catch(() => {});
    });
};
