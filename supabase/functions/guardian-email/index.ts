import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const FIREBASE_PROJECT_ID = "alan-english-listening";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);
const DAY_MS = 24 * 60 * 60 * 1000;
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const cleanText = (value: unknown, maxLength = 2000) => String(value || "")
    .trim()
    .slice(0, maxLength);

const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const escapeHtml = (value: unknown) => cleanText(value, 10000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

async function verifyFirebaseIdToken(token: string) {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: FIREBASE_PROJECT_ID
    });
    const uid = cleanText(payload.sub, 200);
    if (!uid) throw new Error("Firebase token 缺少 uid");
    return uid;
}

const previousWeekStart = () => {
    const taipeiNow = new Date(Date.now() + TAIPEI_OFFSET_MS);
    const localMidnight = Date.UTC(
        taipeiNow.getUTCFullYear(),
        taipeiNow.getUTCMonth(),
        taipeiNow.getUTCDate()
    );
    const weekday = taipeiNow.getUTCDay() || 7;
    const currentMonday = localMidnight - ((weekday - 1) * DAY_MS);
    return new Date(currentMonday - (7 * DAY_MS)).toISOString().slice(0, 10);
};

const getWeekRange = (startDate: string) => {
    if (!isDateKey(startDate)) throw new Error("週起始日期格式不正確");
    const startLocalMs = new Date(`${startDate}T00:00:00.000Z`).getTime();
    const endLocalMs = startLocalMs + (7 * DAY_MS);
    return {
        startDate,
        endDate: new Date(endLocalMs - DAY_MS).toISOString().slice(0, 10),
        startAt: new Date(startLocalMs - TAIPEI_OFFSET_MS).toISOString(),
        endAt: new Date(endLocalMs - TAIPEI_OFFSET_MS).toISOString()
    };
};

const getStatusCopy = (activeDays: number, listening: number, completed: number, accuracy: number | null) => {
    if (activeDays >= 4 && (accuracy === null || accuracy >= 80)) {
        return {
            label: "穩定成長",
            message: "這週維持了很好的練習節奏，請繼續鼓勵孩子保持這個習慣。"
        };
    }
    if (activeDays >= 2 || listening >= 5 || completed >= 1) {
        return {
            label: "持續累積",
            message: "這週已累積實際練習成果，再固定增加一天練習會更穩定。"
        };
    }
    return {
        label: "下週重新啟動",
        message: "本週練習較少，建議下週先從每天 5～10 分鐘的小任務開始。"
    };
};

