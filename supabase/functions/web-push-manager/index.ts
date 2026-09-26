import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { buildPushPayload } from "npm:@block65/webcrypto-web-push@2.0.0";
import { cleanText, verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { getWebPushMessage, isAllowedPushEndpoint, isValidPushKey, isWebPushQuietHour } from "../_shared/web-push-policy.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const adminClient = () => {
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Supabase 伺服器設定不完整");
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
};
const vapid = () => ({
    publicKey: Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY") || "",
    privateKey: Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY") || "",
    subject: Deno.env.get("WEB_PUSH_VAPID_SUBJECT") || ""
});
const queueUpdate = async (admin: any, id: number, fields: Record<string, unknown>) => {
    const { error } = await admin.from("student_push_delivery_queue").update(fields).eq("id", id);
    if (error) throw error;
};
const skipPendingForSubscription = async (admin: any, subscriptionId: number) => {
    const { error } = await admin.from("student_push_delivery_queue").update({ status: "skipped" })
        .eq("subscription_id", subscriptionId).in("status", ["pending", "failed"]);
    if (error) throw error;
};
const dayBounds = () => {
    const local = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const day = local.toISOString().slice(0, 10);
    local.setUTCDate(local.getUTCDate() + 1);
    return [`${day}T00:00:00+08:00`, `${local.toISOString().slice(0, 10)}T00:00:00+08:00`];
};

