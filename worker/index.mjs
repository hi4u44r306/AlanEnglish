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

        return env.ASSETS.fetch(request);
    }
};

export default worker;
