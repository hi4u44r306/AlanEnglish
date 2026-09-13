import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { assertBookEntitled, isBookEntitled, relationOne } from "../_shared/book-entitlement.ts";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";
import { cleanText, verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { createR2PresignedUrl } from "../_shared/r2.ts";
import { toPublicErrorResponse } from "../_shared/public-error.ts";
import { matchesFoundationAnswer, readFoundationInteractionType } from "../_shared/speaking-foundation-answer.ts";
import { authorizeSpeakingChallenge, buildPublicSpeakingQuestion } from "../_shared/speaking-challenge-view.ts";
import {
    ALPHABET_SEQUENCE_ASSEMBLER_VERSION,
    ALPHABET_SEQUENCE_GAP_MS,
    alphabetAudioSequenceValid,
    alphabetSourceFingerprint
} from "../_shared/alphabet-audio-sequence.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, payload: Record<string, unknown>) => new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
});

const secureShuffle = <T>(items: T[]) => {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
        const random = new Uint32Array(1);
        crypto.getRandomValues(random);
        const swapIndex = random[0] % (index + 1);
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
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
        const { demoMode, effectiveAccess } = await authorizeSpeakingChallenge(
            user,
            studentId => loadEffectiveAccess(admin, studentId)
        );
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action, 40);

        if (action === "catalog") {
            const { data: sets, error } = await admin.from("speaking_question_sets")
                .select("id,book_id,title,topic,difficulty,intro_zh,learning_goal_zh,version,generation_metadata,published_at,books(id,name,code,content_scope,enabled,archived_at),speaking_questions(id,sort_order)")
                .eq("status", "published").order("published_at", { ascending: true });
            if (error) throw error;
            const entitlementByBook = new Map<number, boolean>();
            const visibleSets = [];
            for (const set of (sets || [])) {
                const bookId = Number(set.book_id);
                if (!entitlementByBook.has(bookId)) {
                    entitlementByBook.set(bookId, demoMode || await isBookEntitled(admin, user, effectiveAccess, relationOne(set.books)));
                }
                if (entitlementByBook.get(bookId)) visibleSets.push(set);
            }
            const questionIds = visibleSets.flatMap((set: any) => (set.speaking_questions || []).map((question: any) => Number(question.id)));
            const { data: progress, error: progressError } = questionIds.length && !demoMode
                ? await admin.from("speaking_challenge_question_progress").select("question_id,status").eq("student_id", user.id).in("question_id", questionIds)
                : { data: [], error: null };
            if (progressError) throw progressError;
            const completed = new Set((progress || []).filter((row: any) => row.status === "completed").map((row: any) => Number(row.question_id)));
            return json(200, { success: true, demo_mode: demoMode, challenges: visibleSets.map((set: any) => ({
                id: set.id, book: set.books, title: set.title, topic: set.topic, difficulty: set.difficulty,
                intro_zh: set.intro_zh, learning_goal_zh: set.learning_goal_zh,
                version: set.version, generation_metadata: set.generation_metadata || {},
                question_count: (set.speaking_questions || []).length,
                completed_count: (set.speaking_questions || []).filter((question: any) => completed.has(Number(question.id))).length
            })) });
        }

        const setId = Number(body?.question_set_id);
        if (!Number.isInteger(setId) || setId <= 0) return json(400, { error: "找不到口說小關卡" });
        const { data: questionSetRecord, error: setError } = await admin.from("speaking_question_sets")
            .select("id,book_id,title,topic,difficulty,intro_zh,learning_goal_zh,version,generation_metadata,books(id,name,code,content_scope,enabled,archived_at)")
            .eq("id", setId).eq("status", "published").maybeSingle();
        if (setError) throw setError;
        if (!questionSetRecord) return json(404, { error: "找不到已發布的口說小關卡" });
        await assertBookEntitled(admin, user, effectiveAccess, relationOne(questionSetRecord.books));
        const { data: setQuestions, error: questionError } = await admin.from("speaking_questions")
            .select("id,question_text,hint_zh,keywords,simple_answer,model_answer,follow_up_question,pronunciation_notes_zh,visual_aid,sort_order")
            .eq("question_set_id", setId).order("sort_order", { ascending: true });
        if (questionError) throw questionError;
        const questionSet = { ...questionSetRecord, speaking_questions: setQuestions || [] };

        if (action === "question_set") {
            const ids = (questionSet.speaking_questions || []).map((question: any) => Number(question.id));
            const interactionType = readFoundationInteractionType(questionSet.generation_metadata);
            const alphabetMode = interactionType === "alphabet_round";
            const pictureMode = interactionType === "picture_qa" || interactionType === "picture_gap_sentence";
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
                ? await admin.from("speaking_tts_assets").select("id,status,private_object_key,content_hash,byte_size").in("id", assetIds)
                : { data: [], error: null };
            if (assetError) throw assetError;
            const assetById = new Map((assets || []).map((row: any) => [String(row.id), row]));
            const assetByQuestionPurpose = new Map((audioLinks || []).map((row: any) => [
                `${Number(row.question_id)}:${row.purpose}`,
                assetById.get(String(row.asset_id))
            ]));
            const [{ data: pictureInteractions, error: pictureInteractionError }, { data: visualLinks, error: visualLinkError }, { data: wordAudioLinks, error: wordAudioError }] = pictureMode && ids.length
                ? await Promise.all([
                    admin.from("speaking_question_interactions")
                        .select("question_id,interaction_type,prompt_text").in("question_id", ids),
                    admin.from("speaking_question_visual_assets")
                        .select("question_id,speaking_visual_assets!inner(id,status,private_object_key,mime_type,alt_zh)").in("question_id", ids),
                    interactionType === "picture_gap_sentence"
                        ? admin.from("speaking_question_word_audio")
                            .select("question_id,token_index,word,speaking_tts_assets!inner(id,status,private_object_key)")
                            .in("question_id", ids).order("token_index")
                        : Promise.resolve({ data: [], error: null })
                ])
                : [
                    { data: [], error: null },
                    { data: [], error: null },
                    { data: [], error: null }
                ];
            if (pictureInteractionError) throw pictureInteractionError;
            if (visualLinkError) throw visualLinkError;
            if (wordAudioError) throw wordAudioError;
            const pictureInteractionByQuestion = new Map((pictureInteractions || [])
                .map((row: any) => [Number(row.question_id), row]));
            const visualByQuestion = new Map((visualLinks || []).map((row: any) => [
                Number(row.question_id),
                Array.isArray(row.speaking_visual_assets) ? row.speaking_visual_assets[0] : row.speaking_visual_assets
            ]));
            const wordsByQuestion = new Map<number, any[]>();
            for (const row of (wordAudioLinks || [])) {
                const asset = Array.isArray(row.speaking_tts_assets) ? row.speaking_tts_assets[0] : row.speaking_tts_assets;
                wordsByQuestion.set(Number(row.question_id), [
                    ...(wordsByQuestion.get(Number(row.question_id)) || []),
                    { ...row, asset }
                ]);
            }
            let alphabetAudio = null;
            if (alphabetMode) {
                const orderedQuestions = [...(questionSet.speaking_questions || [])]
                    .sort((left: any, right: any) => Number(left.sort_order) - Number(right.sort_order));
                const sourceRecords = orderedQuestions.map((question: any) => {
                    const asset: any = assetByQuestionPurpose.get(`${Number(question.id)}:model_answer`);
                    return {
                        questionId: Number(question.id),
                        letter: String(question.model_answer || "").trim().toUpperCase(),
                        assetId: String(asset?.id || ""),
                        contentHash: String(asset?.content_hash || ""),
                        byteSize: Number(asset?.byte_size || 0)
                    };
                });
                const sourceFingerprint = await alphabetSourceFingerprint(sourceRecords, ALPHABET_SEQUENCE_GAP_MS);
                const { data: sequence, error: sequenceError } = await admin.from("speaking_question_set_audio_sequences")
                    .select("question_set_version,source_fingerprint,assembler_version,status,private_object_key,mime_type,byte_size,duration_ms,segments")
                    .eq("question_set_id", Number(questionSet.id)).eq("purpose", "alphabet_master").maybeSingle();
                if (sequenceError) throw sequenceError;
                const validSequence = Number(sequence?.question_set_version) === Number(questionSet.version)
                    && sequence?.source_fingerprint === sourceFingerprint
                    && sequence?.assembler_version === ALPHABET_SEQUENCE_ASSEMBLER_VERSION
                    && sequence?.mime_type === "audio/wav"
                    && alphabetAudioSequenceValid(orderedQuestions, sequence);
                if (!validSequence) {
                    return json(409, {
                        error: "A–Z 的單一慢速音檔尚未完成或已過期",
                        code: "alphabet_master_not_ready"
                    });
                }
                alphabetAudio = {
                    audio_url: await createR2PresignedUrl(sequence.private_object_key, "GET", 15 * 60),
                    duration_ms: Number(sequence.duration_ms),
                    segments: sequence.segments.map((segment: any) => ({
                        question_id: Number(segment.question_id),
                        start_ms: Number(segment.start_ms),
                        end_ms: Number(segment.end_ms)
                    }))
                };
            }
            const questions = [];
            for (const question of (questionSet.speaking_questions || []).sort((a: any, b: any) => a.sort_order - b.sort_order)) {
                const modelAsset: any = assetByQuestionPurpose.get(`${Number(question.id)}:model_answer`);
                const promptAsset: any = assetByQuestionPurpose.get(`${Number(question.id)}:question_prompt`);
                const pictureInteraction: any = pictureInteractionByQuestion.get(Number(question.id));
                const visualAsset: any = visualByQuestion.get(Number(question.id));
                questions.push(await buildPublicSpeakingQuestion({
                    question,
                    interactionType,
                    progressStatus: statusByQuestion.get(Number(question.id)),
                    modelAsset,
                    promptAsset,
                    pictureInteraction,
                    visualAsset,
                    wordAudioRows: wordsByQuestion.get(Number(question.id)) || [],
                    signPrivateObject: (privateObjectKey: string) => (
                        createR2PresignedUrl(privateObjectKey, "GET", 15 * 60)
                    )
                }));
            }
            return json(200, {
                success: true,
                demo_mode: demoMode,
                challenge: { ...questionSet, speaking_questions: questions, alphabet_audio: alphabetAudio }
            });
        }

        if (action === "start_foundation_round") {
            if (demoMode) return json(403, { error: "示範模式不會建立學生挑戰回合", code: "demo_read_only" });
            const interactionType = readFoundationInteractionType(questionSet.generation_metadata);
            if (interactionType !== "alphabet_round") {
                return json(409, { error: "這個小關卡不使用整輪挑戰", code: "foundation_round_not_supported" });
            }
            const canonicalQuestions = (questionSet.speaking_questions || []).filter((question: any) => (
                /^[A-Z]$/i.test(String(question.model_answer || "").trim())
            ));
            const canonicalLetters = new Set(canonicalQuestions.map((question: any) => String(question.model_answer).trim().toUpperCase()));
            if (canonicalQuestions.length !== 26 || canonicalLetters.size !== 26) {
                return json(409, { error: "A–Z 題庫尚未完整核准", code: "foundation_round_incomplete" });
            }
            const shuffled = secureShuffle(canonicalQuestions);
            const questionOrder = shuffled.map((question: any) => Number(question.id));
            const { data: round, error: roundError } = await admin.rpc("start_speaking_foundation_round_v1", {
                p_student_id: Number(user.id),
                p_question_set_id: setId,
                p_question_set_version: Number(questionSet.version),
                p_question_order: questionOrder
            });
            if (roundError) throw roundError;
            if (round?.status === "busy") {
                return json(409, {
                    error: "上一題正在評分，請稍候再開始新回合",
                    code: "foundation_round_busy",
                    retry_after_seconds: Number(round.retry_after_seconds || 1)
                });
            }
            if (!round?.round_id || !Array.isArray(round?.question_order) || round.question_order.length !== 26) {
                return json(409, { error: "A–Z 挑戰回合尚未準備完成", code: "foundation_round_invalid" });
            }
            const randomCases = new Uint32Array(26);
            crypto.getRandomValues(randomCases);
            return json(200, {
                success: true,
                round: {
                    round_id: round.round_id,
                    expires_at: round.expires_at,
                    questions: shuffled.map((question: any, index: number) => {
                        const letter = String(question.model_answer).trim().toUpperCase();
                        return {
                            question_id: Number(question.id),
                            display_text: randomCases[index] % 2 === 0 ? letter : letter.toLowerCase()
                        };
                    })
                }
            });
        }

        if (action === "complete_question") {
            if (demoMode) return json(403, { error: "示範模式不會寫入學生進度", code: "demo_read_only" });
            const questionId = Number(body?.question_id);
            const question = (questionSet.speaking_questions || []).find((item: any) => Number(item.id) === questionId);
            if (!question) return json(403, { error: "這題不屬於指定的小關卡" });
            const interactionType = readFoundationInteractionType(questionSet.generation_metadata);
            if (interactionType === "alphabet_round") {
                return json(409, { error: "A–Z 必須完成同一個連續挑戰回合", code: "foundation_round_required" });
            }
            if (interactionType) {
                const pictureMode = interactionType === "picture_qa" || interactionType === "picture_gap_sentence";
                const { data: pictureInteraction, error: pictureError } = pictureMode
                    ? await admin.from("speaking_question_interactions")
                        .select("interaction_type,prompt_text,answer_text,accepted_full_responses")
                        .eq("question_id", questionId).maybeSingle()
                    : { data: null, error: null };
                if (pictureError) throw pictureError;
                if (pictureMode && pictureInteraction?.interaction_type !== interactionType) {
                    return json(409, { error: "這題的圖片口說內容尚未完成核准", code: "picture_interaction_missing" });
                }
                const expectedAnswer = pictureMode
                    ? interactionType === "picture_qa"
                        ? `${pictureInteraction.prompt_text} ${pictureInteraction.answer_text}`
                        : pictureInteraction.answer_text
                    : question.model_answer;
                const acceptedAnswers = pictureMode && Array.isArray(pictureInteraction?.accepted_full_responses)
                    ? pictureInteraction.accepted_full_responses
                    : [];
                const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
                const { data: attempt, error: attemptError } = await admin.from("speaking_pronunciation_attempts")
                    .select("recognized_text,created_at").eq("student_id", Number(user.id))
                    .eq("question_set_id", setId).eq("question_id", questionId)
                    .gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
                if (attemptError) throw attemptError;
                if (!attempt || !matchesFoundationAnswer(interactionType, expectedAnswer, attempt.recognized_text, acceptedAnswers)) {
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
        const publicError = toPublicErrorResponse(error, "口說大挑戰服務發生錯誤");
        if (publicError.status >= 500) {
            console.error("speaking-challenge internal failure", {
                name: typeof error?.name === "string" ? error.name : "Error",
                code: typeof error?.code === "string" ? error.code : null
            });
        }
        return json(publicError.status, publicError.payload);
    }
});