const buildReport = async (admin: any, student: any, weekStart: string) => {
    const range = getWeekRange(weekStart);
    const [
        guardianResult,
        listeningResult,
        assignmentResult,
        aiResult,
        reviewResult,
        activityResult
    ] = await Promise.all([
        admin
            .from("guardian_contacts")
            .select("id,guardian_name,email,notification_enabled")
            .eq("student_id", student.id)
            .maybeSingle(),
        admin
            .from("student_listening_daily")
            .select("activity_date,play_count")
            .eq("student_id", student.id)
            .gte("activity_date", range.startDate)
            .lte("activity_date", range.endDate),
        admin
            .from("assignment_progress")
            .select("assignment_id,completed,completed_at,best_score,last_attempt_at")
            .eq("student_id", student.id)
            .gte("last_attempt_at", range.startAt)
            .lt("last_attempt_at", range.endAt),
        admin
            .from("ai_material_attempts")
            .select("score,correct_count,total_questions,passed,created_at")
            .eq("student_id", student.id)
            .gte("created_at", range.startAt)
            .lt("created_at", range.endAt),
        admin
            .from("review_attempts")
            .select("is_correct,reviewed_at")
            .eq("student_id", student.id)
            .gte("reviewed_at", range.startAt)
            .lt("reviewed_at", range.endAt),
        admin
            .from("student_activity_events")
            .select("activity_type,occurred_at")
            .eq("student_id", student.id)
            .gte("occurred_at", range.startAt)
            .lt("occurred_at", range.endAt)
    ]);
    const firstError = [
        guardianResult.error,
        listeningResult.error,
        assignmentResult.error,
        aiResult.error,
        reviewResult.error,
        activityResult.error
    ].find(Boolean);
    if (firstError) throw firstError;

    const listening = (listeningResult.data || []).reduce(
        (sum: number, row: any) => sum + Number(row.play_count || 0),
        0
    );
    const completedAssignments = (assignmentResult.data || []).filter((row: any) => row.completed).length;
    const questionRows = [
        ...(aiResult.data || []).map((row: any) => ({
            correct: Number(row.correct_count || 0),
            total: Number(row.total_questions || 0)
        })),
        ...(reviewResult.data || []).map((row: any) => ({
            correct: row.is_correct ? 1 : 0,
            total: 1
        }))
    ];
    const correctQuestions = questionRows.reduce((sum, row) => sum + row.correct, 0);
    const totalQuestions = questionRows.reduce((sum, row) => sum + row.total, 0);
    const accuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : null;
    const activeDateKeys = new Set<string>();
    for (const row of listeningResult.data || []) {
        if (Number(row.play_count || 0) > 0) activeDateKeys.add(String(row.activity_date));
    }
    for (const row of activityResult.data || []) {
        const timestamp = new Date(row.occurred_at).getTime();
        if (Number.isFinite(timestamp)) {
            activeDateKeys.add(new Date(timestamp + TAIPEI_OFFSET_MS).toISOString().slice(0, 10));
        }
    }
    const conversationCount = (activityResult.data || [])
        .filter((row: any) => row.activity_type === "conversation")
        .length;
    const aiPassed = (aiResult.data || []).filter((row: any) => row.passed).length;
    const status = getStatusCopy(activeDateKeys.size, listening, completedAssignments, accuracy);

    return {
        student,
        guardian: guardianResult.data || null,
        range,
        metrics: {
            active_days: activeDateKeys.size,
            listening_count: listening,
            completed_assignments: completedAssignments,
            ai_passed: aiPassed,
            review_count: (reviewResult.data || []).length,
            conversation_count: conversationCount,
            accuracy
        },
        status
    };
};

