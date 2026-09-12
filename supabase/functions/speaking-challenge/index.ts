import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";
import { cleanText, verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { createR2PresignedUrl } from "../_shared/r2.ts";
import { matchesFoundationAnswer, readFoundationInteractionType } from "../_shared/speaking-foundation-answer.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, payload: Record<string, unknown>) => new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
});

const assertChallengeAccess = async (admin: any, user: any) => {
    if (user.role === "teacher" || user.role === "admin") return { demoMode: true };
    if (user.role !== "student") throw Object.assign(new Error("目前帳號不能開啟口說大挑戰"), { status: 403 });
    const access = await loadEffectiveAccess(admin, Number(user.id));
    if (!access.is_active || !access.features.pronunciation) {
        throw Object.assign(new Error("目前方案不包含 AI 發音練習"), { status: 403, code: "pronunciation_access_required" });
    }
    return { demoMode: false };
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Supabase 伺服器設定不完整" });
        const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const user = await verifyFirebaseRequest(req, admin);
        const { demoMode } = await assertChallengeAccess(admin, user);
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action, 40);

        if (action === "catalog") {
            const { data: sets, error } = await admin.from("speaking_question_sets")
                .select("id,book_id,title,topic,difficulty,intro_zh,learning_goal_zh,version,generation_metadata,published_at,books(id,name,code),speaking_questions(id,sort_order)")
                .eq("status", "published").order("published_at", { ascending: true });
            if (error) throw error;
            const questionIds = (sets || []).flatMap((set: any) => (set.speaking_questions || []).map((question: any) => Number(question.id)));
            const { data: progress, error: progressError } = questionIds.length && !demoMode
                ? await admin.from("speaking_challenge_question_progress").select("question_id,status").eq("student_id", user.id).in("question_id", questionIds)
                : { data: [], error: null };
            if (progressError) throw progressError;
            const completed = new Set((progress || []).filter((row: any) => row.status === "completed").map((row: any) => Number(row.question_id)));
            return json(200, { success: true, demo_mode: demoMode, challenges: (sets || []).map((set: any) => ({
                id: set.id, book: set.books, title: set.title, topic: set.topic, difficulty: set.difficulty,
                intro_zh: set.intro_zh, learning_goal_zh: set.learning_goal_zh,
                version: set.version, generation_metadata: set.generation_metadata || {},
                question_count: (set.speaking_questions || []).length,
                completed_count: (set.speaking_questions || []).filter((question: any) => completed.has(Number(question.id))).length
            })) });
        }

        const setId = Number(body?.question_set_id);
        if (!Number.isInteger(setId) || setId <= 0) return json(400, { error: "找不到口說小關卡" });
        const { data: questionSet, error: setError } = await admin.from("speaking_question_sets")
            .select("id,book_id,title,topic,difficulty,intro_zh,learning_goal_zh,version,generation_metadata,books(id,name,code),speaking_questions(id,question_text,hint_zh,keywords,simple_answer,model_answer,follow_up_question,pronunciation_notes_zh,visual_aid,sort_order)")
            .eq("id", setId).eq("status", "published").maybeSingle();
        if (setError) throw setError;
        if (!questionSet) return json(404, { error: "找不到已發布的口說小關卡" });

        if (action === "question_set") {
            const ids = (questionSet.speaking_questions || []).map((question: any) => Number(question.id));
            const { data: progress, error: progressError } = ids.length && !demoMode
                ? await admin.from("speaking_challenge_question_progress").select("question_id,status").eq("student_id", user.id).in("question_id", ids)
                : { data: [], error: null };
            if (progressError) throw progressError;
            const statusByQuestion = new Map((progress || []).map((row: any) => [Number(row.question_id), row.status]));
            const { data: audioLinks, error: audioLinkError } = ids.length
                ? await admin.from("speaking_question_audio").select("question_id,asset_id,purpose").in("question_id", ids)
                : { data: [], error: null };
            if (audioLinkError) throw audioLinkError;
            const assetIds = [...new Set((audioLinks || []).map((row: any) => row.asset_id).filter(Boolean))];
            const { data: assets, error: assetError } = assetIds.length
                ? await admin.from("speaking_tts_assets").select("id,status,private_object_key").in("id", assetIds)
                : { data: [], error: null };
            if (assetError) throw assetError;
            const assetById = new Map((assets || []).map((row: any) => [String(row.id), row]));
            const assetByQuestionPurpose = new Map((audioLinks || []).map((row: any) => [
                `${Number(row.question_id)}:${row.purpose}`,
                assetById.get(String(row.asset_id))
            ]));
            const questions = [];
            for (const question of (questionSet.speaking_questions || []).sort((a: any, b: any) => a.sort_order - b.sort_order)) {
                const modelAsset: any = assetByQuestionPurpose.get(`${Number(question.id)}:model_answer`);
                const promptAsset: any = assetByQuestionPurpose.get(`${Number(question.id)}:question_prompt`);
                const modelReady = modelAsset?.status === "ready" && modelAsset?.private_object_key;
                const promptReady = promptAsset?.status === "ready" && promptAsset?.private_object_key;
                questions.push({
                    ...question,
                    progress_status: statusByQuestion.get(Number(question.id)) || "opened",
                    question_audio_status: promptReady ? "ready" : (promptAsset?.status || "missing"),
                    question_audio_url: promptReady ? await createR2PresignedUrl(promptAsset.private_object_key, "GET", 15 * 60) : null,
                    model_audio_status: modelReady ? "ready" : (modelAsset?.status || "missing"),
                    model_audio_url: modelReady ? await createR2PresignedUrl(modelAsset.private_object_key, "GET", 15 * 60) : null
                });
            }
            return json(200, { success: true, demo_mode: demoMode, challenge: { ...questionSet, speaking_questions: questions } });
        }

        if (action === "complete_question") {
            if (demoMode) return json(403, { error: "示範模式不會寫入學生進度", code: "demo_read_only" });
            const questionId = Number(body?.question_id);
            const question = (questionSet.speaking_questions || []).find((item: any) => Number(item.id) === questionId);
            if (!question) return json(403, { error: "這題不屬於指定的小關卡" });
            const interactionType = readFoundationInteractionType(questionSet.generation_metadata);
            if (interactionType) {
                const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
                const { data: attempt, error: attemptError } = await admin.from("speaking_pronunciation_attempts")
                    .select("recognized_text,created_at").eq("student_id", Number(user.id))
                    .eq("question_set_id", setId).eq("question_id", questionId)
                    .gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
                if (attemptError) throw attemptError;
                if (!attempt || !matchesFoundationAnswer(interactionType, question.model_answer, attempt.recognized_text)) {
                    return json(409, { error: "這一題要先完成正確的口說評分", code: "correct_assessment_required" });
                }
            }
            const { data: completion, error: completionError } = await admin.rpc("complete_speaking_challenge_question_v2", {
                p_student_id: Number(user.id),
                p_question_set_id: setId,
                p_question_id: questionId
            });
            if (completionError) throw completionError;
            return json(200, { success: true, ...(completion || {}) });
        }
        return json(400, { error: "不支援的操作" });
    } catch (error: any) {
        return json(Number(error?.status) || 500, { error: error?.message || "口說大挑戰服務發生錯誤", code: error?.code || null });
    }
});
