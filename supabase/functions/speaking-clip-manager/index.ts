// 每題片段（聽這題）的管理端：列出、匯入草稿、核准／移除。只有管理員可用。
// 學生端由 speaking-challenge 讀取已核准的片段；這裡不碰任何學生紀錄。
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { cleanText, verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { createR2PresignedUrl } from "../_shared/r2.ts";
import { normalizeMusicStoragePath, validateClipImport } from "../_shared/speaking-question-clips.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, payload: Record<string, unknown>) => new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
});

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Supabase 伺服器設定不完整" });
        const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const user = await verifyFirebaseRequest(req, admin);
        if (user.role !== "admin") return json(403, { error: "只有管理員可以管理每題片段" });
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action, 80);

        if (action === "list_question_clips" || action === "import_question_clips") {
            const setId = Number(body?.question_set_id);
            if (!Number.isInteger(setId) || setId <= 0) return json(400, { error: "題庫編號不正確" });
            const { data: questionSet, error: setError } = await admin.from("speaking_question_sets")
                .select("id,book_id,title,status,speaking_questions!speaking_questions_question_set_id_fkey(id,sort_order,model_answer)")
                .eq("id", setId).neq("status", "archived").maybeSingle();
            if (setError) throw setError;
            if (!questionSet) return json(404, { error: "找不到這個口說關卡" });
            const questions = [...(questionSet.speaking_questions || [])]
                .sort((left: any, right: any) => Number(left.sort_order) - Number(right.sort_order));
            const questionIds = questions.map((question: any) => Number(question.id));
            const { data: tracks, error: trackError } = await admin.from("music_tracks")
                .select("id,title,page,duration_seconds,audio_url,storage_provider")
                .eq("book_id", Number(questionSet.book_id)).eq("enabled", true).order("sort_order");
            if (trackError) throw trackError;

            if (action === "import_question_clips") {
                const inputs = Array.isArray(body?.clips) ? body.clips.slice(0, 100) : [];
                if (!inputs.length) return json(400, { error: "沒有要匯入的片段" });
                const context = {
                    questionIds: new Set<number>(questionIds),
                    tracks: new Map<number, number | null>((tracks || []).map((track: any) => [
                        Number(track.id), track.duration_seconds === null ? null : Number(track.duration_seconds)
                    ]))
                };
                const results: any[] = [];
                const now = new Date().toISOString();
                for (const [index, input] of inputs.entries()) {
                    const checked = validateClipImport(input, context);
                    if ("error" in checked) {
                        results.push({ index, status: "rejected", error: checked.error });
                        continue;
                    }
                    const metadata = input?.generation_metadata && typeof input.generation_metadata === "object" && !Array.isArray(input.generation_metadata)
                        ? input.generation_metadata : {};
                    const { data: inserted, error: insertError } = await admin.from("speaking_question_media_clips").insert({
                        ...checked.row, status: "draft", generation_metadata: metadata,
                        created_by: Number(user.id), created_at: now, updated_at: now
                    }).select("id").single();
                    if (insertError?.code === "23505") {
                        results.push({ index, status: "skipped", reason: "duplicate" });
                        continue;
                    }
                    if (insertError) throw insertError;
                    results.push({ index, status: "created", clip_id: Number(inserted.id) });
                }
                return json(200, {
                    success: true,
                    created: results.filter(item => item.status === "created").length,
                    skipped: results.filter(item => item.status === "skipped").length,
                    rejected: results.filter(item => item.status === "rejected").length,
                    results
                });
            }

            const { data: clips, error: clipError } = questionIds.length
                ? await admin.from("speaking_question_media_clips")
                    .select("id,question_id,source_type,track_id,youtube_video_id,start_ms,end_ms,status,transcript_en,generation_metadata,approved_at,created_at")
                    .in("question_id", questionIds).neq("status", "archived").order("id")
                : { data: [], error: null };
            if (clipError) throw clipError;
            // 管理員試聽用：只簽有片段用到的音檔。
            const usedTrackIds = new Set((clips || []).map((clip: any) => Number(clip.track_id)).filter(Boolean));
            const previewUrls: Record<string, string> = {};
            await Promise.all((tracks || []).filter((track: any) => usedTrackIds.has(Number(track.id))).map(async (track: any) => {
                const path = normalizeMusicStoragePath(track.audio_url);
                if (!path) return;
                if (track.storage_provider === "r2") {
                    previewUrls[String(track.id)] = await createR2PresignedUrl(path, "GET", 15 * 60);
                    return;
                }
                const { data: signed } = await admin.storage.from("music").createSignedUrl(path, 15 * 60);
                if (signed?.signedUrl) previewUrls[String(track.id)] = signed.signedUrl;
            }));
            return json(200, {
                success: true,
                question_set: { id: questionSet.id, book_id: questionSet.book_id, title: questionSet.title, status: questionSet.status },
                questions: questions.map((question: any) => ({ id: question.id, sort_order: question.sort_order, model_answer: question.model_answer })),
                tracks: (tracks || []).map((track: any) => ({ id: track.id, title: track.title, page: track.page })),
                clips: clips || [],
                preview_urls: previewUrls
            });
        }

        if (action === "review_question_clip") {
            const clipId = Number(body?.clip_id);
            const decision = body?.decision === "approve" ? "approve" : body?.decision === "archive" ? "archive" : "";
            if (!Number.isInteger(clipId) || clipId <= 0 || !decision) return json(400, { error: "片段或審核動作不正確" });
            const { data: clip, error: clipError } = await admin.from("speaking_question_media_clips")
                .select("id,question_id,source_type,status").eq("id", clipId).maybeSingle();
            if (clipError) throw clipError;
            if (!clip || clip.status === "archived") return json(404, { error: "找不到這個片段" });
            const now = new Date().toISOString();
            if (decision === "archive") {
                const { error } = await admin.from("speaking_question_media_clips")
                    .update({ status: "archived", updated_at: now }).eq("id", clipId);
                if (error) throw error;
                return json(200, { success: true, clip_id: clipId, status: "archived" });
            }
            if (clip.status === "approved") return json(200, { success: true, clip_id: clipId, status: "approved" });
            // 同一題同類型只留一個核准片段：先封存舊的再核准新的。中途失敗時那一題只會暫時沒有片段。
            const { error: archiveError } = await admin.from("speaking_question_media_clips")
                .update({ status: "archived", updated_at: now })
                .eq("question_id", Number(clip.question_id)).eq("source_type", clip.source_type)
                .eq("status", "approved").neq("id", clipId);
            if (archiveError) throw archiveError;
            const { error: approveError } = await admin.from("speaking_question_media_clips")
                .update({ status: "approved", reviewed_by: Number(user.id), approved_at: now, updated_at: now })
                .eq("id", clipId).eq("status", "draft");
            if (approveError?.code === "23505") return json(409, { error: "這題已有另一個核准片段，請重新整理後再試" });
            if (approveError) throw approveError;
            return json(200, { success: true, clip_id: clipId, status: "approved" });
        }

        return json(400, { error: "不支援的操作" });
    } catch (error) {
        const status = Number((error as any)?.status || 500);
        console.error("speaking-clip-manager error", status, String((error as any)?.code || "unknown"));
        return json(status, { error: status < 500 ? String((error as any)?.message || "請求失敗") : "每題片段服務發生錯誤" });
    }
});
