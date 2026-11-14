// 週報信裡「取消每週學習週報」連結的簽章。
// 連結只帶 學生編號、到期時間、簽章；簽章用伺服器密鑰（GUARDIAN_UNSUBSCRIBE_SECRET）算出，
// 內容綁定家長目前的信箱與連結版本——換信箱或管理員重新開啟後，舊連結自動失效。
// 簽章可以重算（不用存資料庫），所以同一週同一位學生每次產生的連結都相同，Resend 的重複寄送保護不受影響。

const SITE_ORIGIN = "https://alanenglish.com.tw";
const DAY_MS = 24 * 60 * 60 * 1000;
export const UNSUBSCRIBE_GRACE_DAYS = 60;

const encoder = new TextEncoder();
const toHex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(value: string) {
    return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmacHex(secret: string, message: string) {
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

// 固定長度比較，避免用回應時間猜簽章。
function safeEqual(a: string, b: string) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

export type UnsubscribeSubject = { studentId: number; contactId: number; email: string; linkVersion: number };

async function signature(secret: string, subject: UnsubscribeSubject, exp: number) {
    const emailHash = await sha256Hex(String(subject.email || "").trim().toLowerCase());
    return hmacHex(secret, ["v1", subject.studentId, subject.contactId, subject.linkVersion, emailHash, exp].join("|"));
}

// 到期＝該週結束後再 60 天（補寄舊週報時連結仍有效，也不會永遠有效）。
export const unsubscribeExpiry = (weekStartDate: string) => {
    const startMs = new Date(`${weekStartDate}T00:00:00.000Z`).getTime();
    return Math.floor((startMs + (7 + UNSUBSCRIBE_GRACE_DAYS) * DAY_MS) / 1000);
};

export async function buildUnsubscribeUrl(secret: string, subject: UnsubscribeSubject, weekStartDate: string) {
    if (!secret) return null;
    const exp = unsubscribeExpiry(weekStartDate);
    const sig = await signature(secret, subject, exp);
    const params = new URLSearchParams({ s: String(subject.studentId), e: String(exp), t: sig });
    return `${SITE_ORIGIN}/unsubscribe-weekly?${params.toString()}`;
}

export async function verifyUnsubscribe(secret: string, subject: UnsubscribeSubject, exp: number, token: string, nowSeconds = Math.floor(Date.now() / 1000)) {
    if (!secret || !/^[0-9a-f]{64}$/.test(String(token || ""))) return "invalid" as const;
    if (!Number.isInteger(exp) || exp <= 0) return "invalid" as const;
    if (!safeEqual(await signature(secret, subject, exp), token)) return "invalid" as const;
    return exp < nowSeconds ? "expired" as const : "ok" as const;
}
