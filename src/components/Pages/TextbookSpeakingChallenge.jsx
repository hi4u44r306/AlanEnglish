import React, { useEffect, useRef, useState } from "react";
import { FiBookOpen, FiCheck, FiChevronLeft, FiChevronRight, FiMic } from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { completeSpeakingChallengeQuestion, getSpeakingChallengeCatalog, getSpeakingChallengeSet } from "../../services/speakingChallengeService";
import SpeakingPracticeSteps from "./SpeakingPracticeSteps";
import "./css/TextbookSpeakingChallenge.scss";

export default function TextbookSpeakingChallenge() {
    const { firebaseUser } = useAuth();
    const { questionSetId } = useParams();
    const navigate = useNavigate();
    const [catalog, setCatalog] = useState([]);
    const [challenge, setChallenge] = useState(null);
    const [error, setError] = useState("");
    const [audioWorking, setAudioWorking] = useState("");
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
    const audioRef = useRef(null);

    useEffect(() => () => {
        audioRef.current?.pause();
        audioRef.current = null;
    }, []);

    useEffect(() => {
        if (!firebaseUser) return;
        const load = async () => {
            try {
                if (questionSetId) {
                    setActiveQuestionIndex(0);
                    setChallenge((await getSpeakingChallengeSet(firebaseUser, Number(questionSetId))).challenge);
                }
                else setCatalog((await getSpeakingChallengeCatalog(firebaseUser)).challenges || []);
            } catch (loadError) { setError(loadError.message || "口說大挑戰載入失敗"); }
        };
        load();
    }, [firebaseUser, questionSetId]);

    const markComplete = async question => {
        try {
            await completeSpeakingChallengeQuestion(firebaseUser, challenge.id, question.id);
            setChallenge(current => ({ ...current, speaking_questions: current.speaking_questions.map(item => item.id === question.id ? { ...item, progress_status: "completed" } : item) }));
        } catch (saveError) { setError(saveError.message || "無法儲存練習紀錄"); }
    };

    const markScored = async question => {
        if (question.progress_status !== "completed") await markComplete(question);
    };

    const playModelAudio = question => {
        if (!question.model_audio_url) return;
        audioRef.current?.pause();
        const audio = new Audio(question.model_audio_url);
        audioRef.current = audio;
        setAudioWorking(String(question.id));
        const clear = () => setAudioWorking(current => current === String(question.id) ? "" : current);
        audio.addEventListener("ended", clear, { once: true });
        audio.addEventListener("error", () => { clear(); setError("示範語音暫時無法播放，請重新整理後再試"); }, { once: true });
        audio.play().catch(() => { clear(); setError("瀏覽器阻擋了示範語音，請再按一次播放"); });
    };

    if (error) return <main className="speaking-challenge-page"><section className="speaking-challenge-empty"><FiMic /><h1>口說大挑戰暫時無法開啟</h1><p>{error}</p><Link to="/student/membership">查看方案與功能</Link></section></main>;
    if (!questionSetId) return <main className="speaking-challenge-page"><header className="speaking-challenge-hero"><span>TEXTBOOK SPEAKING</span><h1>口說大挑戰</h1><p>每一本到達一個大關卡；跟著題目開口說，先練習，再完成小關卡。</p></header><section className="speaking-challenge-grid">{catalog.map(item => <button key={item.id} onClick={() => navigate(`/student/speaking-challenges/${item.id}`)}><FiBookOpen /><small>{item.book?.name || "教材"} · 第 {item.version} 版</small><strong>{item.title}</strong><span>{item.topic} · {item.difficulty}</span><footer>{item.completed_count}/{item.question_count} 題已練習</footer></button>)}{!catalog.length && <div className="speaking-challenge-empty"><FiBookOpen /><h2>還沒有可挑戰的教材</h2><p>老師發布題庫後，會在這裡出現。</p></div>}</section></main>;
    if (!challenge) return <main className="speaking-challenge-page"><p>載入小關卡中…</p></main>;
    const questions = challenge.speaking_questions || [];
    const activeQuestion = questions[activeQuestionIndex];
    const completedCount = questions.filter(question => question.progress_status === "completed").length;
    const progressPercent = questions.length ? Math.round((completedCount / questions.length) * 100) : 0;

    if (!activeQuestion) return <main className="speaking-challenge-page"><section className="speaking-challenge-empty"><FiBookOpen /><h1>這個大挑戰還沒有小關卡</h1><p>請稍後再回來練習。</p><button type="button" className="speaking-back" onClick={() => navigate("/student/speaking-challenges")}><FiChevronLeft />全部大挑戰</button></section></main>;

    const isCompleted = activeQuestion.progress_status === "completed";
    const isLastQuestion = activeQuestionIndex === questions.length - 1;
    const goForward = () => {
        if (!isCompleted) return;
        if (isLastQuestion) navigate("/student/speaking-challenges");
        else setActiveQuestionIndex(current => current + 1);
    };

    return <main className="speaking-challenge-page speaking-challenge-detail">
        <header className="speaking-lesson-header">
            <button className="speaking-back" onClick={() => navigate("/student/speaking-challenges")}><FiChevronLeft />全部大挑戰</button>
            <div className="speaking-lesson-heading">
                <span>{challenge.books?.name || "教材"}</span>
                <h1>{challenge.title}</h1>
                <p>{challenge.topic} · {challenge.difficulty}</p>
            </div>
            <div className="speaking-lesson-progress">
                <div><span>小關卡 {activeQuestionIndex + 1} / {questions.length}</span><strong>{progressPercent}%</strong></div>
                <div className="speaking-progress-track" role="progressbar" aria-label="大挑戰完成進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progressPercent}><span style={{ width: `${progressPercent}%` }} /></div>
            </div>
        </header>

        <section className="speaking-question-stage">
            <article key={activeQuestion.id} className={`speaking-focus-card ${isCompleted ? "done" : ""}`}>
                <header className="speaking-question-heading">
                    <span className="speaking-question-number">{isCompleted ? <FiCheck aria-hidden="true" /> : activeQuestionIndex + 1}</span>
                    <div><small>{isCompleted ? "已完成本題" : `小關卡 ${activeQuestionIndex + 1}`}</small><h2>{activeQuestion.question_text}</h2><p>{activeQuestion.hint_zh}</p></div>
                </header>
                {activeQuestion.pronunciation_notes_zh && <details className="speaking-pronunciation-note"><summary>發音小提醒</summary><p>{activeQuestion.pronunciation_notes_zh}</p></details>}
                <SpeakingPracticeSteps firebaseUser={firebaseUser} question={activeQuestion} audioWorking={audioWorking === String(activeQuestion.id)} onPlayAudio={() => playModelAudio(activeQuestion)} onCompleted={() => markScored(activeQuestion)} />
                <small className="speaking-no-reward">這裡專心練口說，不會發放 XP 或 AE Points。</small>
            </article>
        </section>

        <nav className="speaking-question-navigation" aria-label="小關卡切換">
            <button type="button" onClick={() => setActiveQuestionIndex(current => current - 1)} disabled={activeQuestionIndex === 0}><FiChevronLeft />上一題</button>
            <span>{completedCount} / {questions.length} 題已完成</span>
            <button type="button" className="primary" onClick={goForward} disabled={!isCompleted}>{isLastQuestion ? "完成大挑戰" : "下一題"}<FiChevronRight /></button>
        </nav>
    </main>;
}
