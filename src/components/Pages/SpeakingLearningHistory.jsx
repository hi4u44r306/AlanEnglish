import React, { useCallback, useEffect, useState } from "react";
import { FiBookOpen, FiMic, FiPlay, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
    deleteSpeakingRecording,
    getSpeakingLearningSummary,
    getSpeakingRecordingHistory,
    getSpeakingRecordingUrl
} from "../../services/pronunciationCoachService";
import "./css/SpeakingLearningHistory.scss";
import SpeakingRecordingPlayer from "./SpeakingRecordingPlayer";

const formatDate = value => new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
}).format(new Date(value));

const scoreTone = score => score >= 80 ? "good" : score >= 60 ? "practice" : "retry";
const scoreLabel = score => score >= 80 ? "很清楚" : score >= 60 ? "再練一下" : "慢慢重念";
const STAFF_DEMO_SUMMARY = { learned_sentences: 12, learned_words: 36, saved_recordings: 4 };
const STAFF_DEMO_RECORDINGS = [{
    id: "demo-1", pronunciation_score: 88, recognized_text: "Nice to meet you, too.",
    question_text: "Nice to meet you!", challenge_title: "02 打招呼與禮貌對話", book_name: "Workbook 1"
}, {
    id: "demo-2", pronunciation_score: 72, recognized_text: "I'm great, thank you.",
    question_text: "How are you today?", challenge_title: "02 打招呼與禮貌對話", book_name: "Workbook 1"
}];

