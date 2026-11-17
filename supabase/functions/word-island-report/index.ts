import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { handleWordIslandReportRequest } from "../_shared/word-island-report-handler.ts";

// 老師端「單字島進度」：只讀。身分一律用 Firebase token 對照 students；
// 班級權限由伺服器查 teacher_class_permissions，不採用前端傳來的 role、班級或學生。
Deno.serve(async (req: Request) => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
        return new Response(JSON.stringify({ error: "服務尚未設定完成", code: null }), {
            status: 500,
            headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" }
        });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    return handleWordIslandReportRequest(req, {
        admin,
        verifyUser: request => verifyFirebaseRequest(request, admin),
        serverForAll: Deno.env.get("WORD_CHALLENGE_SERVER_ALL") === "true"
    });
});
