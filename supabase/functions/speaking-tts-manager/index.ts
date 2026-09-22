import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { cleanText, verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { createR2PresignedUrl, fetchR2, normalizeObjectKey } from "../_shared/r2.ts";
import { spokenExampleText } from "../_shared/speaking-tts-text.ts";
import {
    alphabetRoundContentMatches,
    workbookOneFoundationTemplateByKey
} from "../_shared/workbook-one-foundations.ts";
import {
    ALPHABET_SEQUENCE_ASSEMBLER_VERSION,
    ALPHABET_SEQUENCE_GAP_MS,
    alphabetAudioSequenceValid,
    alphabetSourceFingerprint,
    assembleAlphabetAudioSequence,
    parseLinear16MonoWav
} from "../_shared/alphabet-audio-sequence.ts";
import {
    ALPHABET_CANDIDATE_ASSEMBLER,
    ALPHABET_CANDIDATE_PROFILES,
    ALPHABET_CANDIDATE_SETTINGS,
    alphabetCandidateProfileForRecord,
    buildAlphabetCandidateSegments,
    buildAlphabetMasterSsml
} from "../_shared/alphabet-master-voice.ts";
import {
    chooseSpeakingVoice,
    DEFAULT_FEMALE_VOICE_ID,
    DEFAULT_MALE_VOICE_ID
} from "../_shared/speaking-voice-assignment.ts";
import {
    assemblePictureGapSentenceSegmentsWav,
    googleSpeechInputForText,
    pictureGapTheCandidateInput,
    pictureGapSentenceSegments,
    PICTURE_GAP_THE_CANDIDATE_PROFILES,
    PICTURE_GAP_THE_CANDIDATE_VERSION,
    PICTURE_SENTENCE_AUDIO_VERSION,
    PICTURE_SENTENCE_GAP_MS,
    ttsTextWithoutTerminalFullStops,
    type GoogleSpeechInput
} from "../_shared/speaking-picture-audio.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, payload: Record<string, unknown>) => new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
});

const PROVIDER = "google_cloud_tts";
const LANGUAGE_CODE = "en-US";
const OUTPUT_FORMAT = "wav";
const PIPELINE_VERSION = "elementary-bright-v4";
const SAMPLE_RATE_METADATA = 24000;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_ALPHABET_SOURCE_BYTES = 20 * 1024 * 1024;
const SETTINGS = Object.freeze({ audioEncoding: "LINEAR16", speakingRate: 0.82 });
const WORKBOOK_ONE_PICTURE_GAP_TEMPLATES = new Map([
    ["workbook_1_p22_picture_gap_v1", 22],
    ["workbook_1_p23_picture_gap_v1", 23],
    ["workbook_1_p24_picture_gap_v1", 24]
]);
const pictureGapDraftLabel = (questionSet: any) => {
    const metadata = questionSet?.generation_metadata || {};
    const expectedPage = WORKBOOK_ONE_PICTURE_GAP_TEMPLATES.get(String(metadata.template_key || ""));
    if (questionSet?.status === "draft"
        && metadata.source === "manual_picture_manifest"
        && metadata.interaction_type === "picture_gap_sentence"
        && Array.isArray(metadata.source_pages)
        && metadata.source_pages.length === 1
        && Number(metadata.source_pages[0]) === expectedPage
    ) return `P${expectedPage}`;
    const manualPages = Array.isArray(metadata.source_pages)
        ? metadata.source_pages.map(Number).filter((page: number) => Number.isInteger(page) && page > 0)
        : [];
    if (questionSet?.status === "draft" && metadata.source === "admin_manual_builder"
        && metadata.interaction_type === "picture_gap_sentence" && manualPages.length > 0 && manualPages.length <= 50) {
        return manualPages.length === 1 ? `P${manualPages[0]}` : `P${manualPages[0]}～P${manualPages[manualPages.length - 1]}`;
    }
    if (questionSet?.status === "draft" && ["admin_page_builder", "ai_pdf_visual"].includes(metadata.source)
        && metadata.manual_builder_version === 2 && metadata.interaction_type === "mixed" && manualPages.length === 1) {
        return `P${manualPages[0]}`;
    }
    return null;
};
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
let cachedGoogleToken: { value: string; expiresAt: number } | null = null;

const sha256 = async (value: string) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
};

const voicePool = () => ({
    female: DEFAULT_FEMALE_VOICE_ID,
    male: cleanText(Deno.env.get("GOOGLE_CLOUD_TTS_MALE_VOICE_NAME"), 120) || DEFAULT_MALE_VOICE_ID
});

const base64Url = (value: Uint8Array | string) => {
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const importGooglePrivateKey = async (pem: string) => {
    const encoded = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
    if (!encoded) throw new Error("Google Cloud Service Account private key 格式不正確");
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return crypto.subtle.importKey("pkcs8", bytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
};

const getGoogleAccessToken = async () => {
    if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now() + 60_000) return cachedGoogleToken.value;
    const raw = Deno.env.get("GOOGLE_CLOUD_TTS_SERVICE_ACCOUNT_JSON");
    if (!raw) throw Object.assign(new Error("Google Cloud TTS Service Account 尚未設定"), { status: 503, code: "google_tts_not_configured" });
    let credentials: any;
    try { credentials = JSON.parse(raw); }
    catch { throw Object.assign(new Error("Google Cloud TTS Service Account JSON 格式不正確"), { status: 503, code: "invalid_google_credentials" }); }
    const clientEmail = cleanText(credentials?.client_email, 320);
    const privateKey = String(credentials?.private_key || "");
    const tokenUri = cleanText(credentials?.token_uri, 300) || GOOGLE_TOKEN_URL;
    if (!clientEmail || !privateKey || tokenUri !== GOOGLE_TOKEN_URL) {
        throw Object.assign(new Error("Google Cloud TTS Service Account 資料不完整"), { status: 503, code: "invalid_google_credentials" });
    }
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64Url(JSON.stringify({
        iss: clientEmail, scope: "https://www.googleapis.com/auth/cloud-platform",
        aud: GOOGLE_TOKEN_URL, iat: issuedAt, exp: issuedAt + 3600
    }));
    const unsignedJwt = `${header}.${claims}`;
    const signingKey = await importGooglePrivateKey(privateKey);
    const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signingKey, new TextEncoder().encode(unsignedJwt)));
    const assertion = `${unsignedJwt}.${base64Url(signature)}`;
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
    });
    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenPayload?.access_token) {
        throw Object.assign(new Error("Google Cloud TTS 登入驗證失敗"), { status: 502, code: "google_token_exchange_failed" });
    }
    const expiresIn = Math.max(300, Number(tokenPayload.expires_in) || 3600);
    cachedGoogleToken = { value: String(tokenPayload.access_token), expiresAt: Date.now() + expiresIn * 1000 };
    return cachedGoogleToken.value;
};

const decodeGoogleAudio = (audioContent: unknown) => {
    const encoded = String(audioContent || "");
    if (!encoded || encoded.length > Math.ceil(MAX_AUDIO_BYTES * 4 / 3) + 16) {
        throw Object.assign(new Error("Google Cloud TTS 回傳的音檔大小不正確"), { status: 502, code: "invalid_google_audio_size" });
    }
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0)); }
    catch { throw Object.assign(new Error("Google Cloud TTS 回傳的音檔格式不正確"), { status: 502, code: "invalid_google_audio_base64" }); }
    if (bytes.length < 100 || bytes.length > MAX_AUDIO_BYTES) {
        throw Object.assign(new Error("Google Cloud TTS 回傳的音檔大小不正確"), { status: 502, code: "invalid_google_audio_size" });
    }
    return bytes;
};