export default function SpeakingLearningHistory() {
    const { firebaseUser, role } = useAuth();
    const isStaffDemo = role === "teacher" || role === "admin";
    const [summary, setSummary] = useState({ learned_sentences: 0, learned_words: 0, saved_recordings: 0 });
    const [recordings, setRecordings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [workingId, setWorkingId] = useState(null);
    const [playing, setPlaying] = useState(null);
    const [nextBeforeId, setNextBeforeId] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (!firebaseUser) return;
        if (isStaffDemo) {
            setSummary(STAFF_DEMO_SUMMARY);
            setRecordings(STAFF_DEMO_RECORDINGS);
            setNextBeforeId(null);
            setError("");
            setLoading(false);
            return;
        }
        setLoading(true); setError("");
        try {
            const [summaryResult, historyResult] = await Promise.all([
                getSpeakingLearningSummary(firebaseUser),
                getSpeakingRecordingHistory(firebaseUser)
            ]);
            setSummary(summaryResult.summary || {});
            setRecordings(historyResult.recordings || []);
            setNextBeforeId(historyResult.next_before_id || null);
        } catch (cause) { setError(cause?.message || "口說學習歷程暫時無法載入"); }
        finally { setLoading(false); }
    }, [firebaseUser, isStaffDemo]);

    useEffect(() => { load(); }, [load]);

    const loadMore = async () => {
        if (!firebaseUser || !nextBeforeId || loadingMore) return;
        setLoadingMore(true); setError("");
        try {
            const result = await getSpeakingRecordingHistory(firebaseUser, nextBeforeId);
            setRecordings(current => [...current, ...(result.recordings || [])]);
            setNextBeforeId(result.next_before_id || null);
        } catch (cause) { setError(cause?.message || "更多錄音暫時無法載入"); }
        finally { setLoadingMore(false); }
    };

    const play = async recording => {
        setWorkingId(recording.id); setError("");
        try {
            const result = await getSpeakingRecordingUrl(firebaseUser, recording.id);
            setPlaying({ id: recording.id, url: result.audio_url });
        } catch (cause) { setError(cause?.message || "私人錄音暫時無法播放"); }
        finally { setWorkingId(null); }
    };

    const remove = async recording => {
        if (!window.confirm("確定刪除這次錄音嗎？分數與完成紀錄會保留。")) return;
        setWorkingId(recording.id); setError("");
        try {
            await deleteSpeakingRecording(firebaseUser, recording.id);
            if (playing?.id === recording.id) setPlaying(null);
            setRecordings(current => current.filter(item => item.id !== recording.id));
            setSummary(current => ({ ...current, saved_recordings: Math.max(0, Number(current.saved_recordings || 0) - 1) }));
        } catch (cause) { setError(cause?.message || "私人錄音暫時無法刪除"); }
        finally { setWorkingId(null); }
    };

    return <main className="speaking-history-page">
        <header className="speaking-history-hero">
            <div><span>MY SPEAKING JOURNEY</span><h1>{isStaffDemo ? "口說學習歷程示範" : "我的口說學習歷程"}</h1><p>{isStaffDemo ? "用範例資料向學生介紹學習累積與私人錄音畫面。" : "回來聽自己說過的英文，看見句子與單字一點一點累積。"}</p></div>
            <Link to="/student/speaking-challenges"><FiMic />{isStaffDemo ? "示範口說大挑戰" : "繼續口說練習"}</Link>
        </header>

        {isStaffDemo && <div className="speaking-history-demo" role="note"><strong>老師／管理員示範模式</strong><span>以下皆為固定範例，不會讀取任何學生的統計或私人錄音，也不會寫入資料庫。</span></div>}

        <section className="speaking-history-stats" aria-label="口說學習成果">
            <article><strong>{Number(summary.learned_sentences || 0).toLocaleString("zh-TW")}</strong><span>已學句子</span></article>
            <article><strong>{Number(summary.learned_words || 0).toLocaleString("zh-TW")}</strong><span>不重複單字</span></article>
            <article><strong>{Number(summary.saved_recordings || 0).toLocaleString("zh-TW")}</strong><span>私人錄音</span></article>
        </section>

        {error && <div className="speaking-history-error" role="alert"><span>{error}</span><button type="button" onClick={load}><FiRefreshCw />重新整理</button></div>}
        {loading && <p className="speaking-history-loading">正在整理你的口說成果…</p>}

        {!loading && <section className="speaking-history-list" aria-label={isStaffDemo ? "口說歷程範例" : "我的私人錄音"}>
            <header><div><span>{isStaffDemo ? "DEMO RECORDINGS" : "PRIVATE RECORDINGS"}</span><h2>{isStaffDemo ? "錄音紀錄範例" : "我的錄音"}</h2></div><small>{isStaffDemo ? "學生本人可回聽與刪除自己的錄音" : "每題最多保留最新一次與最高分一次"}</small></header>
            {recordings.map(recording => <article key={recording.id} className="speaking-history-recording">
                <div className="speaking-history-recording__icon"><FiBookOpen /></div>
                <div className="speaking-history-recording__copy">
                    <small>{recording.book_name} · {recording.challenge_title}</small>
                    <strong>{recording.question_text}</strong>
                    <p>{recording.recognized_text || "這次沒有可顯示的辨識文字"}</p>
                    <span>{isStaffDemo ? "示範資料" : formatDate(recording.created_at)}</span>
                </div>
                <div className="speaking-history-recording__actions">
                    <span className={`score-${scoreTone(recording.pronunciation_score)}`}>{scoreLabel(recording.pronunciation_score)}</span>
                    {!isStaffDemo && <button type="button" onClick={() => play(recording)} disabled={workingId === recording.id}><FiPlay />{workingId === recording.id ? "載入中" : "回聽"}</button>}
                    {!isStaffDemo && <button type="button" className="delete" onClick={() => remove(recording)} disabled={workingId === recording.id} aria-label={`刪除 ${recording.question_text} 的錄音`}><FiTrash2 /></button>}
                </div>
                {!isStaffDemo && playing?.id === recording.id && <div className="speaking-history-recording__audio"><SpeakingRecordingPlayer src={playing.url} label="我的錄音" ariaLabel={`${recording.question_text} 的私人錄音`} autoPlay /></div>}
            </article>)}
            {!recordings.length && <div className="speaking-history-empty"><FiMic /><h2>還沒有保存的錄音</h2><p>完成一次口說評分後，錄音就會出現在這裡。</p><Link to="/student/speaking-challenges">開始第一題</Link></div>}
            {!isStaffDemo && nextBeforeId && <button type="button" className="speaking-history-more" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "載入中…" : "載入更多錄音"}</button>}
        </section>}
    </main>;
}
