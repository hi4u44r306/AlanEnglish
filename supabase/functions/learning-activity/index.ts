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
const DAY_MS = 24 * 60 * 60 * 1000;
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

const taipeiDayBounds = () => {
  const dateKey = new Date(Date.now() + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
  const startAt = new Date(`${dateKey}T00:00:00+08:00`);
  return {
    startAt: startAt.toISOString(),
    endAt: new Date(startAt.getTime() + DAY_MS).toISOString()
  };
};

async function verifyFirebaseIdToken(token: string) {
  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    issuer: FIREBASE_ISSUER,
    audience: FIREBASE_PROJECT_ID
  });

  const uid = String(payload.sub || "").trim();
  if (!uid) throw new Error("Firebase token 缺少 uid");
  return uid;
}

const getInactiveDays = (timestamp: string | null) => {
  if (!timestamp) return null;
  const value = new Date(timestamp).getTime();
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.floor((Date.now() - value) / 86400000));
};

const getActivityStatus = (lastActiveAt: string | null, lastLoginAt: string | null) => {
  if (!lastActiveAt && !lastLoginAt) {
    return { code: "never", label: "尚未使用", inactive_days: null };
  }

  const reference = lastActiveAt || lastLoginAt;
  const days = getInactiveDays(reference);
  if (days === null) return { code: "unknown", label: "未知", inactive_days: null };
  if (days <= 6) return { code: "normal", label: "正常", inactive_days: days };
  if (days <= 13) return { code: "warning", label: "一週未使用", inactive_days: days };
  if (days <= 29) return { code: "concern", label: "兩週以上未使用", inactive_days: days };
  return { code: "critical", label: "長期未使用", inactive_days: days };
};

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
      .select("id, name, email, class, role, plan, last_login_at, last_active_at, last_learning_at")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (accountError) {
      console.error("learning-activity account error", accountError);
      return json(500, { error: "無法讀取使用者資料" });
    }
    if (!account) return json(404, { error: "找不到使用者帳號" });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "heartbeat");
    const now = new Date().toISOString();

    if (account.role === "student" && ["conversation_get", "conversation_save"].includes(action)) {
      const effectiveAccess = await loadEffectiveAccess(admin, Number(account.id));
      if (!effectiveAccess.is_active) {
        return json(402, { error: "會員使用期限已結束，無法使用英文對話", code: "membership_required" });
      }
      if (!effectiveAccess.features.conversation) {
        return json(403, { error: "目前帳號不包含英文對話", code: "conversation_not_available" });
      }
    }

    if (action === "heartbeat") {
      const { error } = await admin
        .from("students")
        .update({ last_active_at: now, updated_at: now })
        .eq("id", account.id);
      if (error) return json(500, { error: "更新活躍狀態失敗" });
      return json(200, { success: true, at: now });
    }

    // 播放器記錄「放著不動沒回應」「切換頁面暫停」，每週報告用來算專注度。只記學生本人；不影響任何次數、連續天數或獎勵。
    if (action === "listening_pause") {
      if (account.role !== "student") return json(200, { success: true, ignored: true });
      const reason = String(body?.reason || "");
      if (reason !== "idle" && reason !== "hidden") return json(400, { error: "暫停原因不正確" });
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("student_activity_events")
        .select("id", { count: "exact", head: true })
        .eq("student_id", account.id)
        .eq("activity_type", "listening")
        .like("activity_key", "pause-%")
        .gte("occurred_at", since);
      if ((count || 0) >= 120) return json(200, { success: true, ignored: true });
      const trackId = Number(body?.track_id);
      const { error: eventError } = await admin.from("student_activity_events").insert({
        student_id: account.id,
        activity_type: "listening",
        activity_key: `pause-${reason}`,
        metadata: Number.isInteger(trackId) && trackId > 0 ? { track_id: trackId } : {},
        occurred_at: now
      });
      if (eventError) return json(500, { error: "記錄失敗" });
      return json(200, { success: true });
    }

    // 口說大挑戰的專注度：關卡進行中切換頁面（hidden）、90 秒沒有任何操作（idle）、
    // 想離開「先聽本關教材」被帶回（left_prep）。只記學生本人，不影響通關、次數或獎勵。
    // activity_type 用既有的 other（資料表 CHECK 只允許 login/listening/conversation/ai/other），以 key 前綴區分。
    if (action === "speaking_attention") {
      if (account.role !== "student") return json(200, { success: true, ignored: true });
      const reason = String(body?.reason || "");
      if (!["idle", "hidden", "left_prep"].includes(reason)) return json(400, { error: "中斷原因不正確" });
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("student_activity_events")
        .select("id", { count: "exact", head: true })
        .eq("student_id", account.id)
        .eq("activity_type", "other")
        .like("activity_key", "speaking-pause-%")
        .gte("occurred_at", since);
      if ((count || 0) >= 60) return json(200, { success: true, ignored: true });
      const questionSetId = Number(body?.question_set_id);
      const mode = body?.mode === "challenge" ? "challenge" : body?.mode === "easy" ? "easy" : null;
      const metadata: Record<string, unknown> = {};
      if (Number.isInteger(questionSetId) && questionSetId > 0) metadata.question_set_id = questionSetId;
      if (mode) metadata.mode = mode;
      const { error: eventError } = await admin.from("student_activity_events").insert({
        student_id: account.id,
        activity_type: "other",
        activity_key: `speaking-pause-${reason}`,
        metadata,
        occurred_at: now
      });
      if (eventError) return json(500, { error: "記錄失敗" });
      return json(200, { success: true });
    }

    // 平台內播放的教學影片（YouTube 片段）：start 開始、complete 看完、pause_hidden 播放中切走。
    // 看完要後端再確認：同一個播放工作階段先有 start，且經過的時間至少是片段長度的 80%。
    // 只記學生本人；不給點數、不算通關（遵守 YouTube 不得以獎勵換觀看的規定）。
    if (action === "video_watch") {
      if (account.role !== "student") return json(200, { success: true, ignored: true });
      const phase = String(body?.phase || "");
      if (!["start", "complete", "pause_hidden"].includes(phase)) return json(400, { error: "影片紀錄類型不正確" });
      const videoId = String(body?.video_id || "");
      const startSeconds = Number(body?.start_seconds);
      const endSeconds = Number(body?.end_seconds);
      const sessionId = String(body?.session_id || "");
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)
        || !Number.isInteger(startSeconds) || !Number.isInteger(endSeconds)
        || startSeconds < 0 || endSeconds <= startSeconds || endSeconds - startSeconds > 3 * 60 * 60
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
        return json(400, { error: "影片資料不正確" });
      }
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("student_activity_events")
        .select("id", { count: "exact", head: true })
        .eq("student_id", account.id)
        .eq("activity_type", "other")
        .like("activity_key", "video-%")
        .gte("occurred_at", since);
      if ((count || 0) >= 120) return json(200, { success: true, ignored: true });
      const trackId = Number(body?.track_id);
      const context = body?.context === "speaking_prep" ? "speaking_prep" : "playlist";
      const metadata: Record<string, unknown> = {
        video_id: videoId, start_seconds: startSeconds, end_seconds: endSeconds, session_id: sessionId, context
      };
      if (Number.isInteger(trackId) && trackId > 0) metadata.track_id = trackId;

      if (phase === "complete") {
        const { data: started } = await admin
          .from("student_activity_events")
          .select("occurred_at")
          .eq("student_id", account.id)
          .eq("activity_key", "video-start")
          .eq("metadata->>session_id", sessionId)
          .gte("occurred_at", new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
          .order("occurred_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!started) return json(409, { error: "找不到這段影片的開始紀錄", code: "video_not_started" });
        const elapsed = (Date.now() - new Date(started.occurred_at).getTime()) / 1000;
        if (elapsed + 5 < (endSeconds - startSeconds) * 0.8) {
          return json(409, { error: "影片還沒看到八成", code: "video_too_short" });
        }
        const { count: done } = await admin
          .from("student_activity_events")
          .select("id", { count: "exact", head: true })
          .eq("student_id", account.id)
          .eq("activity_key", "video-watched")
          .eq("metadata->>session_id", sessionId);
        if ((done || 0) > 0) return json(200, { success: true, duplicate: true });
      }

      const { error: eventError } = await admin.from("student_activity_events").insert({
        student_id: account.id,
        activity_type: "other",
        activity_key: phase === "start" ? "video-start" : phase === "complete" ? "video-watched" : "video-pause-hidden",
        metadata,
        occurred_at: now
      });
      if (eventError) return json(500, { error: "記錄失敗" });
      return json(200, { success: true });
    }

    if (action === "login") {
      const { error: updateError } = await admin
        .from("students")
        .update({ last_login_at: now, last_active_at: now, updated_at: now })
        .eq("id", account.id);
      if (updateError) return json(500, { error: "更新登入狀態失敗" });

      await Promise.all([
        admin.from("student_login_events").insert({ student_id: account.id, source: "web", logged_in_at: now }),
        admin.from("student_activity_events").insert({
          student_id: account.id,
          activity_type: "login",
          activity_key: "web-login",
          metadata: {},
          occurred_at: now
        })
      ]);

      return json(200, { success: true, at: now });
    }

    if (action === "conversation_get") {
      if (account.role !== "student") {
        return json(200, { success: true, demo_mode: true, progress: null });
      }

      const scenarioKey = String(body?.scenario_key || "meet-a-foreigner").trim();
      const { data: progress, error } = await admin
        .from("conversation_progress")
        .select("scenario_key, mode, current_step, completed_steps, total_steps, last_step_key, completed, completed_at, last_practiced_at, updated_at")
        .eq("student_id", account.id)
        .eq("scenario_key", scenarioKey)
        .maybeSingle();

      if (error) return json(500, { error: "讀取英文對話進度失敗" });

      await admin
        .from("students")
        .update({ last_active_at: now, updated_at: now })
        .eq("id", account.id);

      return json(200, { success: true, demo_mode: false, progress });
    }

    if (action === "conversation_save") {
      if (account.role !== "student") {
        return json(200, { success: true, demo_mode: true, saved: false });
      }

      const scenarioKey = String(body?.scenario_key || "meet-a-foreigner").trim();
      const mode = ["starter", "explorer", "challenge"].includes(String(body?.mode))
        ? String(body.mode)
        : "explorer";
      const totalSteps = Number(body?.total_steps);
      const currentStep = Number(body?.current_step);
      const completedSteps = Number(body?.completed_steps);
      const completed = Boolean(body?.completed);
      const lastStepKey = body?.last_step_key ? String(body.last_step_key) : null;

      if (!Number.isInteger(totalSteps) || totalSteps < 1 || totalSteps > 100) {
        return json(400, { error: "total_steps 不正確" });
      }
      if (!Number.isInteger(currentStep) || currentStep < 0 || currentStep >= totalSteps) {
        return json(400, { error: "current_step 不正確" });
      }
      if (!Number.isInteger(completedSteps) || completedSteps < 0 || completedSteps > totalSteps) {
        return json(400, { error: "completed_steps 不正確" });
      }

      const { data: oldProgress } = await admin
        .from("conversation_progress")
        .select("completed_steps, completed")
        .eq("student_id", account.id)
        .eq("scenario_key", scenarioKey)
        .maybeSingle();

      const payload = {
        student_id: account.id,
        scenario_key: scenarioKey,
        mode,
        current_step: currentStep,
        completed_steps: completed ? totalSteps : completedSteps,
        total_steps: totalSteps,
        last_step_key: lastStepKey,
        completed,
        completed_at: completed ? now : null,
        last_practiced_at: now,
        updated_at: now
      };

      const { data: progress, error: saveError } = await admin
        .from("conversation_progress")
        .upsert(payload, { onConflict: "student_id,scenario_key" })
        .select("scenario_key, mode, current_step, completed_steps, total_steps, last_step_key, completed, completed_at, last_practiced_at, updated_at")
        .single();

      if (saveError) {
        console.error("conversation save error", saveError);
        return json(500, { error: "儲存英文對話進度失敗" });
      }

      await admin
        .from("students")
        .update({ last_active_at: now, last_learning_at: now, updated_at: now })
        .eq("id", account.id);

      const progressed = completed || completedSteps > Number(oldProgress?.completed_steps || 0);
      if (progressed) {
        await admin.from("student_activity_events").insert({
          student_id: account.id,
          activity_type: "conversation",
          activity_key: `${scenarioKey}:${lastStepKey || currentStep}`,
          metadata: {
            scenario_key: scenarioKey,
            mode,
            current_step: currentStep,
            completed_steps: completed ? totalSteps : completedSteps,
            total_steps: totalSteps,
            completed
          },
          occurred_at: now
        });
      }

      return json(200, { success: true, demo_mode: false, saved: true, progress });
    }

    if (action === "teacher_dashboard") {
      if (!["teacher", "admin"].includes(account.role)) {
        return json(403, { error: "只有 Teacher / Admin 可以查看學生學習後台" });
      }

      const [studentsResult, progressResult, guardiansResult, listeningResult] = await Promise.all([
        admin
          .from("students")
          .select("id, name, email, class, plan, created_at, last_login_at, last_active_at, last_learning_at")
          .eq("role", "student")
          .order("name", { ascending: true }),
        admin
          .from("conversation_progress")
          .select("student_id, scenario_key, mode, current_step, completed_steps, total_steps, completed, last_practiced_at")
          .eq("scenario_key", "meet-a-foreigner"),
        admin
          .from("guardian_contacts")
          .select("id, student_id, guardian_name, email, phone, preferred_channel, notification_enabled, updated_at"),
        admin
          .from("student_track_progress")
          .select("student_id, completed, last_played_at")
      ]);

      if (studentsResult.error) return json(500, { error: "讀取學生資料失敗" });
      if (progressResult.error) return json(500, { error: "讀取 Conversation 進度失敗" });
      if (guardiansResult.error) return json(500, { error: "讀取家長資料失敗" });
      if (listeningResult.error) return json(500, { error: "讀取聽力進度失敗" });

      const progressMap = new Map((progressResult.data || []).map(item => [item.student_id, item]));
      const guardianMap = new Map((guardiansResult.data || []).map(item => [item.student_id, item]));
      const listeningMap = new Map<number, { completed: number; last_played_at: string | null }>();

      for (const item of listeningResult.data || []) {
        const current = listeningMap.get(item.student_id) || { completed: 0, last_played_at: null };
        if (item.completed) current.completed += 1;
        if (item.last_played_at && (!current.last_played_at || item.last_played_at > current.last_played_at)) {
          current.last_played_at = item.last_played_at;
        }
        listeningMap.set(item.student_id, current);
      }

      const students = (studentsResult.data || []).map(student => ({
        ...student,
        status: getActivityStatus(student.last_active_at, student.last_login_at),
        conversation: progressMap.get(student.id) || null,
        guardian: guardianMap.get(student.id) || null,
        listening: listeningMap.get(student.id) || { completed: 0, last_played_at: null }
      }));

      return json(200, { success: true, students });
    }

    if (action === "guardian_upsert") {
      if (!["teacher", "admin"].includes(account.role)) {
        return json(403, { error: "只有 Teacher / Admin 可以管理家長資料" });
      }

      const studentId = Number(body?.student_id);
      if (!Number.isFinite(studentId) || studentId <= 0) return json(400, { error: "student_id 不正確" });

      const { data: student } = await admin
        .from("students")
        .select("id, role")
        .eq("id", studentId)
        .maybeSingle();
      if (!student || student.role !== "student") return json(404, { error: "找不到學生" });

      const email = String(body?.email || "").trim().toLowerCase() || null;
      const guardianName = String(body?.guardian_name || "").trim() || null;
      const phone = String(body?.phone || "").trim() || null;
      const preferredChannel = ["email", "line", "none"].includes(String(body?.preferred_channel))
        ? String(body.preferred_channel)
        : "email";
      const notificationEnabled = body?.notification_enabled !== false;

      const { data: guardian, error } = await admin
        .from("guardian_contacts")
        .upsert({
          student_id: studentId,
          guardian_name: guardianName,
          email,
          phone,
          preferred_channel: preferredChannel,
          notification_enabled: notificationEnabled,
          updated_at: now
        }, { onConflict: "student_id" })
        .select("id, student_id, guardian_name, email, phone, preferred_channel, notification_enabled, updated_at")
        .single();

      if (error) return json(500, { error: "儲存家長資料失敗" });
      return json(200, { success: true, guardian });
    }

    if (action === "notification_draft") {
      if (!["teacher", "admin"].includes(account.role)) {
        return json(403, { error: "只有 Teacher / Admin 可以建立家長提醒" });
      }

      const studentId = Number(body?.student_id);
      if (!Number.isFinite(studentId) || studentId <= 0) return json(400, { error: "student_id 不正確" });

      const [{ data: student }, { data: guardian }] = await Promise.all([
        admin.from("students").select("id, name, last_active_at, last_learning_at").eq("id", studentId).maybeSingle(),
        admin.from("guardian_contacts").select("id, guardian_name, email, notification_enabled").eq("student_id", studentId).maybeSingle()
      ]);

      if (!student) return json(404, { error: "找不到學生" });
      if (!guardian?.notification_enabled) return json(400, { error: "此學生尚未開啟家長通知" });
      if (!guardian?.email) return json(400, { error: "尚未設定家長 Email" });

      const inactiveDays = getInactiveDays(student.last_learning_at || student.last_active_at);
      const daysText = inactiveDays === null ? "一段時間" : `${inactiveDays} 天`;
      const subject = `Alan English 學習提醒｜${student.name}`;
      const message = `${guardian.guardian_name ? `${guardian.guardian_name} 您好：\n\n` : "您好：\n\n"}${student.name} 最近已經 ${daysText} 沒有完成 Alan English 英文練習。建議今天花 5～10 分鐘完成一次聽力或英文口說練習，保持英文學習習慣。\n\n— Alan English`;

      const dayBounds = taipeiDayBounds();
      const { data: sentToday, error: sentTodayError } = await admin
        .from("notification_logs")
        .select("id")
        .eq("student_id", studentId)
        .eq("reason", "inactive-learning")
        .eq("status", "sent")
        .gte("sent_at", dayBounds.startAt)
        .lt("sent_at", dayBounds.endAt)
        .limit(1);
      if (sentTodayError) return json(500, { error: "讀取今日寄送紀錄失敗" });

      const { data: log, error } = await admin
        .from("notification_logs")
        .insert({
          student_id: studentId,
          guardian_contact_id: guardian.id,
          created_by_account_id: account.id,
          channel: "email",
          reason: "inactive-learning",
          subject,
          message,
          status: "draft"
        })
        .select("id, status, created_at")
        .single();

      if (error) return json(500, { error: "建立通知草稿失敗" });

      return json(200, {
        success: true,
        draft: {
          id: log.id,
          email: guardian.email,
          subject,
          message,
          status: log.status,
          already_sent_today: (sentToday || []).length > 0,
          created_at: log.created_at
        }
      });
    }

    if (action === "notification_mark_sent") {
      if (!["teacher", "admin"].includes(account.role)) {
        return json(403, { error: "只有 Teacher / Admin 可以更新提醒紀錄" });
      }

      const logId = Number(body?.notification_id);
      if (!Number.isFinite(logId) || logId <= 0) return json(400, { error: "notification_id 不正確" });

      const { error } = await admin
        .from("notification_logs")
        .update({ status: "sent", sent_at: now })
        .eq("id", logId);
      if (error) return json(500, { error: "更新通知紀錄失敗" });

      return json(200, { success: true });
    }

    return json(400, { error: "未知 action" });
  } catch (error) {
    console.error("learning-activity unexpected error", error);
    return json(500, { error: error instanceof Error ? error.message : "學習活動服務失敗" });
  }
});
