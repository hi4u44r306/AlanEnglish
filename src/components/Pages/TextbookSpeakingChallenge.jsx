import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiBookOpen, FiCheck, FiChevronLeft, FiChevronRight, FiClock, FiMic } from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getSpeakingQuestionVisual } from "../../data/speakingQuestionVisuals";
import { completeSpeakingChallengeQuestion, getSpeakingChallengeCatalog, getSpeakingChallengeSet } from "../../services/speakingChallengeService";
import SpeakingChallengeCompletion from "./SpeakingChallengeCompletion";
import SpeakingPracticeSteps from "./SpeakingPracticeSteps";
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

const ChallengeLesson = ({ item, isStaffDemo, onOpen }) => <button className="speaking-challenge-lesson" type="button" onClick={onOpen}>
    <span className="speaking-challenge-lesson__number">{lessonNumber(item)}</span>
    <span className="speaking-challenge-lesson__copy"><strong>{lessonTitle(item)}</strong><small>{item.intro_zh || `${item.topic} · ${item.difficulty}`}</small></span>
    <span className="speaking-challenge-lesson__meta"><b>{isStaffDemo ? `${item.question_count} 題` : `${item.completed_count}/${item.question_count}`}</b><small>{isStaffDemo ? "示範" : "已練習"}</small></span>
</button>;

