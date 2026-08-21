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
const STAFF_ROLES = new Set(["teacher", "admin"]);
const PERIODS = new Set(["week", "month", "all"]);

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const cleanText = (value: unknown, maxLength = 500) => String(value || "")
    .trim()
    .slice(0, maxLength);

const relationOne = (value: any) => Array.isArray(value) ? value[0] || null : value || null;

const normalizeLevelProgress = (progress: any) => progress ? ({
    ...progress,
    learning_levels: relationOne(progress.learning_levels)
}) : null;

const normalizeBook = (book: any) => ({
    ...book,
    learning_levels: relationOne(book?.learning_levels)
});

const normalizeExam = (exam: any) => ({
    ...exam,
    from_level: relationOne(exam?.from_level),
    to_level: relationOne(exam?.to_level)
});

const positiveInteger = (value: unknown) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

async function verifyFirebaseIdToken(token: string) {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: FIREBASE_PROJECT_ID
    });
    const uid = cleanText(payload.sub, 200);
    if (!uid) throw new Error("Firebase token 缺少 uid");
    return uid;
}

const membershipIsActive = (membership: any, role: string) => {
    if (STAFF_ROLES.has(role)) return true;
    const status = cleanText(membership?.status, 40);
    if (!["trialing", "active", "cancelled", "complimentary"].includes(status)) return false;
    const candidates = [membership?.trial_ends_at, membership?.access_ends_at, membership?.current_period_end]
        .map(value => value ? new Date(value).getTime() : Number.NaN)
        .filter(Number.isFinite);
    if (status === "cancelled" && candidates.length === 0) return false;
    return candidates.length === 0 || Math.max(...candidates) > Date.now();
};

const sanitizeQuestions = (questions: any[]) => (questions || []).map((question: any, index: number) => ({
    index,
    question: cleanText(question?.question, 1000),
    options: Array.isArray(question?.options)
        ? question.options.map((option: unknown) => cleanText(option, 500)).slice(0, 6)
        : []
}));

const validateQuestions = (questions: unknown) => {
    if (!Array.isArray(questions) || questions.length < 5 || questions.length > 50) return null;
    const normalized = questions.map((question: any) => {
        const prompt = cleanText(question?.question, 1000);
        const options = Array.isArray(question?.options)
            ? question.options.map((option: unknown) => cleanText(option, 500)).filter(Boolean)
            : [];
        const answer = cleanText(question?.answer, 500);
        const explanation = cleanText(question?.explanation, 1000) || null;
        if (!prompt || options.length !== 4 || new Set(options).size !== 4 || !options.includes(answer)) {
            return null;
        }
        return { question: prompt, options, answer, explanation };
    });
    return normalized.every(Boolean) ? normalized : null;
};

const maskStudentName = (name: unknown) => {
    const value = cleanText(name, 80);
    if (!value) return "同學";
    if (/^[\u3400-\u9fff]+$/.test(value)) {
        return value.length === 1 ? `${value}同學` : `${value[0]}${"○".repeat(Math.min(2, value.length - 1))}`;
    }
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].length <= 2 ? parts[0] : `${parts[0].slice(0, 2)}${"•".repeat(Math.min(3, parts[0].length - 2))}`;
    }
    return `${parts[0]} ${parts.at(-1)?.slice(0, 1) || ""}.`;
};

