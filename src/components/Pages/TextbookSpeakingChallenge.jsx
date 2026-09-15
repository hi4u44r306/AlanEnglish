import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiAward, FiBookOpen, FiCheck, FiChevronDown, FiChevronLeft, FiChevronRight, FiLock, FiMic } from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { completeAlphabetIntroListen, completeSpeakingChallengeQuestion, getSpeakingChallengeCatalog, getSpeakingChallengeSet, startAlphabetIntroListen, startSpeakingFoundationRound } from "../../services/speakingChallengeService";
import SpeakingPracticeSteps from "./SpeakingPracticeSteps";
import SpeakingVisualAid from "./SpeakingVisualAid";
import WorkbookOneFoundationChallenge from "./WorkbookOneFoundationChallenge";
import WorkbookOnePictureChallenge from "./WorkbookOnePictureChallenge";
import "./css/TextbookSpeakingChallenge.scss";

const CATALOG_SECTION_COPY = {
    preparation: { label: "入門準備", eyebrow: "先從基礎開始", badge: "ABC" },
    textbook: { label: "課本練習", eyebrow: "依教材頁序完成", badge: "課本" },
    topic: { label: "主題練習", eyebrow: "跨頁情境加強", badge: "主題" }
};
const TOPIC_TEMPLATE_KEYS = new Set([
    "workbook_1_greetings_polite_v1",
    "workbook_1_colors_objects_v1",
    "workbook_1_numbers_math_v1"
]);

const catalogSection = item => {
    if (CATALOG_SECTION_COPY[item.catalog_section]) return item.catalog_section;
    if (item.generation_metadata?.interaction_type === "alphabet_round") return "preparation";
    if (TOPIC_TEMPLATE_KEYS.has(String(item.generation_metadata?.template_key || ""))) return "topic";
    return "textbook";
};

const lessonTitle = item => String(item.title || "口說練習")
    .replace(/^\s*(?:P\s*)?\d{1,4}\s*/i, "")
    .trim();

const compressPageNumbers = pages => {
    const numbers = [...new Set((pages || []).map(Number).filter(page => Number.isInteger(page) && page > 0))]
        .sort((left, right) => left - right);
    const ranges = [];
    numbers.forEach(page => {
        const last = ranges[ranges.length - 1];
        if (last && page === last[1] + 1) last[1] = page;
        else ranges.push([page, page]);
    });
    return ranges.map(([start, end]) => start === end ? String(start) : `${start}～${end}`).join("、");
};

const pageReference = item => {
    const pages = compressPageNumbers(item.source_pages || item.generation_metadata?.source_pages);
    return pages ? `配合第 ${pages} 頁` : "";
};

const ChallengeLesson = ({ item, onOpen, staffPreview, section }) => {
    const locked = !staffPreview && item.is_unlocked === false;
    const completed = item.is_completed === true;
    const sectionCopy = CATALOG_SECTION_COPY[section] || CATALOG_SECTION_COPY.textbook;
    const pages = pageReference(item);
    return <button className={`speaking-challenge-lesson ${locked ? "is-locked" : ""} ${completed ? "is-completed" : ""}`} type="button" onClick={onOpen} disabled={locked} aria-describedby={locked ? `speaking-challenge-lock-${item.id}` : undefined}>
    <span className="speaking-challenge-lesson__number">{sectionCopy.badge}</span>
    <span className="speaking-challenge-lesson__copy"><strong>{lessonTitle(item)}{pages && <em>{pages}</em>}</strong><small>{item.intro_zh || `${item.topic} · ${item.difficulty}`}</small></span>
    <span className="speaking-challenge-lesson__meta">{locked ? <><FiLock aria-hidden="true" /><small id={`speaking-challenge-lock-${item.id}`}>先完成前一關</small></> : completed ? <><FiCheck aria-hidden="true" /><small>已通關</small></> : <><b>{item.completed_count}/{item.question_count}</b><small>{staffPreview ? "預覽" : "開始挑戰"}</small></>}</span>
    </button>;
};

