import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";
import { cleanText, verifyFirebaseRequest } from "../_shared/firebase-auth.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, payload: Record<string, unknown>) => new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
});

const assertChallengeAccess = async (admin: any, user: any) => {
    if (user.role !== "student") throw Object.assign(new Error("只有學生可以進行口說大挑戰"), { status: 403 });
    const access = await loadEffectiveAccess(admin, Number(user.id));
    if (!access.is_active || !access.features.pronunciation) {
        throw Object.assign(new Error("目前方案不包含 AI 發音練習"), { status: 403, code: "pronunciation_access_required" });
    }
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
        await assertChallengeAccess(admin, user);
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action, 40);

        if (action === "catalog") {
            const { data: sets, error } = await admin.from("speaking_question_sets")
                .select("id,book_id,title,topic,difficulty,version,published_at,books(id,name,code),speaking_questions(id,sort_order)")
                .eq("status", "published").order("published_at", { ascending: true });
            if (error) throw error;
            const questionIds = (sets || []).flatMap((set: any) => (set.speaking_questions || []).map((question: any) => Number(question.id)));
            const { data: progress, error: progressError } = questionIds.length
                ? await admin.from("speaking_challenge_question_progress").select("question_id,status").eq("student_id", user.id).in("question_id", questionIds)
                : { data: [], error: null };
            if (progressError) throw progressError;
            const completed = new Set((progress || []).filter((row: any) => row.status === "completed").map((row: any) => Number(row.question_id)));
            return json(200, { success: true, challenges: (sets || []).map((set: any) => ({
                id: set.id, book: set.books, title: set.title, topic: set.topic, difficulty: set.difficulty,
                version: set.version, question_count: (set.speaking_questions || []).length,
                completed_count: (set.speaking_questions || []).filter((question: any) => completed.has(Number(question.id))).length
            })) });
        }

        const setId = Number(body?.question_set_id);
        if (!Number.isInteger(setId) || setId <= 0) return json(400, { error: "找不到口說小關卡" });
        const { data: questionSet, error: setError } = await admin.from("speaking_question_sets")
            .select("id,book_id,title,topic,difficulty,version,books(id,name,code),speaking_questions(id,question_text,hint_zh,simple_answer,model_answer,follow_up_question,pronunciation_notes_zh,sort_order)")
            .eq("id", setId).eq("status", "published").maybeSingle();
        if (setError) throw setError;
        if (!questionSet) return json(404, { error: "找不到已發布的口說小關卡" });

        if (action === "question_set") {
            const ids = (questionSet.speaking_questions || []).map((question: any) => Number(question.id));
            const { data: progress, error: progressError } = ids.length
                ? await admin.from("speaking_challenge_question_progress").select("question_id,status").eq("student_id", user.id).in("question_id", ids)
                : { data: [], error: null };
            if (progressError) throw progressError;
            const statusByQuestion = new Map((progress || []).map((row: any) => [Number(row.question_id), row.status]));
            return json(200, { success: true, challenge: { ...questionSet, speaking_questions: (questionSet.speaking_questions || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((question: any) => ({ ...question, progress_status: statusByQuestion.get(Number(question.id)) || "opened" })) } });
        }

        if (action === "complete_question") {
            const questionId = Number(body?.question_id);
            const exists = (questionSet.speaking_questions || []).some((question: any) => Number(question.id) === questionId);
            if (!exists) return json(403, { error: "這題不屬於指定的小關卡" });
            const now = new Date().toISOString();
            const { error } = await admin.from("speaking_challenge_question_progress").upsert({
                student_id: user.id, question_set_id: setId, question_id: questionId, status: "completed", opened_at: now, completed_at: now, updated_at: now
            }, { onConflict: "student_id,question_id" });
            if (error) throw error;
            return json(200, { success: true, question_id: questionId, status: "completed" });
        }
        return json(400, { error: "不支援的操作" });
    } catch (error: any) {
        return json(Number(error?.status) || 500, { error: error?.message || "口說大挑戰服務發生錯誤", code: error?.code || null });
    }
});
