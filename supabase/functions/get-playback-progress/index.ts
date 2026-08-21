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
    const bookId = Number(body?.book_id);
    if (!Number.isFinite(bookId) || bookId <= 0) {
      return json(400, { error: "book_id 不正確" });
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

    if (accountError) return json(500, { error: "無法讀取使用者資料" });
    if (!account) return json(404, { error: "找不到使用者帳號" });

    if (account.role !== "student") {
      return json(200, { success: true, progress: [], daily_count: 0, monthly_count: 0 });
    }

    const { data: tracks, error: tracksError } = await admin
      .from("music_tracks")
      .select("id")
      .eq("book_id", bookId)
      .eq("enabled", true);

    if (tracksError) return json(500, { error: "無法讀取教材音檔" });

    const trackIds = (tracks || []).map(track => track.id);
    let progress: unknown[] = [];

    if (trackIds.length > 0) {
      const { data: progressData, error: progressError } = await admin
        .from("student_track_progress")
        .select("track_id, play_count, completed, completed_at, last_played_at")
        .eq("student_id", account.id)
        .in("track_id", trackIds);

      if (progressError) return json(500, { error: "無法讀取播放進度" });
      progress = progressData || [];
    }

    const now = new Date();
    const taipeiNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
    const year = taipeiNow.getFullYear();
    const month = String(taipeiNow.getMonth() + 1).padStart(2, "0");
    const day = String(taipeiNow.getDate()).padStart(2, "0");
    const today = `${year}-${month}-${day}`;
    const monthStart = `${year}-${month}-01`;

    const [{ data: daily }, { data: monthly }] = await Promise.all([
      admin.from("student_listening_daily").select("play_count").eq("student_id", account.id).eq("activity_date", today).maybeSingle(),
      admin.from("student_listening_monthly").select("play_count").eq("student_id", account.id).eq("month_start", monthStart).maybeSingle()
    ]);

    return json(200, {
      success: true,
      progress,
      daily_count: daily?.play_count || 0,
      monthly_count: monthly?.play_count || 0
    });
  } catch (error) {
    console.error("get-playback-progress unexpected error", error);
    return json(500, { error: error instanceof Error ? error.message : "播放進度讀取失敗" });
  }
});
