import { deliverCostAlerts, validCostAlertEmail } from "./cost-alert-email.ts";
import { refreshServiceCosts, saveServiceCost, serviceCostDashboard } from "./service-cost-dashboard.ts";
const cleanText = (value: unknown, length: number) => String(value || "").trim().slice(0, length);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const publicAlertColumns = "id,month,level,generation,cost_usd,monthly_budget_usd,warning_percent,created_at,acknowledged_at,last_attempt_at,last_sent_at,last_error";
const checked = (result: any) => { if (result.error) throw result.error; return result.data; };

export async function handleCostAlertRequest(req: Request, deps: {
    admin: any;
    verifyUser: (req: Request, admin: any) => Promise<{ id: number; role: string; email: string | null }>;
    env: (name: string) => string | undefined;
    fetch: typeof fetch;
}) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    try {
        const { admin, env } = deps;
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { error: "成本提醒請求格式不正確" });
        const action = cleanText(body.action, 40);
        if (action === "run_due") {
            // A Firebase administrator token alone cannot invoke the background sender.
            const secret = req.headers.get("x-cron-secret") || "";
            if (!secret) return json(401, { error: "排程驗證失敗" });
            const authorized = checked(await admin.rpc("verify_guardian_cron_secret", { p_secret: secret }));
            if (authorized !== true) return json(403, { error: "排程驗證失敗" });
            const month = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Taipei' });
            const budget = checked(await admin.from('ai_api_budget_settings').select('usd_to_twd_rate').eq('id', 1).single());
            await refreshServiceCosts(admin, month, { env, fetch: deps.fetch, now: new Date(), usdToTwd: Number(budget.usd_to_twd_rate) });
            if (env("COST_ALERTS_ENABLED") === "false") return json(200, { paused: true });
            const sender = checked(await admin.from("guardian_email_settings").select("from_email,from_name,reply_to").eq("id", 1).maybeSingle());
            const apiKey = env("RESEND_API_KEY");
            checked(await admin.rpc("reconcile_api_cost_alert_v1"));
            if (!apiKey || !validCostAlertEmail(sender?.from_email)) return json(503, { error: "成本提醒寄信服務尚未設定" });
            const alerts = checked(await admin.rpc("claim_api_cost_alerts_v1")) || [];
            const delivery = await deliverCostAlerts(alerts, {
                recipient: async alert => {
                    const row = checked(await admin.from("students").select("email,role,account_status").eq("id", alert.recipient_student_id).maybeSingle());
                    return row?.role === "admin" && (!row.account_status || row.account_status === "active") ? row.email : null;
                },
                isPending: async alert => Boolean(checked(await admin.from("api_cost_alerts").select("id")
                    .eq("id", alert.id).eq("generation", alert.generation).eq("delivery_token", alert.delivery_token).is("acknowledged_at", null).maybeSingle())),
                send: async (alert, email, message) => {
                    const response = await deps.fetch("https://api.resend.com/emails", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `api-cost-${alert.id}-${alert.generation}-${alert.attempt_count}` },
                        body: JSON.stringify({
                            from: `${cleanText(sender.from_name, 80).replace(/[<>\r\n]/g, "") || "Alan English"} <${sender.from_email}>`, to: [email],
                            reply_to: validCostAlertEmail(sender.reply_to) ? sender.reply_to : undefined,
                            subject: message.subject, text: message.text
                        }),
                        signal: AbortSignal.timeout(10000)
                    });
                    if (!response.ok) throw new Error(`provider_http_${response.status}`);
                    const result = await response.json();
                    if (!result?.id) throw new Error("provider_response_invalid");
                    return cleanText(result.id, 200);
                },
                finish: async (alert, messageId, errorCode) => {
                    checked(await admin.from("api_cost_alerts").update({
                        ...(messageId ? { last_sent_at: new Date().toISOString() } : {}), last_error: errorCode
                    }).eq("id", alert.id).eq("generation", alert.generation).eq("delivery_token", alert.delivery_token));
                }
            });
            return json(200, { success: true, ...delivery });
        }
        const caller = await deps.verifyUser(req, admin);
        if (caller.role !== "admin") return json(403, { error: "只有管理員可以管理成本提醒" });
        if (action === 'dashboard' || action === 'save_service') {
            const month = cleanText(body.month, 7);
            if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return json(400, { error: '月份格式不正確' });
            if (action === 'save_service') await saveServiceCost(admin, body);
            const budget = checked(await admin.from('ai_api_budget_settings').select('usd_to_twd_rate').eq('id', 1).single());
            await refreshServiceCosts(admin, month, { env, fetch: deps.fetch, now: new Date(), usdToTwd: Number(budget.usd_to_twd_rate) });
            return json(200, { success: true, monitoring_paused: env('COST_MONITORING_ENABLED') === 'false', ...await serviceCostDashboard(admin, month) });
        }
        if (action === "subscribe") {
            if (!validCostAlertEmail(caller.email)) return json(400, { error: "管理員帳號沒有可收信的 Email，請先修正帳號 Email" });
            const subscribed = checked(await admin.from("api_cost_notification_settings").update({ recipient_student_id: caller.id, updated_at: new Date().toISOString() })
                .eq("id", 1).or(`recipient_student_id.is.null,recipient_student_id.eq.${caller.id}`).select("id").maybeSingle());
            if (!subscribed) return json(409, { error: "提醒已由另一位管理員接收，請由該帳號登入確認" });
        } else if (action === "acknowledge") {
            if (typeof body.alert_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.alert_id) || !Number.isInteger(body.generation) || body.generation < 1) return json(400, { error: "成本提醒格式不正確" });
            const done = checked(await admin.rpc("acknowledge_api_cost_alert_v1", { p_alert_id: body.alert_id, p_student_id: caller.id, p_generation: body.generation }));
            if (!done) return json(409, { error: "提醒已更新或不屬於您的帳號，請重新整理後確認" });
        } else if (action !== "status") return json(400, { error: "不支援的成本提醒操作" });
        // Viewing or logging in never acknowledges; pending earlier months remain visible.
        checked(await admin.rpc("reconcile_api_cost_alert_v1"));
        const settings = checked(await admin.from("api_cost_notification_settings").select("recipient_student_id").eq("id", 1).single());
        const alerts = checked(await admin.from("api_cost_alerts").select(publicAlertColumns).eq("recipient_student_id", caller.id).order("month", { ascending: false }));
        const sender = checked(await admin.from("guardian_email_settings").select("from_email").eq("id", 1).maybeSingle());
        return json(200, { success: true, notification: {
            configured: Boolean(settings?.recipient_student_id), is_recipient: Number(settings?.recipient_student_id) === caller.id,
            channel: "email", interval_minutes: 5, paused: env("COST_ALERTS_ENABLED") === "false",
            delivery_configured: Boolean(env("RESEND_API_KEY")) && validCostAlertEmail(sender?.from_email)
        }, alerts });
    } catch (error) {
        const status = Number((error as any)?.status || 500);
        // Log no credentials, recipient addresses or raw upstream response bodies.
        if (status >= 500) console.error("cost-alert-manager request failed");
        return json(status, { error: status < 500 && error instanceof Error ? error.message : "成本提醒服務暫時無法使用" });
    }
}