const ChallengeRules = () => {
    const [expanded, setExpanded] = useState(false);
    return <section className={`speaking-challenge-rules ${expanded ? "is-expanded" : ""}`} aria-labelledby="speaking-challenge-rules-title">
        <button type="button" className="speaking-challenge-rules__toggle" aria-expanded={expanded} aria-controls="speaking-challenge-rules-content" onClick={() => setExpanded(current => !current)}>
            <span className="speaking-challenge-rules__icon" aria-hidden="true">?</span>
            <span className="speaking-challenge-rules__heading">
                <small>HOW TO PLAY</small>
                <strong id="speaking-challenge-rules-title">遊戲規則</strong>
            </span>
            <span className="speaking-challenge-rules__action">{expanded ? "收起規則" : "查看規則"}<FiChevronDown aria-hidden="true" /></span>
        </button>
        {expanded && <div id="speaking-challenge-rules-content" className="speaking-challenge-rules__content">
            <ol>
                <li><b>選一關</b><span>先完成入門準備，課本關卡會照順序開放。</span></li>
                <li><b>看題目</b><span>看清楚畫面上的字、圖片或問題，想好要說的英文。</span></li>
                <li><b>開口說</b><span>允許麥克風後清楚說；沒成功沒關係，可以再試一次。</span></li>
            </ol>
            <p><FiCheck aria-hidden="true" /> 通關會顯示打勾並開啟下一關；主題練習可以自由選擇。</p>
        </div>}
    </section>;
};

