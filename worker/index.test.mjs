import assert from "node:assert/strict";
import test from "node:test";
import worker, { BASIC_READING_COLLECTIONS } from "./index.mjs";

const secret = "test-only-basic-reading-secret";

const createEnv = () => ({
    BASIC_READING_SIGNING_KEY: secret,
    BASIC_READING_AUDIO: {
        head: async () => ({
            size: 6,
            httpEtag: '"etag"',
            writeHttpMetadata: headers => headers.set("Content-Type", "audio/mpeg")
        }),
        get: async (_key, options) => ({
            size: 6,
            httpEtag: '"etag"',
            range: options?.range?.get("Range") ? { offset: 1, length: 3 } : undefined,
            body: new Uint8Array([1, 2, 3]),
            writeHttpMetadata: headers => headers.set("Content-Type", "audio/mpeg")
        })
    },
    ASSETS: {
        fetch: async () => new Response("asset", { status: 200 })
    }
});

const issueToken = async (env, collection = "br400_1") => {
    const response = await worker.fetch(
        new Request(`https://alanenglish.com.tw/api/basic-reading/token?collection=${collection}`),
        env
    );
    assert.equal(response.status, 200);
    return response.json();
};

test("catalog exposes exactly 9 books and 399 tracks", async () => {
    const response = await worker.fetch(new Request("https://alanenglish.com.tw/api/basic-reading/catalog"), createEnv());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.collectionCount, 9);
    assert.equal(body.trackCount, 399);
    assert.equal(BASIC_READING_COLLECTIONS.reduce((sum, item) => sum + item.trackCount, 0), 399);
});

test("valid short-lived access serves an R2 byte range", async () => {
    const env = createEnv();
    const access = await issueToken(env);
    const response = await worker.fetch(new Request(
        `https://alanenglish.com.tw/api/basic-reading/audio/br400_1/Track1.mp3?expires=${access.expires}&token=${access.token}`,
        { headers: { Range: "bytes=1-3" } }
    ), env);

    assert.equal(response.status, 206);
    assert.equal(response.headers.get("Accept-Ranges"), "bytes");
    assert.equal(response.headers.get("Content-Range"), "bytes 1-3/6");
    assert.equal(response.headers.get("Content-Length"), "3");
});

test("audio route rejects expired tokens and out-of-range tracks", async () => {
    const env = createEnv();
    const access = await issueToken(env);
    const expired = await worker.fetch(new Request(
        `https://alanenglish.com.tw/api/basic-reading/audio/br400_1/Track1.mp3?expires=1&token=${access.token}`
    ), env);
    const missingTrack = await worker.fetch(new Request(
        `https://alanenglish.com.tw/api/basic-reading/audio/br400_1/Track52.mp3?expires=${access.expires}&token=${access.token}`
    ), env);

    assert.equal(expired.status, 403);
    assert.equal(missingTrack.status, 404);
});

test("unsatisfiable byte ranges return 416 with the complete size", async () => {
    const env = createEnv();
    env.BASIC_READING_AUDIO.get = async () => {
        throw new Error("Unsatisfiable range");
    };
    const access = await issueToken(env);
    const response = await worker.fetch(new Request(
        `https://alanenglish.com.tw/api/basic-reading/audio/br400_1/Track1.mp3?expires=${access.expires}&token=${access.token}`,
        { headers: { Range: "bytes=99-120" } }
    ), env);

    assert.equal(response.status, 416);
    assert.equal(response.headers.get("Content-Range"), "bytes */6");
});

test("non-API routes fall through to static assets", async () => {
    const response = await worker.fetch(new Request("https://alanenglish.com.tw/basic-reading"), createEnv());
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "asset");
});
