import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";
import { computeLearningStreak } from "../_shared/learning-streak.ts";

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

const getTaipeiDateParts = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = parts.find(part => part.type === "year")?.value || "";
  const month = parts.find(part => part.type === "month")?.value || "";
  const day = parts.find(part => part.type === "day")?.value || "";

  if (!year || !month || !day) throw new Error("無法取得台北日期");

  return {
    today: `${year}-${month}-${day}`,
    monthStart: `${year}-${month}-01`
  };
};

// 連續學習天數：聽力播放與口說題目完成都算「學習一天」。
// 只讀取最近約 14 個月、只取日期欄位；讀取失敗時不影響原本的今日／本月統計。
const STREAK_LOOKBACK_DAYS = 430;
const STREAK_PAGE_SIZE = 1000;
const STREAK_MAX_PAGES = 6;

const addDaysToDate = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

async function loadStreak(admin: ReturnType<typeof createClient>, studentId: number, today: string) {
  const since = addDaysToDate(today, -STREAK_LOOKBACK_DAYS);
  const dates = new Set<string>();

  const listening = await admin
    .from("student_listening_daily")
    .select("activity_date")
    .eq("student_id", studentId)
    .gt("play_count", 0)
    .gte("activity_date", since)
    .lte("activity_date", today)
    .order("activity_date", { ascending: false })
    .limit(STREAK_LOOKBACK_DAYS + 5);
  if (listening.error) throw listening.error;
  for (const row of listening.data || []) dates.add(String(row.activity_date));

  for (let page = 0; page < STREAK_MAX_PAGES; page += 1) {
    const speaking = await admin
      .from("speaking_daily_question_completions")
      .select("activity_date")
      .eq("student_id", studentId)
      .gte("activity_date", since)
      .lte("activity_date", today)
      .order("activity_date", { ascending: false })
      .range(page * STREAK_PAGE_SIZE, (page + 1) * STREAK_PAGE_SIZE - 1);
    if (speaking.error) throw speaking.error;
    for (const row of speaking.data || []) dates.add(String(row.activity_date));
    if ((speaking.data || []).length < STREAK_PAGE_SIZE) break;
  }

  return computeLearningStreak(dates, today);
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "伺服器設定不完整" });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: account, error: accountError } = await admin
      .from("students")
      .select("id, role, total_time_played")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (accountError) {
      console.error("get-dashboard-stats account error", accountError);
      return json(500, { error: "無法讀取使用者資料" });
    }

    if (!account) return json(404, { error: "找不到使用者帳號" });
    if (account.role !== "student") return json(403, { error: "此功能僅提供學生帳號使用" });

    const { today, monthStart } = getTaipeiDateParts();

    const [dailyResult, monthlyResult] = await Promise.all([
      admin
        .from("student_listening_daily")
        .select("play_count")
        .eq("student_id", account.id)
        .eq("activity_date", today)
        .maybeSingle(),
      admin
        .from("student_listening_monthly")
        .select("play_count")
        .eq("student_id", account.id)
        .eq("month_start", monthStart)
        .maybeSingle()
    ]);

    if (dailyResult.error) {
      console.error("get-dashboard-stats daily error", dailyResult.error);
      return json(500, { error: "無法讀取今日播放統計" });
    }

    if (monthlyResult.error) {
      console.error("get-dashboard-stats monthly error", monthlyResult.error);
      return json(500, { error: "無法讀取本月播放統計" });
    }

    let streak = null;
    try {
      streak = await loadStreak(admin, account.id, today);
    } catch (streakError) {
      console.error("get-dashboard-stats streak error", streakError);
    }

    return json(200, {
      success: true,
      daily_count: Number(dailyResult.data?.play_count || 0),
      monthly_count: Number(monthlyResult.data?.play_count || 0),
      total_count: Number(account.total_time_played || 0),
      streak
    });
  } catch (error) {
    console.error("get-dashboard-stats unexpected error", error);
    return json(500, { error: error instanceof Error ? error.message : "Dashboard 統計讀取失敗" });
  }
});
