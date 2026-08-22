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
const MINIMUM_LISTENING_COVERAGE = 80;
const MAX_TRACK_DURATION_SECONDS = 60 * 60;

function normalizeCoverageRanges(value: unknown, durationSeconds: number) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 120) return null;

  const ranges = value.map((range) => {
    if (!Array.isArray(range) || range.length !== 2) return null;
    const start = Math.max(0, Math.min(Number(range[0]), durationSeconds));
    const end = Math.max(0, Math.min(Number(range[1]), durationSeconds));
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? [start, end] : null;
  });

  if (ranges.some((range) => !range)) return null;

  const sorted = (ranges as number[][]).sort((first, second) => first[0] - second[0]);
  return sorted.reduce((merged: number[][], [start, end]) => {
    const previous = merged[merged.length - 1];
    if (!previous || start > previous[1] + 0.15) merged.push([start, end]);
    else previous[1] = Math.max(previous[1], end);
    return merged;
  }, []);
}

function validateCompletion(value: unknown, durationSeconds: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, error: "缺少有效聆聽工作階段" };
  }

  const session = value as Record<string, unknown>;
  const sessionId = String(session.session_id || "").trim();
  const usedAcceleratedPlayback = session.used_accelerated_playback === true;
  const ranges = normalizeCoverageRanges(session.coverage_ranges, durationSeconds);

  if (!sessionId) return { valid: false, error: "播放工作階段不正確" };

  if (usedAcceleratedPlayback) {
    return { valid: false, error: "使用加速播放的工作階段不會計入次數" };
  }

  if (!ranges) return { valid: false, error: "有效聆聽區段不正確" };

  const coveredSeconds = ranges.reduce((total, [start, end]) => total + (end - start), 0);
  const coveragePercent = Math.min(100, (coveredSeconds / durationSeconds) * 100);
  if (coveragePercent < MINIMUM_LISTENING_COVERAGE) return { valid: false, error: "尚未真正聽滿 80%" };

  return { valid: true, sessionId, ranges, coveredSeconds, coveragePercent };
}

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
    const action = String(body?.action || "").trim();
    if (action !== "start" && action !== "complete") {
      return json(400, { error: "action 不正確" });
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
      .select("id, enabled, duration_seconds")
      .eq("id", trackId)
      .maybeSingle();

    if (trackError) return json(500, { error: "無法讀取音檔資料" });
    if (!track || !track.enabled) return json(404, { error: "找不到可用音檔" });

    if (action === "start") {
      const requestedDuration = Number(body?.duration_seconds);
      const durationSeconds = Number(track.duration_seconds) || requestedDuration;

      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_TRACK_DURATION_SECONDS) {
        return json(400, { error: "音檔長度不正確" });
      }

      const { data: session, error: sessionError } = await admin
        .from("listening_coverage_sessions")
        .insert({
          student_id: student.id,
          track_id: trackId,
          duration_seconds: Number(durationSeconds.toFixed(2))
        })
        .select("id, duration_seconds, started_at")
        .single();

      if (sessionError || !session) {
        console.error("start listening session error", sessionError);
        return json(500, { error: "無法建立有效聆聽工作階段" });
      }

      return json(200, { success: true, session });
    }

    const requestedSession = body?.listening_session as Record<string, unknown> | undefined;
    const sessionId = String(requestedSession?.session_id || "").trim();
    if (!sessionId) return json(400, { error: "播放工作階段不正確" });

    const { data: storedSession, error: storedSessionError } = await admin
      .from("listening_coverage_sessions")
      .select("id, duration_seconds, started_at, completed_at, count_recorded")
      .eq("id", sessionId)
      .eq("student_id", student.id)
      .eq("track_id", trackId)
      .maybeSingle();

    if (storedSessionError) return json(500, { error: "無法讀取播放工作階段" });
    if (!storedSession || storedSession.completed_at || storedSession.count_recorded) {
      return json(409, { error: "播放工作階段已失效或已完成" });
    }

    const completion = validateCompletion(
      requestedSession,
      Number(storedSession.duration_seconds)
    );
    if (!completion.valid) return json(400, { error: completion.error });

    const elapsedSeconds = (Date.now() - new Date(storedSession.started_at).getTime()) / 1000;
    const minimumElapsedSeconds = Number(storedSession.duration_seconds) * (completion.coveragePercent / 100) * 0.75;
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < minimumElapsedSeconds) {
      return json(400, { error: "播放時間不足，無法計入次數" });
    }

    const now = new Date().toISOString();
    const { error: completeSessionError } = await admin
      .from("listening_coverage_sessions")
      .update({
        completed_at: now,
        covered_ranges: completion.ranges,
        covered_seconds: Number(completion.coveredSeconds.toFixed(2)),
        coverage_percent: Number(completion.coveragePercent.toFixed(2)),
        updated_at: now
      })
      .eq("id", storedSession.id);

    if (completeSessionError) return json(500, { error: "無法完成有效聆聽工作階段" });

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

    await Promise.all([
      admin
        .from("listening_coverage_sessions")
        .update({ count_recorded: true, updated_at: now })
        .eq("id", storedSession.id),
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
          completed: Boolean(result?.completed),
          duration_seconds: Number(storedSession.duration_seconds),
          coverage_percent: completion.coveragePercent,
          session_id: storedSession.id
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
