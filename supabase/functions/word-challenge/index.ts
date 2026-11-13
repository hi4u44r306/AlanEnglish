import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";
import { verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { handleWordChallengeRequest } from "../_shared/word-challenge-handler.ts";

// 單字大挑戰：伺服器出題、伺服器批改、記到帳號並給 XP。
// 身分一律用 Firebase token 對照 students；role、student_id、分數都不採用前端傳來的值。
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
    return handleWordChallengeRequest(req, {
        admin,
        verifyUser: request => verifyFirebaseRequest(request, admin),
        loadAccess: studentId => loadEffectiveAccess(admin, studentId),
        // 全面開放開關：預設關閉，只有被逐一開放的學生走伺服器模式。
        serverForAll: Deno.env.get("WORD_CHALLENGE_SERVER_ALL") === "true"
    });
});
