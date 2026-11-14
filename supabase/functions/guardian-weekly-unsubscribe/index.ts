import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";
import { canManageStudent, getManagedStudentIds } from "../_shared/teacher-scope.ts";
import { verifyUnsubscribe } from "../_shared/guardian-weekly-unsubscribe-token.ts";

// 家長取消每週學習週報。兩種入口：
// 一、公開入口（家長沒有帳號，安全完全靠簽章）：
//   * preview：只檢查連結並回傳「有效／已取消／過期」，不改任何資料（瀏覽器預取或信件掃描器開連結不會取消）。
//   * confirm：家長在頁面上按下按鈕才真的取消。
//   回應不帶學生姓名、信箱等個資；連結無效時一律回同樣的訊息，不洩漏帳號是否存在。
// 二、老師／管理員入口（要登入，且只能處理自己負責班級的學生）：
//   * admin_list：列出哪些學生的家長取消了每週週報。
//   * admin_reenable：重新開啟。
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const FIREBASE_PROJECT_ID = "alan-english-listening";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

async function verifyFirebaseIdToken(token: string) {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: FIREBASE_PROJECT_ID
    });
    const uid = String(payload.sub || "").trim();
    if (!uid) throw new Error("Firebase token 缺少 uid");
    return uid;
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const secret = Deno.env.get("GUARDIAN_UNSUBSCRIBE_SECRET") || "";
    if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "伺服器設定不完整" });

    try {
        const body = await req.json().catch(() => ({}));
        const action = String(body?.action || "");
        if (!["preview", "confirm", "admin_list", "admin_reenable"].includes(action)) return json(400, { error: "不支援的操作" });
        const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

        if (action === "admin_list" || action === "admin_reenable") {
            const authHeader = req.headers.get("Authorization") || "";
            const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
            if (!idToken) return json(401, { error: "請先登入 Alan English" });
            let uid = "";
            try {
                uid = await verifyFirebaseIdToken(idToken);
            } catch {
                return json(401, { error: "登入驗證失敗，請重新登入" });
            }
            const { data: caller, error: callerError } = await admin
                .from("students")
                .select("id,role")
                .eq("firebase_uid", uid)
                .maybeSingle();
            if (callerError) throw callerError;
            if (!caller || !["teacher", "admin"].includes(caller.role)) {
                return json(403, { error: "只有 Teacher / Admin 可以管理家長週報" });
            }

            if (action === "admin_list") {
                const managedIds = await getManagedStudentIds(admin, caller);
                if (managedIds && managedIds.size === 0) return json(200, { success: true, opted_out: [] });
                let query = admin
                    .from("guardian_contacts")
                    .select("student_id,weekly_report_opted_out_at")
                    .not("weekly_report_opted_out_at", "is", null);
                if (managedIds) query = query.in("student_id", [...managedIds]);
                const { data, error } = await query.limit(5000);
                if (error) throw error;
                return json(200, {
                    success: true,
                    opted_out: (data || []).map((row: any) => ({
                        student_id: Number(row.student_id),
                        opted_out_at: row.weekly_report_opted_out_at
                    }))
                });
            }

            const studentId = Number(body?.student_id);
            if (!Number.isInteger(studentId) || studentId <= 0) return json(400, { error: "student_id 不正確" });
            if (!await canManageStudent(admin, caller, studentId)) {
                return json(403, { error: "只能管理自己負責班級的學生" });
            }
            const { data, error } = await admin.rpc("guardian_weekly_report_re_enable", {
                p_student_id: studentId,
                p_actor_id: caller.id
            });
            if (error) throw error;
            return json(200, { success: true, status: data?.status || "not_opted_out" });
        }

        if (!secret) return json(503, { error: "服務暫時無法使用", code: "not_configured" });
        const studentId = Number(body?.s);
        const exp = Number(body?.e);
        const token = String(body?.t || "").slice(0, 100);
        const invalid = () => json(200, { success: true, status: "invalid" });
        if (!Number.isInteger(studentId) || studentId <= 0 || !Number.isInteger(exp)) return invalid();

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