const requestGoogleAudio = async (input: GoogleSpeechInput, selectedVoice: string) => {
    const accessToken = await getGoogleAccessToken();
    const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            input, voice: { languageCode: LANGUAGE_CODE, name: selectedVoice }, audioConfig: SETTINGS
        })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.audioContent) {
        throw Object.assign(new Error("Google Cloud TTS 暫時無法產生示範語音"), {
            status: response.status >= 500 ? 502 : 400,
            code: cleanText(payload?.error?.status, 80) || `google_tts_http_${response.status}`
        });
    }
    const source = "text" in input ? input.text : input.ssml;
    return { bytes: decodeGoogleAudio(payload.audioContent), usedCharacters: source.length };
};

const requestGoogleGapSentenceAudio = async (pattern: string, selectedVoice: string) => {
    const segments = pictureGapSentenceSegments(pattern);
    const segmentAudio = await Promise.all(segments.map(segment => {
        const spoken = ttsTextWithoutTerminalFullStops(segment);
        return spoken ? requestGoogleAudio(googleSpeechInputForText(spoken), selectedVoice) : Promise.resolve(null);
    }));
    const assembled = assemblePictureGapSentenceSegmentsWav(
        segmentAudio.map(audio => audio?.bytes || null),
        PICTURE_SENTENCE_GAP_MS
    );
    return {
        ...assembled,
        usedCharacters: segmentAudio.reduce((total, audio) => total + (audio?.usedCharacters || 0), 0)
    };
};

const pictureGapTheCandidateDescriptor = async (pattern: string, profile: any) => {
    const selectedVoice = voicePool().female;
    const input = pictureGapTheCandidateInput(pattern, profile.id);
    const contentHash = await sha256(pattern);
    const assetSettings = {
        ...SETTINGS,
        audio_version: PICTURE_GAP_THE_CANDIDATE_VERSION,
        picture_gap_the_profile: profile.id,
        gap_mode: "ssml_context",
        gap_ms: PICTURE_SENTENCE_GAP_MS
    };
    const settingsHash = await sha256(JSON.stringify({
        provider: PROVIDER,
        voice_id: selectedVoice,
        language_code: LANGUAGE_CODE,
        output_format: OUTPUT_FORMAT,
        sample_rate: "provider_default",
        pipeline_version: PIPELINE_VERSION,
        settings: assetSettings,
        input
    }));
    const fingerprint = await sha256(JSON.stringify({ content_hash: contentHash, settings_hash: settingsHash }));
    return {
        profile,
        input,
        selectedVoice,
        contentHash,
        settingsHash,
        assetSettings,
        objectKey: normalizeObjectKey(`speaking-tts/candidates/picture-gap-the/${fingerprint}.wav`)
    };
};

const activePictureGapTheProfile = async (admin: any, questionId: number) => {
    const { data: link, error: linkError } = await admin.from("speaking_question_audio")
        .select("asset_id").eq("question_id", questionId).eq("purpose", "question_prompt").maybeSingle();
    if (linkError) throw linkError;
    if (!link?.asset_id) return null;
    const { data: asset, error: assetError } = await admin.from("speaking_tts_assets")
        .select("settings").eq("id", link.asset_id).maybeSingle();
    if (assetError) throw assetError;
    const profileId = String(asset?.settings?.picture_gap_the_profile || "");
    return PICTURE_GAP_THE_CANDIDATE_PROFILES.some(profile => profile.id === profileId) ? profileId : null;
};

const preparePictureGapTheCandidates = async (admin: any, question: any, pattern: string) => {
    const candidates = [];
    for (const profile of PICTURE_GAP_THE_CANDIDATE_PROFILES) {
        const descriptor = await pictureGapTheCandidateDescriptor(pattern, profile);
        let reused = false;
        const existing = await fetchR2(descriptor.objectKey, { method: "HEAD" });
        if (existing.ok && Number(existing.headers.get("content-length") || 0) > 0) {
            reused = true;
        } else {
            const generated = await requestGoogleAudio(descriptor.input, descriptor.selectedVoice);
            const stored = await fetchR2(descriptor.objectKey, {
                method: "PUT", body: generated.bytes,
                headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=31536000, immutable" }
            });
            if (!stored.ok) {
                throw Object.assign(new Error("The 弱讀候選音檔無法寫入私人儲存空間"), {
                    status: 502, code: `r2_put_${stored.status}`
                });
            }
            const probe = await fetchR2(descriptor.objectKey, { method: "HEAD" });
            if (!probe.ok || Number(probe.headers.get("content-length") || 0) !== generated.bytes.length) {
                throw Object.assign(new Error("The 弱讀候選音檔儲存驗證失敗"), {
                    status: 502, code: "picture_gap_the_candidate_size_mismatch"
                });
            }
        }
        candidates.push({
            id: profile.id,
            label: profile.label,
            reused,
            audio_url: await createR2PresignedUrl(descriptor.objectKey, "GET", 15 * 60)
        });
    }
    return {
        success: true,
        question_id: Number(question.id),
        voice_id: voicePool().female,
        active_candidate_id: await activePictureGapTheProfile(admin, Number(question.id)),
        expires_in_seconds: 15 * 60,
        candidates
    };
};

const linkGeneratedAsset = async (admin: any, question: any, assetId: string, target: any, updatedAt: string) => {
    if (target?.kind === "visible_word") {
        const { error } = await admin.from("speaking_question_word_audio").upsert({
            question_id: question.id, token_index: target.tokenIndex, word: target.word,
            asset_id: assetId, updated_at: updatedAt
        }, { onConflict: "question_id,token_index" });
        if (error) throw error;
        return;
    }
    if (target?.kind === "sentence_pattern") {
        const payload = { question_id: question.id, asset_id: assetId, purpose: "question_prompt", updated_at: updatedAt };
        const { data: existingPrompt, error: promptUpdateError } = await admin.from("speaking_question_audio")
            .update({ asset_id: assetId, purpose: "question_prompt", updated_at: updatedAt })
            .eq("question_id", question.id).select("question_id").maybeSingle();
        if (promptUpdateError) throw promptUpdateError;
        if (existingPrompt) return;
        const { error: promptInsertError } = await admin.from("speaking_question_audio").insert(payload);
        if (!promptInsertError) return;
        if (promptInsertError.code !== "23505") throw promptInsertError;
        const { data: retriedPrompt, error: promptRetryError } = await admin.from("speaking_question_audio")
            .update({ asset_id: assetId, purpose: "question_prompt", updated_at: updatedAt })
            .eq("question_id", question.id).select("question_id").maybeSingle();
        if (promptRetryError) throw promptRetryError;
        if (!retriedPrompt) throw Object.assign(new Error("整句語音無法連結至題目"), { status: 409, code: "audio_link_race_failed" });
        return;
    }
    const payload = {
        question_id: question.id, asset_id: assetId, purpose: "model_answer", updated_at: updatedAt
    };
    const { data: existingLink, error: updateError } = await admin.from("speaking_question_audio")
        .update({ asset_id: assetId, updated_at: updatedAt })
        .eq("question_id", question.id).eq("purpose", "model_answer")
        .select("question_id").maybeSingle();
    if (updateError) throw updateError;
    if (existingLink) return;
    const { error: insertError } = await admin.from("speaking_question_audio").insert(payload);
    if (!insertError) return;
    if (insertError.code !== "23505") throw insertError;
    const { data: retriedLink, error: retryError } = await admin.from("speaking_question_audio")
        .update({ asset_id: assetId, updated_at: updatedAt })
        .eq("question_id", question.id).eq("purpose", "model_answer")
        .select("question_id").maybeSingle();
    if (retryError) throw retryError;
    if (!retriedLink) throw Object.assign(new Error("示範語音無法連結至題目"), { status: 409, code: "audio_link_race_failed" });
};

