import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Headphones, RotateCcw, Volume2, XCircle } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { getStudentSpiralQueue, submitSpiralAnswer } from "../../services/spiralReviewService";
import "./css/SpiralReview.scss";

const speak = text => {
    if (!("speechSynthesis" in window)) throw new Error("這個瀏覽器目前無法播放單字語音");
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.78;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
};
const makeRequestKey = () => {
    const cryptoApi = window.crypto;
    if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => {
        const random = cryptoApi?.getRandomValues
            ? cryptoApi.getRandomValues(new Uint8Array(1))[0] % 16
            : Math.floor(Math.random() * 16);
        const value = character === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
    });
};

const StudentSpiralReview = () => {
    const { firebaseUser } = useAuth();
    const [queue, setQueue] = useState([]);
    const [dueCount, setDueCount] = useState(0);
    const [index, setIndex] = useState(0);
    const [selectedId, setSelectedId] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const requestKeyRef = useRef(makeRequestKey());
    const activeCard = queue[index] || null;

    useEffect(() => {
        let active = true;
        getStudentSpiralQueue(firebaseUser).then(response => {
            if (!active) return;
            setQueue(response.cards || []);
            setDueCount(Number(response.due_count || 0));
        }).catch(error => active && setMessage(error.message)).finally(() => active && setLoading(false));
        return () => { active = false; window.speechSynthesis?.cancel(); };
    }, [firebaseUser]);

    useEffect(() => {
        if (!activeCard) return;
        const timer = window.setTimeout(() => {
            try { speak(activeCard.audio_text); } catch (error) { setMessage(error.message); }
        }, 350);
        return () => window.clearTimeout(timer);
    }, [activeCard]);

    const submit = async () => {
        if (!activeCard || !selectedId || busy) return;
        setBusy(true);
        setMessage("");
        try {
            const response = await submitSpiralAnswer(firebaseUser, {
                assignment_id: activeCard.assignment_id,
                card_id: activeCard.card_id,
                selected_card_id: selectedId,
                request_key: requestKeyRef.current
            });
            setResult(response);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    };
    const next = () => {
        setSelectedId(null);
        setResult(null);
        requestKeyRef.current = makeRequestKey();
        setIndex(current => current + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (loading) return <main className="spiral-page"><div className="spiral-loading">正在準備今天的複習卡…</div></main>;
    if (!activeCard) return <main className="spiral-page"><section className="spiral-complete"><CheckCircle2 /><h1>{index ? "今天的複習完成！" : "今天沒有待複習內容"}</h1><p>{index ? `你完成了 ${index} 張卡，明天會依學習狀況安排下一輪。` : "老師發布教材頁碼複習後，會在這裡出現。"}</p></section></main>;

    return (
        <main className="spiral-page spiral-student-page">
            <header className="spiral-study-header"><div><span>{activeCard.unit?.book?.name} · P{activeCard.unit.page_start}–P{activeCard.unit.page_end}</span><h1>{activeCard.unit.title}</h1></div><strong>{index + 1} / {Math.min(dueCount, 20)}</strong></header>
            {message && <div className="spiral-message" role="alert">{message}</div>}
            <section className={`spiral-quiz ${result ? (result.is_correct ? "is-correct" : "is-wrong") : ""}`}>
                <div className="spiral-audio-prompt"><button type="button" onClick={() => speak(activeCard.audio_text)} aria-label="再聽一次"><Volume2 /></button><div><span>仔細聽，再選出你聽到的英文</span><strong>按喇叭可以再聽一次</strong></div></div>
                <div className="spiral-choice-grid">
                    {activeCard.choices.map(choice => <button type="button" key={choice.id} disabled={Boolean(result)} className={selectedId === choice.id ? "selected" : ""} onClick={() => setSelectedId(choice.id)}>{choice.label}</button>)}
                </div>
                {!result ? <button className="spiral-primary" type="button" disabled={!selectedId || busy} onClick={submit}><Headphones />{busy ? "確認中…" : "確認答案"}</button> : (
                    <div className="spiral-feedback" role="status">
                        {result.is_correct ? <CheckCircle2 /> : <XCircle />}
                        <div><strong>{result.is_correct ? "答對了！" : "再聽一次，明天會再複習"}</strong><span>{result.is_correct ? `下一輪安排在 ${result.next_review_at}` : `正確答案是 ${result.correct_answer}`}</span></div>
                        <button type="button" onClick={next}>{index + 1 < queue.length ? "下一張" : "完成"}</button>
                    </div>
                )}
            </section>
            <p className="spiral-study-note"><RotateCcw />答錯不會扣分，系統會在隔天再次安排。</p>
        </main>
    );
};

export default StudentSpiralReview;
