import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { cleanText, verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { fetchR2, normalizeObjectKey } from "../_shared/r2.ts";
import { spokenExampleText } from "../_shared/speaking-tts-text.ts";

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
const DEFAULT_VOICE_ID = "en-US-Chirp3-HD-Autonoe";
const SETTINGS = Object.freeze({ audioEncoding: "LINEAR16", speakingRate: 0.82 });
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
let cachedGoogleToken: { value: string; expiresAt: number } | null = null;

const sha256 = async (value: string) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
};

const voiceId = () => cleanText(Deno.env.get("GOOGLE_CLOUD_TTS_VOICE_NAME"), 120) || DEFAULT_VOICE_ID;

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

const requestGoogleAudio = async (text: string, selectedVoice: string) => {
    const accessToken = await getGoogleAccessToken();
    const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            input: { text }, voice: { languageCode: LANGUAGE_CODE, name: selectedVoice }, audioConfig: SETTINGS
        })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.audioContent) {
        throw Object.assign(new Error("Google Cloud TTS 暫時無法產生示範語音"), {
            status: response.status >= 500 ? 502 : 400,
            code: cleanText(payload?.error?.status, 80) || `google_tts_http_${response.status}`
        });
    }
    return { bytes: decodeGoogleAudio(payload.audioContent), usedCharacters: text.length };
};

const generateQuestionAudio = async (admin: any, question: any) => {
    const text = spokenExampleText(question?.model_answer);
    if (!text) return { question_id: Number(question.id), status: "failed", error: "示範回答是空白" };
    const selectedVoice = voiceId();
    const contentHash = await sha256(text);
    const settingsHash = await sha256(JSON.stringify({
        provider: PROVIDER, voice_id: selectedVoice, language_code: LANGUAGE_CODE,
        output_format: OUTPUT_FORMAT, sample_rate: "provider_default", pipeline_version: PIPELINE_VERSION, settings: SETTINGS
    }));

    const { data: existing, error: existingError } = await admin.from("speaking_tts_assets")
        .select("id,status,private_object_key,updated_at")
        .eq("provider", PROVIDER).eq("content_hash", contentHash)
        .eq("voice_id", selectedVoice).eq("settings_hash", settingsHash).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === "ready" && existing.private_object_key) {
        const { error: linkError } = await admin.from("speaking_question_audio").upsert({
            question_id: question.id, asset_id: existing.id, purpose: "model_answer", updated_at: new Date().toISOString()
        }, { onConflict: "question_id" });
        if (linkError) throw linkError;
        return { question_id: Number(question.id), status: "ready", reused: true };
    }
    if (existing?.status === "processing" && Date.now() - Date.parse(existing.updated_at) < 5 * 60 * 1000) {
        return { question_id: Number(question.id), status: "processing", reused: true };
    }

    const now = new Date().toISOString();
    let asset = existing;
    if (asset) {
        const { data, error } = await admin.from("speaking_tts_assets").update({
            status: "processing", error_code: null, error_message: null, updated_at: now
        }).eq("id", asset.id).select("id").single();
        if (error) throw error;
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
                await admin.from("speaking_question_audio").upsert({ question_id: question.id, asset_id: raced.id, purpose: "model_answer", updated_at: now }, { onConflict: "question_id" });
                return { question_id: Number(question.id), status: "ready", reused: true };
            }
            return { question_id: Number(question.id), status: "processing", reused: true };
        }
        if (error) throw error;
        asset = data;
    }

    try {
        const generated = await requestGoogleAudio(text, selectedVoice);
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
        const { error: linkError } = await admin.from("speaking_question_audio").upsert({
            question_id: question.id, asset_id: asset.id, purpose: "model_answer", updated_at: completedAt
        }, { onConflict: "question_id" });
        if (linkError) throw linkError;
        return { question_id: Number(question.id), status: "ready", reused: false };
    } catch (error: any) {
        await admin.from("speaking_tts_assets").update({
            status: "failed", error_code: cleanText(error?.code, 120) || "generation_failed",
            error_message: cleanText(error?.message, 500) || "語音生成失敗", updated_at: new Date().toISOString()
        }).eq("id", asset.id);
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
        if (action !== "generate_set_audio" && action !== "retry_question_audio") return json(400, { error: "不支援的操作" });
        const setId = Number(body?.question_set_id);
        const requestedQuestionId = action === "retry_question_audio" ? Number(body?.question_id) : null;
        if (!Number.isInteger(setId) || setId <= 0 || (requestedQuestionId !== null && (!Number.isInteger(requestedQuestionId) || requestedQuestionId <= 0))) {
            return json(400, { error: "題庫或題目編號不正確" });
        }
        let query = admin.from("speaking_questions").select("id,question_set_id,model_answer,speaking_question_sets(status)").eq("question_set_id", setId);
        if (requestedQuestionId !== null) query = query.eq("id", requestedQuestionId);
        const { data: questions, error } = await query.order("sort_order");
        if (error) throw error;
        if (!questions?.length) return json(404, { error: "找不到需要產生語音的題目" });
        const setStatus = Array.isArray(questions[0]?.speaking_question_sets)
            ? questions[0].speaking_question_sets[0]?.status : questions[0]?.speaking_question_sets?.status;
        if (setStatus !== "published") return json(409, { error: "只有已發布題庫可以產生正式示範語音" });
        const results = [];
        for (const question of questions.slice(0, 20)) {
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
        console.error("speaking-tts-manager error", status, String(error?.code || "unknown"));
        return json(status, { error: status < 500 ? String(error?.message || "請求失敗") : "教材示範語音服務發生錯誤", code: error?.code || null });
    }
});
