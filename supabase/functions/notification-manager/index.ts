import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { cleanText, verifyFirebaseRequest } from "../_shared/firebase-auth.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const escapeHtml = (value: unknown) => String(value || "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character] || character));
const validEmail = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(value, 320));

const adminClient = () => {
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Supabase 伺服器設定不完整");
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
};

type DueEvent = { key: string; studentId: number; type: string; title: string; body: string; effectiveAt: string | null };

async function recordEvent(admin: any, event: DueEvent) {
    const { data, error } = await admin.from("notification_events").upsert({
        event_key: event.key, student_id: event.studentId, event_type: event.type,
        effective_at: event.effectiveAt, payload: { title: event.title, body: event.body }
    }, { onConflict: "event_key", ignoreDuplicates: true }).select("id").maybeSingle();
    if (error) throw error;
    let eventId = data?.id;
    if (!eventId) {
        const existing = await admin.from("notification_events").select("id").eq("event_key", event.key).single();
        if (existing.error) throw existing.error;
        eventId = existing.data.id;
    }
    const { error: inboxError } = await admin.from("student_notifications").upsert({
        student_id: event.studentId, notification_type: "membership", event_key: event.key,
        title: event.title, body: event.body, metadata: { event_type: event.type, effective_at: event.effectiveAt }
    }, { onConflict: "student_id,event_key", ignoreDuplicates: true });
    if (inboxError) throw inboxError;
    const guardian = await admin.from("guardian_contacts").select("email,notification_enabled").eq("student_id", event.studentId).maybeSingle();
    if (guardian.error) throw guardian.error;
    if (guardian.data?.notification_enabled !== false && validEmail(guardian.data?.email)) {
        const { error: queueError } = await admin.from("email_delivery_queue").upsert({
            notification_event_id: eventId, student_id: event.studentId, recipient_email: cleanText(guardian.data.email, 320).toLowerCase(),
            template_key: event.type, template_data: { title: event.title, body: event.body, effective_at: event.effectiveAt }
        }, { onConflict: "notification_event_id,recipient_email", ignoreDuplicates: true });
        if (queueError) throw queueError;
    }
}

async function createDueEvents(admin: any) {
    const target = new Date(); target.setUTCDate(target.getUTCDate() + 3);
    const targetDay = target.toISOString().slice(0, 10);
    const start = `${targetDay}T00:00:00.000Z`, end = `${targetDay}T23:59:59.999Z`;
    const [material, subscriptions, departures, failed] = await Promise.all([
        admin.from("student_access_grants").select("id,student_id,ends_at,subscription_plans(code,name)").eq("status", "active").gte("ends_at", start).lte("ends_at", end),
        admin.from("student_access_grants").select("id,student_id,current_period_end,cancel_at_period_end,stripe_subscription_status,subscription_plans(code,name)").eq("status", "active").gte("current_period_end", start).lte("current_period_end", end),
        admin.from("academy_enrollments").select("id,student_id,scheduled_departure_at").eq("scheduled_departure_at", targetDay).in("status", ["active", "paused"]),
        admin.from("student_access_grants").select("id,student_id,current_period_end,subscription_plans(code,name)").eq("stripe_subscription_status", "past_due")
    ]);
    const firstError = [material.error, subscriptions.error, departures.error, failed.error].find(Boolean); if (firstError) throw firstError;
    const events: DueEvent[] = [];
    for (const grant of material.data || []) {
        const plan = Array.isArray(grant.subscription_plans) ? grant.subscription_plans[0] : grant.subscription_plans;
        if (plan?.code !== "material_bonus_90_day") continue;
        events.push({ key: `material:${grant.id}:expires:${targetDay}`, studentId: grant.student_id, type: "material_access_expiring", title: "教材附贈網站權限即將到期", body: "教材擁有權與學習紀錄會保留；網站使用權將於三天後到期，可選擇基本月費會員繼續使用已擁有教材。", effectiveAt: grant.ends_at });
    }
    for (const grant of subscriptions.data || []) {
        const type = grant.cancel_at_period_end ? "subscription_cancelled" : "subscription_expiring";
        events.push({ key: `subscription:${grant.id}:${type}:${targetDay}`, studentId: grant.student_id, type, title: grant.cancel_at_period_end ? "方案將於本期結束取消" : "方案即將續訂", body: grant.cancel_at_period_end ? "你仍可使用方案至本期結束，並可在到期前恢復續訂。" : "方案將於三天後進入下一個付款週期。", effectiveAt: grant.current_period_end });
    }
    for (const enrollment of departures.data || []) events.push({ key: `departure:${enrollment.id}:${targetDay}`, studentId: enrollment.student_id, type: "departure_scheduled", title: "預定離校提醒", body: "三天後將結束班級來源教材與新班級作業；自購、管理員贈送教材及歷史紀錄會保留。", effectiveAt: `${targetDay}T00:00:00.000Z` });
    for (const grant of failed.data || []) events.push({ key: `payment_failed:${grant.id}:${grant.current_period_end || "unknown"}`, studentId: grant.student_id, type: "payment_failed", title: "方案付款失敗", body: "請由家長至付款管理頁更新付款方式，避免方案在寬限期後到期。", effectiveAt: grant.current_period_end });
    for (const event of events) await recordEvent(admin, event);
    return events.length;
}

