import React, { useEffect, useRef, useState } from "react";
import { FiBookOpen, FiCheckCircle, FiChevronLeft, FiChevronRight, FiMic, FiVolume2 } from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { completeSpeakingChallengeQuestion, getSpeakingChallengeCatalog, getSpeakingChallengeSet } from "../../services/speakingChallengeService";
import SpeakingGuideAvatar from "./SpeakingGuideAvatar";
import SpeakingVisualAid from "./SpeakingVisualAid";
import "./css/TextbookSpeakingChallenge.scss";

export default function TextbookSpeakingChallenge() {
    const { firebaseUser } = useAuth();
    const { questionSetId } = useParams();
    const navigate = useNavigate();
    const [catalog, setCatalog] = useState([]);
    const [challenge, setChallenge] = useState(null);
    const [error, setError] = useState("");
    const [working, setWorking] = useState("");
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
                if (questionSetId) setChallenge((await getSpeakingChallengeSet(firebaseUser, Number(questionSetId))).challenge);
                else setCatalog((await getSpeakingChallengeCatalog(firebaseUser)).challenges || []);
            } catch (loadError) { setError(loadError.message || "口說大挑戰載入失敗"); }
        };
        load();
    }, [firebaseUser, questionSetId]);

    useEffect(() => {
        setActiveQuestionIndex(0);
        audioRef.current?.pause();
        audioRef.current = null;
        setAudioWorking("");
    }, [challenge?.id]);

    const markComplete = async question => {
        setWorking(String(question.id));
        try {
            await completeSpeakingChallengeQuestion(firebaseUser, challenge.id, question.id);
            setChallenge(current => ({ ...current, speaking_questions: current.speaking_questions.map(item => item.id === question.id ? { ...item, progress_status: "completed" } : item) }));
        } catch (saveError) { setError(saveError.message || "無法儲存練習紀錄"); }
        finally { setWorking(""); }
    };

    const playModelAudio = question => {
        if (!question.model_audio_url) return;
        audioRef.current?.pause();
        const audio = new Audio(question.model_audio_url);
        audioRef.current = audio;
        const questionId = String(question.id);
        const clear = () => setAudioWorking(current => current === questionId ? "" : current);
        audio.addEventListener("play", () => setAudioWorking(questionId), { once: true });
        audio.addEventListener("pause", clear, { once: true });
        audio.addEventListener("ended", clear, { once: true });
        audio.addEventListener("error", () => { clear(); setError("示範語音暫時無法播放，請重新整理後再試"); }, { once: true });
        audio.play().catch(() => { clear(); setError("瀏覽器阻擋了示範語音，請再按一次播放"); });
    };

    const selectQuestion = nextIndex => {
        audioRef.current?.pause();
        audioRef.current = null;
        setAudioWorking("");
        setActiveQuestionIndex(nextIndex);
    };

    if (error) return <main className="speaking-challenge-page"><section className="speaking-challenge-empty"><FiMic /><h1>口說大挑戰暫時無法開啟</h1><p>{error}</p><Link to="/student/membership">查看方案與功能</Link></section></main>;
    if (!questionSetId) return <main className="speaking-challenge-page"><header className="speaking-challenge-hero"><span>TEXTBOOK SPEAKING</span><h1>口說大挑戰</h1><p>每一本到達一個大關卡；跟著題目開口說，先練習，再完成小關卡。</p></header><section className="speaking-challenge-grid">{catalog.map(item => <button key={item.id} onClick={() => navigate(`/student/speaking-challenges/${item.id}`)}><FiBookOpen /><small>{item.book?.name || "教材"} · 第 {item.version} 版</small><strong>{item.title}</strong><span>{item.topic} · {item.difficulty}</span><footer>{item.completed_count}/{item.question_count} 題已練習</footer></button>)}{!catalog.length && <div className="speaking-challenge-empty"><FiBookOpen /><h2>還沒有可挑戰的教材</h2><p>老師發布題庫後，會在這裡出現。</p></div>}</section></main>;
    if (!challenge) return <main className="speaking-challenge-page"><p>載入小關卡中…</p></main>;
    const questions = challenge.speaking_questions || [];
    const question = questions[activeQuestionIndex];
    if (!question) return <main className="speaking-challenge-page"><section className="speaking-challenge-empty"><FiMic /><h1>這個大挑戰還沒有題目</h1><p>請稍後再回來看看。</p><Link to="/student/speaking-challenges">返回全部大挑戰</Link></section></main>;
    const isSpeaking = audioWorking === String(question.id);
    return <main className="speaking-challenge-page"><button className="speaking-back" onClick={() => navigate("/student/speaking-challenges")}><FiChevronLeft />全部大挑戰</button><header className="speaking-challenge-hero compact"><span>{challenge.books?.name || "教材"}</span><h1>{challenge.title}</h1><p>{challenge.topic} · {challenge.difficulty}</p></header><section className="speaking-question-stage"><div className="speaking-question-progress" aria-label={`目前第 ${activeQuestionIndex + 1} 題，共 ${questions.length} 題`}>{questions.map((item, index) => <button key={item.id} type="button" onClick={() => selectQuestion(index)} className={`${index === activeQuestionIndex ? "active" : ""} ${item.progress_status === "completed" ? "done" : ""}`} aria-current={index === activeQuestionIndex ? "step" : undefined} aria-label={`前往第 ${index + 1} 題${item.progress_status === "completed" ? "，已練習" : ""}`}>{index + 1}</button>)}</div><article className={question.progress_status === "completed" ? "done" : ""}>
        <div className={`speaking-ai-guide ${isSpeaking ? "is-speaking" : ""}`} aria-label={isSpeaking ? "AI 口說夥伴正在示範發音" : "AI 口說夥伴"}>
            <SpeakingGuideAvatar gender={question.model_voice_gender} isSpeaking={isSpeaking} />
            <strong>{isSpeaking ? "跟著我一起說！" : question.model_voice_gender === "male" ? "嗨！我是男聲口說夥伴。" : "嗨！我是女聲口說夥伴。"}</strong>
        </div>
        <div className="speaking-question-content">
            <small>小關卡 {activeQuestionIndex + 1}／{questions.length}</small><h2>{question.question_text}</h2><p>{question.hint_zh}</p><SpeakingVisualAid aid={question.visual_aid} /><div className="speaking-answer"><strong>不知道怎麼說？</strong><span>{question.model_answer}</span><button disabled={!question.model_audio_url || isSpeaking} onClick={() => playModelAudio(question)}><FiVolume2 />{question.model_audio_url ? (isSpeaking ? "播放中…" : "聽自然示範") : "語音準備中"}</button></div>{question.pronunciation_notes_zh && <aside>{question.pronunciation_notes_zh}</aside>}<button className="speaking-complete" disabled={working === String(question.id) || question.progress_status === "completed"} onClick={() => markComplete(question)}><FiCheckCircle />{question.progress_status === "completed" ? "已練習" : "我已開口練習"}</button><small className="speaking-no-reward">此階段只記錄練習，不發 XP 或 AE Points。</small>
        </div>
    </article><nav className="speaking-question-navigation" aria-label="小關卡切換"><button type="button" onClick={() => selectQuestion(activeQuestionIndex - 1)} disabled={activeQuestionIndex === 0}><FiChevronLeft />上一題</button><span>第 {activeQuestionIndex + 1}／{questions.length} 題</span><button type="button" onClick={() => selectQuestion(activeQuestionIndex + 1)} disabled={activeQuestionIndex === questions.length - 1}>下一題<FiChevronRight /></button></nav></section></main>;
}
