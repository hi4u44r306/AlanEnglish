import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiBookOpen, FiCheckCircle, FiChevronLeft, FiChevronRight, FiMic, FiVolume2 } from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { completeSpeakingChallengeQuestion, getSpeakingChallengeCatalog, getSpeakingChallengeSet } from "../../services/speakingChallengeService";
import SpeakingVisualAid from "./SpeakingVisualAid";
import "./css/TextbookSpeakingChallenge.scss";

const THEME_RULES = [
    { id: "introductions", label: "認識新朋友", pattern: /名字|自我介紹|來自哪裡|name|country/i },
    { id: "daily", label: "日常對話", pattern: /打招呼|禮貌|一天|時間|問候|greeting|daily|time/i },
    { id: "school", label: "校園英語", pattern: /學校|教室|文具|數字|算術|school|class|number|math/i },
    { id: "people", label: "家人與人物", pattern: /家人|人物|身體|family|people|body/i },
    { id: "places", label: "位置與問路", pattern: /位置|指示|問路|方向|place|direction|where/i },
    { id: "things", label: "生活物品與顏色", pattern: /顏色|物品|水果|color|thing|fruit/i }
];

const getTheme = item => THEME_RULES.find(theme => theme.pattern.test(`${item.title} ${item.topic}`)) || { id: "review", label: "綜合口說" };
const lessonNumber = item => String(item.title || "").match(/^\s*(\d{1,2})/)?.[1]?.padStart(2, "0") || "GO";
const lessonTitle = item => String(item.title || "口說練習").replace(/^\s*\d{1,2}\s*/, "").trim();

const ChallengeLesson = ({ item, onOpen }) => <button className="speaking-challenge-lesson" type="button" onClick={onOpen}>
    <span className="speaking-challenge-lesson__number">{lessonNumber(item)}</span>
    <span className="speaking-challenge-lesson__copy"><strong>{lessonTitle(item)}</strong><small>{item.intro_zh || `${item.topic} · ${item.difficulty}`}</small></span>
    <span className="speaking-challenge-lesson__meta"><b>{item.completed_count}/{item.question_count}</b><small>已練習</small></span>
</button>;