const buildEmail = (report: any) => {
    const guardianName = report.guardian?.guardian_name
        ? `${escapeHtml(report.guardian.guardian_name)} 家長您好`
        : "家長您好";
    const studentName = escapeHtml(report.student.name || "孩子");
    const accuracyText = report.metrics.accuracy === null ? "本週尚無測驗" : `${report.metrics.accuracy}%`;
    const subject = `Alan English｜${report.student.name} ${report.range.startDate} 學習週報`;
    const text = `${guardianName}：\n\n${studentName} 在 ${report.range.startDate}～${report.range.endDate} 的學習摘要：\n` +
        `・活躍天數：${report.metrics.active_days} 天\n` +
        `・聽力播放：${report.metrics.listening_count} 次\n` +
        `・完成作業：${report.metrics.completed_assignments} 份\n` +
        `・AI 教材通過：${report.metrics.ai_passed} 份\n` +
        `・複習題數：${report.metrics.review_count} 題\n` +
        `・作答正確率：${accuracyText}\n\n` +
        `${report.status.label}：${report.status.message}\n\nAlan English`;
    const html = `<!doctype html>
<html lang="zh-Hant">
<body style="margin:0;background:#f6f8fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#172033">
  <div style="max-width:640px;margin:0 auto;padding:28px 16px">
    <div style="background:#173f5f;color:white;border-radius:20px 20px 0 0;padding:28px">
      <div style="font-size:12px;letter-spacing:.16em;opacity:.78">ALAN ENGLISH WEEKLY REPORT</div>
      <h1 style="font-size:26px;margin:10px 0 6px">${studentName} 的英文學習週報</h1>
      <div style="opacity:.84">${report.range.startDate} ～ ${report.range.endDate}</div>
    </div>
    <div style="background:white;padding:28px;border-radius:0 0 20px 20px;box-shadow:0 12px 32px rgba(23,63,95,.08)">
      <p style="font-size:16px;line-height:1.8;margin-top:0">${guardianName}：</p>
      <div style="background:#eef6ff;border-radius:14px;padding:18px;margin:20px 0">
        <strong style="font-size:18px;color:#173f5f">${escapeHtml(report.status.label)}</strong>
        <p style="line-height:1.7;margin:8px 0 0">${escapeHtml(report.status.message)}</p>
      </div>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px">
        <tr><td style="padding:12px;border-bottom:1px solid #edf0f5">活躍天數</td><td style="padding:12px;border-bottom:1px solid #edf0f5;text-align:right;font-weight:700">${report.metrics.active_days} 天</td></tr>
        <tr><td style="padding:12px;border-bottom:1px solid #edf0f5">聽力播放</td><td style="padding:12px;border-bottom:1px solid #edf0f5;text-align:right;font-weight:700">${report.metrics.listening_count} 次</td></tr>
        <tr><td style="padding:12px;border-bottom:1px solid #edf0f5">完成作業</td><td style="padding:12px;border-bottom:1px solid #edf0f5;text-align:right;font-weight:700">${report.metrics.completed_assignments} 份</td></tr>
        <tr><td style="padding:12px;border-bottom:1px solid #edf0f5">AI 教材通過</td><td style="padding:12px;border-bottom:1px solid #edf0f5;text-align:right;font-weight:700">${report.metrics.ai_passed} 份</td></tr>
        <tr><td style="padding:12px;border-bottom:1px solid #edf0f5">智慧複習</td><td style="padding:12px;border-bottom:1px solid #edf0f5;text-align:right;font-weight:700">${report.metrics.review_count} 題</td></tr>
        <tr><td style="padding:12px">作答正確率</td><td style="padding:12px;text-align:right;font-weight:700">${accuracyText}</td></tr>
      </table>
      <p style="font-size:13px;color:#697386;line-height:1.7;margin:26px 0 0">這封信由 Alan English 學習系統自動產生。如需調整收件設定，請聯絡授課老師。</p>
    </div>
  </div>
</body>
</html>`;
    return { subject, text, html };
};

