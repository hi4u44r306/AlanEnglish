import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { importSpeakingQuestionClips, listSpeakingQuestionClips, reviewSpeakingQuestionClip } from "../../services/speakingContentService";
import SpeakingQuestionClip from "./SpeakingQuestionClip";

const seconds = ms => (Number(ms) / 1000).toFixed(1);

// 把片段腳本（clipper）輸出的 clips 轉成匯入格式：n 是第幾題（依關卡題序），音檔由管理員選。
export const clipsFromScriptOutput = (parsed, questions, trackId) => {
    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.clips) ? parsed.clips : [];
    return items.map(item => {
        const question = item.question_id
            ? questions.find(candidate => Number(candidate.id) === Number(item.question_id))
            : questions[Number(item.n) - 1];
        return {
            question_id: question ? Number(question.id) : null,
            source_type: item.source_type || "audio",
            track_id: item.track_id ?? trackId,
            youtube_video_id: item.youtube_video_id,
            start_ms: Number(item.start_ms),
            end_ms: Number(item.end_ms),
            transcript_en: item.transcript_en ?? item.text ?? null,
            generation_metadata: {
                source: "clipper_script",
                ...(item.confidence !== undefined ? { confidence: item.confidence } : {}),
                ...(item.heard ? { heard: item.heard } : {}),
                ...(item.repeats !== undefined ? { repeats: item.repeats } : {})
            }
        };
    }).filter(item => item.question_id);
};

export default function SpeakingQuestionClipReview({ firebaseUser, questionSetId }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [working, setWorking] = useState("");
    const [importText, setImportText] = useState("");
    const [trackId, setTrackId] = useState("");

    const load = useCallback(async () => {
        setError("");
        try {
            const result = await listSpeakingQuestionClips(firebaseUser, questionSetId);
            setData(result);
            setTrackId(current => current || String(result?.tracks?.[0]?.id || ""));
        } catch (cause) {
            setError(cause?.message || "暫時無法讀取每題片段");
        }
    }, [firebaseUser, questionSetId]);

    useEffect(() => { load(); }, [load]);

    const runImport = async () => {
        let parsed;
        try {
            parsed = JSON.parse(importText);
        } catch {
            toast.error("片段資料不是正確的 JSON");
            return;
        }
        const clips = clipsFromScriptOutput(parsed, data?.questions || [], Number(trackId));
        if (!clips.length) {
            toast.error("沒有可對應到題目的片段");
            return;
        }
        setWorking("import");
        try {
            const result = await importSpeakingQuestionClips(firebaseUser, questionSetId, clips);
            const rejected = (result?.results || []).filter(item => item.status === "rejected");
            toast.success(`新增 ${result?.created || 0} 段，略過重複 ${result?.skipped || 0} 段${rejected.length ? `，${rejected.length} 段不符規則` : ""}`);
            if (rejected.length) toast.error(rejected.map(item => `第 ${item.index + 1} 筆：${item.error}`).join("\n"));
            setImportText("");
            await load();
        } catch (cause) {
            toast.error(cause?.message || "匯入失敗");
        } finally { setWorking(""); }
    };

    const review = async (clipId, decision) => {
        setWorking(`${decision}-${clipId}`);
        try {
            await reviewSpeakingQuestionClip(firebaseUser, clipId, decision);
            await load();
        } catch (cause) {
            toast.error(cause?.message || "審核失敗");
        } finally { setWorking(""); }
    };

    if (error) return <div className="speaking-clip-review" role="alert">{error} <button type="button" className="platform-secondary" onClick={load}>重新讀取</button></div>;
    if (!data) return <div className="speaking-clip-review">讀取每題片段中…</div>;

    const clipsByQuestion = new Map();
    for (const clip of data.clips || []) {
        clipsByQuestion.set(Number(clip.question_id), [...(clipsByQuestion.get(Number(clip.question_id)) || []), clip]);
    }
    const approvedCount = (data.questions || []).filter(question => (clipsByQuestion.get(Number(question.id)) || []).some(clip => clip.status === "approved")).length;

    return <section className="speaking-clip-review" aria-label="每題片段">
        <header>
            <strong>每題片段（聽這題）</strong>
            <span>已核准 {approvedCount}／{(data.questions || []).length} 題。學生在「跟著念」才會看到「聽這題」，聽片段不算聽力次數。請逐段試聽：不能有題號，要聽得到完整問答。</span>
        </header>
        <ol>
            {(data.questions || []).map((question, index) => {
                const clips = clipsByQuestion.get(Number(question.id)) || [];
                return <li key={question.id}>
                    <p><b>第 {index + 1} 題</b> {question.model_answer}</p>
                    {!clips.length && <small>尚無片段</small>}
                    {clips.map(clip => <div key={clip.id} className="speaking-clip-review__clip">
                        <span className={`speaking-clip-review__status is-${clip.status}`}>{clip.status === "approved" ? "已核准" : "草稿"}</span>
                        <span>{seconds(clip.start_ms)}～{seconds(clip.end_ms)} 秒{clip.transcript_en ? `｜${clip.transcript_en}` : ""}</span>
                        {clip.source_type === "audio" && <SpeakingQuestionClip clip={{ type: "audio", url: data.preview_urls?.[String(clip.track_id)], start_ms: clip.start_ms, end_ms: clip.end_ms }} />}
                        {clip.source_type === "video" && <small>YouTube {clip.youtube_video_id}</small>}
                        {clip.status === "draft" && <button type="button" className="platform-primary" disabled={Boolean(working)} onClick={() => review(clip.id, "approve")}>{working === `approve-${clip.id}` ? "核准中…" : "試聽沒問題，核准"}</button>}
                        <button type="button" className="platform-danger" disabled={Boolean(working)} onClick={() => review(clip.id, "archive")}>{working === `archive-${clip.id}` ? "移除中…" : "移除"}</button>
                    </div>)}
                </li>;
            })}
        </ol>
        <details>
            <summary>匯入片段（片段腳本輸出的 JSON）</summary>
            <label>來源音檔
                <select value={trackId} onChange={event => setTrackId(event.target.value)}>
                    {(data.tracks || []).map(track => <option key={track.id} value={track.id}>{track.title || track.page}</option>)}
                </select>
            </label>
            <textarea value={importText} onChange={event => setImportText(event.target.value)} rows={6} placeholder='{"clips":[{"n":1,"start_ms":6280,"end_ms":11580,"text":"It is an eye."}]}' aria-label="片段 JSON" />
            <button type="button" className="platform-secondary" disabled={working === "import" || !importText.trim()} onClick={runImport}>{working === "import" ? "匯入中…" : "匯入成草稿"}</button>
        </details>
    </section>;
}