const activatePictureGapTheCandidate = async (admin: any, question: any, pattern: string, profileId: string) => {
    const profile = PICTURE_GAP_THE_CANDIDATE_PROFILES.find(candidate => candidate.id === profileId);
    if (!profile) return Promise.reject(Object.assign(new Error("The 弱讀候選版本不正確"), { status: 400, code: "invalid_picture_gap_the_candidate" }));
    const descriptor = await pictureGapTheCandidateDescriptor(pattern, profile);
    const stored = await fetchR2(descriptor.objectKey, { method: "HEAD" });
    const byteSize = Number(stored.headers.get("content-length") || 0);
    if (!stored.ok || !Number.isInteger(byteSize) || byteSize <= 0) {
        throw Object.assign(new Error("請先產生並完整試聽這個 The 弱讀候選"), {
            status: 409, code: "picture_gap_the_candidate_not_ready"
        });
    }
    const now = new Date().toISOString();
    const usedCharacters = "ssml" in descriptor.input ? descriptor.input.ssml.length : descriptor.input.text.length;
    const selectFields = "id,status,private_object_key";
    let { data: asset, error: assetError } = await admin.from("speaking_tts_assets")
        .select(selectFields).eq("provider", PROVIDER).eq("content_hash", descriptor.contentHash)
        .eq("voice_id", descriptor.selectedVoice).eq("settings_hash", descriptor.settingsHash).maybeSingle();
    if (assetError) throw assetError;
    if (asset) {
        const { data: updated, error } = await admin.from("speaking_tts_assets").update({
            source_text: pattern,
            language_code: LANGUAGE_CODE,
            output_format: OUTPUT_FORMAT,
            sample_rate: SAMPLE_RATE_METADATA,
            settings: descriptor.assetSettings,
            private_object_key: descriptor.objectKey,
            status: "ready",
            byte_size: byteSize,
            used_characters: usedCharacters,
            error_code: null,
            error_message: null,
            completed_at: now,
            updated_at: now
        }).eq("id", asset.id).select(selectFields).single();
        if (error) throw error;
        asset = updated;
    } else {
        const { data: inserted, error } = await admin.from("speaking_tts_assets").insert({
            provider: PROVIDER,
            content_hash: descriptor.contentHash,
            source_text: pattern,
            voice_id: descriptor.selectedVoice,
            language_code: LANGUAGE_CODE,
            output_format: OUTPUT_FORMAT,
            sample_rate: SAMPLE_RATE_METADATA,
            settings_hash: descriptor.settingsHash,
            settings: descriptor.assetSettings,
            private_object_key: descriptor.objectKey,
            status: "ready",
            byte_size: byteSize,
            used_characters: usedCharacters,
            completed_at: now,
            updated_at: now
        }).select(selectFields).single();
        if (error?.code === "23505") {
            const { data: raced, error: raceError } = await admin.from("speaking_tts_assets")
                .select(selectFields).eq("provider", PROVIDER).eq("content_hash", descriptor.contentHash)
                .eq("voice_id", descriptor.selectedVoice).eq("settings_hash", descriptor.settingsHash).single();
            if (raceError) throw raceError;
            asset = raced;
        } else if (error) throw error;
        else asset = inserted;
    }
    if (!asset?.id || asset.status !== "ready" || !asset.private_object_key) {
        throw Object.assign(new Error("The 弱讀候選尚未完成，請重新產生後再套用"), {
            status: 409, code: "picture_gap_the_candidate_asset_not_ready"
        });
    }
    await linkGeneratedAsset(admin, question, asset.id, { kind: "sentence_pattern" }, now);
    return {
        success: true,
        applied: true,
        question_id: Number(question.id),
        active_candidate_id: profile.id,
        active_candidate_label: profile.label,
        audio_url: await createR2PresignedUrl(descriptor.objectKey, "GET", 15 * 60)
    };
};

const requestGoogleAlphabetMaster = async (profile: any) => {
    const accessToken = await getGoogleAccessToken();
    const ssml = buildAlphabetMasterSsml(ALPHABET_SEQUENCE_GAP_MS);
    const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            input: { ssml },
            voice: { languageCode: LANGUAGE_CODE, name: profile.voiceId },
            audioConfig: ALPHABET_CANDIDATE_SETTINGS
        })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.audioContent) {
        throw Object.assign(new Error("Google Cloud TTS 暫時無法產生 A–Z 候選音檔"), {
            status: response.status >= 500 ? 502 : 400,
            code: cleanText(payload?.error?.status, 80) || `google_tts_http_${response.status}`
        });
    }
    const bytes = decodeGoogleAudio(payload.audioContent);
    const wav = parseLinear16MonoWav(bytes);
    const durationMs = Math.round(wav.data.length / wav.byteRate * 1000);
    return { bytes, pcm: wav.data, sampleRate: wav.sampleRate, durationMs, usedCharacters: ssml.length };
};

const alphabetTemplateValid = (questionSet: any, questions: any[]) => {
    const template = workbookOneFoundationTemplateByKey(questionSet?.generation_metadata?.template_key);
    const ordered = [...questions].sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
    return questionSet?.generation_metadata?.template_key === "workbook_1_alphabet_round_v1"
        && questionSet?.generation_metadata?.interaction_type === "alphabet_round"
        && alphabetRoundContentMatches(template, ordered);
};

const alphabetCandidateResponse = async (candidate: any, reused = true) => ({
    success: true,
    candidate_id: candidate.id,
    reused,
    status: candidate.status,
    voice_id: candidate.voice_id,
    voice_label: alphabetCandidateProfileForRecord(candidate)?.label || candidate.voice_id,
    duration_ms: Number(candidate.duration_ms),
    segments: candidate.segments,
    audio_url: await createR2PresignedUrl(candidate.private_object_key, "GET", 15 * 60)
});

const alphabetCandidateValid = (
    candidate: any,
    questions: any[],
    questionSet: any,
    settingsHash: string,
    sourceFingerprint: string,
    allowedStatuses = ["ready"]
) => Boolean(candidate)
    && Boolean(alphabetCandidateProfileForRecord(candidate))
    && Number(candidate.question_set_id) === Number(questionSet.id)
    && Number(candidate.question_set_version) === Number(questionSet.version)
    && candidate.settings_hash === settingsHash
    && candidate.source_fingerprint === sourceFingerprint
    && candidate.assembler_version === ALPHABET_CANDIDATE_ASSEMBLER
    && candidate.mime_type === "audio/wav"
    && allowedStatuses.includes(candidate.status)
    && alphabetAudioSequenceValid(questions, { ...candidate, status: "ready" });

