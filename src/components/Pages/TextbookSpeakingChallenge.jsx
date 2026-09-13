import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiBookOpen, FiCheck, FiChevronLeft, FiChevronRight, FiMic } from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { completeSpeakingChallengeQuestion, getSpeakingChallengeCatalog, getSpeakingChallengeSet, startSpeakingFoundationRound } from "../../services/speakingChallengeService";
import SpeakingPracticeSteps from "./SpeakingPracticeSteps";
import SpeakingVisualAid from "./SpeakingVisualAid";
import WorkbookOneFoundationChallenge from "./WorkbookOneFoundationChallenge";
import WorkbookOnePictureChallenge from "./WorkbookOnePictureChallenge";
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
    const [audioWorking, setAudioWorking] = useState("");
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
    const audioRef = useRef(null);
    const questionHeadingRef = useRef(null);
    const interactionType = String(challenge?.generation_metadata?.interaction_type || "");
    const questions = challenge?.speaking_questions || [];
    const activeQuestion = questions[activeQuestionIndex];
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
        if (!questionSetId) return undefined;
        document.body.classList.add("speaking-challenge-detail-active");
        return () => document.body.classList.remove("speaking-challenge-detail-active");
    }, [questionSetId]);
    useEffect(() => {
        if (questionSetId && activeQuestion?.id && !["alphabet_round", "letter_spelling", "picture_qa", "picture_gap_sentence"].includes(interactionType)) {
            questionHeadingRef.current?.focus({ preventScroll: true });
        }
    }, [activeQuestion?.id, interactionType, questionSetId]);

    useEffect(() => {
        if (!firebaseUser) return;
        let cancelled = false;
        setError("");
        if (questionSetId) {
            setActiveQuestionIndex(0);
            setChallenge(null);
        }
        const load = async () => {
            try {
                if (questionSetId) {
                    const nextChallenge = (await getSpeakingChallengeSet(firebaseUser, Number(questionSetId))).challenge;
                    if (!cancelled) setChallenge(nextChallenge);
                }
                else {
                    setCatalogLoading(true);
                    const nextCatalog = (await getSpeakingChallengeCatalog(firebaseUser)).challenges || [];
                    if (!cancelled) setCatalog(nextCatalog);
                }
            } catch (loadError) {
                if (!cancelled) setError(loadError.message || "口說大挑戰載入失敗");
            }
            finally {
                if (!cancelled && !questionSetId) setCatalogLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [firebaseUser, questionSetId]);

    const markComplete = async question => {
        try {
            await completeSpeakingChallengeQuestion(firebaseUser, challenge.id, question.id);
            setChallenge(current => ({ ...current, speaking_questions: current.speaking_questions.map(item => item.id === question.id ? { ...item, progress_status: "completed" } : item) }));
            return true;
        } catch (saveError) { setError(saveError.message || "無法儲存練習紀錄"); return false; }
    };

    const markScored = async question => {
        if (question.progress_status !== "completed") return markComplete(question);
        return true;
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
    if (!questionSetId) return <main className="speaking-challenge-page"><header className="speaking-challenge-hero"><span>TEXTBOOK SPEAKING</span><h1>口說大挑戰</h1><p>選一本課本順著練，或直接挑一個生活主題開始說英文。</p></header><div className="speaking-catalog-switch" role="group" aria-label="口說大挑戰瀏覽方式"><button type="button" className={catalogView === "books" ? "active" : ""} aria-pressed={catalogView === "books"} onClick={() => setCatalogView("books")}><FiBookOpen />依教材</button><button type="button" className={catalogView === "themes" ? "active" : ""} aria-pressed={catalogView === "themes"} onClick={() => setCatalogView("themes")}><FiMic />依主題</button></div><section className="speaking-challenge-grid" aria-busy={catalogLoading}>{catalogLoading && <div className="speaking-challenge-loading-status" role="status">正在準備口說大挑戰…</div>}{!catalogLoading && catalogGroups.map(group => <section className="speaking-catalog-group" key={group.id}><header><div><small>{group.eyebrow}</small><h2>{group.label}</h2></div><span>{group.items.length} 個小關卡</span></header><div className="speaking-catalog-lessons">{group.items.map(item => <ChallengeLesson key={item.id} item={item} onOpen={() => navigate(`/student/speaking-challenges/${item.id}`)} />)}</div></section>)}{!catalogLoading && !catalog.length && <div className="speaking-challenge-empty"><FiBookOpen /><h2>還沒有可挑戰的教材</h2><p>老師發布題庫後，會在這裡出現。</p></div>}</section></main>;
    if (!challenge || Number(challenge.id) !== Number(questionSetId)) return <main className="speaking-challenge-page"><p>載入小關卡中…</p></main>;
    if (["alphabet_round", "letter_spelling"].includes(interactionType)) return <WorkbookOneFoundationChallenge
        challenge={challenge}
        firebaseUser={firebaseUser}
        onComplete={markScored}
        onStartRound={() => startSpeakingFoundationRound(firebaseUser, challenge.id)}
        onExit={() => navigate("/student/speaking-challenges")}
    />;
    if (["picture_qa", "picture_gap_sentence"].includes(interactionType)) return <WorkbookOnePictureChallenge
        challenge={challenge}
        firebaseUser={firebaseUser}
        onComplete={markScored}
        onExit={() => navigate("/student/speaking-challenges")}
    />;
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
                    <div><small>{isCompleted ? "已完成本題" : `小關卡 ${activeQuestionIndex + 1}`}</small><h2 ref={questionHeadingRef} tabIndex="-1">{activeQuestion.question_text}</h2><p>聽懂問題後，按下麥克風直接回答。</p></div>
                </header>
                <SpeakingVisualAid aid={activeQuestion.visual_aid} />
                <SpeakingPracticeSteps firebaseUser={firebaseUser} question={activeQuestion} audioWorking={audioWorking === String(activeQuestion.id)} onPlayAudio={() => playModelAudio(activeQuestion)} onCompleted={() => markScored(activeQuestion)} />
                <small className="speaking-no-reward">完成整個大挑戰後，第一次通關可以獲得 XP 與 AE Points。</small>
            </article>
        </section>

        <nav className="speaking-question-navigation" aria-label="小關卡切換">
            <button type="button" onClick={() => setActiveQuestionIndex(current => current - 1)} disabled={activeQuestionIndex === 0}><FiChevronLeft />上一題</button>
            <span>{completedCount} / {questions.length} 題已完成</span>
            <button type="button" className="primary" onClick={goForward} disabled={!isCompleted}>{isLastQuestion ? "完成大挑戰" : "下一題"}<FiChevronRight /></button>
        </nav>
    </main>;
}
