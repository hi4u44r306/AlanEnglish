// 每題片段：某一題對應到原本聽力音檔（或 YouTube 影片）的第幾毫秒到第幾毫秒。
// 學生只拿得到已核准的片段；播放片段不寫任何聽力紀錄。資料表：speaking_question_media_clips。

export const CLIP_MIN_MS = 500;
export const CLIP_MAX_MS = 120000;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export type ClipImportRow = {
    question_id: number;
    source_type: "audio" | "video";
    track_id: number | null;
    youtube_video_id: string | null;
    start_ms: number;
    end_ms: number;
    transcript_en: string | null;
};

export type PublicClip =
    | { type: "audio"; url: string; start_ms: number; end_ms: number }
    | { type: "video"; youtube_video_id: string; start_ms: number; end_ms: number };

const toInt = (value: unknown) => {
    const number = Number(value);
    return Number.isInteger(number) ? number : NaN;
};

// 管理員匯入的一筆片段。回傳 { row } 或 { error }（中文訊息），不碰資料庫。
// context.questionIds：這個關卡的題目；context.tracks：同一本書可用的音檔（id → 長度秒數，可為 null）。
export const validateClipImport = (
    input: any,
    context: { questionIds: Set<number>; tracks: Map<number, number | null> }
): { row: ClipImportRow } | { error: string } => {
    const questionId = toInt(input?.question_id);
    if (!context.questionIds.has(questionId)) return { error: "題目不屬於這個關卡" };
    const sourceType = input?.source_type === "video" ? "video" : input?.source_type === "audio" ? "audio" : "";
    if (!sourceType) return { error: "片段類型只能是 audio 或 video" };
    const startMs = toInt(input?.start_ms);
    const endMs = toInt(input?.end_ms);
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || startMs < 0 || endMs <= startMs) {
        return { error: "片段起訖時間不正確" };
    }
    if (endMs - startMs < CLIP_MIN_MS || endMs - startMs > CLIP_MAX_MS) return { error: "片段長度要在 0.5～120 秒之間" };
    const transcript = String(input?.transcript_en ?? "").trim().slice(0, 2000) || null;
    if (sourceType === "audio") {
        const trackId = toInt(input?.track_id);
        if (!context.tracks.has(trackId)) return { error: "音檔不屬於這本教材或已停用" };
        const durationSeconds = context.tracks.get(trackId);
        if (durationSeconds && endMs > Math.ceil(Number(durationSeconds) * 1000)) return { error: "片段超過音檔長度" };
        return { row: { question_id: questionId, source_type: "audio", track_id: trackId, youtube_video_id: null, start_ms: startMs, end_ms: endMs, transcript_en: transcript } };
    }
    const videoId = String(input?.youtube_video_id ?? "").trim();
    if (!YOUTUBE_ID.test(videoId)) return { error: "YouTube 影片編號不正確" };
    return { row: { question_id: questionId, source_type: "video", track_id: null, youtube_video_id: videoId, start_ms: startMs, end_ms: endMs, transcript_en: transcript } };
};

// 只有「跟著念」、示範與純練習會給片段；「自己說」不給，因為片段的聲音就含答案。
export const clipsAllowedForMode = (input: { challengeMode: string; demoMode: boolean; practiceOnly: boolean }) => (
    input.challengeMode === "easy" || input.demoMode || input.practiceOnly
);

export const toPublicClip = (clip: any, signedUrl: string | undefined): PublicClip | null => {
    const start = Number(clip?.start_ms);
    const end = Number(clip?.end_ms);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return null;
    if (clip?.source_type === "audio") return signedUrl ? { type: "audio", url: signedUrl, start_ms: start, end_ms: end } : null;
    if (clip?.source_type === "video" && YOUTUBE_ID.test(String(clip?.youtube_video_id || ""))) {
        return { type: "video", youtube_video_id: String(clip.youtube_video_id), start_ms: start, end_ms: end };
    }
    return null;
};

export const normalizeMusicStoragePath = (value: unknown) => {
    const raw = String(value ?? "").trim().slice(0, 2000);
    if (!raw) return "";
    if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, "");
    try {
        const url = new URL(raw);
        for (const marker of ["/storage/v1/object/public/music/", "/storage/v1/object/sign/music/"]) {
            const index = url.pathname.indexOf(marker);
            if (index >= 0) return decodeURIComponent(url.pathname.slice(index + marker.length));
        }
    } catch {
        return "";
    }
    return "";
};

// 讀出這些題目已核准的片段，回傳 question_id → 片段。音檔必須屬於同一本書且啟用中；同一條音檔只簽一次網址。
// 一題同時有音檔與影片時先給音檔。
export const loadApprovedClips = async (
    admin: any,
    questionIds: number[],
    bookId: number,
    signR2: (key: string) => Promise<string>,
    signedSeconds = 15 * 60
): Promise<Map<number, PublicClip>> => {
    const result = new Map<number, PublicClip>();
    if (!questionIds.length) return result;
    const { data: clips, error } = await admin.from("speaking_question_media_clips")
        .select("question_id,source_type,track_id,youtube_video_id,start_ms,end_ms")
        .in("question_id", questionIds).eq("status", "approved");
    if (error) throw error;
    if (!clips?.length) return result;
    const trackIds = [...new Set(clips.filter((clip: any) => clip.source_type === "audio").map((clip: any) => Number(clip.track_id)))];
    const signedByTrack = new Map<number, string>();
    if (trackIds.length) {
        const { data: tracks, error: trackError } = await admin.from("music_tracks")
            .select("id,audio_url,storage_provider").in("id", trackIds).eq("book_id", bookId).eq("enabled", true);
        if (trackError) throw trackError;
        await Promise.all((tracks || []).map(async (track: any) => {
            const path = normalizeMusicStoragePath(track.audio_url);
            if (!path) return;
            if (track.storage_provider === "r2") {
                signedByTrack.set(Number(track.id), await signR2(path));
                return;
            }
            const { data: signed } = await admin.storage.from("music").createSignedUrl(path, signedSeconds);
            if (signed?.signedUrl) signedByTrack.set(Number(track.id), signed.signedUrl);
        }));
    }
    const ordered = [...clips].sort((left: any, right: any) => (left.source_type === "audio" ? 0 : 1) - (right.source_type === "audio" ? 0 : 1));
    for (const clip of ordered) {
        const questionId = Number(clip.question_id);
        if (result.has(questionId)) continue;
        const publicClip = toPublicClip(clip, signedByTrack.get(Number(clip.track_id)));
        if (publicClip) result.set(questionId, publicClip);
    }
    return result;
};