export default function TextbookSpeakingChallenge() {
    const { firebaseUser, role } = useAuth();
    const isStaffDemo = role === "teacher" || role === "admin";
    const { questionSetId } = useParams();
    const navigate = useNavigate();
    const [catalog, setCatalog] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(!questionSetId);
    const [catalogView, setCatalogView] = useState("books");
    const [challenge, setChallenge] = useState(null);
    const [error, setError] = useState("");
    const [audioWorking, setAudioWorking] = useState("");
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
    const [practiceBusy, setPracticeBusy] = useState(false);
    const [completionReward, setCompletionReward] = useState(null);
    const audioRef = useRef(null);
    const questionStageRef = useRef(null);
    const shouldScrollToQuestionRef = useRef(false);
    const catalogGroups = useMemo(() => {
        const groups = new Map();
        catalog.forEach(item => {
            const group = catalogView === "books"
                ? { id: `book-${item.book?.id || item.book?.code || item.book?.name}`, label: item.book?.name || "其他教材", eyebrow: "教材大關卡" }
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
        if (!firebaseUser) return;
        const load = async () => {
            try {
                if (questionSetId) {
                    setActiveQuestionIndex(0);
                    setChallenge((await getSpeakingChallengeSet(firebaseUser, Number(questionSetId))).challenge);
                }
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
        if (!shouldScrollToQuestionRef.current) return;
        shouldScrollToQuestionRef.current = false;
        questionStageRef.current?.scrollIntoView({
            behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "start"
        });
    }, [activeQuestionIndex]);

    const markComplete = async question => {
        try {
            const completion = await completeSpeakingChallengeQuestion(firebaseUser, challenge.id, question.id);
            setChallenge(current => ({ ...current, speaking_questions: current.speaking_questions.map(item => item.id === question.id ? { ...item, progress_status: "completed" } : item) }));
            if (completion?.challenge_complete && completion?.reward_granted) setCompletionReward(completion);
            return completion;
        } catch (saveError) { setError(saveError.message || "無法儲存練習紀錄"); }
    };

    const markScored = async question => {
        if (question.progress_status !== "completed") await markComplete(question);
    };

    const playQuestionAudio = (question, purpose, onEnded) => {
        const audioUrl = purpose === "question_prompt" ? question.question_audio_url : question.model_audio_url;
        if (!audioUrl) return;
        audioRef.current?.pause();
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        const workingKey = `${question.id}:${purpose}`;
        setAudioWorking(workingKey);
        const clear = () => setAudioWorking(current => current === workingKey ? "" : current);
        audio.addEventListener("ended", () => { clear(); onEnded?.(); }, { once: true });
        audio.addEventListener("error", () => { clear(); setError("自然語音暫時無法播放，請重新整理後再試"); }, { once: true });
        audio.play().catch(() => { clear(); setError("瀏覽器阻擋了示範語音，請再按一次播放"); });
    };

    if (error) return <main className="speaking-challenge-page"><section className="speaking-challenge-empty"><FiMic /><h1>口說大挑戰暫時無法開啟</h1><p>{error}</p><Link to="/student/membership">查看方案與功能</Link></section></main>;
    if (!questionSetId) return <main className="speaking-challenge-page"><header className="speaking-challenge-hero"><div><span>TEXTBOOK SPEAKING</span><h1>口說大挑戰</h1><p>選一本熟悉的教材，或直接挑一個生活主題開始說英文。</p></div><Link className="speaking-history-link" to="/student/speaking-history"><FiClock />{isStaffDemo ? "口說歷程示範" : "我的口說歷程"}</Link></header>{isStaffDemo && <div className="speaking-demo-banner" role="note"><strong>示範模式</strong><span>可查看已發布題庫與示範語音，不會讀取或改寫任何學生進度。</span></div>}<div className="speaking-catalog-switch" role="group" aria-label="口說大挑戰瀏覽方式"><button type="button" className={catalogView === "books" ? "active" : ""} aria-pressed={catalogView === "books"} onClick={() => setCatalogView("books")}><FiBookOpen />依教材</button><button type="button" className={catalogView === "themes" ? "active" : ""} aria-pressed={catalogView === "themes"} onClick={() => setCatalogView("themes")}><FiMic />依主題</button></div><section className="speaking-challenge-grid" aria-busy={catalogLoading}>{catalogLoading && <><div className="speaking-challenge-loading-status" role="status">正在準備口說大挑戰…</div>{[0, 1].map(index => <div className="speaking-challenge-skeleton" aria-hidden="true" key={index}><span className="speaking-skeleton-icon" /><span className="speaking-skeleton-line short" /><span className="speaking-skeleton-line title" /><span className="speaking-skeleton-line" /></div>)}</>}{!catalogLoading && catalogGroups.map(group => <section className="speaking-catalog-group" key={group.id}><header><div><small>{group.eyebrow}</small><h2>{group.label}</h2></div><span>{group.items.length} 個小關卡</span></header><div className="speaking-catalog-lessons">{group.items.map(item => <ChallengeLesson key={item.id} item={item} isStaffDemo={isStaffDemo} onOpen={() => navigate(`/student/speaking-challenges/${item.id}`)} />)}</div></section>)}{!catalogLoading && !catalog.length && <div className="speaking-challenge-empty"><FiBookOpen /><h2>還沒有可挑戰的教材</h2><p>老師發布題庫後，會在這裡出現。</p></div>}</section></main>;
    if (!challenge) return <main className="speaking-challenge-page"><p>載入小關卡中…</p></main>;
    const questions = challenge.speaking_questions || [];
    const activeQuestion = questions[activeQuestionIndex];
    const completedCount = questions.filter(question => question.progress_status === "completed").length;
    const progressPercent = questions.length ? Math.round((completedCount / questions.length) * 100) : 0;

    if (!activeQuestion) return <main className="speaking-challenge-page"><section className="speaking-challenge-empty"><FiBookOpen /><h1>這個大挑戰還沒有小關卡</h1><p>請稍後再回來練習。</p><button type="button" className="speaking-back" onClick={() => navigate("/student/speaking-challenges")}><FiChevronLeft />全部大挑戰</button></section></main>;

    const isCompleted = activeQuestion.progress_status === "completed";
    const questionVisual = getSpeakingQuestionVisual(activeQuestion.question_text);
    const isLastQuestion = activeQuestionIndex === questions.length - 1;
    const showQuestion = nextIndex => {
        shouldScrollToQuestionRef.current = true;
        setActiveQuestionIndex(nextIndex);
    };
    const goForward = () => {
        if (!isCompleted && !isStaffDemo) return;
        if (isLastQuestion) navigate("/student/speaking-challenges");
        else showQuestion(current => current + 1);
    };

    return <main className="speaking-challenge-page speaking-challenge-detail">
        {isStaffDemo && <div className="speaking-demo-banner speaking-demo-banner--detail" role="note"><strong>老師／管理員示範模式</strong><span>題庫與示範語音可操作；錄音、評分與完成紀錄僅限學生帳號。</span></div>}
        <header className="speaking-lesson-header">
            <button className="speaking-back" disabled={practiceBusy} onClick={() => navigate("/student/speaking-challenges")}><FiChevronLeft />全部大挑戰</button>
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

        <section ref={questionStageRef} className="speaking-question-stage">
            <article key={activeQuestion.id} className={`speaking-focus-card ${isCompleted ? "done" : ""}`}>
                <header className="speaking-question-heading">
                    <span className="speaking-question-number">{isCompleted ? <FiCheck aria-hidden="true" /> : activeQuestionIndex + 1}</span>
                    <div><small>{isCompleted ? "已完成本題" : `小關卡 ${activeQuestionIndex + 1}`}</small><h2>{activeQuestion.question_text}</h2><p>聽懂問題後，按下麥克風直接回答。</p></div>
                </header>
                {questionVisual && <figure className="speaking-question-visual">
                    <img src={questionVisual.src} alt={questionVisual.alt} width="640" height="420" />
                    <figcaption>先看圖片，再聽問題並回答。</figcaption>
                </figure>}
                <SpeakingPracticeSteps
                    firebaseUser={firebaseUser}
                    question={activeQuestion}
                    questionAudioWorking={audioWorking === `${activeQuestion.id}:question_prompt`}
                    answerAudioWorking={audioWorking === `${activeQuestion.id}:model_answer`}
                    onPlayQuestionAudio={onEnded => playQuestionAudio(activeQuestion, "question_prompt", onEnded)}
                    onPlayAnswerAudio={onEnded => playQuestionAudio(activeQuestion, "model_answer", onEnded)}
                    onCompleted={() => markScored(activeQuestion)}
                    onBusyChange={setPracticeBusy}
                    demoMode={isStaffDemo}
                />
                <small className="speaking-challenge-reward-note">完成整個大挑戰可獲得 30 XP；有效在校生另得 3 AE Points。</small>
            </article>
        </section>

        <SpeakingChallengeCompletion reward={completionReward} onDismiss={() => setCompletionReward(null)} />

        <nav className="speaking-question-navigation" aria-label="小關卡切換">
            <button type="button" onClick={() => showQuestion(current => current - 1)} disabled={practiceBusy || activeQuestionIndex === 0}><FiChevronLeft />上一題</button>
            <span>{completedCount} / {questions.length} 題已完成</span>
            <button type="button" className="primary" onClick={goForward} disabled={practiceBusy || (!isCompleted && !isStaffDemo)}>{isLastQuestion ? (isStaffDemo ? "結束示範" : "完成大挑戰") : "下一題"}<FiChevronRight /></button>
        </nav>
    </main>;
}
