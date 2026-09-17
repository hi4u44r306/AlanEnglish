const CACHE_PREFIX = "ae-app-shell-v1";

const safeStorage = () => {
    try {
        return window.localStorage;
    } catch (error) {
        return null;
    }
};

const cacheKey = (firebaseUid, section) => `${CACHE_PREFIX}:${firebaseUid}:${section}`;

export const readAppShellCacheEntry = (
    firebaseUid,
    section,
    { freshForMs, keepForMs = freshForMs } = {}
) => {
    if (!firebaseUid || typeof window === "undefined") return null;

    try {
        const raw = safeStorage()?.getItem(cacheKey(firebaseUid, section));
        if (!raw) return null;

        const entry = JSON.parse(raw);
        if (!entry || !Number.isFinite(entry.cachedAt)) return null;

        const ageMs = Math.max(0, Date.now() - entry.cachedAt);
        if (!Number.isFinite(keepForMs) || ageMs > keepForMs) return null;

        return {
            value: entry.value ?? null,
            cachedAt: entry.cachedAt,
            isStale: !Number.isFinite(freshForMs) || ageMs > freshForMs
        };
    } catch (error) {
        return null;
    }
};

export const readAppShellCache = (firebaseUid, section, maxAgeMs) => {
    return readAppShellCacheEntry(firebaseUid, section, {
        freshForMs: maxAgeMs,
        keepForMs: maxAgeMs
    })?.value ?? null;
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

export const clearAppShellCache = firebaseUid => {
    if (!firebaseUid || typeof window === "undefined") return;

    try {
        const storage = safeStorage();
        if (!storage) return;

        const userPrefix = `${CACHE_PREFIX}:${firebaseUid}:`;
        for (let index = storage.length - 1; index >= 0; index -= 1) {
            const key = storage.key(index);
            if (key?.startsWith(userPrefix)) storage.removeItem(key);
        }
    } catch (error) {
        // 登出流程不應因瀏覽器禁止 localStorage 而中斷。
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
