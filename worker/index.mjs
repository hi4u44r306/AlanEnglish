const TOKEN_TTL_SECONDS = 60 * 60;
const TOKEN_FUTURE_TOLERANCE_SECONDS = 30;
const R2_PREFIX = "basic-reading";

export const BASIC_READING_COLLECTIONS = Object.freeze([
    { id: "br400_1", level: 400, book: 1, title: "Basic Reading 400 第 1 冊", trackCount: 51 },
    { id: "br400_2", level: 400, book: 2, title: "Basic Reading 400 第 2 冊", trackCount: 51 },
    { id: "br400_3", level: 400, book: 3, title: "Basic Reading 400 第 3 冊", trackCount: 51 },
    { id: "br800_1", level: 800, book: 1, title: "Basic Reading 800 第 1 冊", trackCount: 49 },
    { id: "br800_2", level: 800, book: 2, title: "Basic Reading 800 第 2 冊", trackCount: 49 },
    { id: "br800_3", level: 800, book: 3, title: "Basic Reading 800 第 3 冊", trackCount: 49 },
    { id: "br1200_1", level: 1200, book: 1, title: "Basic Reading 1200 第 1 冊", trackCount: 33 },
    { id: "br1200_2", level: 1200, book: 2, title: "Basic Reading 1200 第 2 冊", trackCount: 33 },
    { id: "br1200_3", level: 1200, book: 3, title: "Basic Reading 1200 第 3 冊", trackCount: 33 }
]);

const COLLECTION_BY_ID = new Map(BASIC_READING_COLLECTIONS.map(collection => [collection.id, collection]));
const encoder = new TextEncoder();

const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
    status,
    headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...extraHeaders
    }
});

const base64Url = bytes => {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const fromBase64Url = value => {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    try {
        const binary = atob(padded);
        return Uint8Array.from(binary, character => character.charCodeAt(0));
    } catch {
        return null;
    }
};

const importSigningKey = secret => crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
);

