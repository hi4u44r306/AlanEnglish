import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const FIREBASE_PROJECT_ID = "alan-english-listening";
const FIREBASE_ISSUER = "https://securetoken.google.com/" + FIREBASE_PROJECT_ID;
const FIREBASE_JWKS = createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);
const MASTERY_STREAK = 3;
const SESSION_SIZE = 10;

const json = (status: number, body: unknown) => new Response(
    JSON.stringify(body),
    {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
        }
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

const toTime = (value: unknown) => {
    const time = new Date(String(value || "")).getTime();
    return Number.isFinite(time) ? time : 0;
};

const addDays = (value: Date, days: number) => {
    const next = new Date(value);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString();
};

const cleanOptions = (value: unknown) => (
    Array.isArray(value)
        ? value.map(option => String(option ?? "").trim()).filter(Boolean).slice(0, 8)
        : []
);

const getTypeLabel = (type: string) => {
    if (type === "grammar") return "文法";
    if (type === "vocabulary") return "單字";
    if (type === "listening") return "聽力";
    if (type === "reading") return "閱讀";
    return "綜合";
};

const sanitizeReviewItem = (item: any) => ({
    id: item.id,
    source_type: item.source_type,
    source_title: item.source_title || "英文複習",
    material_type: item.material_type || "custom",
    material_type_label: getTypeLabel(String(item.material_type || "custom")),
    difficulty: item.difficulty || "",
    question_index: Number(item.question_index || 0),
    question_text: item.question_text,
    options: cleanOptions(item.options),
    correct_streak: Number(item.correct_streak || 0),
    mastery_goal: MASTERY_STREAK,
    attempt_count: Number(item.attempt_count || 0),
    first_wrong_at: item.first_wrong_at,
    next_review_at: item.next_review_at
});
const buildStats = (items: any[]) => {
    const now = Date.now();
    const learning = items.filter(item => item.status === "learning");
    const mastered = items.filter(item => item.status === "mastered");
    const due = learning.filter(item => !item.next_review_at || toTime(item.next_review_at) <= now);
    const futureDates = learning
        .map(item => item.next_review_at)
        .filter((value: unknown) => value && toTime(value) > now)
        .sort((a: string, b: string) => toTime(a) - toTime(b));
    const typeCounts = new Map<string, number>();

    for (const item of learning) {
        const type = String(item.material_type || "custom");
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }

    const weaknesses = Array.from(typeCounts.entries())
        .map(([type, count]) => ({ type, label: getTypeLabel(type), count }))
        .sort((a, b) => b.count - a.count);
    const total = items.length;

    return {
        due: due.length,
        learning: learning.length,
        mastered: mastered.length,
        total,
        mastery_percent: total ? Math.round((mastered.length / total) * 100) : 0,
        next_review_at: futureDates[0] || null,
        weaknesses
    };
};

const syncReviewItems = async (admin: any, studentId: number) => {
    const [aiAttemptRes, assignmentAttemptRes, existingRes] = await Promise.all([
        admin
            .from("ai_material_attempts")
            .select("id,material_id,wrong_questions,created_at")
            .eq("student_id", studentId)
            .order("created_at", { ascending: true })
            .limit(2000),
        admin
            .from("assignment_attempts")
            .select("id,assignment_id,wrong_questions,created_at")
            .eq("student_id", studentId)
            .order("created_at", { ascending: true })
            .limit(2000),
        admin
            .from("review_items")
            .select("*")
            .eq("student_id", studentId)
            .limit(3000)
    ]);

    const sourceError = aiAttemptRes.error || assignmentAttemptRes.error || existingRes.error;
    if (sourceError) throw sourceError;

    const aiAttempts = aiAttemptRes.data || [];
    const assignmentAttempts = assignmentAttemptRes.data || [];
    const assignmentIds = Array.from(new Set(
        assignmentAttempts.map((attempt: any) => Number(attempt.assignment_id)).filter(Number.isFinite)
    ));
    const assignmentRes = assignmentIds.length
        ? await admin
            .from("assignments")
            .select("id,title,ai_material_id,source_type")
            .in("id", assignmentIds)
        : { data: [], error: null };

    if (assignmentRes.error) throw assignmentRes.error;

    const assignments = assignmentRes.data || [];
    const materialIds = Array.from(new Set([
        ...aiAttempts.map((attempt: any) => Number(attempt.material_id)),
        ...assignments.map((assignment: any) => Number(assignment.ai_material_id))
    ].filter(Number.isFinite)));
    const materialRes = materialIds.length
        ? await admin
            .from("ai_generated_materials")
            .select("id,title,material_type,difficulty,content")
            .in("id", materialIds)
        : { data: [], error: null };

    if (materialRes.error) throw materialRes.error;

    const materialMap = new Map(
        (materialRes.data || []).map((material: any) => [Number(material.id), material])
    );
    const assignmentMap = new Map(
        assignments.map((assignment: any) => [Number(assignment.id), assignment])
    );
    const candidateMap = new Map<string, any>();

    const addCandidate = (
        sourceType: "ai_material" | "assignment",
        sourceId: number,
        attempt: any,
        material: any,
        sourceTitle: string
    ) => {
        const questions = Array.isArray(material?.content?.questions)
            ? material.content.questions
            : [];
        const wrongQuestions = Array.isArray(attempt?.wrong_questions)
            ? attempt.wrong_questions
            : [];

        for (const wrong of wrongQuestions) {
            const questionIndex = Number(wrong?.index);
            const question = questions[questionIndex];
            const options = cleanOptions(question?.options);
            const correctAnswer = String(question?.answer || wrong?.correct_answer || "").trim();
            const questionText = String(question?.question || wrong?.question || "").trim();

            if (!Number.isInteger(questionIndex) || questionIndex < 0) continue;
            if (!questionText || options.length < 2 || !correctAnswer || !options.includes(correctAnswer)) continue;

            const key = `${sourceType}:${sourceId}:${questionIndex}`;
            const createdAt = attempt.created_at || new Date().toISOString();
            const current = candidateMap.get(key);
            const candidate = {
                student_id: studentId,
                source_type: sourceType,
                source_id: sourceId,
                source_attempt_id: Number(attempt.id),
                material_id: Number(material.id),
                question_index: questionIndex,
                question_text: questionText,
                options,
                correct_answer: correctAnswer,
                explanation: String(question?.explanation || wrong?.explanation || "").trim() || null,
                source_title: sourceTitle || material.title || "英文複習",
                material_type: material.material_type || "custom",
                difficulty: material.difficulty || null,
                first_wrong_at: current?.first_wrong_at || createdAt,
                last_wrong_at: createdAt
            };

            if (!current || toTime(createdAt) >= toTime(current.last_wrong_at)) {
                candidate.first_wrong_at = current?.first_wrong_at || createdAt;
                candidateMap.set(key, candidate);
            }
        }
    };

    for (const attempt of aiAttempts) {
        const materialId = Number(attempt.material_id);
        const material = materialMap.get(materialId);
        if (material) addCandidate("ai_material", materialId, attempt, material, material.title);
    }

    for (const attempt of assignmentAttempts) {
        const assignmentId = Number(attempt.assignment_id);
        const assignment = assignmentMap.get(assignmentId);
        const material = assignment
            ? materialMap.get(Number(assignment.ai_material_id))
            : null;
        if (assignment && material) {
            addCandidate("assignment", assignmentId, attempt, material, assignment.title);
        }
    }

    if (!candidateMap.size) return;

    const existingMap = new Map(
        (existingRes.data || []).map((item: any) => [
            `${item.source_type}:${Number(item.source_id)}:${Number(item.question_index)}`,
            item
        ])
    );
    const now = new Date().toISOString();
    const rows = Array.from(candidateMap.entries()).map(([key, candidate]) => {
        const existing = existingMap.get(key);
        const hasNewWrongAnswer = !existing
            || toTime(candidate.last_wrong_at) > toTime(existing.last_wrong_at);

        return {
            ...candidate,
            first_wrong_at: existing?.first_wrong_at || candidate.first_wrong_at,
            status: hasNewWrongAnswer ? "learning" : existing.status,
            correct_streak: hasNewWrongAnswer ? 0 : Number(existing.correct_streak || 0),
            attempt_count: Number(existing?.attempt_count || 0),
            last_reviewed_at: existing?.last_reviewed_at || null,
            next_review_at: hasNewWrongAnswer
                ? candidate.last_wrong_at
                : existing.next_review_at,
            mastered_at: hasNewWrongAnswer ? null : existing?.mastered_at || null,
            updated_at: hasNewWrongAnswer ? now : existing?.updated_at || now
        };
    });

    const { error: upsertError } = await admin
        .from("review_items")
        .upsert(rows, {
            onConflict: "student_id,source_type,source_id,question_index"
        });
    if (upsertError) throw upsertError;
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
        return json(405, { error: "Method not allowed" });
    }

    try {
        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7).trim()
            : "";
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
            .select("id,name,role")
            .eq("firebase_uid", firebaseUid)
            .maybeSingle();

        if (callerError) throw callerError;
        if (!caller) return json(404, { error: "找不到 Alan English 帳號" });
        if (caller.role !== "student") {
            return json(403, { error: "智慧複習中心目前提供學生帳號使用" });
        }

        const effectiveAccess = await loadEffectiveAccess(admin, Number(caller.id));
        if (!effectiveAccess.is_active) {
            return json(402, { error: "會員使用期限已結束，無法使用智慧複習", code: "membership_required" });
        }
        if (!effectiveAccess.features.review) {
            return json(403, { error: "目前帳號不包含智慧複習", code: "review_not_available" });
        }

        const body = await req.json().catch(() => ({}));
        const action = String(body?.action || "bootstrap");

        if (action === "bootstrap") {
            await syncReviewItems(admin, Number(caller.id));
            const { data: items, error } = await admin
                .from("review_items")
                .select("*")
                .eq("student_id", caller.id)
                .order("next_review_at", { ascending: true, nullsFirst: false })
                .order("last_wrong_at", { ascending: false })
                .limit(3000);
            if (error) throw error;

            const allItems = items || [];
            const now = Date.now();
            const dueItems = allItems
                .filter((item: any) => (
                    item.status === "learning"
                    && (!item.next_review_at || toTime(item.next_review_at) <= now)
                ))
                .slice(0, SESSION_SIZE)
                .map(sanitizeReviewItem);

            return json(200, {
                success: true,
                student: { name: caller.name },
                session_size: SESSION_SIZE,
                mastery_streak: MASTERY_STREAK,
                stats: buildStats(allItems),
                items: dueItems
            });
        }

        if (action === "submit") {
            const itemId = Number(body?.item_id);
            const selectedAnswer = String(body?.selected_answer || "").trim();
            if (!Number.isFinite(itemId) || !selectedAnswer) {
                return json(400, { error: "請先選擇答案" });
            }

            const { data: item, error: itemError } = await admin
                .from("review_items")
                .select("*")
                .eq("id", itemId)
                .eq("student_id", caller.id)
                .maybeSingle();
            if (itemError) throw itemError;
            if (!item) return json(404, { error: "找不到這一題複習內容" });
            if (item.status === "mastered") {
                return json(409, { error: "這一題已經掌握，請重新整理複習清單" });
            }

            const options = cleanOptions(item.options);
            if (!options.includes(selectedAnswer)) {
                return json(400, { error: "選項內容不正確，請重新整理後再試" });
            }

            const now = new Date();
            const isCorrect = selectedAnswer === String(item.correct_answer || "");
            const nextStreak = isCorrect
                ? Number(item.correct_streak || 0) + 1
                : 0;
            const mastered = isCorrect && nextStreak >= MASTERY_STREAK;
            const intervalDays = nextStreak >= 2 ? 3 : 1;
            const nextReviewAt = mastered
                ? null
                : addDays(now, intervalDays);
            const nextStatus = mastered ? "mastered" : "learning";

            const { error: attemptError } = await admin
                .from("review_attempts")
                .insert({
                    review_item_id: item.id,
                    student_id: caller.id,
                    selected_answer: selectedAnswer,
                    is_correct: isCorrect,
                    streak_after: nextStreak,
                    status_after: nextStatus,
                    reviewed_at: now.toISOString()
                });
            if (attemptError) throw attemptError;

            const { data: updated, error: updateError } = await admin
                .from("review_items")
                .update({
                    status: nextStatus,
                    correct_streak: nextStreak,
                    attempt_count: Number(item.attempt_count || 0) + 1,
                    last_reviewed_at: now.toISOString(),
                    next_review_at: nextReviewAt,
                    mastered_at: mastered ? now.toISOString() : null,
                    updated_at: now.toISOString()
                })
                .eq("id", item.id)
                .eq("student_id", caller.id)
                .select("id,status,correct_streak,attempt_count,next_review_at,mastered_at")
                .single();
            if (updateError) throw updateError;

            await admin.from("student_activity_events").insert({
                student_id: caller.id,
                activity_type: "other",
                activity_key: `review:${item.id}:${updated.attempt_count}`,
                metadata: {
                    review_item_id: item.id,
                    event_type: "smart_review",
                    source_type: item.source_type,
                    source_id: item.source_id,
                    material_type: item.material_type,
                    is_correct: isCorrect,
                    mastered
                },
                occurred_at: now.toISOString()
            });

            return json(200, {
                success: true,
                result: {
                    item_id: item.id,
                    selected_answer: selectedAnswer,
                    is_correct: isCorrect,
                    correct_answer: item.correct_answer,
                    explanation: item.explanation || "",
                    correct_streak: Number(updated.correct_streak || 0),
                    mastery_goal: MASTERY_STREAK,
                    attempt_count: Number(updated.attempt_count || 0),
                    status: updated.status,
                    mastered,
                    next_review_at: updated.next_review_at
                }
            });
        }

        return json(400, { error: "不支援的操作" });
    } catch (error) {
        console.error("review-center error", error);
        return json(500, {
            error: error instanceof Error
                ? error.message
                : "智慧複習服務暫時無法使用"
        });
    }
});
