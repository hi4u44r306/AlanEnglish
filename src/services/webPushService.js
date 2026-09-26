import { callEdgeFunction } from "./edgeFunctionClient";

const MANAGER = "web-push-manager";
const workerPath = "/web-push-sw.js";
const isAppleMobile = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;

export const getWebPushAvailability = () => {
    if (!window.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return { supported: false, reason: "此瀏覽器或連線方式不支援推播，仍可使用網站內通知。" };
    }
    if (isAppleMobile() && !isStandalone()) {
        return { supported: false, reason: "iPhone／iPad 請先用 Safari 將此網站加入主畫面，再從主畫面圖示開啟。" };
    }
    if (Notification.permission === "denied") {
        return { supported: false, reason: "通知權限已被封鎖，請到手機的網站或 App 通知設定重新允許。" };
    }
    return { supported: true, reason: "" };
};

const keyBytes = base64url => {
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return Uint8Array.from(binary, character => character.charCodeAt(0));
};

export const getWebPushRegistration = () => navigator.serviceWorker.register(workerPath, { scope: "/" });

export const getWebPushConfig = firebaseUser => callEdgeFunction(MANAGER, firebaseUser, { action: "config" });

export const getCurrentWebPushStatus = async firebaseUser => {
    const availability = getWebPushAvailability();
    if (!availability.supported) return { ...availability, active: false };
    const registration = await getWebPushRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { ...availability, active: false };
    const result = await callEdgeFunction(MANAGER, firebaseUser, { action: "status", endpoint: subscription.endpoint });
    return { ...availability, active: result.active === true };
};

export const enableWebPush = async (firebaseUser, publicKey) => {
    const availability = getWebPushAvailability();
    if (!availability.supported) throw new Error(availability.reason);
    // This must be the first asynchronous browser operation after the button click on iOS.
    if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("未取得通知權限。請在裝置設定允許通知後再試。");
    }
    if (Notification.permission !== "granted") throw new Error("通知權限尚未開啟");
    const registration = await getWebPushRegistration();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true, applicationServerKey: keyBytes(publicKey)
        });
    }
    try {
        await callEdgeFunction(MANAGER, firebaseUser, {
            action: "subscribe", endpoint: subscription.endpoint,
            keys: subscription.toJSON().keys,
            device_label: isAppleMobile() ? "iPhone／iPad 主畫面" : "Android／瀏覽器"
        });
    } catch (error) {
        await subscription.unsubscribe().catch(() => {});
        throw error;
    }
};

export const disableWebPush = async firebaseUser => {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration(workerPath);
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    try {
        await callEdgeFunction(MANAGER, firebaseUser, { action: "unsubscribe", endpoint: subscription.endpoint });
    } finally {
        await subscription.unsubscribe();
    }
};

export const unsubscribeBrowserPush = async () => {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration(workerPath);
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
};

export const disconnectWebPushOnLogout = async firebaseUser => {
    try { await disableWebPush(firebaseUser); }
    catch { /* Signing out must still proceed; the browser subscription was removed locally. */ }
};
