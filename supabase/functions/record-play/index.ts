import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";

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
    const firebaseToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!firebaseToken) return json(401, { error: "缺少登入驗證" });

    let firebaseUid = "";
    try {
      firebaseUid = await verifyFirebaseIdToken(firebaseToken);
    } catch (error) {
      console.error("Firebase token verify error", error);
      return json(401, { error: "Firebase 登入驗證失敗" });
    }

    const body = await req.json();
    const trackId = Number(body?.track_id);
    if (!Number.isFinite(trackId) || trackId <= 0) {
      return json(400, { error: "track_id 不正確" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "伺服器設定不完整" });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id, role")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (studentError) return json(500, { error: "無法讀取學生資料" });
    if (!student) return json(404, { error: "找不到學生帳號" });
    if (student.role !== "student") return json(403, { error: "只有學生帳號會累計播放紀錄" });

    const effectiveAccess = await loadEffectiveAccess(admin, Number(student.id));
    if (!effectiveAccess.is_active) {
      return json(402, { error: "會員使用期限已結束，播放紀錄不會再累計", code: "membership_required" });
    }
    if (!effectiveAccess.features.listening) {
      return json(403, { error: "目前帳號不包含聽力教材", code: "listening_not_available" });
    }

    const { data: track, error: trackError } = await admin
      .from("music_tracks")
      .select("id, enabled")
      .eq("id", trackId)
      .maybeSingle();

    if (trackError) return json(500, { error: "無法讀取音檔資料" });
    if (!track || !track.enabled) return json(404, { error: "找不到可用音檔" });

    const { data, error } = await admin.rpc("record_student_music_play", {
      p_student_id: student.id,
      p_track_id: trackId,
      p_required_plays: 100
    });

    if (error) {
      console.error("record play rpc error", error);
      return json(500, { error: `播放紀錄更新失敗：${error.message}` });
    }

    const result = Array.isArray(data) ? data[0] : data;
    const now = new Date().toISOString();

    await Promise.all([
      admin
        .from("students")
        .update({ last_active_at: now, last_learning_at: now, updated_at: now })
        .eq("id", student.id),
      admin.from("student_activity_events").insert({
        student_id: student.id,
        activity_type: "listening",
        activity_key: `track:${trackId}`,
        metadata: {
          track_id: trackId,
          play_count: Number(result?.play_count || 0),
          completed: Boolean(result?.completed)
        },
        occurred_at: now
      })
    ]);

    return json(200, { success: true, progress: result });
  } catch (error) {
    console.error("record-play unexpected error", error);
    return json(500, { error: error instanceof Error ? error.message : "播放紀錄更新失敗" });
  }
});
