import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { assertBookEntitled, isBookEntitled, relationOne } from "../_shared/book-entitlement.ts";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";
import { cleanText, verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { createR2PresignedUrl } from "../_shared/r2.ts";
import { toPublicErrorResponse } from "../_shared/public-error.ts";
import { readFoundationInteractionType } from "../_shared/speaking-foundation-answer.ts";
import { authorizeSpeakingChallenge, buildPublicSpeakingQuestion } from "../_shared/speaking-challenge-view.ts";
import {
    ALPHABET_SEQUENCE_ASSEMBLER_VERSION,
    ALPHABET_SEQUENCE_GAP_MS,
    alphabetAudioSequenceValid,
    alphabetSourceFingerprint
} from "../_shared/alphabet-audio-sequence.ts";
import { DEFAULT_FEMALE_VOICE_ID } from "../_shared/speaking-voice-assignment.ts";
import {
    alphabetCandidateSequenceAllowed
} from "../_shared/alphabet-master-voice.ts";
import {
    sortSpeakingChallengeSets,
    speakingChallengeUnlockState
} from "../_shared/speaking-challenge-progression.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, payload: Record<string, unknown>) => new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
});
const SPEAKING_CHALLENGE_REWARD_POLICY = Object.freeze({
    xp: 30,
    ae_points: 3,
    basis: "first_completion_per_challenge",
    ae_points_eligible_students_only: true
});
const SPEAKING_CHALLENGE_DAILY_LIMIT = 5;
const SPEAKING_RECORDING_LIMIT_SECONDS = 12;
const taipeiActivityDate = () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

const speakingChallengePolicy = async (admin: any, studentId: number, demoMode: boolean) => {
    if (demoMode) return {
        daily_limit: SPEAKING_CHALLENGE_DAILY_LIMIT,
        daily_used: null,
        daily_remaining: null,
        recording_limit_seconds: SPEAKING_RECORDING_LIMIT_SECONDS,
        reset_timezone: "Asia/Taipei"
    };
    const { count, error } = await admin.from("speaking_challenge_sessions")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId)
        .eq("activity_date", taipeiActivityDate());
    if (error) throw error;
    const used = Math.max(0, Number(count) || 0);
    return {
        daily_limit: SPEAKING_CHALLENGE_DAILY_LIMIT,
        daily_used: used,
        daily_remaining: Math.max(SPEAKING_CHALLENGE_DAILY_LIMIT - used, 0),
        recording_limit_seconds: SPEAKING_RECORDING_LIMIT_SECONDS,
        reset_timezone: "Asia/Taipei"
    };
};
const alphabetFemaleVoiceId = () => cleanText(Deno.env.get("GOOGLE_CLOUD_TTS_FEMALE_VOICE_NAME"), 120)
    || cleanText(Deno.env.get("GOOGLE_CLOUD_TTS_VOICE_NAME"), 120)
    || DEFAULT_FEMALE_VOICE_ID;

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

const challengeProgress = async (admin: any, studentId: number, sets: any[]) => {
    const questionIds = sets.flatMap(set => (set.speaking_questions || []).map((question: any) => Number(question.id)));
    if (!questionIds.length) return new Set<number>();
    const { data, error } = await admin.from("speaking_challenge_question_progress")
        .select("question_id,status").eq("student_id", studentId).in("question_id", questionIds);
    if (error) throw error;
    return new Set((data || []).filter((row: any) => row.status === "completed").map((row: any) => Number(row.question_id)));
};

