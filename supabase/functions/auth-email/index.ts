import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { importPKCS8, SignJWT } from "npm:jose@5.9.6";

type JsonObject = Record<string, unknown>;
type ServiceAccount = {
    project_id: string;
    client_email: string;
    private_key: string;
    token_uri?: string;
};

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const ALLOWED_CONTINUE_ORIGINS = new Set([
    "https://alanenglish.com.tw",
    "https://www.alanenglish.com.tw",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]);
const INTERNAL_LOGIN_DOMAIN = "login.alanenglish.com.tw";
let adminTokenCache: { token: string; expiresAt: number } | null = null;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const cleanText = (value: unknown, maxLength = 320) => typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
const normalizeEmail = (value: unknown) => cleanText(value).toLowerCase();
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const escapeHtml = (value: unknown) => cleanText(value, 5000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const sha256 = async (value: string) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
};

const getServiceAccount = (): ServiceAccount => {
    const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")?.trim();
    if (!raw) throw new Error("FIREBASE_ADMIN_NOT_CONFIGURED");
    const account = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!account.project_id || !account.client_email || !account.private_key) {
        throw new Error("FIREBASE_ADMIN_CONFIG_INVALID");
    }
    return account as ServiceAccount;
};

const getAdminToken = async () => {
    if (adminTokenCache && adminTokenCache.expiresAt > Date.now() + 60_000) {
        return adminTokenCache.token;
    }
    const account = getServiceAccount();
    const now = Math.floor(Date.now() / 1000);
    const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/identitytoolkit" })
        .setProtectedHeader({ alg: "RS256", typ: "JWT" })
        .setIssuer(account.client_email)
        .setSubject(account.client_email)
        .setAudience(account.token_uri || "https://oauth2.googleapis.com/token")
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .sign(await importPKCS8(account.private_key, "RS256"));
    const response = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth2:grant-type:jwt-bearer",
            assertion
        })
    });
    const payload = await response.json().catch(() => ({})) as {
        access_token?: string;
        expires_in?: number;
    };
    if (!response.ok || !payload.access_token) throw new Error("FIREBASE_ADMIN_AUTH_FAILED");
    adminTokenCache = {
        token: payload.access_token,
        expiresAt: Date.now() + Math.max(300, Number(payload.expires_in) || 3600) * 1000
    };
    return payload.access_token;
};

const lookupFirebaseUser = async (idToken: string) => {
    const apiKey = Deno.env.get("FIREBASE_WEB_API_KEY")?.trim();
    if (!apiKey) throw new Error("FIREBASE_WEB_CONFIG_MISSING");
    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken })
        }
    );
    const payload = await response.json().catch(() => ({})) as {
        users?: Array<{ email?: string; emailVerified?: boolean; disabled?: boolean }>;
    };
    const user = payload.users?.[0];
    if (!response.ok || !user?.email || user.disabled) throw new Error("INVALID_FIREBASE_USER");
    return { email: normalizeEmail(user.email), emailVerified: user.emailVerified === true };
};