const examSelect = `
    id,
    from_level_id,
    to_level_id,
    title,
    description,
    passing_score,
    questions,
    enabled,
    created_at,
    updated_at,
    from_level:learning_levels!promotion_exams_from_level_id_fkey(id,code,name_zh,name_en,rank,badge_color),
    to_level:learning_levels!promotion_exams_to_level_id_fkey(id,code,name_zh,name_en,rank,badge_color)
`;

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
        if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "伺服器設定不完整" });
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        const { data: student, error: studentError } = await admin
            .from("students")
            .select("id,name,role,class")
            .eq("firebase_uid", firebaseUid)
            .maybeSingle();
        if (studentError) throw studentError;
        if (!student) return json(404, { error: "找不到 Alan English 帳號" });

        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action || "dashboard", 80);

        if (action === "leaderboard") {
            const requestedPeriod = cleanText(body?.period || "week", 20);
            const period = PERIODS.has(requestedPeriod) ? requestedPeriod : "week";
            const { data: rows, error } = await admin.rpc("get_learning_leaderboard", {
                p_period: period,
                p_limit: 50,
                p_student_id: student.role === "student" ? student.id : null
            });
            if (error) throw error;
            return json(200, {
                success: true,
                period,
                scoring: {
                    listening: 1,
                    assignment: 10,
                    ai_pass: 5,
                    review_correct: 2,
                    conversation: 2
                },
                leaderboard: (rows || []).map((row: any) => ({
                    ...row,
                    student_name: row.student_id === student.id
                        ? student.name
                        : maskStudentName(row.student_name),
                    is_current_user: row.student_id === student.id
                }))
            });
        }

        const [membershipResult, progressResult, levelsResult] = await Promise.all([
            admin
                .from("memberships")
                .select("status,trial_ends_at,access_ends_at,current_period_end")
                .eq("student_id", student.id)
                .maybeSingle(),
            admin
                .from("student_level_progress")
                .select("student_id,current_level_id,unlocked_rank,total_points,last_promoted_at,learning_levels(id,code,name_zh,name_en,rank,description,badge_color)")
                .eq("student_id", student.id)
                .maybeSingle(),
            admin
                .from("learning_levels")
                .select("id,code,name_zh,name_en,rank,description,badge_color")
                .eq("enabled", true)
                .order("rank", { ascending: true })
        ]);
        const firstError = [membershipResult.error, progressResult.error, levelsResult.error].find(Boolean);
        if (firstError) throw firstError;
        const membershipActive = membershipIsActive(membershipResult.data, student.role);
        const progress = normalizeLevelProgress(progressResult.data);
        const levels = levelsResult.data || [];
        const unlockedRank = STAFF_ROLES.has(student.role) ? 999 : Number(progress?.unlocked_rank || 1);

        if (action === "dashboard") {
            const [booksResult, examsResult, attemptsResult] = await Promise.all([
                admin
                    .from("books")
                    .select("id,name,code,category_id,sort_order,required_level_id,learning_levels(id,code,name_zh,name_en,rank,badge_color)")
                    .eq("enabled", true)
                    .is("archived_at", null)
                    .order("sort_order", { ascending: true }),
                admin
                    .from("promotion_exams")
                    .select(examSelect)
                    .eq("enabled", true)
                    .order("from_level_id", { ascending: true }),
                student.role === "student"
                    ? admin
                        .from("promotion_exam_attempts")
                        .select("id,exam_id,score,correct_count,total_questions,passed,created_at")
                        .eq("student_id", student.id)
                        .order("created_at", { ascending: false })
                        .limit(100)
                    : Promise.resolve({ data: [], error: null })
            ]);
            const error = [booksResult.error, examsResult.error, attemptsResult.error].find(Boolean);
            if (error) throw error;
            const attempts = attemptsResult.data || [];
            const bestByExam = new Map<number, any>();
            for (const attempt of attempts) {
                const current = bestByExam.get(Number(attempt.exam_id));
                if (!current || Number(attempt.score) > Number(current.score)) {
                    bestByExam.set(Number(attempt.exam_id), attempt);
                }
            }
            const exams = (examsResult.data || []).map((rawExam: any) => {
                const exam = normalizeExam(rawExam);
                return {
                id: exam.id,
                title: exam.title,
                description: exam.description,
                passing_score: exam.passing_score,
                question_count: Array.isArray(exam.questions) ? exam.questions.length : 0,
                from_level: exam.from_level,
                to_level: exam.to_level,
                eligible: student.role === "student"
                    && membershipActive
                    && Number(exam.from_level?.rank) === unlockedRank,
                already_unlocked: Number(exam.to_level?.rank) <= unlockedRank,
                best_attempt: bestByExam.get(Number(exam.id)) || null
                };
            });
            return json(200, {
                success: true,
                membership_active: membershipActive,
                progress: progress || null,
                levels,
                books: (booksResult.data || []).map((rawBook: any) => {
                    const book = normalizeBook(rawBook);
                    return {
                        ...book,
                        required_rank: Number(book.learning_levels?.rank || 1),
                        locked: !STAFF_ROLES.has(student.role)
                            && (!membershipActive || Number(book.learning_levels?.rank || 1) > unlockedRank)
                    };
                }),
                exams,
                attempts
            });
        }

        if (action === "exam") {
            if (student.role !== "student") return json(400, { error: "請使用學生帳號參加晉級測驗" });
            if (!membershipActive) return json(402, { error: "會員使用期限已結束，無法參加晉級測驗" });
            const examId = positiveInteger(body?.exam_id);
            if (!examId) return json(400, { error: "測驗編號不正確" });
            const { data: exam, error } = await admin
                .from("promotion_exams")
                .select(examSelect)
                .eq("id", examId)
                .eq("enabled", true)
                .maybeSingle();
            if (error) throw error;
            if (!exam) return json(404, { error: "找不到晉級測驗" });
            const normalizedExam = normalizeExam(exam);
            if (Number(normalizedExam.from_level?.rank) !== unlockedRank) {
                return json(403, {
                    error: Number(normalizedExam.to_level?.rank) <= unlockedRank
                        ? "你已經通過這個等級"
                        : "請先完成前一級晉級測驗"
                });
            }
            return json(200, {
                success: true,
                exam: {
                    id: normalizedExam.id,
                    title: normalizedExam.title,
                    description: normalizedExam.description,
                    passing_score: normalizedExam.passing_score,
                    from_level: normalizedExam.from_level,
                    to_level: normalizedExam.to_level,
                    questions: sanitizeQuestions(normalizedExam.questions)
                }
            });
        }

        if (action === "submit_exam") {
            if (student.role !== "student") return json(400, { error: "請使用學生帳號參加晉級測驗" });
            if (!membershipActive) return json(402, { error: "會員使用期限已結束，無法提交測驗" });
            const examId = positiveInteger(body?.exam_id);
            const answers = Array.isArray(body?.answers) ? body.answers : [];
            if (!examId) return json(400, { error: "測驗編號不正確" });
            const { data: exam, error } = await admin
                .from("promotion_exams")
                .select(examSelect)
                .eq("id", examId)
                .eq("enabled", true)
                .maybeSingle();
            if (error) throw error;
            if (!exam) return json(404, { error: "找不到晉級測驗" });
            const normalizedExam = normalizeExam(exam);
            if (Number(normalizedExam.from_level?.rank) !== unlockedRank) {
                return json(403, { error: "目前無法提交這一級測驗" });
            }
            const questions = Array.isArray(normalizedExam.questions) ? normalizedExam.questions : [];
            if (answers.length !== questions.length) return json(400, { error: "請完成所有題目再送出" });

            let correctCount = 0;
            const results = questions.map((question: any, index: number) => {
                const selected = cleanText(answers[index], 500);
                const answer = cleanText(question.answer, 500);
                const correct = selected === answer;
                if (correct) correctCount += 1;
                return {
                    index,
                    question: cleanText(question.question, 1000),
                    selected_answer: selected,
                    correct_answer: answer,
                    is_correct: correct,
                    explanation: cleanText(question.explanation, 1000) || null
                };
            });
            const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
            const passed = score >= Number(normalizedExam.passing_score || 80);
            const now = new Date().toISOString();
            const { data: attempt, error: attemptError } = await admin
                .from("promotion_exam_attempts")
                .insert({
                    exam_id: normalizedExam.id,
                    student_id: student.id,
                    score,
                    correct_count: correctCount,
                    total_questions: questions.length,
                    passed,
                    answers
                })
                .select("id,score,correct_count,total_questions,passed,created_at")
                .single();
            if (attemptError) throw attemptError;

            let updatedProgress = progress;
            if (passed) {
                const targetRank = Number(normalizedExam.to_level?.rank || unlockedRank + 1);
                const { data: promoted, error: promotionError } = await admin
                    .from("student_level_progress")
                    .update({
                        current_level_id: normalizedExam.to_level_id,
                        unlocked_rank: targetRank,
                        total_points: Number(progress?.total_points || 0) + score,
                        last_promoted_at: now,
                        updated_at: now
                    })
                    .eq("student_id", student.id)
                    .eq("unlocked_rank", unlockedRank)
                    .select("student_id,current_level_id,unlocked_rank,total_points,last_promoted_at,learning_levels(id,code,name_zh,name_en,rank,description,badge_color)")
                    .single();
                if (promotionError) throw promotionError;
                updatedProgress = promoted;
                await admin.from("student_activity_events").insert({
                    student_id: student.id,
                    activity_type: "promotion",
                    activity_key: `exam:${normalizedExam.id}`,
                    metadata: {
                        exam_id: normalizedExam.id,
                        score,
                        from_level: normalizedExam.from_level?.code,
                        to_level: normalizedExam.to_level?.code
                    },
                    occurred_at: now
                });
            }

            return json(200, {
                success: true,
                attempt,
                passed,
                score,
                passing_score: normalizedExam.passing_score,
                results,
                progress: normalizeLevelProgress(updatedProgress),
                promoted_to: passed ? normalizedExam.to_level : null
            });
        }

        if (action === "admin_catalog") {
            if (student.role !== "admin") return json(403, { error: "只有管理員可以管理等級制度" });
            const [booksResult, examsResult, studentsResult] = await Promise.all([
                admin
                    .from("books")
                    .select("id,name,code,category_id,sort_order,required_level_id,learning_levels(id,code,name_zh,name_en,rank,badge_color)")
                    .order("sort_order", { ascending: true }),
                admin.from("promotion_exams").select(examSelect).order("from_level_id", { ascending: true }),
                admin
                    .from("students")
                    .select("id,name,email,class,student_level_progress(student_id,current_level_id,unlocked_rank,total_points,last_promoted_at,learning_levels(id,code,name_zh,name_en,rank,badge_color))")
                    .eq("role", "student")
                    .order("name", { ascending: true })
            ]);
            const error = [booksResult.error, examsResult.error, studentsResult.error].find(Boolean);
            if (error) throw error;
            return json(200, {
                success: true,
                levels,
                books: (booksResult.data || []).map(normalizeBook),
                exams: (examsResult.data || []).map((rawExam: any) => {
                    const exam = normalizeExam(rawExam);
                    return {
                        ...exam,
                        question_count: Array.isArray(exam.questions) ? exam.questions.length : 0
                    };
                }),
                students: (studentsResult.data || []).map((item: any) => ({
                    ...item,
                    level_progress: normalizeLevelProgress(relationOne(item.student_level_progress)),
                    student_level_progress: undefined
                }))
            });
        }

        if (action === "admin_update_book_level") {
            if (student.role !== "admin") return json(403, { error: "只有管理員可以調整教材等級" });
            const bookId = positiveInteger(body?.book_id);
            const levelId = positiveInteger(body?.level_id);
            if (!bookId || !levelId) return json(400, { error: "教材或等級設定不正確" });
            const { data: level } = await admin.from("learning_levels").select("id").eq("id", levelId).maybeSingle();
            if (!level) return json(404, { error: "找不到指定等級" });
            const { data: book, error } = await admin
                .from("books")
                .update({ required_level_id: levelId, updated_at: new Date().toISOString() })
                .eq("id", bookId)
                .select("id,name,code,required_level_id,learning_levels(id,code,name_zh,name_en,rank,badge_color)")
                .single();
            if (error) throw error;
            return json(200, { success: true, book: normalizeBook(book) });
        }

        if (action === "admin_set_student_level") {
            if (student.role !== "admin") return json(403, { error: "只有管理員可以調整學生等級" });
            const targetStudentId = positiveInteger(body?.student_id);
            const levelId = positiveInteger(body?.level_id);
            if (!targetStudentId || !levelId) return json(400, { error: "學生或等級設定不正確" });
            const { data: level, error: levelError } = await admin
                .from("learning_levels")
                .select("id,rank")
                .eq("id", levelId)
                .maybeSingle();
            if (levelError) throw levelError;
            if (!level) return json(404, { error: "找不到指定等級" });
            const { data: target, error: targetError } = await admin
                .from("students")
                .select("id")
                .eq("id", targetStudentId)
                .eq("role", "student")
                .maybeSingle();
            if (targetError) throw targetError;
            if (!target) return json(404, { error: "找不到學生" });
            const { data: levelProgress, error } = await admin
                .from("student_level_progress")
                .upsert({
                    student_id: targetStudentId,
                    current_level_id: level.id,
                    unlocked_rank: level.rank,
                    updated_by: student.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: "student_id" })
                .select("student_id,current_level_id,unlocked_rank,total_points,last_promoted_at,learning_levels(id,code,name_zh,name_en,rank,badge_color)")
                .single();
            if (error) throw error;
            return json(200, { success: true, level_progress: normalizeLevelProgress(levelProgress) });
        }

        if (action === "admin_update_exam") {
            if (student.role !== "admin") return json(403, { error: "只有管理員可以編輯晉級測驗" });
            const examId = positiveInteger(body?.exam_id);
            const title = cleanText(body?.title, 200);
            const description = cleanText(body?.description, 1000) || null;
            const passingScore = Number(body?.passing_score);
            const questions = validateQuestions(body?.questions);
            const enabled = body?.enabled !== false;
            if (!examId || !title || !questions) {
                return json(400, { error: "測驗需要標題及 5～50 題有效的四選一題目" });
            }
            if (!Number.isInteger(passingScore) || passingScore < 50 || passingScore > 100) {
                return json(400, { error: "及格分數必須介於 50～100 分" });
            }
            const { data: exam, error } = await admin
                .from("promotion_exams")
                .update({
                    title,
                    description,
                    passing_score: passingScore,
                    questions,
                    enabled,
                    updated_at: new Date().toISOString()
                })
                .eq("id", examId)
                .select(examSelect)
                .single();
            if (error) throw error;
            return json(200, { success: true, exam: normalizeExam(exam) });
        }

        return json(400, { error: "不支援的等級操作" });
    } catch (error) {
        console.error("learning-progress unexpected error", error);
        return json(500, {
            error: error instanceof Error ? error.message : "學習等級服務暫時無法使用"
        });
    }
});
