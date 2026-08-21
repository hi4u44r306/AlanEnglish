import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
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

    try {
        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
        if (!token) return json(401, { error: "請先登入 Alan English" });

        let firebaseUid = "";
        try {
            firebaseUid = await verifyFirebaseIdToken(token);
        } catch (error) {
            console.error("tour-progress Firebase verify error", error);
            return json(401, { error: "登入驗證失敗，請重新登入" });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "伺服器設定不完整" });

        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        const { data: account, error: accountError } = await admin
            .from("students")
            .select("id, role")
            .eq("firebase_uid", firebaseUid)
            .maybeSingle();

        if (accountError) return json(500, { error: "無法讀取帳號資料" });
        if (!account) return json(404, { error: "找不到 Alan English 帳號" });

        const body = await req.json().catch(() => ({}));
        const action = String(body?.action || "get");
        const tourKey = String(body?.tour_key || "").trim().slice(0, 80);
        const tourVersion = Math.max(1, Math.min(999, Number(body?.tour_version) || 1));

        if (!tourKey) return json(400, { error: "tour_key 不可為空" });

        if (action === "get") {
            const { data: progress, error } = await admin
                .from("student_tour_progress")
                .select("tour_key, tour_version, completed, completed_at, updated_at")
                .eq("student_id", account.id)
                .eq("tour_key", tourKey)
                .eq("tour_version", tourVersion)
                .maybeSingle();

            if (error) return json(500, { error: "讀取導覽進度失敗" });

            return json(200, {
                success: true,
                progress: progress || {
                    tour_key: tourKey,
                    tour_version: tourVersion,
                    completed: false,
                    completed_at: null
                }
            });
        }

        if (action === "complete") {
            const now = new Date().toISOString();
            const { data: progress, error } = await admin
                .from("student_tour_progress")
                .upsert({
                    student_id: account.id,
                    tour_key: tourKey,
                    tour_version: tourVersion,
                    completed: true,
                    completed_at: now,
                    updated_at: now
                }, { onConflict: "student_id,tour_key,tour_version" })
                .select("tour_key, tour_version, completed, completed_at, updated_at")
                .single();

            if (error) return json(500, { error: "儲存導覽進度失敗" });
            return json(200, { success: true, progress });
        }

        return json(400, { error: "未知 action" });
    } catch (error) {
        console.error("tour-progress unexpected error", error);
        return json(500, { error: error instanceof Error ? error.message : "導覽服務失敗" });
    }
});