const sendWithResend = async (apiKey: string, payload: any, idempotencyKey: string) => {
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || `Email provider error (${response.status})`);
    return data;
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const environmentCronSecret = Deno.env.get("GUARDIAN_CRON_SECRET") || "";
    if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "伺服器設定不完整" });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    try {
        const body = await req.json().catch(() => ({}));
        const requestedAction = cleanText(body?.action || "status", 80);
        const headerSecret = req.headers.get("x-cron-secret") || "";
        let cronAuthorized = Boolean(
            environmentCronSecret
            && headerSecret
            && headerSecret === environmentCronSecret
        );
        if (!cronAuthorized && headerSecret) {
            const { data: verifiedByVault, error: verifyError } = await admin.rpc(
                "verify_guardian_cron_secret",
                { p_secret: headerSecret }
            );
            if (verifyError) console.error("Guardian cron secret verification failed", verifyError);
            cronAuthorized = verifiedByVault === true;
        }
        if (requestedAction === "scheduled_batch" && !cronAuthorized) {
            return json(403, { error: "排程驗證失敗" });
        }
        if (cronAuthorized && requestedAction !== "scheduled_batch") {
            return json(403, { error: "排程憑證只能執行排定的週報工作" });
        }
        const action = requestedAction === "scheduled_batch" ? "send_batch" : requestedAction;

        let caller: any = null;
        if (!cronAuthorized) {
            const authHeader = req.headers.get("Authorization") || "";
            const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
            if (!token) return json(401, { error: "請先登入 Alan English" });
            let uid = "";
            try {
                uid = await verifyFirebaseIdToken(token);
            } catch {
                return json(401, { error: "登入驗證失敗，請重新登入" });
            }
            const { data, error } = await admin
                .from("students")
                .select("id,name,email,role")
                .eq("firebase_uid", uid)
                .maybeSingle();
            if (error) throw error;
            if (!data || !["teacher", "admin"].includes(data.role)) {
                return json(403, { error: "只有教師或管理員可以寄送家長週報" });
            }
            caller = data;
        }

        const { data: settings, error: settingsError } = await admin
            .from("guardian_email_settings")
            .select("*")
            .eq("id", 1)
            .maybeSingle();
        if (settingsError) throw settingsError;
        const providerConfigured = Boolean(resendApiKey && settings?.from_email);

        if (action === "status") {
            const [recentResult, scheduleResult] = await Promise.all([
                admin
                    .from("notification_logs")
                    .select("id,student_id,channel,reason,subject,status,provider,provider_message_id,error_message,week_start,sent_at,created_at,students(name,email)")
                    .eq("channel", "email")
                    .order("created_at", { ascending: false })
                    .limit(100),
                admin.rpc("guardian_email_cron_status")
            ]);
            if (recentResult.error) throw recentResult.error;
            if (scheduleResult.error) console.error("Guardian cron status failed", scheduleResult.error);
            return json(200, {
                success: true,
                provider_configured: providerConfigured,
                settings: settings || null,
                schedule: scheduleResult.data || { configured: false },
                recent: recentResult.data || []
            });
        }

        if (!["send_one", "send_batch"].includes(action)) {
            return json(400, { error: "不支援的寄信操作" });
        }
        let reminderResult: any = null;
        if (requestedAction === "scheduled_batch" && cronAuthorized) {
            try {
                const reminderResponse = await fetch(`${supabaseUrl}/functions/v1/notification-manager`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-cron-secret": headerSecret
                    },
                    body: JSON.stringify({ action: "run_due" })
                });
                const reminderBody = await reminderResponse.json().catch(() => ({}));
                reminderResult = reminderResponse.ok
                    ? { success: true, events_processed: Number(reminderBody?.events_processed || 0), email: reminderBody?.email || null }
                    : { success: false, status: reminderResponse.status };
                if (!reminderResponse.ok) console.error("Membership reminder dispatch failed", reminderResponse.status);
            } catch (error) {
                reminderResult = { success: false, status: 0 };
                console.error("Membership reminder dispatch failed", error instanceof Error ? error.message : "unknown");
            }
        }
        if (requestedAction === "scheduled_batch" && !settings?.enabled) {
            return json(200, { success: true, skipped: true, reason: "automatic_email_disabled", reminders: reminderResult });
        }
        if (requestedAction === "scheduled_batch") {
            const taipeiNow = new Date(Date.now() + TAIPEI_OFFSET_MS);
            const weekday = taipeiNow.getUTCDay();
            const hour = taipeiNow.getUTCHours();
            if (weekday !== Number(settings?.send_weekday) || hour !== Number(settings?.send_hour)) {
                return json(200, {
                    success: true,
                    skipped: true,
                    reason: "outside_scheduled_time",
                    taipei_weekday: weekday,
                    taipei_hour: hour,
                    reminders: reminderResult
                });
            }
        }
        if (!providerConfigured) {
            return json(503, {
                error: "自動寄信尚未完成 RESEND_API_KEY 與寄件網域設定",
                code: "email_provider_not_configured"
            });
        }
        if (action === "send_batch" && !cronAuthorized && caller?.role !== "admin") {
            return json(403, { error: "只有管理員可以批次寄送週報" });
        }

        const weekStart = cleanText(body?.week_start || previousWeekStart(), 20);
        getWeekRange(weekStart);
        let students: any[] = [];
        if (action === "send_one") {
            const studentId = Number(body?.student_id);
            if (!Number.isInteger(studentId) || studentId <= 0) {
                return json(400, { error: "學生編號不正確" });
            }
            const { data, error } = await admin
                .from("students")
                .select("id,name,email,class,role")
                .eq("id", studentId)
                .eq("role", "student")
                .maybeSingle();
            if (error) throw error;
            if (!data) return json(404, { error: "找不到學生" });
            students = [data];
        } else {
            const { data, error } = await admin
                .from("students")
                .select("id,name,email,class,role,guardian_contacts!inner(id,email,notification_enabled)")
                .eq("role", "student")
                .eq("guardian_contacts.notification_enabled", true)
                .not("guardian_contacts.email", "is", null)
                .order("id", { ascending: true })
                .limit(5000);
            if (error) throw error;
            students = data || [];
        }

        const results: any[] = [];
        for (const student of students) {
            const idempotencyKey = `guardian-weekly:${student.id}:${weekStart}`;
            const { data: existing } = await admin
                .from("notification_logs")
                .select("id,status,provider_message_id")
                .eq("idempotency_key", idempotencyKey)
                .maybeSingle();
            if (existing?.status === "sent") {
                results.push({ student_id: student.id, status: "skipped", reason: "already_sent" });
                continue;
            }

            try {
                const report = await buildReport(admin, student, weekStart);
                if (!report.guardian?.email || !report.guardian?.notification_enabled) {
                    results.push({ student_id: student.id, status: "skipped", reason: "guardian_not_configured" });
                    continue;
                }
                const email = buildEmail(report);
                let logId = existing?.id || null;
                if (!logId) {
                    const { data: log, error: logError } = await admin
                        .from("notification_logs")
                        .insert({
                            student_id: student.id,
                            guardian_contact_id: report.guardian.id,
                            created_by_account_id: caller?.id || null,
                            channel: "email",
                            reason: "weekly_report",
                            subject: email.subject,
                            message: email.text,
                            status: "draft",
                            provider: "resend",
                            week_start: weekStart,
                            idempotency_key: idempotencyKey
                        })
                        .select("id")
                        .single();
                    if (logError) throw logError;
                    logId = log.id;
                }

                const providerResult = await sendWithResend(resendApiKey, {
                    from: `${settings.from_name || "Alan English"} <${settings.from_email}>`,
                    to: [report.guardian.email],
                    subject: email.subject,
                    html: email.html,
                    text: email.text,
                    ...(settings.reply_to ? { reply_to: settings.reply_to } : {})
                }, idempotencyKey);
                const { error: sentLogError } = await admin
                    .from("notification_logs")
                    .update({
                        status: "sent",
                        provider_message_id: providerResult?.id || null,
                        error_message: null,
                        sent_at: new Date().toISOString()
                    })
                    .eq("id", logId);
                if (sentLogError) throw sentLogError;
                results.push({
                    student_id: student.id,
                    status: "sent",
                    provider_message_id: providerResult?.id || null
                });
            } catch (error) {
                console.error("Guardian email failed", { student_id: student.id, error });
                await admin
                    .from("notification_logs")
                    .update({
                        status: "failed",
                        error_message: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error"
                    })
                    .eq("idempotency_key", idempotencyKey);
                results.push({
                    student_id: student.id,
                    status: "failed",
                    error: error instanceof Error ? error.message : "寄送失敗"
                });
            }
        }

        return json(200, {
            success: true,
            week_start: weekStart,
            totals: {
                requested: students.length,
                sent: results.filter(item => item.status === "sent").length,
                skipped: results.filter(item => item.status === "skipped").length,
                failed: results.filter(item => item.status === "failed").length
            },
            reminders: reminderResult,
            results
        });
    } catch (error) {
        console.error("guardian-email unexpected error", error);
        return json(500, {
            error: error instanceof Error ? error.message : "家長週報寄送服務暫時無法使用"
        });
    }
});