const assertStudentChallengeUnlocked = async (admin: any, studentId: number, questionSet: any) => {
    const { data: sets, error } = await admin.from("speaking_question_sets")
        .select("id,title,generation_metadata,speaking_questions(id)")
        .eq("book_id", Number(questionSet.book_id)).eq("status", "published");
    if (error) throw error;
    const orderedSets = sortSpeakingChallengeSets(sets || []);
    const progress = await challengeProgress(admin, studentId, orderedSets);
    const state = speakingChallengeUnlockState(orderedSets, progress)
        .find(item => item.id === Number(questionSet.id));
    if (!state?.is_unlocked) {
        throw Object.assign(new Error("請先完成前一關，再繼續下一關"), {
            status: 403,
            code: "speaking_challenge_locked"
        });
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
        const { demoMode, effectiveAccess } = await authorizeSpeakingChallenge(
            user,
            studentId => loadEffectiveAccess(admin, studentId)
        );
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action, 40);

        if (action === "catalog") {
            const { data: sets, error } = await admin.from("speaking_question_sets")
                .select("id,book_id,title,topic,difficulty,intro_zh,learning_goal_zh,version,generation_metadata,published_at,books(id,name,code,content_scope,enabled,archived_at),speaking_questions(id,sort_order)")
                .eq("status", "published");
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
            const completed = demoMode ? new Set<number>() : await challengeProgress(admin, Number(user.id), visibleSets);
            const stateBySet = new Map<number, any>();
            const setsByBook = new Map<string, any[]>();
            for (const set of visibleSets) {
                const bookKey = String(set.book_id);
                setsByBook.set(bookKey, [...(setsByBook.get(bookKey) || []), set]);
            }
            for (const bookSets of setsByBook.values()) {
                for (const state of speakingChallengeUnlockState(bookSets, completed)) stateBySet.set(state.id, state);
            }
            const orderedSets = [...visibleSets].sort((left: any, right: any) => {
                const leftBook = String(left.books?.name || "");
                const rightBook = String(right.books?.name || "");
                return leftBook.localeCompare(rightBook, "zh-Hant")
                    || Number(stateBySet.get(Number(left.id))?.sequence_order || 0) - Number(stateBySet.get(Number(right.id))?.sequence_order || 0)
                    || Number(stateBySet.get(Number(left.id))?.source_pages?.at(-1) || 0) - Number(stateBySet.get(Number(right.id))?.source_pages?.at(-1) || 0)
                    || Number(left.id) - Number(right.id);
            });
            const challengePolicy = await speakingChallengePolicy(admin, Number(user.id), demoMode);
            return json(200, { success: true, demo_mode: demoMode, reward_policy: SPEAKING_CHALLENGE_REWARD_POLICY, challenge_policy: challengePolicy, challenges: orderedSets.map((set: any) => ({
                id: set.id, book: set.books, title: set.title, topic: set.topic, difficulty: set.difficulty,
                intro_zh: set.intro_zh, learning_goal_zh: set.learning_goal_zh,
                version: set.version, generation_metadata: set.generation_metadata || {},
                question_count: (set.speaking_questions || []).length,
                completed_count: (set.speaking_questions || []).filter((question: any) => completed.has(Number(question.id))).length,
                catalog_section: String(stateBySet.get(Number(set.id))?.catalog_section || "textbook"),
                source_pages: stateBySet.get(Number(set.id))?.source_pages || [],
                sequence_order: Number(stateBySet.get(Number(set.id))?.sequence_order || 0),
                is_completed: demoMode ? false : Boolean(stateBySet.get(Number(set.id))?.is_completed),
                is_unlocked: demoMode || Boolean(stateBySet.get(Number(set.id))?.is_unlocked)
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
        if (!demoMode) await assertStudentChallengeUnlocked(admin, Number(user.id), questionSetRecord);
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
            const [{ data: pictureInteractions, error: pictureInteractionError }, { data: visualLinks, error: visualLinkError }] = pictureMode && ids.length
                ? await Promise.all([
                    admin.from("speaking_question_interactions")
                        .select("question_id,interaction_type,prompt_text").in("question_id", ids),
                    admin.from("speaking_question_visual_assets")
                        .select("question_id,speaking_visual_assets!inner(id,status,private_object_key,mime_type,alt_zh)").in("question_id", ids)
                ])
                : [
                    { data: [], error: null },
                    { data: [], error: null }
                ];
            if (pictureInteractionError) throw pictureInteractionError;
            if (visualLinkError) throw visualLinkError;
            const pictureInteractionByQuestion = new Map((pictureInteractions || [])
                .map((row: any) => [Number(row.question_id), row]));
            const visualByQuestion = new Map((visualLinks || []).map((row: any) => [
                Number(row.question_id),
                Array.isArray(row.speaking_visual_assets) ? row.speaking_visual_assets[0] : row.speaking_visual_assets
            ]));
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
                const legacySequence = sequence?.assembler_version === ALPHABET_SEQUENCE_ASSEMBLER_VERSION
                    && sequence?.source_fingerprint === sourceFingerprint
                    && sequence?.segments?.every((segment: any) => segment?.voice_id === alphabetFemaleVoiceId());
                const singleSequence = alphabetCandidateSequenceAllowed(sequence?.assembler_version, sequence?.segments);
                const validSequence = Number(sequence?.question_set_version) === Number(questionSet.version)
                    && (legacySequence || singleSequence)
                    && sequence?.mime_type === "audio/wav"
                    && Array.isArray(sequence?.segments)
                    && alphabetAudioSequenceValid(orderedQuestions, sequence);
                if (!validSequence) {
                    return json(409, {
                        error: "A–Z 的單一慢速音檔尚未完成或已過期",
                        code: "alphabet_master_not_ready"
                    });
                }
                const { data: introListen, error: introListenError } = !demoMode
                    ? await admin.from("speaking_alphabet_intro_listens")
                        .select("completed_at")
                        .eq("student_id", Number(user.id))
                        .eq("question_set_id", Number(questionSet.id))
                        .eq("question_set_version", Number(questionSet.version))
                        .eq("sequence_fingerprint", String(sequence.source_fingerprint))
                        .not("completed_at", "is", null)
                        .maybeSingle()
                    : { data: null, error: null };
                if (introListenError) throw introListenError;
                alphabetAudio = {
                    audio_url: await createR2PresignedUrl(sequence.private_object_key, "GET", 15 * 60),
                    duration_ms: Number(sequence.duration_ms),
                    intro_listen_completed: Boolean(introListen?.completed_at),
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
                    signPrivateObject: (privateObjectKey: string) => (
                        createR2PresignedUrl(privateObjectKey, "GET", 15 * 60)
                    )
                }));
            }
            const challengePolicy = await speakingChallengePolicy(admin, Number(user.id), demoMode);
            return json(200, {
                success: true,
                demo_mode: demoMode,
                challenge_policy: challengePolicy,
                challenge: { ...questionSet, speaking_questions: questions, alphabet_audio: alphabetAudio }
            });
        }

        if (["start_alphabet_intro_listen", "complete_alphabet_intro_listen"].includes(action)) {
            if (demoMode) return json(403, { error: "示範模式不會建立學生聆聽紀錄", code: "demo_read_only" });
            if (readFoundationInteractionType(questionSet.generation_metadata) !== "alphabet_round") {
                return json(409, { error: "這個小關卡不使用 A–Z 導聽", code: "alphabet_intro_not_supported" });
            }
            const orderedQuestions = [...(questionSet.speaking_questions || [])]
                .sort((left: any, right: any) => Number(left.sort_order) - Number(right.sort_order));
            const { data: sequence, error: sequenceError } = await admin.from("speaking_question_set_audio_sequences")
                // alphabetAudioSequenceValid verifies the private object and payload size too.
                // Keep this projection aligned with that validation; omitting either field
                // made a ready A–Z master sequence appear unavailable when a student started it.
                .select("question_set_version,source_fingerprint,status,duration_ms,private_object_key,byte_size,segments")
                .eq("question_set_id", Number(questionSet.id)).eq("purpose", "alphabet_master").maybeSingle();
            if (sequenceError) throw sequenceError;
            const sequenceReady = sequence?.status === "ready"
                && Number(sequence?.question_set_version) === Number(questionSet.version)
                && Boolean(sequence?.source_fingerprint)
                && alphabetAudioSequenceValid(orderedQuestions, sequence);
            if (!sequenceReady) return json(409, { error: "A–Z 單一慢速音檔尚未完成或已過期", code: "alphabet_master_not_ready" });

            const fingerprint = String(sequence.source_fingerprint);
            if (action === "start_alphabet_intro_listen") {
                const { data: completed, error: completedError } = await admin.from("speaking_alphabet_intro_listens")
                    .select("completed_at").eq("student_id", Number(user.id)).eq("question_set_id", Number(questionSet.id))
                    .eq("question_set_version", Number(questionSet.version)).eq("sequence_fingerprint", fingerprint)
                    .not("completed_at", "is", null).maybeSingle();
                if (completedError) throw completedError;
                if (completed?.completed_at) return json(200, { success: true, already_completed: true });
                const now = new Date();
                const sessionId = crypto.randomUUID();
                const minimumListenMs = Math.ceil(Math.max(1000, Number(sequence.duration_ms) * 0.8));
                const minCompleteAt = new Date(now.getTime() + minimumListenMs).toISOString();
                const { error: startError } = await admin.from("speaking_alphabet_intro_listens").upsert({
                    student_id: Number(user.id), question_set_id: Number(questionSet.id),
                    question_set_version: Number(questionSet.version), sequence_fingerprint: fingerprint,
                    listen_session_id: sessionId, started_at: now.toISOString(), min_complete_at: minCompleteAt,
                    completed_at: null, updated_at: now.toISOString()
                }, { onConflict: "student_id,question_set_id,question_set_version,sequence_fingerprint" });
                if (startError) throw startError;
                return json(200, { success: true, listen_session_id: sessionId, minimum_listen_ms: minimumListenMs });
            }

            const listenSessionId = cleanText(body?.listen_session_id, 80);
            if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(listenSessionId)) {
                return json(400, { error: "A–Z 聆聽工作階段無效", code: "alphabet_intro_session_invalid" });
            }
            const { data: listen, error: listenError } = await admin.from("speaking_alphabet_intro_listens")
                .select("listen_session_id,min_complete_at,completed_at").eq("student_id", Number(user.id))
                .eq("question_set_id", Number(questionSet.id)).eq("question_set_version", Number(questionSet.version))
                .eq("sequence_fingerprint", fingerprint).maybeSingle();
            if (listenError) throw listenError;
            if (!listen || String(listen.listen_session_id) !== listenSessionId) {
                return json(409, { error: "A–Z 聆聽工作階段已更新，請重新開始", code: "alphabet_intro_session_invalid" });
            }
            if (listen.completed_at) return json(200, { success: true, completed: true });
            if (new Date(listen.min_complete_at).getTime() > Date.now()) {
                return json(409, { error: "請完整聽完 A–Z 後再開始挑戰", code: "alphabet_intro_too_short" });
            }
            const { error: completeError } = await admin.from("speaking_alphabet_intro_listens")
                .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq("student_id", Number(user.id)).eq("question_set_id", Number(questionSet.id))
                .eq("question_set_version", Number(questionSet.version)).eq("sequence_fingerprint", fingerprint)
                .eq("listen_session_id", listenSessionId).is("completed_at", null);
            if (completeError) throw completeError;
            return json(200, { success: true, completed: true });
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
                const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
                const { data: attempt, error: attemptError } = await admin.from("speaking_pronunciation_attempts")
                    .select("answer_match,created_at").eq("student_id", Number(user.id))
                    .eq("question_set_id", setId).eq("question_id", questionId)
                    .gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
                if (attemptError) throw attemptError;
                // pronunciation-coach computes answer_match from the provider response and
                // persists it server-side. Reusing that authoritative decision keeps the
                // child-tolerant spelling policy consistent while still rejecting any
                // completion value supplied by the browser.
                if (!attempt || attempt.answer_match !== true) {
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
