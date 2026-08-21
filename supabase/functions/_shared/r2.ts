import { AwsClient } from "npm:aws4fetch@1.0.20";

const clean = (value: string | undefined) => String(value || "").trim();

export type R2Config = {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    endpoint: string;
    region: string;
};

export const getR2Config = (): R2Config => {
    const accountId = clean(Deno.env.get("R2_ACCOUNT_ID"));
    const accessKeyId = clean(Deno.env.get("R2_ACCESS_KEY_ID"));
    const secretAccessKey = clean(Deno.env.get("R2_SECRET_ACCESS_KEY"));
    const bucket = clean(Deno.env.get("R2_BUCKET_NAME"));
    const endpoint = clean(Deno.env.get("R2_ENDPOINT")) || (accountId
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : "");
    const region = clean(Deno.env.get("R2_REGION")) || "auto";

    const missing = [
        ["R2_ACCOUNT_ID", accountId],
        ["R2_ACCESS_KEY_ID", accessKeyId],
        ["R2_SECRET_ACCESS_KEY", secretAccessKey],
        ["R2_BUCKET_NAME", bucket],
        ["R2_ENDPOINT", endpoint]
    ].filter(([, value]) => !value).map(([name]) => name);

    if (missing.length) throw new Error(`R2 Secrets 尚未完整設定：${missing.join(", ")}`);
    if (!/^https:\/\//i.test(endpoint)) throw new Error("R2_ENDPOINT 必須使用 https://");

    return {
        accountId,
        accessKeyId,
        secretAccessKey,
        bucket,
        endpoint: endpoint.replace(/\/+$/, ""),
        region
    };
};

export const createR2Client = (config = getR2Config()) => new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: config.region
});

export const normalizeObjectKey = (value: unknown) => String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .join("/");

const encodedObjectKey = (key: string) => normalizeObjectKey(key)
    .split("/")
    .map(segment => encodeURIComponent(segment))
    .join("/");

export const r2BucketUrl = (config = getR2Config()) => `${config.endpoint}/${encodeURIComponent(config.bucket)}`;

export const r2ObjectUrl = (key: string, config = getR2Config()) => {
    const normalized = normalizeObjectKey(key);
    if (!normalized || normalized.includes("..")) throw new Error("R2 音檔路徑不正確");
    return `${r2BucketUrl(config)}/${encodedObjectKey(normalized)}`;
};

export const createR2PresignedUrl = async (
    key: string,
    method: "GET" | "PUT" | "HEAD" | "DELETE" = "GET",
    expiresIn = 3600,
    contentType = ""
) => {
    const config = getR2Config();
    const client = createR2Client(config);
    const url = new URL(r2ObjectUrl(key, config));
    url.searchParams.set("X-Amz-Expires", String(Math.max(1, Math.min(604800, Math.round(expiresIn)))));
    const headers = new Headers();
    if (contentType) headers.set("Content-Type", contentType);
    const signed = await client.sign(new Request(url, { method, headers }), {
        aws: { signQuery: true }
    });
    return signed.url.toString();
};

export const fetchR2 = async (key: string, init: RequestInit = {}) => {
    const config = getR2Config();
    const client = createR2Client(config);
    return client.fetch(r2ObjectUrl(key, config), init);
};

export const probeR2Bucket = async () => {
    const config = getR2Config();
    const client = createR2Client(config);
    const url = new URL(r2BucketUrl(config));
    url.searchParams.set("list-type", "2");
    url.searchParams.set("max-keys", "1");
    const response = await client.fetch(url.toString(), { method: "GET" });
    if (!response.ok) {
        const detail = (await response.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
        throw new Error(`R2 連線失敗（HTTP ${response.status}）${detail ? `：${detail}` : ""}`);
    }
    return { ok: true, status: response.status, bucket: config.bucket };
};