const alphabetCandidateStored = async (candidate: any) => {
    if (!candidate?.private_object_key || Number(candidate?.byte_size || 0) <= 0) return false;
    const probe = await fetchR2(candidate.private_object_key, { method: "HEAD" });
    return probe.ok && Number(probe.headers.get("content-length") || 0) === Number(candidate.byte_size);
};

const prepareAlphabetCandidate = async (admin: any, questions: any[], questionSet: any, profile: any) => {
    if (!alphabetTemplateValid(questionSet, questions)) {
        throw Object.assign(new Error("A–Z 題庫不是固定 26 個字母模板"), { status: 409, code: "alphabet_template_invalid" });
    }
    const ordered = [...questions].sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
    const settingsHash = await sha256(JSON.stringify({
        revision: profile.revision,
        voice_id: profile.voiceId,
        settings: ALPHABET_CANDIDATE_SETTINGS,
        ssml: buildAlphabetMasterSsml(ALPHABET_SEQUENCE_GAP_MS)
    }));
    const sourceFingerprint = await sha256(JSON.stringify({
        question_set_id: Number(questionSet.id), question_set_version: Number(questionSet.version), settings_hash: settingsHash,
        questions: ordered.map(question => ({ id: Number(question.id), letter: String(question.model_answer).trim().toUpperCase() }))
    }));
    const selectFields = "id,question_set_id,question_set_version,revision,voice_id,settings_hash,source_fingerprint,assembler_version,private_object_key,mime_type,byte_size,duration_ms,segments,status,updated_at";
    const { data: existing, error: existingError } = await admin.from("speaking_alphabet_audio_candidates")
        .select(selectFields).eq("question_set_id", Number(questionSet.id))
        .eq("question_set_version", Number(questionSet.version)).eq("revision", profile.revision).maybeSingle();
    if (existingError) throw existingError;
    if (["ready", "active"].includes(existing?.status)) {
        if (!alphabetCandidateValid(existing, ordered, questionSet, settingsHash, sourceFingerprint, ["ready", "active"])
            || !(await alphabetCandidateStored(existing))) {
            throw Object.assign(new Error("既有 A–Z 候選音檔不完整，不能沿用"), { status: 409, code: "alphabet_candidate_invalid" });
        }
        return alphabetCandidateResponse(existing);
    }
    if (existing?.status === "superseded") {
        throw Object.assign(new Error("這個 A–Z 候選版本已被取代，請由程式更新建立新版本"), { status: 409, code: "alphabet_candidate_superseded" });
    }
    if (existing?.status === "processing" && Date.now() - Date.parse(existing.updated_at) < 10 * 60 * 1000) {
        throw Object.assign(new Error("A–Z 候選音檔正在產生，請稍後重新整理"), { status: 409, code: "alphabet_candidate_processing" });
    }
    const processingToken = crypto.randomUUID();
    const now = new Date().toISOString();
    let candidateId = existing?.id;
    if (existing) {
        const { data: claimed, error } = await admin.from("speaking_alphabet_audio_candidates").update({
            status: "processing", processing_token: processingToken, error_code: null, error_message: null, updated_at: now
        }).eq("id", existing.id).eq("updated_at", existing.updated_at).select("id").maybeSingle();
        if (error) throw error;
        if (!claimed) throw Object.assign(new Error("A–Z 候選音檔已由另一個工作接手"), { status: 409, code: "alphabet_candidate_claimed" });
        candidateId = claimed.id;
    } else {
        const { data: inserted, error } = await admin.from("speaking_alphabet_audio_candidates").insert({
            question_set_id: Number(questionSet.id), question_set_version: Number(questionSet.version),
            revision: profile.revision, voice_id: profile.voiceId,
            settings_hash: settingsHash, source_fingerprint: sourceFingerprint,
            assembler_version: ALPHABET_CANDIDATE_ASSEMBLER, status: "processing",
            processing_token: processingToken, updated_at: now
        }).select("id").single();
        if (error) {
            if (error.code === "23505") throw Object.assign(new Error("A–Z 候選音檔已開始產生，請稍後重新整理"), { status: 409, code: "alphabet_candidate_processing" });
            throw error;
        }
        candidateId = inserted.id;
    }
    try {
        const generated = await requestGoogleAlphabetMaster(profile);
        const objectKey = normalizeObjectKey(`speaking-tts/derived/alphabet-candidates/${sourceFingerprint}.wav`);
        const stored = await fetchR2(objectKey, {
            method: "PUT", body: generated.bytes,
            headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=31536000, immutable" }
        });
        if (!stored.ok) throw Object.assign(new Error("A–Z 候選音檔無法寫入私人儲存空間"), { status: 502, code: `r2_put_${stored.status}` });
        const probe = await fetchR2(objectKey, { method: "HEAD" });
        if (!probe.ok || Number(probe.headers.get("content-length") || 0) !== generated.bytes.length) {
            throw Object.assign(new Error("A–Z 候選音檔儲存驗證失敗"), { status: 502, code: "alphabet_candidate_size_mismatch" });
        }
        const segments = buildAlphabetCandidateSegments(ordered, generated.pcm, generated.sampleRate, profile.voiceId);
        const completedAt = new Date().toISOString();
        const { data: ready, error } = await admin.from("speaking_alphabet_audio_candidates").update({
            private_object_key: objectKey, byte_size: generated.bytes.length, duration_ms: generated.durationMs,
            segments, status: "ready", processing_token: null, completed_at: completedAt, updated_at: completedAt
        }).eq("id", candidateId).eq("processing_token", processingToken).select(selectFields).maybeSingle();
        if (error) throw error;
        if (!ready) throw Object.assign(new Error("A–Z 候選音檔已有較新的工作"), { status: 409, code: "alphabet_candidate_superseded" });
        return alphabetCandidateResponse(ready, false);
    } catch (error: any) {
        await admin.from("speaking_alphabet_audio_candidates").update({
            status: "failed", processing_token: null,
            error_code: cleanText(error?.code, 120) || "alphabet_candidate_failed",
            error_message: cleanText(error?.message, 500) || "A–Z 候選音檔產生失敗", updated_at: new Date().toISOString()
        }).eq("id", candidateId).eq("processing_token", processingToken);
        throw error;
    }
};

const prepareAlphabetCandidates = async (admin: any, questions: any[], questionSet: any) => {
    const candidates = [];
    for (const profile of ALPHABET_CANDIDATE_PROFILES) {
        candidates.push(await prepareAlphabetCandidate(admin, questions, questionSet, profile));
    }
    return { success: true, candidates, reused: candidates.every(candidate => candidate.reused) };
};