export default function TextbookSpeakingChallenge() {
    const { firebaseUser } = useAuth();
    const { questionSetId } = useParams();
    const navigate = useNavigate();
    const [catalog, setCatalog] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(!questionSetId);
    const [catalogView, setCatalogView] = useState("books");
    const [challenge, setChallenge] = useState(null);
    const [error, setError] = useState("");
    const [working, setWorking] = useState("");
    const [audioWorking, setAudioWorking] = useState("");
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
    const audioRef = useRef(null);
    const catalogGroups = useMemo(() => {
        const groups = new Map();
        catalog.forEach(item => {
            const book = item.book || item.books || {};
            const group = catalogView === "books"
                ? { id: `book-${book.id || book.code || book.name}`, label: book.name || "其他教材", eyebrow: "教材大關卡" }
                : { ...getTheme(item), eyebrow: "生活主題" };
            if (!groups.has(group.id)) groups.set(group.id, { ...group, items: [] });
            groups.get(group.id).items.push(item);
        });
        return [...groups.values()];
    }, [catalog, catalogView]);

    useEffect(() => () => {
        audioRef.current?.pause();
        audioRef.current = null;
    }, []);

    useEffect(() => {
        if (!firebaseUser) return;
        const load = async () => {
            try {
                if (questionSetId) setChallenge((await getSpeakingChallengeSet(firebaseUser, Number(questionSetId))).challenge);
                else {
                    setCatalogLoading(true);
                    setCatalog((await getSpeakingChallengeCatalog(firebaseUser)).challenges || []);
                }
            } catch (loadError) { setError(loadError.message || "口說大挑戰載入失敗"); }
            finally {
                if (!questionSetId) setCatalogLoading(false);
            }
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
    if (!questionSetId) return <main className="speaking-challenge-page"><header className="speaking-challenge-hero speaking-challenge-hero--catalog"><div><span>TEXTBOOK SPEAKING</span><h1>口說大挑戰</h1><p>選一本課本順著練，或直接挑一個生活主題開始說英文。</p></div></header><div className="speaking-catalog-switch" role="group" aria-label="口說大挑戰瀏覽方式"><button type="button" className={catalogView === "books" ? "active" : ""} aria-pressed={catalogView === "books"} onClick={() => setCatalogView("books")}><FiBookOpen />依教材</button><button type="button" className={catalogView === "themes" ? "active" : ""} aria-pressed={catalogView === "themes"} onClick={() => setCatalogView("themes")}><FiMic />依主題</button></div><section className="speaking-challenge-grid" aria-busy={catalogLoading}>{catalogLoading && <><div className="speaking-challenge-loading-status" role="status">正在準備口說大挑戰…</div>{[0, 1].map(index => <div className="speaking-challenge-skeleton" aria-hidden="true" key={index}><span className="speaking-skeleton-icon" /><span className="speaking-skeleton-line short" /><span className="speaking-skeleton-line title" /><span className="speaking-skeleton-line" /></div>)}</>}{!catalogLoading && catalogGroups.map(group => <section className="speaking-catalog-group" key={group.id}><header><div><small>{group.eyebrow}</small><h2>{group.label}</h2></div><span>{group.items.length} 個小關卡</span></header><div className="speaking-catalog-lessons">{group.items.map(item => <ChallengeLesson key={item.id} item={item} onOpen={() => navigate(`/student/speaking-challenges/${item.id}`)} />)}</div></section>)}{!catalogLoading && !catalog.length && <div className="speaking-challenge-empty"><FiBookOpen /><h2>還沒有可挑戰的教材</h2><p>老師發布題庫後，會在這裡出現。</p></div>}</section></main>;
    if (!challenge) return <main className="speaking-challenge-page"><p>載入小關卡中…</p></main>;
    const questions = challenge.speaking_questions || [];
    const question = questions[activeQuestionIndex];
    if (!question) return <main className="speaking-challenge-page"><section className="speaking-challenge-empty"><FiMic /><h1>這個大挑戰還沒有題目</h1><p>請稍後再回來看看。</p><Link to="/student/speaking-challenges">返回全部大挑戰</Link></section></main>;
    const isSpeaking = audioWorking === String(question.id);
    return <main className="speaking-challenge-page"><button className="speaking-back" onClick={() => navigate("/student/speaking-challenges")}><FiChevronLeft />全部大挑戰</button><header className="speaking-challenge-hero compact"><span>{challenge.books?.name || "教材"}</span><h1>{challenge.title}</h1><p>{challenge.topic} · {challenge.difficulty}</p></header><section className="speaking-question-stage"><div className="speaking-question-progress" aria-label={`目前第 ${activeQuestionIndex + 1} 題，共 ${questions.length} 題`}>{questions.map((item, index) => <button key={item.id} type="button" onClick={() => selectQuestion(index)} className={`${index === activeQuestionIndex ? "active" : ""} ${item.progress_status === "completed" ? "done" : ""}`} aria-current={index === activeQuestionIndex ? "step" : undefined} aria-label={`前往第 ${index + 1} 題${item.progress_status === "completed" ? "，已練習" : ""}`}>{index + 1}</button>)}</div><article className={question.progress_status === "completed" ? "done" : ""}><div className="speaking-question-content"><small>小關卡 {activeQuestionIndex + 1}／{questions.length}</small><h2>{question.question_text}</h2><p>{question.hint_zh}</p><SpeakingVisualAid aid={question.visual_aid} /><div className="speaking-answer"><strong>不知道怎麼說？</strong><span>{question.model_answer}</span><button disabled={!question.model_audio_url || isSpeaking} onClick={() => playModelAudio(question)}><FiVolume2 />{question.model_audio_url ? (isSpeaking ? "播放中…" : "聽自然示範") : "語音準備中"}</button></div>{question.pronunciation_notes_zh && <aside>{question.pronunciation_notes_zh}</aside>}<button className="speaking-complete" disabled={working === String(question.id) || question.progress_status === "completed"} onClick={() => markComplete(question)}><FiCheckCircle />{question.progress_status === "completed" ? "已練習" : "我已開口練習"}</button><small className="speaking-no-reward">此階段只記錄練習，不發 XP 或 AE Points。</small></div></article><nav className="speaking-question-navigation" aria-label="小關卡切換"><button type="button" onClick={() => selectQuestion(activeQuestionIndex - 1)} disabled={activeQuestionIndex === 0}><FiChevronLeft />上一題</button><span>第 {activeQuestionIndex + 1}／{questions.length} 題</span><button type="button" onClick={() => selectQuestion(activeQuestionIndex + 1)} disabled={activeQuestionIndex === questions.length - 1}>下一題<FiChevronRight /></button></nav></section></main>;
}
