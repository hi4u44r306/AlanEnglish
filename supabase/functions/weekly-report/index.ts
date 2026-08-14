import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const FIREBASE_PROJECT_ID = "alan-english-listening";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_WEEK_OFFSET = -12;

const json = (status: number, body: unknown) => new Response(
    JSON.stringify(body),
    {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
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

const safeNumber = (value: unknown) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const average = (values: unknown[]) => {
    const numbers = values.map(safeNumber).filter(Number.isFinite);
    return numbers.length
        ? Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length)
        : 0;
};

const toTaipeiDateKey = (value: unknown) => {
    const time = new Date(String(value || "")).getTime();
    if (!Number.isFinite(time)) return "";
    return new Date(time + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
};

const getWeekBounds = (weekOffset: number) => {
    const taipeiNow = new Date(Date.now() + TAIPEI_OFFSET_MS);
    const localMidnight = Date.UTC(
        taipeiNow.getUTCFullYear(),
        taipeiNow.getUTCMonth(),
        taipeiNow.getUTCDate()
    );
    const weekday = taipeiNow.getUTCDay() || 7;
    const mondayLocal = localMidnight - ((weekday - 1) * DAY_MS) + (weekOffset * 7 * DAY_MS);
    const startUtcMs = mondayLocal - TAIPEI_OFFSET_MS;
    const endUtcMs = startUtcMs + (7 * DAY_MS);
    const previousStartUtcMs = startUtcMs - (7 * DAY_MS);

    return {
        offset: weekOffset,
        start_date: new Date(mondayLocal).toISOString().slice(0, 10),
        end_date: new Date(mondayLocal + (6 * DAY_MS)).toISOString().slice(0, 10),
        start_at: new Date(startUtcMs).toISOString(),
        end_at: new Date(endUtcMs).toISOString(),
        previous_start_date: new Date(mondayLocal - (7 * DAY_MS)).toISOString().slice(0, 10),
        previous_start_at: new Date(previousStartUtcMs).toISOString(),
        can_go_next: weekOffset < 0,
        can_go_previous: weekOffset > MIN_WEEK_OFFSET
    };
};

const getMaterialTypeLabel = (type: string) => {
    if (type === "grammar") return "文法";
    if (type === "vocabulary") return "單字";
    if (type === "listening") return "聽力理解";
    if (type === "reading") return "閱讀理解";
    return "綜合英文";
};

const getSourceLabel = (type: string) => {
    if (type === "ai_material") return "AI 練習";
    if (type === "assignment") return "老師作業";
    return "英文練習";
};

const inCurrentWeek = (value: unknown, week: ReturnType<typeof getWeekBounds>) => {
    const timestamp = new Date(String(value || "")).getTime();
    return Number.isFinite(timestamp)
        && timestamp >= new Date(week.start_at).getTime()
        && timestamp < new Date(week.end_at).getTime();
};

const inPreviousWeek = (value: unknown, week: ReturnType<typeof getWeekBounds>) => {
    const timestamp = new Date(String(value || "")).getTime();
    return Number.isFinite(timestamp)
        && timestamp >= new Date(week.previous_start_at).getTime()
        && timestamp < new Date(week.start_at).getTime();
};

const getStatus = (score: number, activeDays: number) => {
    if (score >= 80) {
        return {
            code: "excellent",
            label: "穩定成長",
            message: "這週有規律地練習，也把學習成果累積下來了。"
        };
    }
    if (score >= 55) {
        return {
            code: "steady",
            label: "持續累積",
            message: "已經建立不錯的節奏，再多固定一天會更穩定。"
        };
    }
    if (activeDays > 0) {
        return {
            code: "building",
            label: "正在建立習慣",
            message: "這週已經有開始，下一步是把練習分散到更多天。"
        };
    }
    return {
        code: "restart",
        label: "本週待啟動",
        message: "先從一次 5～10 分鐘的小任務開始，就能重新接上進度。"
    };
};

const buildWeeklyReport = async (
    admin: any,
    target: any,
    week: ReturnType<typeof getWeekBounds>,
    isManager: boolean
) => {
    const twoWeekStart = week.previous_start_at;
    const twoWeekStartDate = week.previous_start_date;

    const [
        guardianResult,
        listeningResult,
        assignmentsResult,
        progressResult,
        assignmentAttemptsResult,
        aiAttemptsResult,
        reviewAttemptsResult,
        reviewItemsResult,
        activityResult,
        conversationResult
    ] = await Promise.all([
        admin
            .from("guardian_contacts")
            .select("id,guardian_name,email,preferred_channel,notification_enabled")
            .eq("student_id", target.id)
            .maybeSingle(),
        admin
            .from("student_listening_daily")
            .select("activity_date,play_count")
            .eq("student_id", target.id)
            .gte("activity_date", twoWeekStartDate)
            .lte("activity_date", week.end_date)
            .limit(100),
        admin
            .from("assignments")
            .select("id,title,source_type,target_class,assigned_date,due_at,passing_score,enabled")
            .eq("enabled", true)
            .gte("assigned_date", week.start_date)
            .lte("assigned_date", week.end_date)
            .order("assigned_date", { ascending: true })
            .limit(500),
        admin
            .from("assignment_progress")
            .select("assignment_id,best_score,attempt_count,completed,completed_at,last_attempt_at")
            .eq("student_id", target.id)
            .limit(2000),
        admin
            .from("assignment_attempts")
            .select("assignment_id,score,correct_count,total_questions,passed,created_at")
            .eq("student_id", target.id)
            .gte("created_at", twoWeekStart)
            .lt("created_at", week.end_at)
            .order("created_at", { ascending: true })
            .limit(5000),
        admin
            .from("ai_material_attempts")
            .select("material_id,score,correct_count,total_questions,passed,created_at")
            .eq("student_id", target.id)
            .gte("created_at", twoWeekStart)
            .lt("created_at", week.end_at)
            .order("created_at", { ascending: true })
            .limit(5000),
        admin
            .from("review_attempts")
            .select("review_item_id,is_correct,status_after,reviewed_at")
            .eq("student_id", target.id)
            .gte("reviewed_at", twoWeekStart)
            .lt("reviewed_at", week.end_at)
            .order("reviewed_at", { ascending: true })
            .limit(5000),
        admin
            .from("review_items")
            .select("id,source_type,source_title,material_type,status,first_wrong_at,mastered_at")
            .eq("student_id", target.id)
            .limit(3000),
        admin
            .from("student_activity_events")
            .select("activity_type,activity_key,metadata,occurred_at")
            .eq("student_id", target.id)
            .gte("occurred_at", twoWeekStart)
            .lt("occurred_at", week.end_at)
            .order("occurred_at", { ascending: true })
            .limit(5000),
        admin
            .from("conversation_progress")
            .select("scenario_key,mode,completed_steps,total_steps,completed,last_practiced_at")
            .eq("student_id", target.id)
            .eq("scenario_key", "meet-a-foreigner")
            .maybeSingle()
    ]);

    const firstError = [
        guardianResult.error,
        listeningResult.error,
        assignmentsResult.error,
        progressResult.error,
        assignmentAttemptsResult.error,
        aiAttemptsResult.error,
        reviewAttemptsResult.error,
        reviewItemsResult.error,
        activityResult.error,
        conversationResult.error
    ].find(Boolean);
    if (firstError) throw firstError;

    const guardian = guardianResult.data || null;
    const allListening = listeningResult.data || [];
    const progressMap = new Map(
        (progressResult.data || []).map((item: any) => [Number(item.assignment_id), item])
    );
    const assignments = (assignmentsResult.data || []).filter((assignment: any) => (
        !assignment.target_class
        || String(assignment.target_class).trim() === String(target.class || "").trim()
    ));
    const currentAssignmentAttempts = (assignmentAttemptsResult.data || []).filter((item: any) => (
        inCurrentWeek(item.created_at, week)
    ));
    const previousAssignmentAttempts = (assignmentAttemptsResult.data || []).filter((item: any) => (
        inPreviousWeek(item.created_at, week)
    ));
    const currentAiAttempts = (aiAttemptsResult.data || []).filter((item: any) => (
        inCurrentWeek(item.created_at, week)
    ));
    const previousAiAttempts = (aiAttemptsResult.data || []).filter((item: any) => (
        inPreviousWeek(item.created_at, week)
    ));
    const currentReviewAttempts = (reviewAttemptsResult.data || []).filter((item: any) => (
        inCurrentWeek(item.reviewed_at, week)
    ));
    const previousReviewAttempts = (reviewAttemptsResult.data || []).filter((item: any) => (
        inPreviousWeek(item.reviewed_at, week)
    ));
    const currentEvents = (activityResult.data || []).filter((item: any) => (
        inCurrentWeek(item.occurred_at, week)
    ));
    const previousEvents = (activityResult.data || []).filter((item: any) => (
        inPreviousWeek(item.occurred_at, week)
    ));
    const currentListening = allListening.filter((item: any) => (
        String(item.activity_date) >= week.start_date
    ));
    const previousListening = allListening.filter((item: any) => (
        String(item.activity_date) < week.start_date
    ));

    const assignmentDetails = assignments.map((assignment: any) => {
        const progress = progressMap.get(Number(assignment.id));
        const completedByEnd = Boolean(
            progress?.completed
            && progress?.completed_at
            && new Date(progress.completed_at).getTime() < new Date(week.end_at).getTime()
        );
        return {
            id: assignment.id,
            title: assignment.title,
            source_label: getSourceLabel(String(assignment.source_type || "")),
            assigned_date: assignment.assigned_date,
            due_at: assignment.due_at,
            completed: completedByEnd,
            best_score: safeNumber(progress?.best_score),
            attempt_count: safeNumber(progress?.attempt_count)
        };
    });
    const completedAssignments = assignmentDetails.filter((item: any) => item.completed).length;
    const assignmentCompletionRate = assignmentDetails.length
        ? Math.round((completedAssignments / assignmentDetails.length) * 100)
        : null;

    const currentQuestionResults = [
        ...currentAssignmentAttempts.map((item: any) => ({
            correct: safeNumber(item.correct_count),
            total: safeNumber(item.total_questions)
        })),
        ...currentAiAttempts.map((item: any) => ({
            correct: safeNumber(item.correct_count),
            total: safeNumber(item.total_questions)
        })),
        ...currentReviewAttempts.map((item: any) => ({
            correct: item.is_correct ? 1 : 0,
            total: 1
        }))
    ];
    const correctQuestions = currentQuestionResults.reduce((sum, item) => sum + item.correct, 0);
    const totalQuestions = currentQuestionResults.reduce((sum, item) => sum + item.total, 0);
    const answerAccuracy = totalQuestions
        ? Math.round((correctQuestions / totalQuestions) * 100)
        : null;

    const learningReviewItems = (reviewItemsResult.data || []).filter((item: any) => item.status === "learning");
    const masteredThisWeek = (reviewItemsResult.data || []).filter((item: any) => (
        item.mastered_at && inCurrentWeek(item.mastered_at, week)
    )).length;
    const weaknessMap = new Map<string, number>();
    for (const item of learningReviewItems) {
        const type = String(item.material_type || "custom");
        weaknessMap.set(type, (weaknessMap.get(type) || 0) + 1);
    }
    const weaknesses = Array.from(weaknessMap.entries())
        .map(([type, count]) => ({ type, label: getMaterialTypeLabel(type), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

    const currentConversationEvents = currentEvents.filter((event: any) => event.activity_type === "conversation");
    const previousConversationEvents = previousEvents.filter((event: any) => event.activity_type === "conversation");
    const dailyMap = new Map<string, any>();
    const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];

    for (let index = 0; index < 7; index += 1) {
        const dateMs = new Date(`${week.start_date}T00:00:00.000Z`).getTime() + (index * DAY_MS);
        const date = new Date(dateMs).toISOString().slice(0, 10);
        dailyMap.set(date, {
            date,
            weekday: `週${weekdayLabels[index]}`,
            listening: 0,
            assignments: 0,
            ai: 0,
            review: 0,
            conversation: 0,
            total: 0
        });
    }

    for (const item of currentListening) {
        const day = dailyMap.get(String(item.activity_date));
        if (day) day.listening += safeNumber(item.play_count);
    }
    for (const item of currentAssignmentAttempts) {
        const day = dailyMap.get(toTaipeiDateKey(item.created_at));
        if (day) day.assignments += 1;
    }
    for (const item of currentAiAttempts) {
        const day = dailyMap.get(toTaipeiDateKey(item.created_at));
        if (day) day.ai += 1;
    }
    for (const item of currentReviewAttempts) {
        const day = dailyMap.get(toTaipeiDateKey(item.reviewed_at));
        if (day) day.review += 1;
    }
    for (const item of currentConversationEvents) {
        const day = dailyMap.get(toTaipeiDateKey(item.occurred_at));
        if (day) day.conversation += 1;
    }

    const dailyBreakdown = Array.from(dailyMap.values()).map(day => ({
        ...day,
        total: day.listening + day.assignments + day.ai + day.review + day.conversation
    }));
    const activeDays = dailyBreakdown.filter(day => day.total > 0).length;
    const listeningPlays = currentListening.reduce((sum: number, item: any) => sum + safeNumber(item.play_count), 0);
    const previousListeningPlays = previousListening.reduce((sum: number, item: any) => sum + safeNumber(item.play_count), 0);
    const totalActions = listeningPlays
        + currentAssignmentAttempts.length
        + currentAiAttempts.length
        + currentReviewAttempts.length
        + currentConversationEvents.length;
    const previousTotalActions = previousListeningPlays
        + previousAssignmentAttempts.length
        + previousAiAttempts.length
        + previousReviewAttempts.length
        + previousConversationEvents.length;
    const change = totalActions - previousTotalActions;
    const learningCategories = [
        listeningPlays,
        currentAssignmentAttempts.length,
        currentAiAttempts.length,
        currentReviewAttempts.length,
        currentConversationEvents.length
    ].filter(value => value > 0).length;
    const consistencyPoints = Math.min(60, Math.round((activeDays / 5) * 60));
    const varietyPoints = Math.min(20, learningCategories * 5);
    const completionPoints = assignmentCompletionRate === null
        ? (totalActions > 0 ? 20 : 0)
        : Math.round(assignmentCompletionRate * 0.2);
    const engagementScore = Math.min(100, consistencyPoints + varietyPoints + completionPoints);
    const status = getStatus(engagementScore, activeDays);

    const highlights: string[] = [];
    if (activeDays >= 5) highlights.push(`維持 ${activeDays} 天學習節奏，規律度很棒`);
    else if (activeDays > 0) highlights.push(`本週有 ${activeDays} 天主動打開平台學習`);
    if (completedAssignments > 0) highlights.push(`完成 ${completedAssignments} 份老師作業`);
    if (currentAiAttempts.length > 0) highlights.push(`完成 ${currentAiAttempts.length} 次 AI 專屬練習`);
    if (masteredThisWeek > 0) highlights.push(`透過智慧複習新掌握 ${masteredThisWeek} 題`);
    if (listeningPlays > 0) highlights.push(`累積 ${listeningPlays} 次聽力播放`);
    if (!highlights.length) highlights.push("這週尚無學習紀錄，現在開始仍然來得及");

    const nextFocus: string[] = [];
    if (activeDays < 3) nextFocus.push("下週先固定 3 天，每次完成 5～10 分鐘練習");
    const pendingAssignments = Math.max(0, assignmentDetails.length - completedAssignments);
    if (pendingAssignments > 0) nextFocus.push(`優先完成 ${pendingAssignments} 份尚未完成的老師作業`);
    if (weaknesses[0]) nextFocus.push(`智慧複習先加強「${weaknesses[0].label}」`);
    if (listeningPlays < 9) nextFocus.push("每天聽 3 次，讓英文聲音變得更熟悉");
    if (!nextFocus.length) nextFocus.push("保持目前節奏，挑戰一份新的 AI 專屬練習");

    const comparisonText = change > 0
        ? `比上週多 ${change} 次學習活動`
        : change < 0
            ? `比上週少 ${Math.abs(change)} 次，下一週再把節奏接回來`
            : previousTotalActions > 0
                ? "和上週維持相同學習量"
                : "這是第一週可比較的學習紀錄";
    const guardianName = guardian?.guardian_name ? `${guardian.guardian_name}您好：` : "家長您好：";
    const familyMessage = `${guardianName}\n\n這是 ${target.name} 的 Alan English 每週學習報告（${week.start_date}～${week.end_date}）。\n\n本週學習 ${activeDays} 天，共完成 ${totalActions} 次學習活動，${comparisonText}。${answerAccuracy === null ? "" : `答題正確率 ${answerAccuracy}%。`}\n\n本週亮點：${highlights.slice(0, 3).join("；")}。\n下週建議：${nextFocus.slice(0, 2).join("；")}。\n\n鼓勵孩子保持短時間、固定頻率的練習，比一次學很久更容易持續。\n\n— Alan English`;

    return {
        student: {
            id: target.id,
            name: target.name,
            class: target.class || "",
            plan: target.plan || ""
        },
        guardian: {
            contact_id: isManager ? guardian?.id || null : null,
            configured: Boolean(guardian?.email && guardian?.notification_enabled),
            name: guardian?.guardian_name || "",
            email: isManager ? guardian?.email || "" : "",
            notification_enabled: Boolean(guardian?.notification_enabled)
        },
        week: {
            offset: week.offset,
            start_date: week.start_date,
            end_date: week.end_date,
            can_go_next: week.can_go_next,
            can_go_previous: week.can_go_previous
        },
        status: {
            ...status,
            score: engagementScore
        },
        comparison: {
            current_actions: totalActions,
            previous_actions: previousTotalActions,
            change,
            text: comparisonText
        },
        metrics: {
            active_days: activeDays,
            total_actions: totalActions,
            answer_accuracy: answerAccuracy,
            correct_questions: correctQuestions,
            total_questions: totalQuestions
        },
        listening: {
            plays: listeningPlays,
            active_days: currentListening.filter((item: any) => safeNumber(item.play_count) > 0).length,
            goal_days: currentListening.filter((item: any) => safeNumber(item.play_count) >= 3).length
        },
        assignments: {
            assigned: assignmentDetails.length,
            completed: completedAssignments,
            pending: pendingAssignments,
            completion_rate: assignmentCompletionRate,
            attempts: currentAssignmentAttempts.length,
            average_score: average(currentAssignmentAttempts.map((item: any) => item.score)),
            best_score: currentAssignmentAttempts.length
                ? Math.max(...currentAssignmentAttempts.map((item: any) => safeNumber(item.score)))
                : 0,
            items: assignmentDetails
        },
        ai_practice: {
            attempts: currentAiAttempts.length,
            average_score: average(currentAiAttempts.map((item: any) => item.score)),
            best_score: currentAiAttempts.length
                ? Math.max(...currentAiAttempts.map((item: any) => safeNumber(item.score)))
                : 0,
            passed: currentAiAttempts.filter((item: any) => item.passed).length
        },
        review: {
            attempts: currentReviewAttempts.length,
            correct: currentReviewAttempts.filter((item: any) => item.is_correct).length,
            accuracy: currentReviewAttempts.length
                ? Math.round((currentReviewAttempts.filter((item: any) => item.is_correct).length / currentReviewAttempts.length) * 100)
                : null,
            mastered: masteredThisWeek,
            learning: learningReviewItems.length,
            weaknesses
        },
        conversation: {
            practice_steps: currentConversationEvents.length,
            completed_steps: safeNumber(conversationResult.data?.completed_steps),
            total_steps: safeNumber(conversationResult.data?.total_steps) || 9,
            completed: Boolean(conversationResult.data?.completed),
            last_practiced_at: conversationResult.data?.last_practiced_at || null
        },
        daily_breakdown: dailyBreakdown,
        highlights: highlights.slice(0, 4),
        next_focus: nextFocus.slice(0, 3),
        family_message: familyMessage,
        generated_at: new Date().toISOString()
    };
};

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
        } catch {
            return json(401, { error: "登入驗證失敗，請重新登入" });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !serviceRoleKey) {
            return json(500, { error: "Supabase 伺服器設定不完整" });
        }

        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data: caller, error: callerError } = await admin
            .from("students")
            .select("id,name,email,class,role,plan")
            .eq("firebase_uid", firebaseUid)
            .maybeSingle();
        if (callerError) throw callerError;
        if (!caller) return json(404, { error: "找不到 Alan English 帳號" });

        const body = await req.json().catch(() => ({}));
        const action = String(body?.action || "report");
        const requestedOffset = Number(body?.week_offset || 0);
        const weekOffset = Number.isInteger(requestedOffset)
            ? Math.max(MIN_WEEK_OFFSET, Math.min(0, requestedOffset))
            : 0;
        const week = getWeekBounds(weekOffset);
        const isManager = ["teacher", "admin"].includes(String(caller.role));
        let students: any[] = [];
        let target = caller;

        if (isManager) {
            const { data, error } = await admin
                .from("students")
                .select("id,name,class,plan")
                .eq("role", "student")
                .order("name", { ascending: true });
            if (error) throw error;
            students = data || [];
            if (!students.length) return json(404, { error: "目前沒有可產生報告的學生" });

            const requestedStudentId = Number(body?.student_id);
            target = students.find(student => Number(student.id) === requestedStudentId) || students[0];
        } else if (caller.role !== "student") {
            return json(403, { error: "此帳號無法查看學生週報" });
        }

        const report = await buildWeeklyReport(admin, target, week, isManager);

        if (action === "guardian_draft") {
            if (!isManager) return json(403, { error: "只有 Teacher / Admin 可以準備家長 Email" });
            if (!report.guardian.configured || !report.guardian.email) {
                return json(400, { error: "請先在管理首頁設定家長 Email 並開啟通知" });
            }

            const subject = `Alan English 每週學習報告｜${report.student.name}｜${report.week.start_date}`;
            const { data: log, error } = await admin
                .from("notification_logs")
                .insert({
                    student_id: report.student.id,
                    guardian_contact_id: report.guardian.contact_id,
                    created_by_account_id: caller.id,
                    channel: "email",
                    reason: "weekly-report",
                    subject,
                    message: report.family_message,
                    status: "draft"
                })
                .select("id,status,created_at")
                .single();
            if (error) throw error;

            return json(200, {
                success: true,
                draft: {
                    id: log.id,
                    email: report.guardian.email,
                    subject,
                    message: report.family_message,
                    status: log.status,
                    created_at: log.created_at
                }
            });
        }

        if (action !== "report") return json(400, { error: "不支援的操作" });

        return json(200, {
            success: true,
            role: caller.role,
            students: isManager ? students : [],
            report
        });
    } catch (error) {
        console.error("weekly-report error", error);
        return json(500, {
            error: error instanceof Error ? error.message : "每週學習報告暫時無法使用"
        });
    }
});