async function processQueue(admin: any) {
    const keys = vapid();
    if (Deno.env.get("WEB_PUSH_ENABLED") !== "true" || !keys.publicKey || !keys.privateKey || !keys.subject) {
        return { configured: false, claimed: 0, sent: 0 };
    }
    if (isWebPushQuietHour()) return { configured: true, quiet_hours: true, claimed: 0, sent: 0 };
    const { data: jobs, error } = await admin.rpc("claim_student_web_push", { p_limit: 20 });
    if (error) throw error;
    let sent = 0;
    for (const job of jobs || []) {
        const [subscription, notification] = await Promise.all([
            admin.from("student_push_subscriptions").select("id,student_id,endpoint,p256dh,auth_secret,active").eq("id", job.subscription_id).maybeSingle(),
            admin.from("student_notifications").select("id,student_id,notification_type,metadata,expires_at").eq("id", job.student_notification_id).maybeSingle()
        ]);
        if (subscription.error || notification.error) throw subscription.error || notification.error;
        const device = subscription.data, notice = notification.data;
        if (!device?.active || !notice || device.student_id !== notice.student_id
            || (notice.expires_at && new Date(notice.expires_at).getTime() <= Date.now())) {
            await queueUpdate(admin, job.id, { status: "skipped" });
            continue;
        }
        const message = getWebPushMessage(notice);
        if (!message) {
            await queueUpdate(admin, job.id, { status: "skipped" });
            continue;
        }
        const relevantUntil = notice.notification_type === "assignment"
            ? notice.metadata?.due_at : notice.metadata?.effective_at;
        if (relevantUntil && new Date(relevantUntil).getTime() <= Date.now()) {
            await queueUpdate(admin, job.id, { status: "skipped" });
            continue;
        }
        const [start, end] = dayBounds();
        const daily = await admin.from("student_push_delivery_queue").select("id", { count: "exact", head: true })
            .eq("subscription_id", device.id).eq("status", "sent").gte("sent_at", start).lt("sent_at", end);
        if (daily.error) throw daily.error;
        if ((daily.count || 0) >= 3) {
            await queueUpdate(admin, job.id, { status: "skipped" });
            continue;
        }
        try {
            const data = JSON.stringify(message);
            const payload = await buildPushPayload({ data, options: { ttl: 3600 } }, {
                endpoint: device.endpoint, expirationTime: null,
                keys: { p256dh: device.p256dh, auth: device.auth_secret }
            }, keys);
            const response = await fetch(device.endpoint, {
                ...payload, redirect: "error", signal: AbortSignal.timeout(8000)
            });
            if (response.ok) {
                await queueUpdate(admin, job.id, { status: "sent", sent_at: new Date().toISOString(), last_http_status: response.status });
                sent += 1;
            } else if (response.status === 404 || response.status === 410) {
                await admin.from("student_push_subscriptions").update({ active: false, disabled_at: new Date().toISOString() }).eq("id", device.id);
                await queueUpdate(admin, job.id, { status: "skipped", last_http_status: response.status });
                await skipPendingForSubscription(admin, device.id);
            } else {
                const retry = [408, 429, 500, 502, 503, 504].includes(response.status) && job.attempt_count < 5;
                await queueUpdate(admin, job.id, {
                    status: retry ? "failed" : "skipped", last_http_status: response.status,
                    next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** job.attempt_count * 5) * 60 * 1000).toISOString()
                });
            }
        } catch {
            await queueUpdate(admin, job.id, {
                status: job.attempt_count < 5 ? "failed" : "skipped",
                next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** job.attempt_count * 5) * 60 * 1000).toISOString()
            });
        }
    }
    return { configured: true, claimed: (jobs || []).length, sent };
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    try {
        const admin = adminClient();
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body.action, 40);
        if (action === "process_queue") {
            const headerSecret = req.headers.get("x-cron-secret") || "";
            const envSecret = Deno.env.get("GUARDIAN_CRON_SECRET") || "";
            let authorized = Boolean(envSecret) && headerSecret === envSecret;
            if (!authorized && headerSecret) {
                const verified = await admin.rpc("verify_guardian_cron_secret", { p_secret: headerSecret });
                authorized = verified.error === null && verified.data === true;
            }
            if (!authorized) return json(403, { error: "沒有推播排程權限" });
            return json(200, { success: true, queue: await processQueue(admin) });
        }
        const caller = await verifyFirebaseRequest(req, admin);
        if (caller.role !== "student") return json(403, { error: "只有學生可以設定推播" });
        const keys = vapid();
        const publicKey = keys.publicKey;
        const enabled = Boolean(keys.publicKey && keys.privateKey && keys.subject) && Deno.env.get("WEB_PUSH_ENABLED") === "true";
        if (action === "config") return json(200, { public_key: publicKey, enabled });
        const endpoint = body.endpoint;
        if (!isAllowedPushEndpoint(endpoint)) return json(400, { error: "推播裝置資訊無效" });
        if (action === "status") {
            const result = await admin.from("student_push_subscriptions").select("id,active")
                .eq("endpoint", endpoint).eq("student_id", caller.id).maybeSingle();
            if (result.error) throw result.error;
            return json(200, { active: result.data?.active === true });
        }
        if (action === "unsubscribe") {
            const { data, error } = await admin.from("student_push_subscriptions")
                .update({ active: false, disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq("endpoint", endpoint).eq("student_id", caller.id).select("id");
            if (error) throw error;
            for (const row of data || []) await skipPendingForSubscription(admin, row.id);
            return json(200, { success: true });
        }
        if (action !== "subscribe") return json(400, { error: "不支援的推播操作" });
        if (!enabled) return json(503, { error: "推播服務尚未開放" });
        if (!isValidPushKey(body.keys?.p256dh, 65) || !isValidPushKey(body.keys?.auth, 16)) {
            return json(400, { error: "推播加密金鑰無效" });
        }
        const existing = await admin.from("student_push_subscriptions").select("id,student_id,active").eq("endpoint", endpoint).maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data && (existing.data.student_id !== caller.id || !existing.data.active)) {
            await skipPendingForSubscription(admin, existing.data.id);
        }
        if (!existing.data) {
            const count = await admin.from("student_push_subscriptions").select("id", { count: "exact", head: true })
                .eq("student_id", caller.id).eq("active", true);
            if (count.error) throw count.error;
            if ((count.count || 0) >= 5) return json(429, { error: "最多只能在五個裝置開啟推播" });
        }
        const now = new Date().toISOString();
        const { error } = await admin.from("student_push_subscriptions").upsert({
            endpoint, student_id: caller.id, p256dh: body.keys.p256dh, auth_secret: body.keys.auth,
            device_label: cleanText(body.device_label, 80) || "此裝置", active: true,
            disabled_at: null, updated_at: now
        }, { onConflict: "endpoint" });
        if (error) throw error;
        return json(200, { success: true });
    } catch (error) {
        const status = Number((error as any)?.status || 500);
        if (status >= 500) console.error("web-push-manager failed", error instanceof Error ? error.message : "unknown");
        return json(status, { error: status >= 500 ? "推播服務暫時無法使用" : (error instanceof Error ? error.message : "推播操作失敗") });
    }
});
