import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { cleanText, verifyFirebaseRequest } from "../_shared/firebase-auth.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, payload: Record<string, unknown>) => new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
});
const AI_MODEL = "gpt-5-mini";

const extractOutputText = (data: any) => {
    if (typeof data?.output_text === "string") return data.output_text.trim();
    return (Array.isArray(data?.output) ? data.output : [])
        .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
        .map((item: any) => item?.text || item?.value || "")
        .join("")
        .trim();
};

const cleanArray = (value: unknown, maxItems: number, maxLength: number) => Array.from(new Set(
    (Array.isArray(value) ? value : []).map(item => cleanText(item, maxLength)).filter(Boolean)
)).slice(0, maxItems);

const normalizeQuestions = (value: unknown, expectedCount: number) => {
    const rows = Array.isArray(value) ? value : [];
    const questions = rows.map((row: any) => ({
        question_text: cleanText(row?.question_text, 800),
        hint_zh: cleanText(row?.hint_zh, 1200),
        keywords: cleanArray(row?.keywords, 8, 80),
        simple_answer: cleanText(row?.simple_answer, 1000),
        model_answer: cleanText(row?.model_answer, 2000),
        follow_up_question: cleanText(row?.follow_up_question, 800) || null,
        pronunciation_notes_zh: cleanText(row?.pronunciation_notes_zh, 1200) || null,
        accepted_intents: cleanArray(row?.accepted_intents, 8, 300)
    })).filter(row => (
        row.question_text
        && row.hint_zh
        && row.simple_answer
        && row.model_answer
        && row.keywords.length > 0
    ));
    return questions.length === expectedCount ? questions : null;
};

const assertEditor = (user: any) => {
    if (user.role !== "admin") {
        throw Object.assign(new Error("只有管理員可以管理教材口說題庫"), { status: 403 });
    }
};