export const signCollectionAccess = async (secret, collectionId, expires) => {
    const key = await importSigningKey(secret);
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${collectionId}:${expires}`));
    return base64Url(new Uint8Array(signature));
};

const verifyCollectionAccess = async (secret, collectionId, expires, token) => {
    const signature = fromBase64Url(token);
    if (!signature) return false;
    const key = await importSigningKey(secret);
    return crypto.subtle.verify("HMAC", key, signature, encoder.encode(`${collectionId}:${expires}`));
};

const audioPathMatch = pathname => pathname.match(/^\/api\/basic-reading\/audio\/(br(?:400|800|1200)_[123])\/Track([1-9]\d*)\.mp3$/);

const addAudioHeaders = (headers, object) => {
    object.writeHttpMetadata?.(headers);
    headers.set("Content-Type", "audio/mpeg");
    headers.set("Accept-Ranges", "bytes");
    headers.set("ETag", object.httpEtag);
    headers.set("Cache-Control", "private, max-age=300");
    headers.set("Content-Disposition", "inline");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "same-origin");
};

const handleCatalog = () => json({
    collections: BASIC_READING_COLLECTIONS,
    collectionCount: BASIC_READING_COLLECTIONS.length,
    trackCount: BASIC_READING_COLLECTIONS.reduce((total, collection) => total + collection.trackCount, 0)
}, 200, { "Cache-Control": "public, max-age=300" });

const handleToken = async (request, env) => {
    if (!env.BASIC_READING_SIGNING_KEY) return json({ error: "播放服務尚未完成設定" }, 503);
    const url = new URL(request.url);
    const collectionId = url.searchParams.get("collection") || "";
    if (!COLLECTION_BY_ID.has(collectionId)) return json({ error: "找不到這冊教材" }, 404);

    const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    const token = await signCollectionAccess(env.BASIC_READING_SIGNING_KEY, collectionId, expires);
    return json({ collection: collectionId, expires, token });
};

const handleAudio = async (request, env, match) => {
    if (!env.BASIC_READING_SIGNING_KEY || !env.BASIC_READING_AUDIO) {
        return json({ error: "播放服務尚未完成設定" }, 503);
    }

    const [, collectionId, rawTrackNumber] = match;
    const collection = COLLECTION_BY_ID.get(collectionId);
    const trackNumber = Number(rawTrackNumber);
    if (!collection || !Number.isInteger(trackNumber) || trackNumber < 1 || trackNumber > collection.trackCount) {
        return json({ error: "找不到這個音軌" }, 404);
    }

    const url = new URL(request.url);
    const expires = Number(url.searchParams.get("expires"));
    const token = url.searchParams.get("token") || "";
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(expires) || expires < now || expires > now + TOKEN_TTL_SECONDS + TOKEN_FUTURE_TOLERANCE_SECONDS) {
        return json({ error: "播放網址已過期" }, 403);
    }
    if (!await verifyCollectionAccess(env.BASIC_READING_SIGNING_KEY, collectionId, expires, token)) {
        return json({ error: "播放網址驗證失敗" }, 403);
    }

    const key = `${R2_PREFIX}/${collectionId}/Track${trackNumber}.mp3`;
    if (request.method === "HEAD") {
        const object = await env.BASIC_READING_AUDIO.head(key);
        if (!object) return json({ error: "找不到音檔" }, 404);
        const headers = new Headers();
        addAudioHeaders(headers, object);
        headers.set("Content-Length", String(object.size));
        return new Response(null, { status: 200, headers });
    }

    let object;
    try {
        object = await env.BASIC_READING_AUDIO.get(key, {
            onlyIf: request.headers,
            range: request.headers
        });
    } catch {
        const objectMetadata = await env.BASIC_READING_AUDIO.head(key).catch(() => null);
        const headers = new Headers({
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-store"
        });
        if (objectMetadata?.size !== undefined) headers.set("Content-Range", `bytes */${objectMetadata.size}`);
        return new Response(null, {
            status: 416,
            headers
        });
    }
    if (!object) return json({ error: "找不到音檔" }, 404);

    const headers = new Headers();
    addAudioHeaders(headers, object);
    if (!("body" in object)) return new Response(null, { status: 412, headers });

    const hasPartialRange = Boolean(request.headers.get("Range") && object.range && Number.isFinite(object.range.offset));
    if (hasPartialRange) {
        const offset = Number(object.range.offset);
        const length = Number(object.range.length);
        headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
        headers.set("Content-Length", String(length));
    } else {
        headers.set("Content-Length", String(object.size));
    }

    return new Response(object.body, {
        status: hasPartialRange ? 206 : 200,
        headers
    });
};

// Alan 工具箱（Astro 靜態站）掛在主網域的公開路徑；其餘路徑維持原本的 SPA 與 noindex 行為。
const TOOLBOX_ORIGIN = "https://tools.alanenglish.com.tw";
const TOOLBOX_LOCALE_PATH = /^\/(?:zh-tw|zh-cn|en|es|pt|ja|ko|fr|de|hi|id|ar)(?:\/|$)/;
const TOOLBOX_EXACT_PATHS = new Set([
    "/sitemap-index.xml",
    "/sitemap-0.xml",
    "/favicon-144.png",
    "/favicon.svg",
    "/icons.svg",
    "/images/study-tools-logo.png"
]);
const TOOLBOX_FORWARDED_HEADERS = ["Accept", "Accept-Language", "If-None-Match", "If-Modified-Since", "Range", "User-Agent"];

export const isToolboxPath = pathname => TOOLBOX_LOCALE_PATH.test(pathname)
    || pathname.startsWith("/_astro/")
    || TOOLBOX_EXACT_PATHS.has(pathname);

const handleToolbox = async (request, url) => {
    // 不轉送 Cookie 與 Authorization，避免主站登入資訊送到工具箱主機。
    const headers = new Headers();
    for (const name of TOOLBOX_FORWARDED_HEADERS) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
    }

    let upstream;
    try {
        upstream = await fetch(new URL(url.pathname + url.search, TOOLBOX_ORIGIN), {
            method: request.method,
            headers,
            redirect: "manual"
        });
    } catch {
        return new Response("工具箱暫時無法連線，請稍後再試。", {
            status: 502,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
        });
    }

    const response = new Response(upstream.body, upstream);
    const location = response.headers.get("Location");
    if (location) {
        const target = new URL(location, TOOLBOX_ORIGIN);
        if (target.origin === TOOLBOX_ORIGIN) {
            response.headers.set("Location", new URL(target.pathname + target.search + target.hash, url.origin).toString());
        }
    }
    return response;
};

// 對應 scripts/generate-static-seo-pages.mjs 產生的靜態 SEO HTML；key 必須與 src/config/publicSeo.json 一致（首頁除外）。
export const PUBLIC_SEO_ASSETS = Object.freeze({ "/links": "/seo-links" });
const NOINDEX_ASSET = "/noindex";
const HAS_FILE_EXTENSION = /\.[A-Za-z0-9]+$/;

// 回傳要改讀的靜態資產路徑；null 代表維持原本的資產與 SPA 行為。
export const seoAssetPathFor = pathname => {
    const route = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    if (route === "" || route === "/") return null;
    if (PUBLIC_SEO_ASSETS[route]) return PUBLIC_SEO_ASSETS[route];
    if (HAS_FILE_EXTENSION.test(route) || route.startsWith("/static/") || route.startsWith("/api/")) return null;
    if (route === NOINDEX_ASSET || Object.values(PUBLIC_SEO_ASSETS).includes(route)) return null;
    return NOINDEX_ASSET;
};

export const worker = {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (request.method === "GET" && url.pathname === "/api/basic-reading/catalog") return handleCatalog();
        if (request.method === "GET" && url.pathname === "/api/basic-reading/token") return handleToken(request, env);

        const match = audioPathMatch(url.pathname);
        if (match) {
            if (request.method !== "GET" && request.method !== "HEAD") {
                return json({ error: "Method not allowed" }, 405, { Allow: "GET, HEAD" });
            }
            return handleAudio(request, env, match);
        }

        if ((request.method === "GET" || request.method === "HEAD") && isToolboxPath(url.pathname)) {
            return handleToolbox(request, url);
        }

        if (request.method === "GET" || request.method === "HEAD") {
            const seoAssetPath = seoAssetPathFor(url.pathname);
            if (seoAssetPath) return env.ASSETS.fetch(new Request(new URL(seoAssetPath, url), request));
        }

        return env.ASSETS.fetch(request);
    }
};

export default worker;