const generateQuestionAudio = async (admin: any, question: any, target: any = null) => {
    const text = target?.kind === "sentence_pattern"
        ? String(target?.text || "").trim()
        : spokenExampleText(target?.text ?? question?.model_answer);
    if (!text) return { question_id: Number(question.id), status: "failed", error: "示範回答是空白" };
    const selected = target?.voiceChoice
        || chooseSpeakingVoice(question.question_set_id, target?.tokenIndex ?? question.sort_order, voicePool());
    const selectedVoice = selected.voiceId;
    const contentHash = await sha256(text);
    const settingsHash = await sha256(JSON.stringify({
        provider: PROVIDER, voice_id: selectedVoice, language_code: LANGUAGE_CODE,
        output_format: OUTPUT_FORMAT, sample_rate: "provider_default", pipeline_version: PIPELINE_VERSION,
        audio_version: target?.audioVersion || (/\bthe\b/i.test(text) ? "the-ipa-v2" : "default-v2"),
        gap_ms: target?.kind === "sentence_pattern" ? PICTURE_SENTENCE_GAP_MS : null,
        settings: SETTINGS
    }));

    const { data: existing, error: existingError } = await admin.from("speaking_tts_assets")
        .select("id,status,private_object_key,byte_size,completed_at,error_code,updated_at")
        .eq("provider", PROVIDER).eq("content_hash", contentHash)
        .eq("voice_id", selectedVoice).eq("settings_hash", settingsHash).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === "ready" && existing.private_object_key) {
        await linkGeneratedAsset(admin, question, existing.id, target, new Date().toISOString());
        return { question_id: Number(question.id), token_index: target?.tokenIndex ?? null, status: "ready", reused: true, voice_id: selectedVoice, voice_gender: selected.gender };
    }
    const mayRecoverStoredAsset = existing?.status === "failed"
        && existing?.error_code === "42P10"
        && Boolean(existing?.private_object_key)
        && Number(existing?.byte_size || 0) > 0
        && Boolean(existing?.completed_at);
    if (mayRecoverStoredAsset) {
        const stored = await fetchR2(existing.private_object_key, { method: "HEAD" });
        if (stored.ok) {
            const storedBytes = Number(stored.headers.get("content-length") || 0);
            if (!Number.isFinite(storedBytes) || storedBytes !== Number(existing.byte_size)) {
                throw Object.assign(new Error("既有示範語音的儲存大小與資料庫不一致"), {
                    status: 502, code: "stored_audio_size_mismatch"
                });
            }
            const recoveredAt = new Date().toISOString();
            const { error: recoverError } = await admin.from("speaking_tts_assets").update({
                status: "ready", error_code: null, error_message: null, updated_at: recoveredAt
            }).eq("id", existing.id);
            if (recoverError) throw recoverError;
            await linkGeneratedAsset(admin, question, existing.id, target, recoveredAt);
            return {
                question_id: Number(question.id), token_index: target?.tokenIndex ?? null,
                status: "ready", reused: true, recovered: true,
                voice_id: selectedVoice, voice_gender: selected.gender
            };
        }
        if (stored.status !== 404) {
            throw Object.assign(new Error("暫時無法確認既有示範語音，已停止以避免重複產生費用"), {
                status: 502, code: `stored_audio_probe_${stored.status}`
            });
        }
    }
    if (existing?.status === "processing" && Date.now() - Date.parse(existing.updated_at) < 5 * 60 * 1000) {
        return { question_id: Number(question.id), status: "processing", reused: true, voice_id: selectedVoice, voice_gender: selected.gender };
    }

    const now = new Date().toISOString();
    let asset = existing;
    if (asset) {
        const { data, error } = await admin.from("speaking_tts_assets").update({
            status: "processing", error_code: null, error_message: null, updated_at: now
        }).eq("id", asset.id)
            .eq("status", existing.status)
            .eq("updated_at", existing.updated_at)
            .select("id").maybeSingle();
        if (error) throw error;
        if (!data) {
            return {
                question_id: Number(question.id), token_index: target?.tokenIndex ?? null,
                status: "processing", reused: true,
                voice_id: selectedVoice, voice_gender: selected.gender
            };
        }
        asset = data;
    } else {
        const { data, error } = await admin.from("speaking_tts_assets").insert({
            provider: PROVIDER, content_hash: contentHash, source_text: text, voice_id: selectedVoice,
            language_code: LANGUAGE_CODE, output_format: OUTPUT_FORMAT, sample_rate: SAMPLE_RATE_METADATA,
            settings_hash: settingsHash, settings: SETTINGS, status: "processing", updated_at: now
        }).select("id").single();
        if (error?.code === "23505") {
            const { data: raced, error: raceError } = await admin.from("speaking_tts_assets")
                .select("id,status,private_object_key").eq("provider", PROVIDER).eq("content_hash", contentHash)
                .eq("voice_id", selectedVoice).eq("settings_hash", settingsHash).single();
            if (raceError) throw raceError;
            if (raced.status === "ready" && raced.private_object_key) {
                await linkGeneratedAsset(admin, question, raced.id, target, now);
                return { question_id: Number(question.id), token_index: target?.tokenIndex ?? null, status: "ready", reused: true, voice_id: selectedVoice, voice_gender: selected.gender };
            }
            return { question_id: Number(question.id), status: "processing", reused: true, voice_id: selectedVoice, voice_gender: selected.gender };
        }
        if (error) throw error;
        asset = data;
    }

    try {
        const generated = target?.kind === "sentence_pattern"
            ? await requestGoogleGapSentenceAudio(text, selectedVoice)
            : await requestGoogleAudio(googleSpeechInputForText(text), selectedVoice);
        const objectKey = normalizeObjectKey(`speaking-tts/google/${selectedVoice}/${contentHash}-${settingsHash.slice(0, 16)}.wav`);
        const stored = await fetchR2(objectKey, {
            method: "PUT", body: generated.bytes,
            headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=31536000, immutable" }
        });
        if (!stored.ok) throw Object.assign(new Error("示範語音無法寫入私人儲存空間"), { status: 502, code: `r2_put_${stored.status}` });
        const completedAt = new Date().toISOString();
        const { error: readyError } = await admin.from("speaking_tts_assets").update({
            private_object_key: objectKey, status: "ready", byte_size: generated.bytes.length,
            used_characters: generated.usedCharacters, completed_at: completedAt, updated_at: completedAt
        }).eq("id", asset.id);
        if (readyError) throw readyError;
        await linkGeneratedAsset(admin, question, asset.id, target, completedAt);
        return { question_id: Number(question.id), token_index: target?.tokenIndex ?? null, status: "ready", reused: false, voice_id: selectedVoice, voice_gender: selected.gender };
    } catch (error: any) {
        await admin.from("speaking_tts_assets").update({
            status: "failed", error_code: cleanText(error?.code, 120) || "generation_failed",
            error_message: cleanText(error?.message, 500) || "語音生成失敗", updated_at: new Date().toISOString()
        }).eq("id", asset.id);
        throw error;
    }
};