export default function TextbookSpeakingChallenge() {
    const { firebaseUser, role } = useAuth();
    const { questionSetId, bookKey } = useParams();
    const navigate = useNavigate();
    const [catalog, setCatalog] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(!questionSetId);
    const [challenge, setChallenge] = useState(null);
    const [error, setError] = useState("");
    const [audioWorking, setAudioWorking] = useState("");
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
    const [completionNotice, setCompletionNotice] = useState(null);
    const audioRef = useRef(null);
    const questionHeadingRef = useRef(null);
    const interactionType = String(challenge?.generation_metadata?.interaction_type || "");
    const questions = challenge?.speaking_questions || [];
    const activeQuestion = questions[activeQuestionIndex];
    const staffPreview = role === "teacher" || role === "admin";
    const catalogGroups = useMemo(() => {
        const groups = new Map();
        catalog.forEach(item => {
            const book = item.book || item.books || {};
            const group = { id: `book-${book.id || book.code || book.name}`, label: book.name || "其他教材", eyebrow: "照順序完成" };
            if (!groups.has(group.id)) groups.set(group.id, { ...group, sections: new Map() });
            const section = catalogSection(item);
            if (!groups.get(group.id).sections.has(section)) groups.get(group.id).sections.set(section, []);
            groups.get(group.id).sections.get(section).push(item);
        });
        return [...groups.values()].map(group => {
            const sections = ["preparation", "textbook", "topic"]
                .filter(section => group.sections.has(section))
                .map(section => ({
                    id: section,
                    ...CATALOG_SECTION_COPY[section],
                    items: [...group.sections.get(section)].sort((left, right) => Number(left.sequence_order || 0) - Number(right.sequence_order || 0) || Number(left.id) - Number(right.id))
                }));
            return { ...group, sections, itemCount: sections.reduce((count, section) => count + section.items.length, 0) };
        });
    }, [catalog]);

    useEffect(() => () => {
        audioRef.current?.pause();
        audioRef.current = null;
    }, []);

    useEffect(() => {
        document.body.classList.add("speaking-challenge-active");
        return () => document.body.classList.remove("speaking-challenge-active");
    }, []);
    useEffect(() => {
        if (questionSetId && activeQuestion?.id && !["alphabet_round", "letter_spelling", "picture_qa", "picture_gap_sentence"].includes(interactionType)) {
            questionHeadingRef.current?.focus({ preventScroll: true });
        }
    }, [activeQuestion?.id, interactionType, questionSetId]);

    useEffect(() => {
        if (!questionSetId) {
            try { window.scrollTo({ top: 0, behavior: "auto" }); } catch { /* test environments may not implement scrolling */ }
        }
    }, [bookKey, questionSetId]);

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
            const response = await completeSpeakingChallengeQuestion(firebaseUser, challenge.id, question.id);
            setChallenge(current => ({ ...current, speaking_questions: current.speaking_questions.map(item => item.id === question.id ? { ...item, progress_status: "completed" } : item) }));
            if (response?.challenge_completed || response?.completed_challenge) setCompletionNotice(response);
            return response || true;
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
    if (!questionSetId) {
        const selectedBook = bookKey ? catalogGroups.find(group => group.id === bookKey || encodeURIComponent(group.id) === bookKey) : null;
        return <main className="speaking-challenge-page speaking-challenge-catalog"><header className="speaking-challenge-hero"><span>{staffPreview ? "STAFF PREVIEW" : "STEP BY STEP"}</span><h1>{selectedBook ? selectedBook.label : "口說大挑戰"}</h1><p>{selectedBook ? "依照順序完成關卡；完成後會開啟下一關。" : (staffPreview ? "這是唯讀預覽，所有已發布關卡都可直接開啟。" : "選一本教材，開始你的口說挑戰。")}</p></header>{!staffPreview && !selectedBook && <ChallengeRules />}<section className="speaking-challenge-grid" aria-busy={catalogLoading}>{catalogLoading && <div className="speaking-challenge-loading-status" role="status">正在準備口說大挑戰…</div>}{!catalogLoading && !selectedBook && catalogGroups.map(group => <button type="button" className="speaking-book-card" key={group.id} onClick={() => navigate(`/student/speaking-challenges/book/${encodeURIComponent(group.id)}`)}><FiBookOpen /><strong>{group.label}</strong><span>{group.itemCount} 個小關卡</span><small>{group.sections.flatMap(section => section.items).filter(item => item.is_completed).length} / {group.itemCount} 已完成</small><footer>查看關卡 <FiChevronRight /></footer></button>)}{!catalogLoading && selectedBook && <><button type="button" className="speaking-back" onClick={() => navigate("/student/speaking-challenges")}><FiChevronLeft />全部教材</button><section className="speaking-catalog-group"><header><div><small>{selectedBook.eyebrow}</small><h2>{selectedBook.label}</h2></div><span>{selectedBook.itemCount} 個小關卡</span></header>{selectedBook.sections.map(section => <section className={`speaking-catalog-section is-${section.id}`} key={section.id}><header><div><small>{section.eyebrow}</small><h3>{section.label}</h3></div><span>{section.items.length} 關</span></header><div className="speaking-catalog-lessons">{section.items.map(item => <ChallengeLesson key={item.id} item={item} section={section.id} staffPreview={staffPreview} onOpen={() => navigate(`/student/speaking-challenges/${item.id}`)} />)}</div></section>)}</section></>}{!catalogLoading && !catalog.length && <div className="speaking-challenge-empty"><FiBookOpen /><h2>還沒有可挑戰的教材</h2><p>老師發布題庫後，會在這裡出現。</p></div>}</section></main>;
    }
    if (!challenge || Number(challenge.id) !== Number(questionSetId)) return <main className="speaking-challenge-page"><p>載入小關卡中…</p></main>;
    if (["alphabet_round", "letter_spelling"].includes(interactionType)) return <WorkbookOneFoundationChallenge
        challenge={challenge}
        firebaseUser={firebaseUser}
        onComplete={markScored}
        onStartRound={() => startSpeakingFoundationRound(firebaseUser, challenge.id)}
        onStartAlphabetIntro={() => startAlphabetIntroListen(firebaseUser, challenge.id)}
        onCompleteAlphabetIntro={listenSessionId => completeAlphabetIntroListen(firebaseUser, challenge.id, listenSessionId)}
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
            {Number.isFinite(Number(challenge.reward_xp)) && <div className="speaking-lesson-reward"><FiAward aria-hidden="true" /><span>通關獎勵</span><strong>{Number(challenge.reward_xp)} XP</strong></div>}
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
        {completionNotice && <div className="speaking-reward-dialog" role="dialog" aria-modal="true" aria-labelledby="speaking-reward-title">
            <section>
                <span className="speaking-reward-dialog__stars" aria-hidden="true">✦ ✨ ✦</span>
                <FiAward aria-hidden="true" />
                <h2 id="speaking-reward-title">太棒了，成功通關！</h2>
                {Number.isFinite(Number(completionNotice.xp_awarded ?? completionNotice.reward_xp)) ? <p><strong>🏆 獲得 {Number(completionNotice.xp_awarded ?? completionNotice.reward_xp)} XP</strong></p> : <p>這一關已完成，下一關已開啟！</p>}
                <div><button type="button" onClick={() => navigate("/student/speaking-challenges")}>回到關卡列表</button><button type="button" className="primary" onClick={() => { setCompletionNotice(null); navigate("/student/speaking-challenges"); }}>繼續挑戰</button></div>
            </section>
        </div>}
    </main>;
}
