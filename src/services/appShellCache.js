const CACHE_PREFIX = "ae-app-shell-v1";

const safeStorage = () => {
    try {
        return window.localStorage;
    } catch (error) {
        return null;
    }
};

const cacheKey = (firebaseUid, section) => `${CACHE_PREFIX}:${firebaseUid}:${section}`;

export const readAppShellCache = (firebaseUid, section, maxAgeMs) => {
    if (!firebaseUid || typeof window === "undefined") return null;

    try {
        const raw = safeStorage()?.getItem(cacheKey(firebaseUid, section));
        if (!raw) return null;

        const entry = JSON.parse(raw);
        if (!entry || !Number.isFinite(entry.cachedAt)) return null;
        if (Date.now() - entry.cachedAt > maxAgeMs) return null;
        return entry.value ?? null;
    } catch (error) {
        return null;
    }
};

export const writeAppShellCache = (firebaseUid, section, value) => {
    if (!firebaseUid || typeof window === "undefined") return;

    try {
        safeStorage()?.setItem(cacheKey(firebaseUid, section), JSON.stringify({
            cachedAt: Date.now(),
            value
        }));
    } catch (error) {
        // 快取僅用於加速首屏；儲存空間不足時不影響正常功能。
    }
};

export const scheduleWhenIdle = callback => {
    if (typeof window === "undefined") return () => {};

    if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(callback, { timeout: 1200 });
        return () => window.cancelIdleCallback?.(id);
    }

    const id = window.setTimeout(callback, 180);
    return () => window.clearTimeout(id);
};
