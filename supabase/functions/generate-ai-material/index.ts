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
const FIREBASE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const DAILY_LIMITS: Record<string, number> = { student: 5, teacher: 10, admin: 10 };
const ALLOWED_TYPES = ["reading", "vocabulary", "grammar", "listening", "custom"];
const ALLOWED_ROLES = ["student", "teacher", "admin"];
const STAFF_ROLES = new Set(["teacher", "admin"]);
const PASSING_SCORE = 90;
const AI_MODEL = "gpt-5-mini";
const DASHBOARD_PAGE_SIZE = 1000;
const DASHBOARD_MAX_ROWS = 50000;
const DEFAULT_BUDGET = {
    monthly_budget_usd: 10,
    warning_percent: 80,
    usd_to_twd_rate: 33
};
const MODEL_PRICING_USD_PER_MILLION = {
    input: 0.25,
    cached_input: 0.025,
    output: 2
};

const nonNegativeInteger = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
};

const roundNumber = (value: number, digits = 8) => Number(value.toFixed(digits));

const extractTokenUsage = (data: any) => {
    const inputTokens = nonNegativeInteger(data?.usage?.input_tokens);
    const cachedInputTokens = Math.min(
        inputTokens,
        nonNegativeInteger(data?.usage?.input_tokens_details?.cached_tokens)
    );
    const outputTokens = nonNegativeInteger(data?.usage?.output_tokens);
    const reasoningTokens = Math.min(
        outputTokens,
        nonNegativeInteger(data?.usage?.output_tokens_details?.reasoning_tokens)
    );
    const totalTokens = nonNegativeInteger(data?.usage?.total_tokens) || inputTokens + outputTokens;
    const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
    const estimatedCostUsd = (
        (uncachedInputTokens * MODEL_PRICING_USD_PER_MILLION.input)
        + (cachedInputTokens * MODEL_PRICING_USD_PER_MILLION.cached_input)
        + (outputTokens * MODEL_PRICING_USD_PER_MILLION.output)
    ) / 1000000;

    return {
        input_tokens: inputTokens,
        cached_input_tokens: cachedInputTokens,
        output_tokens: outputTokens,
        reasoning_tokens: reasoningTokens,
        total_tokens: totalTokens,
        estimated_cost_usd: roundNumber(estimatedCostUsd)
    };
};

const getTaiwanMonthRange = (month: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;

    const [year, monthNumber] = month.split("-").map(Number);
    const nextYear = monthNumber === 12 ? year + 1 : year;
    const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
    const nextMonthText = String(nextMonth).padStart(2, "0");

    return {
        start: new Date(`${month}-01T00:00:00+08:00`).toISOString(),
        end: new Date(`${nextYear}-${nextMonthText}-01T00:00:00+08:00`).toISOString()
    };
};

const taiwanDateFromValue = (value: string) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
}).format(new Date(value));

async function verifyFirebaseIdToken(token: string) {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: FIREBASE_PROJECT_ID
    });
    const uid = String(payload.sub || "").trim();
    if (!uid) throw new Error("Firebase token 缺少 uid");
    return uid;
}

const taiwanDate = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
}).format(new Date());

const extractOutputText = (data: any) => {
    if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
    const parts: string[] = [];
    for (const item of data?.output || []) {
        for (const content of item?.content || []) {
            if (content?.type === "output_text" && typeof content?.text === "string") parts.push(content.text);
        }
    }
    return parts.join("\n").trim();
};

const sanitizeContent = (content: any) => ({
    title: content?.title || "AI English Practice",
    subtitle: content?.subtitle || "",
    passage: content?.passage || "",
    vocabulary: Array.isArray(content?.vocabulary) ? content.vocabulary : [],
    questions: Array.isArray(content?.questions)
        ? content.questions.map((question: any) => ({
            question: String(question?.question || ""),
            options: Array.isArray(question?.options) ? question.options.map((option: any) => String(option)) : []
        }))
        : [],
    study_tip: content?.study_tip || ""
});