const generateActionLink = async (
    email: string,
    requestType: "VERIFY_EMAIL" | "PASSWORD_RESET",
    continueUrl: string,
    userIp: string | null
) => {
    const account = getServiceAccount();
    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/accounts:sendOobCode`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await getAdminToken()}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                requestType,
                email,
                continueUrl,
                returnOobLink: true,
                ...(requestType === "PASSWORD_RESET" && userIp ? { userIp } : {})
            })
        }
    );
    const payload = await response.json().catch(() => ({})) as {
        oobLink?: string;
        error?: { message?: string };
    };
    if (!response.ok || !payload.oobLink) {
        const error = new Error(cleanText(payload.error?.message, 120) || "ACTION_LINK_FAILED");
        (error as Error & { status?: number }).status = response.status;
        throw error;
    }
    return payload.oobLink;
};

const sendWithResend = async (apiKey: string, payload: JsonObject, idempotencyKey: string) => {
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok) throw new Error(data.message || `RESEND_${response.status}`);
    return data;
};

const buildEmail = (kind: "verification" | "password_reset", actionLink: string) => {
    const verification = kind === "verification";
    const title = verification ? "驗證你的 Alan English Email" : "重設你的 Alan English 密碼";
    const button = verification ? "完成 Email 驗證" : "設定新密碼";
    const description = verification
        ? "完成驗證後，你的免費試用或會員功能才會正式啟用。"
        : "有人提出重設密碼的要求。如果不是你本人操作，可以忽略這封信。";
    const safeLink = escapeHtml(actionLink);
    return {
        subject: title,
        text: `${title}\n\n${description}\n\n${actionLink}\n\n此連結具有時效性，請勿轉傳。\nAlan English`,
        html: `<!doctype html><html lang="zh-Hant"><body style="margin:0;background:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#17233d"><div style="max-width:600px;margin:0 auto;padding:28px 16px"><div style="background:#142443;color:#fff;padding:28px;border-radius:20px 20px 0 0"><div style="font-size:12px;letter-spacing:.16em;color:#ffd45c">ALAN ENGLISH</div><h1 style="font-size:25px;margin:10px 0 0">${title}</h1></div><div style="background:#fff;padding:28px;border-radius:0 0 20px 20px"><p style="font-size:16px;line-height:1.8;margin-top:0">${description}</p><p style="margin:28px 0"><a href="${safeLink}" style="display:inline-block;background:#315fda;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">${button}</a></p><p style="font-size:13px;line-height:1.7;color:#667085">按鈕無法開啟時，請複製以下連結到瀏覽器：<br><span style="word-break:break-all">${safeLink}</span></p><p style="font-size:13px;color:#667085;margin-bottom:0">此連結具有時效性，請勿轉傳。Alan English 不會透過 Email 要求你提供密碼。</p></div></div></body></html>`
    };
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "伺服器設定不完整" });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    try {
        const body = await req.json().catch(() => ({})) as JsonObject;
        const action = cleanText(body.action, 40);
        if (!['send_verification', 'send_password_reset'].includes(action)) {
            return json(400, { error: "不支援的寄信操作" });
        }
        const kind = action === "send_verification" ? "verification" : "password_reset";
        let email = "";
        if (kind === "verification") {
            const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
            if (!token) return json(401, { error: "請重新登入後再寄送驗證信" });
            const user = await lookupFirebaseUser(token);
            if (user.emailVerified) return json(200, { success: true, already_verified: true });
            email = user.email;
        } else {
            email = normalizeEmail(body.email);
        }
        if (!isEmail(email) || email.endsWith(`@${INTERNAL_LOGIN_DOMAIN}`)) {
            return kind === "password_reset"
                ? json(200, { success: true, message: "如果帳號存在，重設信將寄到該信箱" })
                : json(400, { error: "Email 格式不正確" });
        }
        if (!resendApiKey) return json(503, { error: "Email 寄送服務尚未完成設定" });

        const identifierHash = await sha256(`${kind}:${email}`);
        const forwardedIp = cleanText(
            (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "")
                .split(",")[0],
            64
        ) || null;
        const sourceHash = forwardedIp ? await sha256(`${kind}:${forwardedIp}`) : null;
        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const emailThrottle = admin
            .from("auth_email_requests")
            .select("id", { count: "exact", head: true })
            .eq("identifier_hash", identifierHash)
            .eq("request_kind", kind)
            .gte("requested_at", since);
        const sourceThrottle = sourceHash
            ? admin
                .from("auth_email_requests")
                .select("id", { count: "exact", head: true })
                .eq("source_hash", sourceHash)
                .eq("request_kind", kind)
                .gte("requested_at", since)
            : Promise.resolve({ count: 0, error: null });
        const [emailThrottleResult, sourceThrottleResult] = await Promise.all([emailThrottle, sourceThrottle]);
        if (emailThrottleResult.error || sourceThrottleResult.error) {
            throw emailThrottleResult.error || sourceThrottleResult.error;
        }
        if ((emailThrottleResult.count || 0) >= 5 || (sourceThrottleResult.count || 0) >= 20) {
            return json(429, { error: "寄送次數過多，請一小時後再試" });
        }

        const { data: settings, error: settingsError } = await admin
            .from("guardian_email_settings")
            .select("from_email,from_name,reply_to")
            .eq("id", 1)
            .maybeSingle();
        if (settingsError) throw settingsError;
        if (!settings?.from_email) return json(503, { error: "寄件網域尚未完成設定" });

        const { data: requestRow, error: requestError } = await admin
            .from("auth_email_requests")
            .insert({ request_kind: kind, identifier_hash: identifierHash, source_hash: sourceHash })
            .select("id")
            .single();
        if (requestError) throw requestError;

        const requestOrigin = cleanText(req.headers.get("Origin"), 200);
        const origin = ALLOWED_CONTINUE_ORIGINS.has(requestOrigin)
            ? requestOrigin
            : "https://alanenglish.com.tw";
        const requestedContinuePath = cleanText(body.continue_path, 500);
        const continuePath = kind === "verification"
            && (/^\/student\/membership(?:[?#].*)?$/.test(requestedContinuePath)
                || /^\/academy\/invite(?:[?#].*)?$/.test(requestedContinuePath))
            ? requestedContinuePath
            : kind === "verification" ? "/student/membership" : "/login";
        try {
            const link = await generateActionLink(
                email,
                kind === "verification" ? "VERIFY_EMAIL" : "PASSWORD_RESET",
                `${origin}${continuePath}`,
                forwardedIp
            );
            const emailContent = buildEmail(kind, link);
            const provider = await sendWithResend(resendApiKey, {
                from: `${settings.from_name || "Alan English"} <${settings.from_email}>`,
                to: [email],
                subject: emailContent.subject,
                html: emailContent.html,
                text: emailContent.text,
                ...(settings.reply_to ? { reply_to: settings.reply_to } : {})
            }, `auth-${kind}-${requestRow.id}`);
            await admin.from("auth_email_requests").update({
                status: "sent",
                delivered_at: new Date().toISOString(),
                provider_message_id: provider.id || null
            }).eq("id", requestRow.id);
        } catch (error) {
            await admin.from("auth_email_requests").update({ status: "failed" }).eq("id", requestRow.id);
            const message = error instanceof Error ? error.message : "UNKNOWN";
            if (kind === "password_reset" && /EMAIL_NOT_FOUND|USER_NOT_FOUND/.test(message)) {
                return json(200, { success: true, message: "如果帳號存在，重設信將寄到該信箱" });
            }
            console.error("Auth email delivery failed", { kind, message: cleanText(message, 120) });
            return json(502, { error: "目前無法寄信，請稍後再試" });
        }

        return json(200, {
            success: true,
            message: kind === "verification"
                ? "驗證信已寄出，請檢查收件匣"
                : "如果帳號存在，重設信將寄到該信箱"
        });
    } catch (error) {
        console.error("Auth email request failed", {
            message: cleanText(error instanceof Error ? error.message : "UNKNOWN", 120)
        });
        return json(500, { error: "Email 服務暫時無法使用" });
    }
});