const recoverStoredQuestionAudio = async (admin: any, question: any) => {
    const text = spokenExampleText(question?.model_answer);
    const selected = { gender: "female", voiceId: voicePool().female };
    const contentHash = await sha256(text);
    const settingsHash = await sha256(JSON.stringify({
        provider: PROVIDER, voice_id: selected.voiceId, language_code: LANGUAGE_CODE,
        output_format: OUTPUT_FORMAT, sample_rate: "provider_default",
        pipeline_version: PIPELINE_VERSION, settings: SETTINGS
    }));
    const { data: asset, error } = await admin.from("speaking_tts_assets")
        .select("id,status,content_hash,private_object_key,byte_size,completed_at,error_code")
        .eq("provider", PROVIDER).eq("content_hash", contentHash)
        .eq("voice_id", selected.voiceId).eq("settings_hash", settingsHash).maybeSingle();
    if (error) throw error;
    if (!asset?.private_object_key || Number(asset?.byte_size || 0) <= 0 || !asset?.completed_at) {
        throw Object.assign(new Error(`字母 ${text} 尚無可復用的私人 WAV，已停止且不會重新呼叫付費語音`), {
            status: 409, code: "alphabet_source_audio_missing"
        });
    }
    const stored = await fetchR2(asset.private_object_key, { method: "HEAD" });
    if (!stored.ok) {
        throw Object.assign(new Error(`字母 ${text} 的既有私人 WAV 無法確認，已停止且不會重新呼叫付費語音`), {
            status: 502, code: `alphabet_source_probe_${stored.status}`
        });
    }
    const storedBytes = Number(stored.headers.get("content-length") || 0);
    if (storedBytes !== Number(asset.byte_size)) {
        throw Object.assign(new Error(`字母 ${text} 的既有私人 WAV 大小不一致`), {
            status: 502, code: "alphabet_source_size_mismatch"
        });
    }
    if (asset.status !== "ready") {
        if (asset.error_code !== "42P10") {
            throw Object.assign(new Error(`字母 ${text} 的既有音檔狀態不可安全復用`), {
                status: 409, code: "alphabet_source_not_ready"
            });
        }
        const { error: recoverError } = await admin.from("speaking_tts_assets").update({
            status: "ready", error_code: null, error_message: null, updated_at: new Date().toISOString()
        }).eq("id", asset.id);
        if (recoverError) throw recoverError;
    }
    await linkGeneratedAsset(admin, question, asset.id, null, new Date().toISOString());
    return {
        questionId: Number(question.id),
        letter: text.toUpperCase(),
        assetId: String(asset.id),
        contentHash: String(asset.content_hash),
        byteSize: Number(asset.byte_size),
        privateObjectKey: String(asset.private_object_key)
    };
};