const sanitizeMaterial = (material: any) => ({
    ...material,
    content: sanitizeContent(material?.content)
});

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
        const openaiKey = Deno.env.get("OPENAI_API_KEY");
        if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Supabase 伺服器設定不完整" });

        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        const { data: student, error: studentError } = await admin
            .from("students")
            .select("id,name,role")
            .eq("firebase_uid", firebaseUid)
            .maybeSingle();

        if (studentError) return json(500, { error: "無法讀取帳號資料" });
        if (!student) return json(404, { error: "找不到 Alan English 帳號" });

        const role = ALLOWED_ROLES.includes(student.role) ? student.role : "student";
        const body = await req.json().catch(() => ({}));
        const action = String(body?.action || "generate");
        const today = taiwanDate();

        const effectiveAccess = await loadEffectiveAccess(admin, Number(student.id));
        if (role === "student" && !effectiveAccess.is_active && !["status", "history"].includes(action)) {
            return json(402, { error: "會員使用期限已結束，請續訂或輸入教材啟用碼", code: "membership_required" });
        }
        const configuredLimit = Number(effectiveAccess.ai_daily_limit);
        if (role === "student" && action === "generate" && !effectiveAccess.features.ai_materials) {
            return json(403, { error: "目前帳號不包含 AI 教材", code: "ai_materials_not_available" });
        }
        const dailyLimit = role === "student" && Number.isInteger(configuredLimit) && configuredLimit >= 0
            ? configuredLimit
            : DAILY_LIMITS[role] ?? 5;

        const { data: usage } = await admin
            .from("ai_usage_daily")
            .select("generation_count")
            .eq("student_id", student.id)
            .eq("usage_date", today)
            .maybeSingle();

        const used = Number(usage?.generation_count || 0);
        const remaining = Math.max(0, dailyLimit - used);
        const usagePayload = { date: today, used, limit: dailyLimit, remaining, role };

        if (action === "cost_dashboard") {
            if (role !== "admin") return json(403, { error: "只有管理者可以查看 API 成本" });

            const month = String(body?.month || today.slice(0, 7)).trim();
            const range = getTaiwanMonthRange(month);
            if (!range) return json(400, { error: "月份格式不正確" });

            const logs: any[] = [];
            let truncated = false;

            for (let offset = 0; offset < DASHBOARD_MAX_ROWS; offset += DASHBOARD_PAGE_SIZE) {
                const { data: pageRows, error: logsError } = await admin
                    .from("ai_api_usage_logs")
                    .select("id,student_id,material_id,owner_role,model,material_type,question_count,request_status,input_tokens,cached_input_tokens,output_tokens,reasoning_tokens,total_tokens,estimated_cost_usd,http_status,error_code,created_at")
                    .gte("created_at", range.start)
                    .lt("created_at", range.end)
                    .order("created_at", { ascending: false })
                    .range(offset, offset + DASHBOARD_PAGE_SIZE - 1);

                if (logsError) {
                    console.error("AI cost dashboard log read error", logsError);
                    return json(500, { error: "無法讀取 API 成本紀錄" });
                }

                const currentPage = pageRows || [];
                logs.push(...currentPage);
                if (currentPage.length < DASHBOARD_PAGE_SIZE) break;
                if (logs.length >= DASHBOARD_MAX_ROWS) truncated = true;
            }

            const studentIds = [...new Set(logs.map(item => Number(item.student_id)).filter(Number.isFinite))];
            let profiles: any[] = [];

            if (studentIds.length > 0) {
                const { data: profileRows, error: profilesError } = await admin
                    .from("students")
                    .select("id,name,role")
                    .in("id", studentIds);

                if (profilesError) {
                    console.error("AI cost dashboard profile read error", profilesError);
                } else {
                    profiles = profileRows || [];
                }
            }

            const { data: storedBudget, error: budgetError } = await admin
                .from("ai_api_budget_settings")
                .select("monthly_budget_usd,warning_percent,usd_to_twd_rate,updated_at")
                .eq("id", 1)
                .maybeSingle();

            if (budgetError) console.error("AI budget read error", budgetError);

            const budget = {
                monthly_budget_usd: Number(storedBudget?.monthly_budget_usd || DEFAULT_BUDGET.monthly_budget_usd),
                warning_percent: Number(storedBudget?.warning_percent || DEFAULT_BUDGET.warning_percent),
                usd_to_twd_rate: Number(storedBudget?.usd_to_twd_rate || DEFAULT_BUDGET.usd_to_twd_rate),
                updated_at: storedBudget?.updated_at || null
            };
            const profileMap = new Map(profiles.map(profile => [Number(profile.id), profile]));
            const dailyMap = new Map<string, any>();
            const userMap = new Map<number, any>();
            let totalCostUsd = 0;
            let inputTokens = 0;
            let cachedInputTokens = 0;
            let outputTokens = 0;
            let reasoningTokens = 0;
            let totalTokens = 0;
            let successfulRequests = 0;
            let billedRequests = 0;

            for (const item of logs) {
                const cost = Number(item.estimated_cost_usd || 0);
                const isSuccess = item.request_status === "success";
                const isBilled = cost > 0 || Number(item.total_tokens || 0) > 0;
                totalCostUsd += cost;
                inputTokens += Number(item.input_tokens || 0);
                cachedInputTokens += Number(item.cached_input_tokens || 0);
                outputTokens += Number(item.output_tokens || 0);
                reasoningTokens += Number(item.reasoning_tokens || 0);
                totalTokens += Number(item.total_tokens || 0);
                if (isSuccess) successfulRequests += 1;
                if (isBilled) billedRequests += 1;

                const day = taiwanDateFromValue(item.created_at);
                const daily = dailyMap.get(day) || {
                    date: day,
                    requests: 0,
                    successful_requests: 0,
                    failed_requests: 0,
                    total_tokens: 0,
                    cost_usd: 0
                };
                daily.requests += 1;
                daily.successful_requests += isSuccess ? 1 : 0;
                daily.failed_requests += isSuccess ? 0 : 1;
                daily.total_tokens += Number(item.total_tokens || 0);
                daily.cost_usd += cost;
                dailyMap.set(day, daily);

                const studentId = Number(item.student_id);
                const profile = profileMap.get(studentId);
                const user = userMap.get(studentId) || {
                    student_id: studentId,
                    name: profile?.name || `使用者 #${studentId}`,
                    role: profile?.role || item.owner_role,
                    requests: 0,
                    successful_requests: 0,
                    failed_requests: 0,
                    total_tokens: 0,
                    cost_usd: 0
                };
                user.requests += 1;
                user.successful_requests += isSuccess ? 1 : 0;
                user.failed_requests += isSuccess ? 0 : 1;
                user.total_tokens += Number(item.total_tokens || 0);
                user.cost_usd += cost;
                userMap.set(studentId, user);
            }

            const normalizedCostUsd = roundNumber(totalCostUsd);
            const budgetUsedPercent = budget.monthly_budget_usd > 0
                ? roundNumber((normalizedCostUsd / budget.monthly_budget_usd) * 100, 2)
                : 0;
            const budgetStatus = budgetUsedPercent >= 100
                ? "over"
                : budgetUsedPercent >= budget.warning_percent
                    ? "warning"
                    : "normal";

            return json(200, {
                success: true,
                month,
                summary: {
                    total_requests: logs.length,
                    billed_requests: billedRequests,
                    successful_requests: successfulRequests,
                    failed_requests: logs.length - successfulRequests,
                    success_rate: logs.length > 0 ? roundNumber((successfulRequests / logs.length) * 100, 1) : 0,
                    input_tokens: inputTokens,
                    cached_input_tokens: cachedInputTokens,
                    output_tokens: outputTokens,
                    reasoning_tokens: reasoningTokens,
                    total_tokens: totalTokens,
                    total_cost_usd: normalizedCostUsd,
                    total_cost_twd: roundNumber(normalizedCostUsd * budget.usd_to_twd_rate, 2),
                    truncated
                },
                budget: {
                    ...budget,
                    used_percent: budgetUsedPercent,
                    status: budgetStatus
                },
                daily: [...dailyMap.values()]
                    .map(item => ({ ...item, cost_usd: roundNumber(item.cost_usd) }))
                    .sort((a, b) => a.date.localeCompare(b.date)),
                users: [...userMap.values()]
                    .map(item => ({ ...item, cost_usd: roundNumber(item.cost_usd) }))
                    .sort((a, b) => b.cost_usd - a.cost_usd),
                recent: logs.slice(0, 50).map(item => {
                    const profile = profileMap.get(Number(item.student_id));
                    return {
                        ...item,
                        name: profile?.name || `使用者 #${item.student_id}`,
                        role: profile?.role || item.owner_role,
                        estimated_cost_usd: Number(item.estimated_cost_usd || 0)
                    };
                })
            });
        }

        if (action === "update_cost_budget") {
            if (role !== "admin") return json(403, { error: "只有管理者可以調整 API 預算" });

            const monthlyBudgetUsd = Number(body?.monthly_budget_usd);
            const warningPercent = Number(body?.warning_percent);
            const usdToTwdRate = Number(body?.usd_to_twd_rate);

            if (!Number.isFinite(monthlyBudgetUsd) || monthlyBudgetUsd < 1 || monthlyBudgetUsd > 10000) {
                return json(400, { error: "每月預算必須介於 US$1～10,000" });
            }
            if (!Number.isInteger(warningPercent) || warningPercent < 50 || warningPercent > 100) {
                return json(400, { error: "提醒門檻必須介於 50%～100%" });
            }
            if (!Number.isFinite(usdToTwdRate) || usdToTwdRate < 20 || usdToTwdRate > 50) {
                return json(400, { error: "美元匯率必須介於 20～50" });
            }

            const now = new Date().toISOString();
            const { data: updatedBudget, error: updateBudgetError } = await admin
                .from("ai_api_budget_settings")
                .upsert({
                    id: 1,
                    monthly_budget_usd: roundNumber(monthlyBudgetUsd, 2),
                    warning_percent: warningPercent,
                    usd_to_twd_rate: roundNumber(usdToTwdRate, 4),
                    updated_by: student.id,
                    updated_at: now
                }, { onConflict: "id" })
                .select("monthly_budget_usd,warning_percent,usd_to_twd_rate,updated_at")
                .single();

            if (updateBudgetError) {
                console.error("AI budget update error", updateBudgetError);
                return json(500, { error: "API 預算設定儲存失敗" });
            }

            return json(200, {
                success: true,
                budget: {
                    monthly_budget_usd: Number(updatedBudget.monthly_budget_usd),
                    warning_percent: Number(updatedBudget.warning_percent),
                    usd_to_twd_rate: Number(updatedBudget.usd_to_twd_rate),
                    updated_at: updatedBudget.updated_at
                }
            });
        }

        if (action === "status") {
            return json(200, { success: true, usage: usagePayload, passing_score: PASSING_SCORE });
        }

        if (action === "history") {
            const { data: materials, error: historyError } = await admin
                .from("ai_generated_materials")
                .select("id,material_type,title,topic,difficulty,question_count,content,owner_role,is_favorite,review_count,last_reviewed_at,source_material_id,created_at")
                .eq("student_id", student.id)
                .order("created_at", { ascending: false })
                .limit(100);

            if (historyError) return json(500, { error: "無法讀取 AI 教材庫" });

            const materialIds = (materials || []).map((item: any) => item.id);
            let progressRows: any[] = [];
            if (materialIds.length > 0) {
                const { data: progress, error: progressError } = await admin
                    .from("ai_material_progress")
                    .select("material_id,best_score,attempt_count,completed,completed_at,last_attempt_at")
                    .eq("student_id", student.id)
                    .in("material_id", materialIds);
                if (progressError) return json(500, { error: "無法讀取教材作答進度" });
                progressRows = progress || [];
            }

            const progressMap = new Map(progressRows.map((item: any) => [Number(item.material_id), item]));
            const safeMaterials = (materials || []).map((item: any) => ({
                ...sanitizeMaterial(item),
                progress: progressMap.get(Number(item.id)) || {
                    best_score: 0,
                    attempt_count: 0,
                    completed: false,
                    completed_at: null,
                    last_attempt_at: null
                }
            }));

            return json(200, {
                success: true,
                materials: safeMaterials,
                usage: usagePayload,
                passing_score: PASSING_SCORE
            });
        }

        if (action === "favorite") {
            const materialId = Number(body?.material_id);
            const isFavorite = Boolean(body?.is_favorite);
            if (!Number.isFinite(materialId)) return json(400, { error: "教材編號不正確" });

            const { data: updated, error: favoriteError } = await admin
                .from("ai_generated_materials")
                .update({ is_favorite: isFavorite })
                .eq("id", materialId)
                .eq("student_id", student.id)
                .select("id,is_favorite")
                .maybeSingle();

            if (favoriteError) return json(500, { error: "收藏狀態更新失敗" });
            if (!updated) return json(404, { error: "找不到這份教材" });
            return json(200, { success: true, material: updated });
        }

        if (action === "mark_reviewed") {
            const materialId = Number(body?.material_id);
            if (!Number.isFinite(materialId)) return json(400, { error: "教材編號不正確" });

            const { data: current } = await admin
                .from("ai_generated_materials")
                .select("id,review_count")
                .eq("id", materialId)
                .eq("student_id", student.id)
                .maybeSingle();

            if (!current) return json(404, { error: "找不到這份教材" });
            const now = new Date().toISOString();
            const { data: updated, error: reviewError } = await admin
                .from("ai_generated_materials")
                .update({ review_count: Number(current.review_count || 0) + 1, last_reviewed_at: now })
                .eq("id", materialId)
                .eq("student_id", student.id)
                .select("id,review_count,last_reviewed_at")
                .single();

            if (reviewError) return json(500, { error: "複習紀錄更新失敗" });
            return json(200, { success: true, material: updated });
        }

        if (action === "submit_attempt") {
            const materialId = Number(body?.material_id);
            const answers = Array.isArray(body?.answers) ? body.answers.map((answer: any) => String(answer ?? "")) : [];
            if (!Number.isFinite(materialId)) return json(400, { error: "教材編號不正確" });

            const { data: materialRow, error: materialError } = await admin
                .from("ai_generated_materials")
                .select("id,content")
                .eq("id", materialId)
                .eq("student_id", student.id)
                .maybeSingle();

            if (materialError) return json(500, { error: "無法讀取教材" });
            if (!materialRow) return json(404, { error: "找不到這份教材" });

            const questions = Array.isArray(materialRow.content?.questions) ? materialRow.content.questions : [];
            if (questions.length === 0) return json(400, { error: "這份教材沒有可作答的題目" });
            if (answers.length !== questions.length || answers.some((answer: string) => !answer.trim())) {
                return json(400, { error: "請完成所有題目後再提交答案" });
            }

            let correctCount = 0;
            const wrongQuestions: any[] = [];
            const feedback = questions.map((question: any, index: number) => {
                const selected = String(answers[index] || "");
                const correctAnswer = String(question?.answer || "");
                const isCorrect = selected === correctAnswer;
                if (isCorrect) correctCount += 1;
                else {
                    wrongQuestions.push({
                        index,
                        question: String(question?.question || ""),
                        selected_answer: selected,
                        correct_answer: correctAnswer
                    });
                }
                return {
                    index,
                    is_correct: isCorrect,
                    selected_answer: selected,
                    correct_answer: correctAnswer,
                    explanation: String(question?.explanation || "")
                };
            });

            const totalQuestions = questions.length;
            const score = Math.round((correctCount / totalQuestions) * 100);
            const passed = score >= PASSING_SCORE;
            const now = new Date().toISOString();

            const { error: attemptError } = await admin.from("ai_material_attempts").insert({
                student_id: student.id,
                material_id: materialId,
                score,
                correct_count: correctCount,
                total_questions: totalQuestions,
                passed,
                answers,
                wrong_questions: wrongQuestions
            });
            if (attemptError) return json(500, { error: "作答紀錄儲存失敗" });

            const { data: currentProgress } = await admin
                .from("ai_material_progress")
                .select("best_score,attempt_count,completed,completed_at")
                .eq("student_id", student.id)
                .eq("material_id", materialId)
                .maybeSingle();

            const bestScore = Math.max(Number(currentProgress?.best_score || 0), score);
            const attemptCount = Number(currentProgress?.attempt_count || 0) + 1;
            const completed = Boolean(currentProgress?.completed) || passed;
            const completedAt = currentProgress?.completed_at || (passed ? now : null);

            const { data: progress, error: progressError } = await admin
                .from("ai_material_progress")
                .upsert({
                    student_id: student.id,
                    material_id: materialId,
                    best_score: bestScore,
                    attempt_count: attemptCount,
                    completed,
                    completed_at: completedAt,
                    last_attempt_at: now,
                    updated_at: now
                }, { onConflict: "student_id,material_id" })
                .select("material_id,best_score,attempt_count,completed,completed_at,last_attempt_at")
                .single();

            if (progressError) return json(500, { error: "教材完成狀態更新失敗" });

            await admin.from("student_activity_events").insert({
                student_id: student.id,
                activity_type: "ai_quiz",
                activity_key: `material_attempt:${materialId}:${attemptCount}`,
                metadata: {
                    material_id: materialId,
                    score,
                    passed,
                    correct_count: correctCount,
                    total_questions: totalQuestions
                },
                occurred_at: now
            });

            return json(200, {
                success: true,
                result: {
                    score,
                    correct_count: correctCount,
                    total_questions: totalQuestions,
                    passed,
                    passing_score: PASSING_SCORE,
                    feedback,
                    wrong_questions: wrongQuestions
                },
                progress
            });
        }

        if (action !== "generate") return json(400, { error: "不支援的操作" });
        if (!openaiKey) return json(500, { error: "OPENAI_API_KEY 尚未設定" });

        if (used >= dailyLimit) {
            return json(429, {
                error: `今天的 AI 教材生成額度已用完，明天 00:00 會重新獲得 ${dailyLimit} 次。`,
                usage: usagePayload
            });
        }

        const materialType = String(body?.material_type || "reading").trim();
        const topic = String(body?.topic || "").trim().slice(0, 120);
        const difficulty = String(body?.difficulty || "國小中年級").trim().slice(0, 40);
        const questionCount = Math.min(15, Math.max(3, Number(body?.question_count) || 5));
        const customRequest = String(body?.custom_request || "").trim().slice(0, 600);

        if (!ALLOWED_TYPES.includes(materialType)) return json(400, { error: "教材類型不正確" });
        if (!topic && materialType !== "custom") return json(400, { error: "請輸入教材主題" });
        if (materialType === "custom" && !customRequest) return json(400, { error: "請輸入想生成的教材內容" });

        const typeLabels: Record<string, string> = {
            reading: "英文閱讀理解",
            vocabulary: "英文單字練習",
            grammar: "英文文法練習",
            listening: "英文聽力理解練習",
            custom: "自訂英文教材"
        };

        const prompt = `你是 Alan English 的專業兒童英語教材編寫老師。\n請生成一份適合「${difficulty}」的「${typeLabels[materialType]}」。\n主題：${topic || "由需求自行決定"}\n題目數：${questionCount}\n自訂需求：${customRequest || "無"}\n\n規則：\n1. 內容必須適合台灣國小學生，不使用成人或不適齡內容。\n2. 英文自然、正確，難度符合指定程度。\n3. explanation 使用繁體中文，簡潔清楚。\n4. reading/listening 類型需提供一篇 passage；其他類型 passage 可為空字串。\n5. vocabulary 至少提供 5 個重要單字，每個含 word、meaning（繁中）、example。\n6. questions 必須剛好 ${questionCount} 題，而且全部都是單選選擇題；每題必須有四個不同的 options。\n7. answer 必須是四個 options 其中一個選項的完整文字，不可使用 A/B/C/D 代號。\n8. listening 類型的 passage 視為語音朗讀的聽力稿，題目必須能靠聽力稿回答。\n9. 不要在 question 或 options 文字中洩漏正確答案。\n10. 只輸出 JSON，不要 markdown code fence。\n\nJSON 格式：\n{\n  "title": "教材標題",\n  "subtitle": "一句教材說明",\n  "passage": "英文文章或聽力稿",\n  "vocabulary": [{"word":"","meaning":"","example":""}],\n  "questions": [{"question":"","options":["","","",""],"answer":"","explanation":""}],\n  "study_tip": "繁體中文學習提示"\n}`;

        const recordApiUsage = async ({
            requestStatus,
            responseData = {},
            materialId = null,
            httpStatus = null,
            errorCode = null
        }: {
            requestStatus: string;
            responseData?: any;
            materialId?: number | null;
            httpStatus?: number | null;
            errorCode?: string | null;
        }) => {
            const tokenUsage = extractTokenUsage(responseData);
            const { error: logError } = await admin.from("ai_api_usage_logs").insert({
                student_id: student.id,
                material_id: materialId,
                owner_role: role,
                model: String(responseData?.model || AI_MODEL).slice(0, 100),
                material_type: materialType,
                question_count: questionCount,
                request_status: requestStatus,
                openai_response_id: responseData?.id ? String(responseData.id).slice(0, 200) : null,
                ...tokenUsage,
                http_status: httpStatus,
                error_code: errorCode ? String(errorCode).slice(0, 120) : null
            });

            if (logError) console.error("AI API usage log error", logError);
            return tokenUsage;
        };

        let openaiResponse: Response;
        try {
            openaiResponse = await fetch("https://api.openai.com/v1/responses", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${openaiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    input: prompt,
                    max_output_tokens: 4500
                })
            });
        } catch (error) {
            console.error("OpenAI network error", error);
            await recordApiUsage({
                requestStatus: "network_error",
                errorCode: "network_error"
            });
            return json(502, { error: "AI 連線暫時失敗，這次不會扣除額度，請稍後再試。" });
        }

        const openaiData = await openaiResponse.json().catch(() => ({}));
        if (!openaiResponse.ok) {
            console.error("OpenAI API error", openaiData);
            await recordApiUsage({
                requestStatus: "openai_error",
                responseData: openaiData,
                httpStatus: openaiResponse.status,
                errorCode: openaiData?.error?.code || `openai_http_${openaiResponse.status}`
            });
            return json(502, { error: "AI 目前無法生成教材，這次不會扣除額度，請稍後再試。" });
        }

        const outputText = extractOutputText(openaiData);
        let content: any;
        try {
            content = JSON.parse(outputText);
        } catch (error) {
            console.error("AI JSON parse error", error, {
                response_id: openaiData?.id || null,
                output_length: outputText.length
            });
            await recordApiUsage({
                requestStatus: "invalid_json",
                responseData: openaiData,
                httpStatus: openaiResponse.status,
                errorCode: "invalid_json"
            });
            return json(502, { error: "AI 回傳格式異常，這次不會扣除額度，請再試一次。" });
        }

        const validQuestions = Array.isArray(content?.questions)
            && content.questions.length === questionCount
            && content.questions.every((question: any) => (
                Array.isArray(question?.options)
                && question.options.length === 4
                && question.options.includes(question?.answer)
            ));

        if (!content?.title || !validQuestions) {
            await recordApiUsage({
                requestStatus: "invalid_material",
                responseData: openaiData,
                httpStatus: openaiResponse.status,
                errorCode: "invalid_material"
            });
            return json(502, { error: "AI 教材題目格式不完整，這次不會扣除額度，請再生成一次。" });
        }

        const { data: saved, error: saveError } = await admin
            .from("ai_generated_materials")
            .insert({
                student_id: student.id,
                owner_role: role,
                material_type: materialType,
                title: String(content.title).slice(0, 200),
                topic: topic || null,
                difficulty,
                question_count: questionCount,
                content
            })
            .select("id,material_type,title,topic,difficulty,question_count,content,owner_role,is_favorite,review_count,last_reviewed_at,source_material_id,created_at")
            .single();

        if (saveError) {
            console.error("AI material save error", saveError);
            await recordApiUsage({
                requestStatus: "save_failed",
                responseData: openaiData,
                httpStatus: openaiResponse.status,
                errorCode: "material_save_failed"
            });
            return json(500, { error: "教材已生成但儲存失敗，這次不會扣除額度。" });
        }

        await recordApiUsage({
            requestStatus: "success",
            responseData: openaiData,
            materialId: Number(saved.id),
            httpStatus: openaiResponse.status
        });

        const nextUsed = used + 1;
        const now = new Date().toISOString();
        const { error: usageError } = await admin
            .from("ai_usage_daily")
            .upsert({
                student_id: student.id,
                usage_date: today,
                generation_count: nextUsed,
                updated_at: now
            }, { onConflict: "student_id,usage_date" });

        if (usageError) console.error("AI usage update error", usageError);

        await Promise.all([
            admin
                .from("students")
                .update({ last_active_at: now, last_learning_at: now, updated_at: now })
                .eq("id", student.id),
            admin.from("student_activity_events").insert({
                student_id: student.id,
                activity_type: "ai",
                activity_key: `material:${saved.id}`,
                metadata: {
                    material_id: saved.id,
                    material_type: materialType,
                    title: saved.title,
                    role
                },
                occurred_at: now
            })
        ]);

        return json(200, {
            success: true,
            material: {
                ...sanitizeMaterial(saved),
                progress: {
                    best_score: 0,
                    attempt_count: 0,
                    completed: false,
                    completed_at: null,
                    last_attempt_at: null
                }
            },
            usage: {
                date: today,
                used: nextUsed,
                limit: dailyLimit,
                remaining: Math.max(0, dailyLimit - nextUsed),
                role
            },
            passing_score: PASSING_SCORE
        });
    } catch (error) {
        console.error("generate-ai-material unexpected error", error);
        return json(500, { error: error instanceof Error ? error.message : "AI 教材生成失敗" });
    }
});
