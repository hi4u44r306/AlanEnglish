const AVATAR_CACHE_KEY = "ae-userimage";
const PROFILE_CACHE_KEY = "ae-profile-cache-v2";
const AVATAR_CACHE_VERSION = 2;
const REMOTE_URL_TTL_MS = 10 * 60 * 1000;
const MAX_LOCAL_PREVIEW_BYTES = 360 * 1024;
const LOCAL_PREVIEW_MAX_EDGE = 192;

export const STUDENT_AVATAR_CACHE_UPDATED_EVENT = "ae:student-avatar-cache-updated";

const storage = () => {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage;
    } catch (error) {
        return null;
    }
};

const normalizeOwnerUid = value => String(value || "").trim();
const normalizeSourceKey = value => String(value || "").trim();

export const isStudentAvatarDisplayUrl = value => {
    const url = String(value || "").trim();
    return url.startsWith("/default-avatars/")
        || url.startsWith("/.netlify/images?")
        || url.startsWith("data:image/")
        || /^https?:\/\//i.test(url);
};

const readCacheRecord = () => {
    const localStorage = storage();
    if (!localStorage) return null;
    const raw = localStorage.getItem(AVATAR_CACHE_KEY);
    if (!raw) return null;

    // 舊版只存一段網址；預設頭貼可直接沿用，短效網址則等待背景重新快取。
    if (!raw.startsWith("{")) {
        if (raw.startsWith("/default-avatars/")) return { version: 1, displayUrl: raw };
        localStorage.removeItem(AVATAR_CACHE_KEY);
        return null;
    }

    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
        localStorage.removeItem(AVATAR_CACHE_KEY);
        return null;
    }
};

const writeCacheRecord = record => {
    const localStorage = storage();
    if (!localStorage) return false;
    try {
        localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(record));
        window.dispatchEvent(new CustomEvent(STUDENT_AVATAR_CACHE_UPDATED_EVENT, { detail: record }));
        return true;
    } catch (error) {
        return false;
    }
};

const blobToDataUrl = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => reject(reader.error || new Error("頭貼快取讀取失敗"));
    reader.readAsDataURL(blob);
});

const canvasToWebp = (canvas, quality) => new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));