async function processQueue(admin: any) {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const settings = await admin.from("guardian_email_settings").select("from_email,from_name,reply_to_email").eq("id", 1).maybeSingle();
    if (settings.error) throw settings.error;
    const fromEmail = cleanText(settings.data?.from_email, 320);
    if (!apiKey || !validEmail(fromEmail)) return { provider_configured: false, sent: 0, pending: null };
    const { data: rows, error } = await admin.from("email_delivery_queue").select("*").in("status", ["pending", "failed"]).lte("next_attempt_at", new Date().toISOString()).lt("attempt_count", 5).order("created_at").limit(50);
    if (error) throw error;
    let sent = 0;
    for (const row of rows || []) {
        await admin.from("email_delivery_queue").update({ status: "sending", attempt_count: row.attempt_count + 1 }).eq("id", row.id);
        const subject = cleanText(row.template_data?.title, 120) || "Alan English 方案提醒";
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `alan-notification-${row.notification_event_id}` },
            body: JSON.stringify({
                from: `${cleanText(settings.data?.from_name, 80) || "Alan English"} <${fromEmail}>`, to: [row.recipient_email],
                reply_to: validEmail(settings.data?.reply_to_email) ? settings.data.reply_to_email : undefined,
                subject, html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#112a4d"><h2>${escapeHtml(subject)}</h2><p>${escapeHtml(row.template_data?.body)}</p><p><a href="https://alanenglish.com.tw/student/membership">查看方案</a></p></div>`
            })
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok) {
            sent += 1;
            await admin.from("email_delivery_queue").update({ status: "sent", provider: "resend", provider_message_id: cleanText(result?.id, 300) || null, sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
        } else {
            await admin.from("email_delivery_queue").update({ status: "failed", provider: "resend", last_error: `provider_http_${response.status}`, next_attempt_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }).eq("id", row.id);
        }
    }
    return { provider_configured: true, sent, pending: (rows || []).length - sent };
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    try {
        const admin = adminClient();
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body.action || "mark_all_read", 50);
        const cronSecret = Deno.env.get("GUARDIAN_CRON_SECRET") || "";
        const cronAuthorized = Boolean(cronSecret) && req.headers.get("x-cron-secret") === cronSecret;
        const caller = cronAuthorized ? null : await verifyFirebaseRequest(req, admin);
        if (action === "mark_all_read") {
            if (!caller || caller.role !== "student") return json(403, { error: "只有學生可以更新自己的通知" });
            const { error } = await admin.from("student_notifications").update({ read_at: new Date().toISOString() }).eq("student_id", caller.id).is("read_at", null);
            if (error) throw error;
            return json(200, { success: true });
        }
        if (!cronAuthorized && caller?.role !== "admin") return json(403, { error: "只有管理員或排程服務可以執行通知工作" });
        if (action === "run_due") return json(200, { success: true, events_processed: await createDueEvents(admin), email: await processQueue(admin) });
        if (action === "process_email_queue") return json(200, { success: true, email: await processQueue(admin) });
        return json(400, { error: "不支援的通知操作" });
    } catch (error) {
        const status = Number((error as any)?.status || 500);
        if (status >= 500) console.error("notification-manager unexpected error", error instanceof Error ? error.message : "unknown");
        return json(status, { error: error instanceof Error ? error.message : "通知服務暫時無法使用" });
    }
});