const assembleAlphabetMasterAudio = async (admin: any, questions: any[], questionSet: any) => {
    const template = workbookOneFoundationTemplateByKey(questionSet?.generation_metadata?.template_key);
    const orderedQuestions = [...questions].sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
    if (questionSet?.generation_metadata?.interaction_type !== "alphabet_round"
        || !alphabetRoundContentMatches(template, orderedQuestions)) {
        throw Object.assign(new Error("A–Z 題庫不是固定 26 個字母模板"), {
            status: 409, code: "alphabet_template_invalid"
        });
    }
    const sourceRecords = [];
    for (const question of orderedQuestions) sourceRecords.push(await recoverStoredQuestionAudio(admin, question));
    const totalSourceBytes = sourceRecords.reduce((sum, source) => sum + source.byteSize, 0);
    if (totalSourceBytes > MAX_ALPHABET_SOURCE_BYTES) {
        throw Object.assign(new Error("A–Z 來源音檔總大小超過安全上限"), { status: 409, code: "alphabet_source_too_large" });
    }
    const sourceFingerprint = await alphabetSourceFingerprint(sourceRecords.map(source => ({
        questionId: source.questionId,
        letter: source.letter,
        assetId: source.assetId,
        contentHash: source.contentHash,
        byteSize: source.byteSize
    })), ALPHABET_SEQUENCE_GAP_MS);
    const { data: existingSequence, error: sequenceError } = await admin.from("speaking_question_set_audio_sequences")
        .select("question_set_version,source_fingerprint,assembler_version,status,private_object_key,byte_size,duration_ms,segments")
        .eq("question_set_id", Number(questionSet.id)).eq("purpose", "alphabet_master").maybeSingle();
    if (sequenceError) throw sequenceError;
    let forceRebuild = false;
    if (existingSequence?.source_fingerprint === sourceFingerprint
        && Number(existingSequence?.question_set_version) === Number(questionSet.version)
        && existingSequence?.assembler_version === ALPHABET_SEQUENCE_ASSEMBLER_VERSION
        && Array.isArray(existingSequence?.segments)
        && existingSequence.segments.every((segment: any) => segment?.voice_id === voicePool().female)
        && existingSequence?.status === "ready" && existingSequence?.private_object_key) {
        const stored = await fetchR2(existingSequence.private_object_key, { method: "HEAD" });
        if (stored.ok && Number(stored.headers.get("content-length") || 0) === Number(existingSequence.byte_size)) {
            return { reused: true, duration_ms: Number(existingSequence.duration_ms), segments: existingSequence.segments };
        }
        if (stored.status !== 404) {
            throw Object.assign(new Error("暫時無法確認既有 A–Z 主音檔，已停止以避免重複處理"), {
                status: 502, code: `alphabet_master_probe_${stored.status}`
            });
        }
        forceRebuild = true;
    }
    const objectKey = normalizeObjectKey(`speaking-tts/derived/alphabet/${sourceFingerprint}.wav`);
    const assemblyToken = crypto.randomUUID();
    const { data: claim, error: processingError } = await admin.rpc("claim_speaking_alphabet_audio_sequence", {
        p_question_set_id: Number(questionSet.id),
        p_question_set_version: Number(questionSet.version),
        p_source_fingerprint: sourceFingerprint,
        p_assembler_version: ALPHABET_SEQUENCE_ASSEMBLER_VERSION,
        p_assembly_token: assemblyToken,
        p_force_rebuild: forceRebuild
    });
    if (processingError) throw processingError;
    if (!claim?.claimed) {
        throw Object.assign(new Error(claim?.status === "processing"
            ? "A–Z 主音檔正在組合，請稍後重新整理"
            : "A–Z 主音檔已有較新的版本，請重新整理"), {
            status: 409, code: "alphabet_assembly_in_progress"
        });
    }
    try {
        const sources = [];
        for (const source of sourceRecords) {
            const response = await fetchR2(source.privateObjectKey, { method: "GET" });
            if (!response.ok) throw Object.assign(new Error(`字母 ${source.letter} 的私人 WAV 讀取失敗`), {
                status: 502, code: `alphabet_source_get_${response.status}`
            });
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.length !== source.byteSize) throw Object.assign(new Error(`字母 ${source.letter} 的私人 WAV 大小不一致`), {
                status: 502, code: "alphabet_source_download_size_mismatch"
            });
            sources.push({ ...source, bytes });
        }
        const assembled = assembleAlphabetAudioSequence(sources, ALPHABET_SEQUENCE_GAP_MS);
        const femaleSegments = assembled.segments.map(segment => ({ ...segment, voice_id: voicePool().female }));
        const stored = await fetchR2(objectKey, {
            method: "PUT",
            body: assembled.bytes,
            headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=31536000, immutable" }
        });
        if (!stored.ok) throw Object.assign(new Error("A–Z 主音檔無法寫入私人儲存空間"), {
            status: 502, code: `alphabet_master_put_${stored.status}`
        });
        const completedAt = new Date().toISOString();
        const { data: readySequence, error: readyError } = await admin.from("speaking_question_set_audio_sequences").update({
            private_object_key: objectKey,
            mime_type: "audio/wav",
            status: "ready",
            byte_size: assembled.bytes.length,
            duration_ms: assembled.durationMs,
            segments: femaleSegments,
            error_code: null,
            error_message: null,
            completed_at: completedAt,
            assembly_token: null,
            updated_at: completedAt
        }).eq("question_set_id", Number(questionSet.id)).eq("purpose", "alphabet_master")
            .eq("assembly_token", assemblyToken)
            .select("status").maybeSingle();
        if (readyError) throw readyError;
        if (!readySequence) {
            throw Object.assign(new Error("A–Z 主音檔已有較新的組合工作，請稍後重新整理"), {
                status: 409, code: "alphabet_assembly_superseded"
            });
        }
        return { reused: false, duration_ms: assembled.durationMs, segments: femaleSegments };
    } catch (error: any) {
        await admin.from("speaking_question_set_audio_sequences").update({
            status: "failed",
            error_code: cleanText(error?.code, 120) || "alphabet_assembly_failed",
            error_message: cleanText(error?.message, 500) || "A–Z 主音檔組合失敗",
            updated_at: new Date().toISOString()
        }).eq("question_set_id", Number(questionSet.id)).eq("purpose", "alphabet_master")
            .eq("assembly_token", assemblyToken);
        throw error;
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
        if (user.role !== "admin") return json(403, { error: "只有管理員可以產生教材示範語音" });
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action, 40);
        if (!["generate_set_audio", "generate_visible_word_audio", "retry_question_audio", "preview_question_audio", "preview_picture_gap_the_candidates", "activate_picture_gap_the_candidate", "restore_picture_gap_standard_audio", "prepare_alphabet_audio_candidate", "activate_alphabet_audio_candidate"].includes(action)) return json(400, { error: "不支援的操作" });
        const setId = Number(body?.question_set_id);
        const requestedQuestionId = ["retry_question_audio", "preview_question_audio", "preview_picture_gap_the_candidates", "activate_picture_gap_the_candidate", "restore_picture_gap_standard_audio"].includes(action)
            ? Number(body?.question_id)
            : null;
        if (!Number.isInteger(setId) || setId <= 0 || (requestedQuestionId !== null && (!Number.isInteger(requestedQuestionId) || requestedQuestionId <= 0))) {
            return json(400, { error: "題庫或題目編號不正確" });
        }
        let query = admin.from("speaking_questions").select("id,question_set_id,question_text,simple_answer,model_answer,sort_order,speaking_question_sets(id,status,version,generation_metadata)").eq("question_set_id", setId);
        if (requestedQuestionId !== null) query = query.eq("id", requestedQuestionId);
        const { data: questions, error } = await query.order("sort_order");
        if (error) throw error;
        if (!questions?.length) return json(404, { error: "找不到需要產生語音的題目" });
        const questionSet = Array.isArray(questions[0]?.speaking_question_sets)
            ? questions[0].speaking_question_sets[0] : questions[0]?.speaking_question_sets;
        const setStatus = questionSet?.status;
        const interactionType = String(questionSet?.generation_metadata?.interaction_type || "");
        const mayPrepareAlphabetDraft = setStatus === "draft" && interactionType === "alphabet_round";
        const pictureGapPage = pictureGapDraftLabel(questionSet);
        const mayPreparePictureGapDraft = Boolean(pictureGapPage) && action === "generate_visible_word_audio";
        const manualStandardDraft = setStatus === "draft"
            && questionSet?.generation_metadata?.source === "admin_manual_builder"
            && interactionType === "standard_sentence";
        const manualPageDraft = setStatus === "draft"
            && ["admin_page_builder", "ai_pdf_visual"].includes(questionSet?.generation_metadata?.source)
            && questionSet?.generation_metadata?.manual_builder_version === 2
            && interactionType === "mixed";
        const mayPrepareManualStandardDraft = manualStandardDraft
            && ["generate_set_audio", "retry_question_audio", "preview_question_audio"].includes(action);
        const mayPrepareManualPageDraft = manualPageDraft
            && ["generate_set_audio", "generate_visible_word_audio", "retry_question_audio", "preview_question_audio"].includes(action);
        const mayPreviewPictureGapDraft = Boolean(pictureGapPage)
            && ["preview_question_audio", "preview_picture_gap_the_candidates", "activate_picture_gap_the_candidate", "restore_picture_gap_standard_audio"].includes(action);
        if (setStatus !== "published" && !mayPrepareAlphabetDraft && !mayPreparePictureGapDraft
            && !mayPrepareManualStandardDraft && !mayPrepareManualPageDraft && !mayPreviewPictureGapDraft) {
            return json(409, { error: "只有已發布題庫或管理員待發布草稿可以產生／預覽正式語音" });
        }
        if (["prepare_alphabet_audio_candidate", "activate_alphabet_audio_candidate"].includes(action)
            && !alphabetTemplateValid(questionSet, questions)) {
            return json(409, { error: "A–Z 題庫不是固定 26 個字母模板", code: "alphabet_template_invalid" });
        }
        if (action === "prepare_alphabet_audio_candidate") {
            return json(200, await prepareAlphabetCandidates(admin, questions, questionSet));
        }
        if (action === "activate_alphabet_audio_candidate") {
            const candidateId = cleanText(body?.candidate_id, 80);
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidateId)) {
                return json(400, { error: "候選音檔編號不正確" });
            }
            const selectFields = "id,question_set_id,question_set_version,revision,voice_id,settings_hash,source_fingerprint,assembler_version,private_object_key,mime_type,byte_size,duration_ms,segments,status,updated_at";
            const { data: candidate, error: candidateError } = await admin.from("speaking_alphabet_audio_candidates")
                .select(selectFields).eq("id", candidateId).maybeSingle();
            if (candidateError) throw candidateError;
            const profile = alphabetCandidateProfileForRecord(candidate);
            if (!profile) return json(409, { error: "候選音檔不是目前允許的語音版本" });
            const ordered = [...questions].sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
            const settingsHash = await sha256(JSON.stringify({
                revision: profile.revision,
                voice_id: profile.voiceId,
                settings: ALPHABET_CANDIDATE_SETTINGS,
                ssml: buildAlphabetMasterSsml(ALPHABET_SEQUENCE_GAP_MS)
            }));
            const sourceFingerprint = await sha256(JSON.stringify({
                question_set_id: Number(questionSet.id), question_set_version: Number(questionSet.version), settings_hash: settingsHash,
                questions: ordered.map(question => ({ id: Number(question.id), letter: String(question.model_answer).trim().toUpperCase() }))
            }));
            if (!alphabetCandidateValid(candidate, ordered, questionSet, settingsHash, sourceFingerprint)
                || !(await alphabetCandidateStored(candidate))) {
                return json(409, { error: "候選音檔尚未準備完成或不屬於這個題庫" });
            }
            const { data: activated, error: activateError } = await admin.rpc("activate_speaking_alphabet_audio_candidate", {
                p_candidate_id: candidateId
            });
            if (activateError) throw activateError;
            return json(200, { success: true, ...activated });
        }
        if (["preview_picture_gap_the_candidates", "activate_picture_gap_the_candidate", "restore_picture_gap_standard_audio"].includes(action)) {
            const fixedPage = WORKBOOK_ONE_PICTURE_GAP_TEMPLATES.get(String(questionSet?.generation_metadata?.template_key || ""));
            if (!fixedPage || interactionType !== "picture_gap_sentence") {
                return json(409, { error: "The 弱讀候選只提供 Workbook 1 P22～P24 看圖補句使用" });
            }
            const question = questions[0];
            const { data: interaction, error: interactionError } = await admin.from("speaking_question_interactions")
                .select("interaction_type,prompt_text").eq("question_id", Number(question.id)).maybeSingle();
            if (interactionError) throw interactionError;
            if (interaction?.interaction_type !== "picture_gap_sentence" || !interaction?.prompt_text) {
                return json(409, { error: "這一題缺少看圖補句語音資料" });
            }
            if (["preview_picture_gap_the_candidates", "activate_picture_gap_the_candidate"].includes(action)
                && (String(interaction.prompt_text).match(/_{2,}/g) || []).length !== 1) {
                return json(409, { error: "The 弱讀候選只適用於單一挖空題；多挖空題請使用標準分段語音" });
            }
            if (action === "preview_picture_gap_the_candidates") {
                return json(200, await preparePictureGapTheCandidates(admin, question, interaction.prompt_text));
            }
            if (action === "activate_picture_gap_the_candidate") {
                const candidateId = cleanText(body?.candidate_id, 40);
                return json(200, await activatePictureGapTheCandidate(admin, question, interaction.prompt_text, candidateId));
            }
            const restored = await generateQuestionAudio(admin, question, {
                kind: "sentence_pattern",
                text: interaction.prompt_text,
                voiceChoice: { gender: "female", voiceId: voicePool().female },
                audioVersion: PICTURE_SENTENCE_AUDIO_VERSION
            });
            if (restored.status !== "ready") {
                return json(409, { error: "標準分段版仍在處理中，請稍後再試", result: restored });
            }
            return json(200, {
                success: true,
                restored: true,
                question_id: Number(question.id),
                active_candidate_id: null
            });
        }
        if (interactionType === "alphabet_round"
            && ["generate_set_audio", "retry_question_audio"].includes(action)) {
            return json(409, {
                error: "A–Z 固定教材只使用既有來源組合單一音檔，不會重新呼叫付費 TTS",
                code: "alphabet_provider_generation_disabled"
            });
        }
        if (action === "generate_visible_word_audio") {
            if (interactionType !== "picture_gap_sentence" && !manualPageDraft) return json(409, { error: "只有看圖補句關卡可產生整句發音" });
            const questionIds = questions.map((question: any) => Number(question.id));
            const { data: interactions, error: interactionError } = await admin.from("speaking_question_interactions")
                .select("question_id,interaction_type,prompt_text").in("question_id", questionIds);
            if (interactionError) throw interactionError;
            const interactionByQuestion = new Map((interactions || []).map((row: any) => [Number(row.question_id), row]));
            const gapQuestions = manualPageDraft
                ? questions.filter((question: any) => interactionByQuestion.get(Number(question.id))?.interaction_type === "picture_gap_sentence")
                : questions;
            const invalidInteraction = gapQuestions.some((question: any) => {
                const interaction: any = interactionByQuestion.get(Number(question.id));
                return interaction?.interaction_type !== "picture_gap_sentence" || !String(interaction?.prompt_text || "").trim();
            });
            if (!gapQuestions.length || invalidInteraction || (!manualPageDraft && interactions?.length !== questions.length)) {
                return json(409, { error: `${pictureGapPage || "看圖補句"} 整句資料不完整` });
            }
            const results = [];
            const femaleVoice = { gender: "female", voiceId: voicePool().female };
            for (const question of gapQuestions) {
                const interaction: any = interactionByQuestion.get(Number(question.id));
                try {
                    results.push(await generateQuestionAudio(admin, question, {
                        kind: "sentence_pattern", text: interaction?.prompt_text,
                        voiceChoice: femaleVoice, audioVersion: PICTURE_SENTENCE_AUDIO_VERSION
                    }));
                } catch (generationError: any) {
                    results.push({
                        question_id: Number(question.id), kind: "sentence_pattern", status: "failed",
                        error: cleanText(generationError?.message, 300) || "整句語音生成失敗"
                    });
                }
            }
            const failed = results.filter(item => item.status === "failed").length;
            const pending = results.filter(item => item.status !== "ready" && item.status !== "failed").length;
            return json(failed || pending ? 207 : 200, {
                success: failed === 0 && pending === 0,
                generated: results.filter(item => item.status === "ready" && !item.reused).length,
                reused: results.filter(item => item.status === "ready" && item.reused).length,
                failed, pending, results
            });
        }
        if (action === "preview_question_audio") {
            const question = questions[0];
            const { data: link, error: linkError } = await admin.from("speaking_question_audio")
                .select("asset_id,purpose").eq("question_id", question.id)
                .eq("purpose", interactionType === "picture_gap_sentence" ? "question_prompt" : "model_answer")
                .maybeSingle();
            if (linkError) throw linkError;
            if (!link?.asset_id) return json(404, { error: "這一題尚未產生示範語音" });
            const { data: asset, error: assetError } = await admin.from("speaking_tts_assets")
                .select("voice_id,status,private_object_key").eq("id", link.asset_id).maybeSingle();
            if (assetError) throw assetError;
            if (!asset || asset.status !== "ready" || !asset.private_object_key) {
                return json(409, { error: "這一題的示範語音尚未準備完成" });
            }
            const configuredVoices = voicePool();
            return json(200, {
                success: true,
                question_id: Number(question.id),
                voice_id: asset.voice_id,
                voice_gender: asset.voice_id === configuredVoices.male ? "male"
                    : asset.voice_id === configuredVoices.female ? "female" : "unknown",
                audio_url: await createR2PresignedUrl(asset.private_object_key, "GET", 15 * 60)
            });
        }
        if (manualPageDraft && action === "generate_set_audio") {
            const questionIds = questions.map((question: any) => Number(question.id));
            const { data: interactions, error: interactionError } = await admin.from("speaking_question_interactions")
                .select("question_id").in("question_id", questionIds);
            if (interactionError) throw interactionError;
            const pictureQuestionIds = new Set((interactions || []).map((row: any) => Number(row.question_id)));
            const standardQuestions = questions.filter((question: any) => !pictureQuestionIds.has(Number(question.id)));
            const results = [];
            for (const question of standardQuestions) {
                try { results.push(await generateQuestionAudio(admin, question)); }
                catch (generationError: any) {
                    results.push({ question_id: Number(question.id), status: "failed", error: cleanText(generationError?.message, 300) || "語音生成失敗" });
                }
            }
            const failed = results.filter(item => item.status === "failed").length;
            return json(failed ? 207 : 200, {
                success: failed === 0, generated: results.filter(item => item.status === "ready" && !item.reused).length,
                reused: results.filter(item => item.reused).length, failed, results
            });
        }
        const results = [];
        for (const question of questions.slice(0, 50)) {
            try { results.push(await generateQuestionAudio(admin, question)); }
            catch (generationError: any) {
                results.push({ question_id: Number(question.id), status: "failed", error: cleanText(generationError?.message, 300) || "語音生成失敗" });
            }
        }
        const failed = results.filter(item => item.status === "failed").length;
        return json(failed ? 207 : 200, {
            success: failed === 0, generated: results.filter(item => item.status === "ready" && !item.reused).length,
            reused: results.filter(item => item.reused).length, failed, results
        });
    } catch (error: any) {
        const status = Number(error?.status) || 500;
        const diagnostic = cleanText(error?.message, 180)
            .replace(/https?:\/\/\S+/gi, "[url]")
            .replace(/[A-Za-z0-9_-]{40,}/g, "[redacted]");
        console.error(
            "speaking-tts-manager error",
            status,
            String(error?.code || "unknown"),
            String(error?.name || "Error"),
            diagnostic || "no_message"
        );
        return json(status, { error: status < 500 ? String(error?.message || "請求失敗") : "教材示範語音服務發生錯誤", code: error?.code || null });
    }
});