const createCompactPreviewBlob = async blob => {
    if (!blob?.type?.startsWith("image/")) return null;
    if (blob.size <= MAX_LOCAL_PREVIEW_BYTES) return blob;
    if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") return null;

    const objectUrl = URL.createObjectURL(blob);
    try {
        const image = await new Promise((resolve, reject) => {
            const nextImage = new Image();
            nextImage.onload = () => resolve(nextImage);
            nextImage.onerror = () => reject(new Error("頭貼快取縮圖讀取失敗"));
            nextImage.src = objectUrl;
        });
        const largestEdge = Math.max(image.naturalWidth || image.width || 1, image.naturalHeight || image.height || 1);
        const scale = Math.min(1, LOCAL_PREVIEW_MAX_EDGE / largestEdge);
        const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
        const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
        const compactBlob = await canvasToWebp(canvas, 0.82);
        return compactBlob && compactBlob.size <= MAX_LOCAL_PREVIEW_BYTES ? compactBlob : null;
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
};

const persistLocalPreview = async (imageUrl, record, previewBlob) => {
    try {
        const blob = previewBlob || await fetch(imageUrl, { cache: "force-cache", credentials: "omit" }).then(response => {
            if (!response.ok) throw new Error("頭貼下載失敗");
            return response.blob();
        });
        const compactBlob = await createCompactPreviewBlob(blob);
        if (!compactBlob) return;
        const previewDataUrl = await blobToDataUrl(compactBlob);
        if (!previewDataUrl) return;

        const current = readCacheRecord();
        if (!current
            || current.ownerUid !== record.ownerUid
            || current.remoteUrl !== record.remoteUrl
            || current.sourceKey !== record.sourceKey) return;
        writeCacheRecord({ ...current, previewDataUrl, cachedAt: Date.now() });
    } catch (error) {
        // 跨來源圖片或瀏覽器容量限制不應阻止頭貼正常顯示。
    }
};

export const getCachedStudentAvatarUrl = (fallback, { ownerUid, sourceKey } = {}) => {
    const record = readCacheRecord();
    const expectedOwner = normalizeOwnerUid(ownerUid);
    const expectedSource = normalizeSourceKey(sourceKey);

    // A previously deployed build stored preset thumbnails through Netlify
    // Image CDN. The source path is authoritative, so immediately migrate
    // display back to the bundled Cloudflare asset instead of retrying it.
    if (expectedSource.startsWith("/default-avatars/")) return expectedSource;

    if (record?.version === 1) return record.displayUrl;
    if (record?.version === AVATAR_CACHE_VERSION) {
        if (expectedOwner && record.ownerUid !== expectedOwner) {
            storage()?.removeItem(AVATAR_CACHE_KEY);
        } else if (!expectedSource || !record.sourceKey || record.sourceKey === expectedSource) {
            if (isStudentAvatarDisplayUrl(record.previewDataUrl)) return record.previewDataUrl;
            if (isStudentAvatarDisplayUrl(record.displayUrl)) return record.displayUrl;
            if (Number(record.remoteExpiresAt || 0) > Date.now() && isStudentAvatarDisplayUrl(record.remoteUrl)) {
                return record.remoteUrl;
            }
        }
    }

    return isStudentAvatarDisplayUrl(fallback) ? fallback : null;
};

export const clearStudentAvatarCache = ownerUid => {
    const localStorage = storage();
    if (!localStorage) return;
    const expectedOwner = normalizeOwnerUid(ownerUid);
    const record = readCacheRecord();
    if (!expectedOwner || !record?.ownerUid || record.ownerUid === expectedOwner) {
        localStorage.removeItem(AVATAR_CACHE_KEY);
    }
};

export const cacheStudentAvatarDisplayUrl = (imageUrl, { ownerUid, sourceKey, previewBlob } = {}) => {
    const localStorage = storage();
    const normalizedUrl = String(imageUrl || "").trim();
    if (!localStorage || !isStudentAvatarDisplayUrl(normalizedUrl)) return Promise.resolve(null);

    const normalizedOwner = normalizeOwnerUid(ownerUid);
    const normalizedSource = normalizeSourceKey(sourceKey);
    const current = readCacheRecord();
    const sameAvatar = current?.version === AVATAR_CACHE_VERSION
        && current.ownerUid === normalizedOwner
        && (!normalizedSource || !current.sourceKey || current.sourceKey === normalizedSource);

    if (normalizedUrl.startsWith("/default-avatars/") || normalizedUrl.startsWith("data:image/")) {
        writeCacheRecord({
            version: AVATAR_CACHE_VERSION,
            ownerUid: normalizedOwner,
            sourceKey: normalizedSource || normalizedUrl,
            displayUrl: normalizedUrl,
            previewDataUrl: normalizedUrl.startsWith("data:image/") ? normalizedUrl : null,
            cachedAt: Date.now()
        });
        return Promise.resolve(normalizedUrl);
    }

    const record = {
        version: AVATAR_CACHE_VERSION,
        ownerUid: normalizedOwner,
        sourceKey: normalizedSource || current?.sourceKey || "",
        displayUrl: sameAvatar ? current.displayUrl || null : null,
        previewDataUrl: sameAvatar ? current.previewDataUrl || null : null,
        remoteUrl: normalizedUrl,
        remoteExpiresAt: Date.now() + REMOTE_URL_TTL_MS,
        cachedAt: sameAvatar ? current.cachedAt || Date.now() : Date.now()
    };
    writeCacheRecord(record);
    return persistLocalPreview(normalizedUrl, record, previewBlob).then(() => normalizedUrl);
};

export const updateStudentAvatarCache = (profile, { imageUrl, path, ownerUid, previewBlob }) => {
    const nextProfile = {
        ...profile,
        avatar_url: imageUrl || profile?.avatar_url || null,
        user_image: path || profile?.user_image || null,
        cached_at: Date.now()
    };
    const localStorage = storage();

    if (!localStorage) return nextProfile;

    try {
        if (nextProfile.avatar_url) {
            cacheStudentAvatarDisplayUrl(nextProfile.avatar_url, {
                ownerUid,
                sourceKey: nextProfile.user_image,
                previewBlob
            });
        } else {
            clearStudentAvatarCache(ownerUid);
        }
        const cachedProfile = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || "null");
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
            ...(cachedProfile && typeof cachedProfile === "object" ? cachedProfile : {}),
            ...nextProfile
        }));
    } catch (error) {
        // 快取失敗不影響已成功儲存到後端的頭像。
    }

    return nextProfile;
};