const loadBootstrap = async (admin: any) => {
    const [bookRes, documentRes, sectionRes, setRes] = await Promise.all([
        admin.from("books").select("id,name,code,enabled").eq("enabled", true).order("name"),
        admin.from("speaking_source_documents").select("id,book_id,title,source_kind,status,created_at,updated_at").neq("status", "archived").order("updated_at", { ascending: false }),
        admin.from("speaking_source_sections").select("id,document_id,unit_label,page_from_label,page_to_label,topic,language_level,status,version,reviewed_at,updated_at").neq("status", "archived").order("updated_at", { ascending: false }),
        admin.from("speaking_question_sets").select("id,source_section_id,book_id,title,topic,difficulty,status,version,published_at,updated_at,speaking_questions(id,question_text,hint_zh,keywords,simple_answer,model_answer,follow_up_question,pronunciation_notes_zh,accepted_intents,sort_order)").neq("status", "archived").order("updated_at", { ascending: false })
    ]);
    const error = bookRes.error || documentRes.error || sectionRes.error || setRes.error;
    if (error) throw error;
    return {
        books: bookRes.data || [], documents: documentRes.data || [],
        sections: sectionRes.data || [], question_sets: setRes.data || []
    };
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
        assertEditor(user);
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action, 80);

        if (action === "bootstrap") return json(200, { success: true, ...await loadBootstrap(admin) });

        if (action === "save_reviewed_source") {
            const bookId = Number(body?.book_id);
            const documentTitle = cleanText(body?.document_title, 200);
            const topic = cleanText(body?.topic, 200);
            const sourceText = String(body?.source_text || "").trim().slice(0, 30000);
            const languageLevel = cleanText(body?.language_level, 80) || "國小中年級";
            if (!Number.isInteger(bookId) || bookId <= 0 || !documentTitle || !topic || sourceText.length < 20 || body?.confirmed !== true) {
                return json(400, { error: "請選擇教材、填寫來源資訊，並確認這段教材文字已經人工核對" });
            }
            const { data: book, error: bookError } = await admin.from("books").select("id").eq("id", bookId).eq("enabled", true).maybeSingle();
            if (bookError) throw bookError;
            if (!book) return json(404, { error: "找不到可用教材" });
            const now = new Date().toISOString();
            const { data: document, error: documentError } = await admin.from("speaking_source_documents").insert({
                book_id: bookId, title: documentTitle, source_kind: "pasted_text", status: "ready",
                created_by: user.id, created_at: now, updated_at: now
            }).select("id").single();
            if (documentError) throw documentError;
            const { data: section, error: sectionError } = await admin.from("speaking_source_sections").insert({
                document_id: document.id,
                unit_label: cleanText(body?.unit_label, 80) || null,
                page_from_label: cleanText(body?.page_from_label, 80) || null,
                page_to_label: cleanText(body?.page_to_label, 80) || null,
                topic, source_text: sourceText, language_level: languageLevel, status: "reviewed",
                created_by: user.id, reviewed_by: user.id, reviewed_at: now, created_at: now, updated_at: now
            }).select("id").single();
            if (sectionError) {
                await admin.from("speaking_source_documents").delete().eq("id", document.id);
                throw sectionError;
            }
            return json(201, { success: true, document_id: document.id, source_section_id: section.id });
        }

        if (action === "generate_question_set") {
            const sourceSectionId = Number(body?.source_section_id);
            const questionCount = Math.min(12, Math.max(3, Number(body?.question_count) || 5));
            const requestKey = cleanText(body?.request_key, 80);
            if (!Number.isInteger(sourceSectionId) || sourceSectionId <= 0 || !/^[0-9a-f-]{36}$/i.test(requestKey)) {
                return json(400, { error: "題庫生成資料不完整" });
            }
            const { data: existingJob, error: existingError } = await admin.from("speaking_generation_jobs")
                .select("status,question_set_id").eq("request_key", requestKey).maybeSingle();
            if (existingError) throw existingError;
            if (existingJob?.status === "completed" && existingJob.question_set_id) {
                return json(200, { success: true, question_set_id: existingJob.question_set_id, reused: true });
            }
            if (existingJob) return json(409, { error: "這次生成正在處理或先前失敗，請重新按一次產生", code: "generation_request_exists" });
            const { data: section, error: sectionError } = await admin.from("speaking_source_sections")
                .select("id,document_id,unit_label,page_from_label,page_to_label,topic,source_text,language_level,status,speaking_source_documents(book_id,title)")
                .eq("id", sourceSectionId).maybeSingle();
            if (sectionError) throw sectionError;
            if (!section || section.status !== "reviewed") return json(400, { error: "只有管理員確認過的教材文字可以交給 AI 出題" });
            const document = Array.isArray(section.speaking_source_documents) ? section.speaking_source_documents[0] : section.speaking_source_documents;
            const bookId = Number(document?.book_id);
            if (!bookId) return json(400, { error: "教材來源缺少書籍關聯" });
            const now = new Date().toISOString();
            const { data: job, error: jobError } = await admin.from("speaking_generation_jobs").insert({
                source_section_id: sourceSectionId, requested_by: user.id, request_key: requestKey,
                requested_count: questionCount, status: "processing", model: AI_MODEL, created_at: now
            }).select("id").single();
            if (jobError) throw jobError;
            const openaiKey = Deno.env.get("OPENAI_API_KEY");
            if (!openaiKey) {
                await admin.from("speaking_generation_jobs").update({ status: "failed", error_code: "service_not_configured", completed_at: now }).eq("id", job.id);
                return json(503, { error: "AI 題庫服務尚未設定", code: "service_not_configured" });
            }
            const sourceText = String(section.source_text || "").slice(0, 18000);
            const prompt = `你是 Alan English 的兒童英語口說教材編輯。只能根據下方老師已核准的教材文字，產生 ${questionCount} 題口說練習草稿。\n\n教材主題：${section.topic}\n程度：${section.language_level}\n單元：${section.unit_label || "未標示"}\n頁碼：${section.page_from_label || "未標示"} 至 ${section.page_to_label || section.page_from_label || "未標示"}\n\n核准教材文字：\n${sourceText}\n\n規則：\n1. 問題必須能從教材主題、句型或情境合理延伸，不得補充教材沒有根據的專有知識。\n2. 內容適合台灣國小學生，不包含個資、成人、危險或不適齡主題。\n3. 每題提供繁體中文提示、1 個簡易回答、1 個完整自然回答、1 個延伸問題。\n4. keywords 為 1 至 5 個英文關鍵字；accepted_intents 為可接受的回答意思摘要，不是逐字答案。\n5. pronunciation_notes_zh 用繁體中文標示重要重音、尾音或連音，無特別需要可為空字串。\n6. 只輸出 JSON，不要 markdown。\nJSON：{"title":"題庫名稱","questions":[{"question_text":"","hint_zh":"","keywords":[""],"simple_answer":"","model_answer":"","follow_up_question":"","pronunciation_notes_zh":"","accepted_intents":[""]}]}`;
            let aiResponse: Response;
            try {
                aiResponse = await fetch("https://api.openai.com/v1/responses", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ model: AI_MODEL, input: prompt, max_output_tokens: 5000 })
                });
            } catch {
                await admin.from("speaking_generation_jobs").update({ status: "failed", error_code: "network_error", completed_at: new Date().toISOString() }).eq("id", job.id);
                return json(502, { error: "AI 連線暫時失敗，請稍後再試" });
            }
            const aiData = await aiResponse.json().catch(() => ({}));
            const usage = aiData?.usage || {};
            if (!aiResponse.ok) {
                await admin.from("speaking_generation_jobs").update({ status: "failed", error_code: cleanText(aiData?.error?.code, 120) || `http_${aiResponse.status}`, input_tokens: Number(usage.input_tokens || 0), output_tokens: Number(usage.output_tokens || 0), total_tokens: Number(usage.total_tokens || 0), completed_at: new Date().toISOString() }).eq("id", job.id);
                return json(502, { error: "AI 目前無法產生題庫，請稍後再試" });
            }
            let generated: any = null;
            try {
                generated = JSON.parse(extractOutputText(aiData).replace(/^```json\s*|\s*```$/g, ""));
            } catch {
                generated = null;
            }
            const questions = normalizeQuestions(generated?.questions, questionCount);
            if (!questions) {
                await admin.from("speaking_generation_jobs").update({ status: "failed", error_code: "invalid_output", input_tokens: Number(usage.input_tokens || 0), output_tokens: Number(usage.output_tokens || 0), total_tokens: Number(usage.total_tokens || 0), completed_at: new Date().toISOString() }).eq("id", job.id);
                return json(502, { error: "AI 回傳的口說題庫格式不完整，請重新產生" });
            }
            const { data: latest } = await admin.from("speaking_question_sets").select("id,version").eq("source_section_id", sourceSectionId).order("version", { ascending: false }).limit(1).maybeSingle();
            const { data: questionSet, error: setError } = await admin.from("speaking_question_sets").insert({
                source_section_id: sourceSectionId, book_id: bookId,
                title: cleanText(generated?.title, 200) || `${section.topic} 口說練習`,
                topic: section.topic, difficulty: section.language_level, status: "draft",
                version: Number(latest?.version || 0) + 1, previous_set_id: latest?.id || null,
                generation_metadata: { model: String(aiData?.model || AI_MODEL), source_characters: sourceText.length, request_key: requestKey },
                created_by: user.id, created_at: now, updated_at: now
            }).select("id").single();
            if (setError) {
                await admin.from("speaking_generation_jobs").update({
                    status: "failed", error_code: "question_set_insert_failed", completed_at: new Date().toISOString()
                }).eq("id", job.id);
                throw setError;
            }
            const { error: questionError } = await admin.from("speaking_questions").insert(questions.map((question, index) => ({
                question_set_id: questionSet.id, ...question, sort_order: index, created_at: now, updated_at: now
            })));
            if (questionError) {
                await admin.from("speaking_question_sets").delete().eq("id", questionSet.id);
                await admin.from("speaking_generation_jobs").update({
                    status: "failed", error_code: "question_insert_failed", completed_at: new Date().toISOString()
                }).eq("id", job.id);
                throw questionError;
            }
            await admin.from("speaking_generation_jobs").update({
                status: "completed", question_set_id: questionSet.id,
                input_tokens: Number(usage.input_tokens || 0), output_tokens: Number(usage.output_tokens || 0),
                total_tokens: Number(usage.total_tokens || 0), completed_at: new Date().toISOString()
            }).eq("id", job.id);
            return json(201, { success: true, question_set_id: questionSet.id, question_count: questions.length });
        }

        if (action === "update_draft_question") {
            const questionId = Number(body?.question_id);
            const { data: question, error: questionError } = await admin.from("speaking_questions")
                .select("id,question_set_id,speaking_question_sets(status)").eq("id", questionId).maybeSingle();
            if (questionError) throw questionError;
            const setStatus = Array.isArray(question?.speaking_question_sets) ? question.speaking_question_sets[0]?.status : question?.speaking_question_sets?.status;
            if (!question || setStatus !== "draft") return json(409, { error: "只有草稿題庫可以修改" });
            const normalized = normalizeQuestions([body?.question], 1)?.[0];
            if (!normalized) return json(400, { error: "問題、提示、關鍵字與兩種示範回答都必須完整" });
            const { error } = await admin.from("speaking_questions").update({ ...normalized, updated_at: new Date().toISOString() }).eq("id", questionId);
            if (error) throw error;
            return json(200, { success: true });
        }

        if (action === "publish_question_set") {
            const setId = Number(body?.question_set_id);
            const { data: questionSet, error: setError } = await admin.from("speaking_question_sets")
                .select("id,status,speaking_questions(id)").eq("id", setId).maybeSingle();
            if (setError) throw setError;
            if (!questionSet || questionSet.status !== "draft" || (questionSet.speaking_questions || []).length < 3) {
                return json(409, { error: "題庫必須是草稿且至少包含 3 題才能發布" });
            }
            const now = new Date().toISOString();
            const { error } = await admin.from("speaking_question_sets").update({ status: "published", reviewed_by: user.id, published_at: now, updated_at: now }).eq("id", setId).eq("status", "draft");
            if (error) throw error;
            return json(200, { success: true, published_at: now });
        }

        return json(400, { error: "不支援的操作" });
    } catch (error) {
        const status = Number((error as any)?.status || 500);
        console.error("speaking-content-manager error", status, (error as any)?.code || "unknown");
        return json(status, { error: status < 500 ? String((error as any)?.message || "請求失敗") : "教材口說題庫服務發生錯誤" });
    }
});
