import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { verifyUnsubscribe } from "../_shared/guardian-weekly-unsubscribe-token.ts";

// 家長按週報信裡的連結取消每週學習週報。公開入口（家長沒有帳號），安全完全靠簽章：
//   * preview：只檢查連結並回傳「有效／已取消／過期」，不改任何資料（瀏覽器預取或信件掃描器開連結不會取消）。
//   * confirm：家長在頁面上按下按鈕才真的取消。
// 回應不帶學生姓名、信箱等個資；連結無效時一律回同樣的訊息，不洩漏帳號是否存在。
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const secret = Deno.env.get("GUARDIAN_UNSUBSCRIBE_SECRET") || "";
    if (!supabaseUrl || !serviceRoleKey || !secret) return json(503, { error: "服務暫時無法使用", code: "not_configured" });

    try {
        const body = await req.json().catch(() => ({}));
        const action = String(body?.action || "");
        if (!["preview", "confirm"].includes(action)) return json(400, { error: "不支援的操作" });

        const studentId = Number(body?.s);
        const exp = Number(body?.e);
        const token = String(body?.t || "").slice(0, 100);
        const invalid = () => json(200, { success: true, status: "invalid" });
        if (!Number.isInteger(studentId) || studentId <= 0 || !Number.isInteger(exp)) return invalid();

        const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: contact, error } = await admin
            .from("guardian_contacts")
            .select("id,student_id,email,weekly_report_opted_out_at,weekly_report_link_version")
            .eq("student_id", studentId)
            .maybeSingle();
        if (error) throw error;
        if (!contact?.email) return invalid();

        const verdict = await verifyUnsubscribe(secret, {
            studentId,
            contactId: Number(contact.id),
            email: String(contact.email),
            linkVersion: Number(contact.weekly_report_link_version || 1)
        }, exp, token);
        if (verdict === "invalid") return invalid();
        if (verdict === "expired") return json(200, { success: true, status: "expired" });

        if (action === "preview") {
            return json(200, { success: true, status: contact.weekly_report_opted_out_at ? "already" : "ready" });
        }

        const { data, error: rpcError } = await admin.rpc("guardian_weekly_report_opt_out", {
            p_student_id: studentId,
            p_contact_id: Number(contact.id),
            p_source: "email_link"
        });
        if (rpcError) throw rpcError;
        return json(200, { success: true, status: data?.status === "opted_out" ? "opted_out" : "already" });
    } catch (error) {
        console.error("guardian-weekly-unsubscribe error", (error as { code?: string })?.code || (error as Error)?.name);
        return json(500, { error: "服務暫時無法使用，請稍後再試" });
    }
});
