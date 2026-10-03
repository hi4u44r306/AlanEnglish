import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiAward, FiBookOpen, FiCheck, FiChevronDown, FiChevronLeft, FiChevronRight, FiMic, FiVolume2 } from "react-icons/fi";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { completeAlphabetIntroListen, completeSpeakingChallengeQuestion, getSpeakingChallengeCatalog, getSpeakingChallengeSet, revealSpeakingChallengeHint, startAlphabetIntroListen, startSpeakingFoundationRound } from "../../services/speakingChallengeService";
import SpeakingPracticeSteps from "./SpeakingPracticeSteps";
import SpeakingVisualAid from "./SpeakingVisualAid";
import SpeakingChallengeLoading from "./SpeakingChallengeLoading";
import { ChallengePreviewDialog, SpeakingMapGoal, speakingLessonTopic } from "./SpeakingMapEntry";
import SpeakingAdventureSession from "./SpeakingAdventureSession";
import { SpeakingChallengeCompletion, SpeakingChallengeReturn } from "./SpeakingChallengeAnimation";
import WorkbookOneFoundationChallenge from "./WorkbookOneFoundationChallenge";
import WorkbookOnePictureChallenge from "./WorkbookOnePictureChallenge";
import { buildSpeakingAdventureRoute } from "../../utils/speakingAdventureMap";
import { createSpeakingChallengeSessionId } from "../../utils/speakingChallengeSession";
import { questionPromptMode } from "../../utils/textQaPrompt";
import { isReadAloudType, usesSinglePracticeMode } from "../../utils/speakingPracticeMode";
import "./css/TextbookSpeakingChallenge.scss";
import "./css/SpeakingAdventureMap.scss";
import "./css/SpeakingAdventureRoute.scss";
import "./css/ImmersiveSpeaking.scss";
import "./css/SpeakingMapEntry.scss";
import "./css/SpeakingAdventureSession.scss";

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
    .replace(/^\s*(?:P[.\s]*)?\d{1,4}\s*/i, "")
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
    return pages ? `P.${pages}` : "";
};

const levelReference = item => {
    const pages = pageReference(item);
    if (pages) return pages;
    const titlePage = String(item.title || "").match(/^\s*P[.\s]*(\d+(?:\s*[～~-]\s*\d+)?)/i);
    return titlePage ? `P.${titlePage[1].replace(/\s+/g, "")}` : "";
};

const challengeBookCatalogPath = challenge => {
    const book = challenge?.book || challenge?.books || {};
    const bookIdentity = book.id || challenge?.book_id || book.code || book.name;
    return bookIdentity
        ? `/student/speaking-challenges/book/${encodeURIComponent(`book-${bookIdentity}`)}`
        : "/student/speaking-challenges";
};

const SpeakingBookCard = ({ group, index, onOpen, rewardPolicy }) => {
    const completedCount = group.sections
        .flatMap(section => section.items)
        .filter(item => item.is_completed).length;
    const progressPercent = group.itemCount
        ? Math.round((completedCount / group.itemCount) * 100)
        : 0;
    const actionLabel = completedCount === group.itemCount && group.itemCount > 0
        ? "再次挑戰"
        : completedCount > 0 ? "繼續冒險" : "開始冒險";
    const rewardXp = Number(rewardPolicy?.xp);
    const rewardPoints = Number(rewardPolicy?.ae_points);
    const hasRewardPolicy = Number.isFinite(rewardXp) && Number.isFinite(rewardPoints);
    const rewardLabel = hasRewardPolicy
        ? `，每關首次通關 ${rewardXp} XP、最多 ${rewardPoints} AE Points`
        : "";

    return <button
        type="button"
        className={`speaking-book-card speaking-book-card--theme-${index % 4}`}
        onClick={onOpen}
        aria-label={`開啟 ${group.label}，共 ${group.itemCount} 關，已完成 ${completedCount} 關${rewardLabel}`}
    >
        <span className="speaking-book-card__chapter" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <span className="speaking-book-card__content">
            <small className="speaking-book-card__eyebrow">口說冒險 · 第 {index + 1} 冊</small>
            <strong>{group.label}</strong>
            <span className="speaking-book-card__count">共 {group.itemCount} 關 · 已完成 {completedCount} 關</span>
            <span className="speaking-book-card__progress">
                <span
                    className="speaking-book-card__track"
                    role="progressbar"
                    aria-label={`${group.label} 完成進度`}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={progressPercent}
                ><span style={{ width: `${progressPercent}%` }} /></span>
            </span>
        </span>
        <span className="speaking-book-card__action">{actionLabel}<FiChevronRight aria-hidden="true" /></span>
    </button>;
};

const ChallengeLesson = ({ item, onOpen, staffPreview, section, current, nextTarget, mapNode, levelNumber, topicNumber }) => {
    const locked = !staffPreview && item.is_unlocked === false;
    const completed = item.is_completed === true;
    const pages = pageReference(item);
    const challengeLabel = lessonTitle(item);
    const special = item.generation_metadata?.map_level_kind === "special";
    const levelLabel = section === "topic" ? `主題${topicNumber}` : pages || String(levelNumber).padStart(2, "0");
    const multilineLabel = /[～、]/.test(levelLabel);
    const visualLabel = levelLabel.replace("～", "\n～").replace("、", "\n");
    return <button data-question-set-id={item.id} aria-current={nextTarget ? "step" : undefined} className={`speaking-challenge-lesson is-${section} is-${mapNode.zone} ${multilineLabel ? "is-multiline-label" : ""} ${special ? "is-special" : ""} ${locked ? "is-locked" : ""} ${completed ? "is-completed" : ""} ${current ? "is-current" : ""} ${nextTarget ? "is-next-target" : ""}`} style={{ "--map-y": `${mapNode.y}%`, "--map-side": `${mapNode.x}%`, "--map-mobile-side": `${mapNode.xMobile}%` }} type="button" onClick={onOpen} aria-label={`${levelLabel}，${challengeLabel}，${locked ? "尚未解鎖" : completed ? "已通關" : "可挑戰"}${nextTarget ? "，下一個目標" : ""}`}>
        <span className="speaking-challenge-lesson__number" aria-hidden="true">{visualLabel}</span>
    </button>;
};

const ChallengeRules = ({ policy }) => {
    const [expanded, setExpanded] = useState(false);
    const dailyRemaining = Number(policy?.daily_remaining);
    const hasUsage = Number.isFinite(dailyRemaining);
    return <section className={`speaking-challenge-rules ${expanded ? "is-expanded" : ""}`} aria-labelledby="speaking-challenge-rules-title">
        <button type="button" className="speaking-challenge-rules__toggle" aria-expanded={expanded} aria-controls="speaking-challenge-rules-content" onClick={() => setExpanded(current => !current)}>
            <span className="speaking-challenge-rules__icon" aria-hidden="true">?</span>
            <span className="speaking-challenge-rules__heading">
                <small>HOW TO PLAY</small>
                <strong id="speaking-challenge-rules-title">遊戲規則</strong>
                <span className="speaking-challenge-rules__quota">每天最多 5 次{hasUsage ? ` · 今天剩 ${dailyRemaining} 次` : ""}</span>
            </span>
            <span className="speaking-challenge-rules__action">{expanded ? "收起規則" : "查看規則"}<FiChevronDown aria-hidden="true" /></span>
        </button>
        {expanded && <div id="speaking-challenge-rules-content" className="speaking-challenge-rules__content">
            <ol>
                <li><b>每天 5 次</b><span>每天最多開始 5 輪正式挑戰，於台北時間午夜重置。</span></li>
                <li><b>送出才計次</b><span>只進入關卡、還沒正式送出第一段錄音就離開，不會扣次數。</span></li>
                <li><b>重錄不多扣輪數</b><span>同一輪裡重新錄音、重試題目或繼續下一題，都只算每天額度中的同一輪。</span></li>
                <li><b>慢慢說也有時間</b><span>字母與拼讀最長 12 秒，句子與問答最長 25 秒；說完就能停止，不必等倒數結束。</span></li>
                <li><b>回聽安心練習</b><span>錄音與回聽不占送評時間；送出與重試評分會按音檔實際長度計入月用量，不是一律計滿 25 秒。</span></li>
                <li><b>依序闖關</b><span>先完成入門準備，課本關卡會照順序開放。</span></li>
                <li><b>依題型練習</b><span>照念類只有一種練習，需要時可聽示範；問答類可選簡單或挑戰，成就分開記錄。練習或簡單通關後解鎖下一頁。</span></li>
                <li><b>挑戰提示</b><span>看過提示的題目本輪不計通關，結束後只要重試未通過的題目。</span></li>
            </ol>
            <p><FiCheck aria-hidden="true" /> 通關會顯示打勾並開啟下一關；主題練習可以自由選擇。</p>
        </div>}
    </section>;
};

export default function TextbookSpeakingChallenge() {
    const { firebaseUser, role } = useAuth();
    const { questionSetId, bookKey } = useParams();
    const [searchParams] = useSearchParams();
    const challengeMode = searchParams.get("mode") === "challenge" ? "challenge" : "easy";
    const navigate = useNavigate();
    const location = useLocation();
    const [catalog, setCatalog] = useState([]);
    const [catalogRewardPolicy, setCatalogRewardPolicy] = useState(null);
    const [challengePolicy, setChallengePolicy] = useState(null);
    const [catalogLoading, setCatalogLoading] = useState(!questionSetId);
    const [loadedCatalogPath, setLoadedCatalogPath] = useState("");
    const [challenge, setChallenge] = useState(null);
    const [loadedChallengeKey, setLoadedChallengeKey] = useState("");
    const [error, setError] = useState("");
    const [audioWorking, setAudioWorking] = useState("");
    const [audioError, setAudioError] = useState("");
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
    const [completionNotice, setCompletionNotice] = useState(null);
    const [returnTransition, setReturnTransition] = useState(null);
    const [completionCatalog, setCompletionCatalog] = useState([]);
    const [retryNotice, setRetryNotice] = useState(false);
    const [challengeSessionId, setChallengeSessionId] = useState("");
    const [selectedLesson, setSelectedLesson] = useState(null);
    const audioRef = useRef(null);
    const questionHeadingRef = useRef(null);
    const levelDialogRef = useRef(null);
    const selectedNodeRef = useRef(null);
    const leavingRef = useRef(false);
    const activeRouteRef = useRef("");
    activeRouteRef.current = `${questionSetId}:${challengeMode}`;
    const interactionType = String(challenge?.generation_metadata?.interaction_type || "");
    const questions = challenge?.speaking_questions || [];
    const singlePractice = usesSinglePracticeMode(challenge);
    const activeQuestion = questions[activeQuestionIndex];
    const staffPreview = role === "teacher" || role === "admin";
    const adminScoringPreview = role === "admin";
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
                    items: [...group.sections.get(section)].sort((left, right) => Number(left.sequence_order || 0) - Number(right.sequence_order || 0)
                        || Number(left.source_pages?.at(-1) || 0) - Number(right.source_pages?.at(-1) || 0)
                        || Number(left.id) - Number(right.id))
                }));
            const guardedSections = sections.map(section => ({
                ...section,
                items: section.items.map((item, itemIndex) => {
                    // Every catalog section is an independent learning path:
                    // its first challenge is always available, while later
                    // challenges must follow the completed chain in that section.
                    const previousItemsCompleted = section.items
                        .slice(0, itemIndex)
                        .every(previousItem => previousItem.is_completed === true);
                    const itemUnlocked = staffPreview
                        || itemIndex === 0
                        || (item.is_unlocked !== false && previousItemsCompleted);
                    return { ...item, is_unlocked: itemUnlocked };
                })
            }));
            return { ...group, sections: guardedSections, itemCount: guardedSections.reduce((count, section) => count + section.items.length, 0) };
        });
    }, [catalog, staffPreview]);

    useEffect(() => {
        leavingRef.current = false;
        setReturnTransition(null);
        setCompletionNotice(null);
        setCompletionCatalog([]);
    }, [location.pathname, challengeMode]);

    useEffect(() => {
        if (!returnTransition) return undefined;
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        const timer = window.setTimeout(() => navigate(returnTransition.path, {
            state: { speakingReturn: { questionSetId: returnTransition.questionSetId } }
        }), reduced ? 0 : 650);
        return () => window.clearTimeout(timer);
    }, [navigate, returnTransition]);

    useEffect(() => {
        if (!completionNotice) return undefined;
        let cancelled = false;
        getSpeakingChallengeCatalog(firebaseUser).then(response => {
            if (!cancelled && !leavingRef.current) setCompletionCatalog(response?.challenges || []);
        }).catch(() => { /* The result remains available; returning to the map can retry its request. */ });
        return () => { cancelled = true; };
    }, [completionNotice, firebaseUser]);

    const requestReturn = path => {
        if (leavingRef.current) return;
        leavingRef.current = true;
        audioRef.current?.pause();
        audioRef.current = null;
        setReturnTransition({ path, questionSetId: Number(questionSetId) || null });
    };

    const showCompletion = notice => {
        audioRef.current?.pause();
        setCompletionNotice(current => current || (notice && typeof notice === "object" ? notice : { xp_awarded: 0, ae_points_awarded: 0 }));
    };

    const renderScene = content => {
        if (returnTransition) return <SpeakingChallengeReturn toCatalog={returnTransition.path === "/student/speaking-challenges"} />;
        if (!completionNotice) return questionSetId && challenge && Number(challenge.id) === Number(questionSetId) && loadedChallengeKey === `${questionSetId}:${challengeMode}`
            ? <SpeakingAdventureSession key={`${questionSetId}:${challengeMode}`} challenge={challenge} pages={levelReference(challenge)} mode={challengeMode} firebaseUser={firebaseUser}>{content}</SpeakingAdventureSession>
            : content;
        const bookPath = challengeBookCatalogPath(challenge);
        const items = (completionCatalog.length ? completionCatalog : staffPreview ? catalog : [])
            .filter(item => challengeBookCatalogPath(item) === bookPath)
            .sort((left, right) => ["preparation", "textbook", "topic"].indexOf(catalogSection(left)) - ["preparation", "textbook", "topic"].indexOf(catalogSection(right))
                || Number(left.sequence_order || 0) - Number(right.sequence_order || 0)
                || Number(left.source_pages?.at(-1) || 0) - Number(right.source_pages?.at(-1) || 0)
                || Number(left.id) - Number(right.id));
        const currentIndex = items.findIndex(item => Number(item.id) === Number(questionSetId));
        const next = currentIndex >= 0 ? items[currentIndex + 1] : null;
        const nextAvailable = next && (staffPreview || next.is_unlocked === true);
        return <SpeakingChallengeCompletion notice={completionNotice} mode={challengeMode} staffPreview={staffPreview}
            nextTopic={nextAvailable ? speakingLessonTopic(next, levelReference(next)) : ""}
            reference={[challenge?.books?.name || challenge?.book?.name, challenge ? levelReference(challenge) || challenge.title : ""].filter(Boolean).join(" · ")}
            onReturn={() => requestReturn(bookPath)}
            onNext={nextAvailable ? () => navigate(`/student/speaking-challenges/${next.id}?mode=${usesSinglePracticeMode(next) ? "easy" : challengeMode}`, { state: { speakingEntry: {
                questionSetId: next.id, bookLabel: next.book?.name || next.books?.name,
                levelLabel: levelReference(next) || lessonTitle(next), bookCatalogPath: bookPath, singlePractice: usesSinglePracticeMode(next)
            } } }) : undefined} />;
    };

    useEffect(() => () => {
        audioRef.current?.pause();
        audioRef.current = null;
    }, []);

    useEffect(() => {
        // Workbook 地圖與小關卡共用手機專注模式；教材總覽保留導覽。
        if (!bookKey && !questionSetId) {
            document.body.classList.remove("speaking-challenge-active", "speaking-game-world-active");
            return undefined;
        }

        document.body.classList.add("speaking-challenge-active", "speaking-game-world-active");
        return () => document.body.classList.remove("speaking-challenge-active", "speaking-game-world-active");
    }, [bookKey, questionSetId]);
    useEffect(() => {
        if (questionSetId && activeQuestion?.id && !["alphabet_round", "letter_spelling", "picture_qa", "picture_gap_sentence", "mixed"].includes(interactionType)) {
            questionHeadingRef.current?.focus({ preventScroll: true });
        }
    }, [activeQuestion?.id, interactionType, questionSetId]);

    useEffect(() => {
        // Keep every catalog, workbook, and individual challenge entry at a
        // predictable reading position. JSDOM deliberately omits scrolling.
        if (process.env.NODE_ENV !== "test") {
            window.scrollTo({ top: 0, behavior: "auto" });
        }
    }, [bookKey, questionSetId]);

    useEffect(() => {
        setSelectedLesson(null);
    }, [bookKey]);

    useEffect(() => {
        if (!bookKey || !catalog.length || process.env.NODE_ENV === "test") return;
        const returnedId = Number(location.state?.speakingReturn?.questionSetId);
        const node = (returnedId && document.querySelector(`[data-question-set-id="${returnedId}"]`))
            || document.querySelector(".speaking-challenge-lesson.is-next-target")
            || document.querySelector(".speaking-challenge-lesson.is-current");
        node?.scrollIntoView?.({ block: "center", behavior: "auto" });
        if (returnedId) node?.focus?.({ preventScroll: true });
    }, [bookKey, catalog, location.state]);

    useEffect(() => {
        if (!selectedLesson) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const firstAction = levelDialogRef.current?.querySelector(".speaking-level-dialog__actions .primary:not(:disabled)")
            || levelDialogRef.current?.querySelector("button:not(:disabled)");
        firstAction?.focus();
        const onKeyDown = event => {
            if (event.key === "Escape") setSelectedLesson(null);
            if (event.key !== "Tab") return;
            const buttons = [...(levelDialogRef.current?.querySelectorAll("button:not(:disabled)") || [])];
            if (!buttons.length) return;
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", onKeyDown);
            selectedNodeRef.current?.focus();
        };
    }, [selectedLesson]);

    useEffect(() => {
        if (!firebaseUser) return;
        let cancelled = false;
        setError("");
        setAudioError("");
        if (questionSetId) {
            setActiveQuestionIndex(0);
            setChallenge(null);
            setRetryNotice(false);
            setChallengeSessionId(createSpeakingChallengeSessionId());
        }
        const load = async () => {
            try {
                if (questionSetId) {
                    const challengeResponse = await getSpeakingChallengeSet(firebaseUser, Number(questionSetId), challengeMode);
                    if (!cancelled && !leavingRef.current) {
                        if (challengeMode === "challenge" && usesSinglePracticeMode(challengeResponse.challenge)) {
                            navigate(`${location.pathname}?mode=easy`, { replace: true, state: location.state });
                            return;
                        }
                        setChallenge(challengeResponse.challenge);
                        setLoadedChallengeKey(`${questionSetId}:${challengeMode}`);
                        if (!staffPreview) {
                            const nextIndex = (challengeResponse.challenge?.speaking_questions || [])
                                .findIndex(question => question.progress_status !== "completed");
                            setActiveQuestionIndex(Math.max(0, nextIndex));
                        }
                        setChallengePolicy(challengeResponse.challenge_policy || null);
                    }
                }
                else {
                    setCatalogLoading(true);
                    const catalogResponse = await getSpeakingChallengeCatalog(firebaseUser);
                    const nextCatalog = catalogResponse.challenges || [];
                    if (!cancelled && !leavingRef.current) {
                        setCatalog(nextCatalog);
                        setLoadedCatalogPath(location.pathname);
                        setCatalogRewardPolicy(catalogResponse.reward_policy || null);
                        setChallengePolicy(catalogResponse.challenge_policy || null);
                    }
                }
            } catch (loadError) {
                if (!cancelled && !leavingRef.current) setError(loadError.message || "口說大挑戰載入失敗");
            }
            finally {
                if (!cancelled && !leavingRef.current && !questionSetId) setCatalogLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [firebaseUser, questionSetId, staffPreview, challengeMode, navigate, location.pathname, location.state]);

    const markComplete = async question => {
        if (staffPreview) return { success: true, demo_mode: true };
        const requestKey = activeRouteRef.current;
        try {
            const response = await completeSpeakingChallengeQuestion(firebaseUser, challenge.id, question.id, challengeMode, challengeSessionId);
            if (leavingRef.current || activeRouteRef.current !== requestKey) return response || true;
            setChallenge(current => ({ ...current, speaking_questions: current.speaking_questions.map(item => item.id === question.id ? { ...item, progress_status: "completed" } : item) }));
            if (response?.challenge_completed || response?.completed_challenge || response?.challenge_complete) showCompletion(response);
            return response || true;
        } catch (saveError) {
            if (leavingRef.current || activeRouteRef.current !== requestKey) return false;
            if (saveError.code === "challenge_hint_used") return { hint_used: true };
            return false;
        }
    };

    const markScored = async question => {
        if (question.progress_status !== "completed") return markComplete(question);
        return true;
    };

    const revealHint = (question, sessionId) => staffPreview
        ? Promise.resolve({
            hint_zh: question.hint_zh,
            simple_answer: question.simple_answer,
            model_answer: question.model_answer,
            pronunciation_notes_zh: question.pronunciation_notes_zh
        })
        : revealSpeakingChallengeHint(firebaseUser, challenge.id, question.id, sessionId);

    const playModelAudio = question => {
        if (!question.model_audio_url) return;
        audioRef.current?.pause();
        const audio = new Audio(question.model_audio_url);
        audioRef.current = audio;
        setAudioWorking(String(question.id));
        const clear = () => setAudioWorking(current => current === String(question.id) ? "" : current);
        audio.addEventListener("ended", clear, { once: true });
        setAudioError("");
        audio.addEventListener("error", () => { clear(); setAudioError("示範暫時無法播放，請再按一次試聽；你仍可直接錄音。"); }, { once: true });
        audio.play().catch(() => { clear(); setAudioError("示範暫時無法播放，請再按一次試聽；你仍可直接錄音。"); });
    };

    if (error) return <main className="speaking-challenge-page"><section className="speaking-challenge-empty"><FiMic /><h1>口說大挑戰暫時無法開啟</h1><p>{error}</p><Link to="/student/membership">查看方案與功能</Link></section></main>;
    if (!questionSetId) {
        const selectedBook = bookKey ? catalogGroups.find(group => group.id === bookKey || encodeURIComponent(group.id) === bookKey) : null;
        if (bookKey && (catalogLoading || loadedCatalogPath !== location.pathname)) {
            const entry = location.state?.speakingBookEntry;
            const routeLabel = /^book-\d+$/.test(bookKey) ? `Workbook ${bookKey.slice(5)}` : bookKey.replace(/^book-/, "");
            return renderScene(<SpeakingChallengeLoading workbookEntry
                bookLabel={selectedBook?.label || (entry?.bookKey === bookKey ? entry.bookLabel : "") || routeLabel}
                onReturn={() => requestReturn("/student/speaking-challenges")} />);
        }
        const selectedBookCompleted = selectedBook?.sections
            .flatMap(section => section.items)
            .filter(item => item.is_completed).length || 0;
        let topicNumber = 0;
        const mapLessons = selectedBook?.sections.flatMap(section => {
            const currentIndex = section.items.findIndex(item => item.is_unlocked !== false && item.is_completed !== true);
            return section.items.map((item, index) => ({ item, section: section.id, current: index === currentIndex, topicNumber: section.id === "topic" ? ++topicNumber : null }));
        }) || [];
        const nextTarget = mapLessons.find(lesson => lesson.current);
        const openMapLesson = (lesson, trigger) => {
            selectedNodeRef.current = trigger;
            setSelectedLesson({ item: lesson.item, section: lesson.section });
        };
        const mapRoute = selectedBook ? buildSpeakingAdventureRoute(selectedBook.id, mapLessons.map(({ item }) => item)) : null;
        return renderScene(<main className={`speaking-challenge-page speaking-challenge-catalog${selectedBook ? " is-book-open" : ""}`}>
            {selectedBook ? <header className="speaking-book-toolbar">
                <button type="button" className="speaking-back" aria-label="返回全部教材" onClick={() => requestReturn("/student/speaking-challenges")}><FiChevronLeft /><span>全部教材</span></button>
                <div className="speaking-book-toolbar__title">
                    <FiBookOpen aria-hidden="true" />
                    <div><h1>{selectedBook.label}</h1><p>口說大挑戰</p></div></div>
                <div className="speaking-book-toolbar__progress" aria-label={`已完成 ${selectedBookCompleted} / ${selectedBook.itemCount} 關`}>
                    <strong>{selectedBookCompleted}/{selectedBook.itemCount}</strong><span>已完成</span>
                </div>
            </header> : <header className="speaking-challenge-hero">
                <span className="speaking-challenge-hero__copy">
                    <span>{staffPreview ? "STAFF PREVIEW" : "SPEAKING ADVENTURE"}</span>
                    <h1>口說大挑戰</h1>
                    <p>{staffPreview ? "選擇 Workbook 預覽已發布關卡。" : "選一本 Workbook，沿著地圖開始冒險。"}</p>
                </span>
            </header>}
            {!staffPreview && !selectedBook && <ChallengeRules policy={challengePolicy} />}
            <section className="speaking-challenge-grid" aria-busy={catalogLoading}>
                {catalogLoading && <div className="speaking-challenge-loading-status" role="status">正在準備口說大挑戰…</div>}
                {!catalogLoading && !selectedBook && catalogGroups.map((group, index) => <SpeakingBookCard key={group.id} group={group} index={index} rewardPolicy={catalogRewardPolicy} onOpen={() => navigate(`/student/speaking-challenges/book/${encodeURIComponent(group.id)}`, { state: { speakingBookEntry: { bookKey: group.id, bookLabel: group.label } } })} />)}
                {!catalogLoading && selectedBook && <section className="speaking-catalog-group speaking-adventure-route" aria-label={`${selectedBook.label} 冒險地圖`}>
                    <section className="speaking-map-chapter is-book"><div className="speaking-map-canvas" style={{ "--map-aspect-ratio": mapRoute.aspectRatio }}>
                        {/* <div className="speaking-map-book-sign" aria-label={`${selectedBook.label} 口說大挑戰`}>
                            <strong>{selectedBook.label}</strong>
                            <span>{staffPreview ? "關卡預覽" : "口說大挑戰"}</span>
                        </div> */}
                        {mapLessons.map((lesson, index) => <ChallengeLesson key={lesson.item.id} item={lesson.item} section={lesson.section} staffPreview={staffPreview} current={lesson.current} nextTarget={lesson === nextTarget} mapNode={mapRoute.nodes[index]} levelNumber={index + 1} topicNumber={lesson.topicNumber} onOpen={event => openMapLesson(lesson, event.currentTarget)} />)}
                    </div></section>
                </section>}
                {!catalogLoading && !catalog.length && <div className="speaking-challenge-empty"><FiBookOpen /><h2>還沒有可挑戰的教材</h2><p>老師發布題庫後，會在這裡出現。</p></div>}
            </section>
            {!catalogLoading && selectedBook && selectedBook.itemCount > 0 && <SpeakingMapGoal target={nextTarget} pages={nextTarget ? levelReference(nextTarget.item) : ""} completed={selectedBookCompleted} total={selectedBook.itemCount} staffPreview={staffPreview} onOpen={event => openMapLesson(nextTarget, event.currentTarget)} />}
            {selectedLesson && <ChallengePreviewDialog item={selectedLesson.item} section={selectedLesson.section} sectionCopy={CATALOG_SECTION_COPY[selectedLesson.section] || CATALOG_SECTION_COPY.textbook} pages={levelReference(selectedLesson.item)} staffPreview={staffPreview} dialogRef={levelDialogRef} onClose={() => setSelectedLesson(null)} onEnter={mode => navigate(`/student/speaking-challenges/${selectedLesson.item.id}?mode=${mode}`, { state: { speakingEntry: {
                questionSetId: selectedLesson.item.id,
                bookLabel: selectedBook?.label,
                levelLabel: levelReference(selectedLesson.item) || lessonTitle(selectedLesson.item),
                bookCatalogPath: location.pathname, singlePractice: usesSinglePracticeMode(selectedLesson.item)
            } } })} />}
        </main>);
    }
    if (!challenge || Number(challenge.id) !== Number(questionSetId) || loadedChallengeKey !== `${questionSetId}:${challengeMode}`) {
        const entry = Number(location.state?.speakingEntry?.questionSetId) === Number(questionSetId)
            ? location.state.speakingEntry : null;
        const catalogItem = catalog.find(item => Number(item.id) === Number(questionSetId));
        const returnPath = entry?.bookCatalogPath || challengeBookCatalogPath(catalogItem);
        return renderScene(<SpeakingChallengeLoading mode={challengeMode}
            singlePractice={entry?.singlePractice || usesSinglePracticeMode(catalogItem)}
            bookLabel={entry?.bookLabel || catalogItem?.book?.name || catalogItem?.books?.name}
            levelLabel={entry?.levelLabel || (catalogItem ? levelReference(catalogItem) || lessonTitle(catalogItem) : "")}
            onReturn={() => requestReturn(returnPath)} />);
    }
    const bookCatalogPath = challengeBookCatalogPath(challenge);
    const returnToBookCatalog = () => requestReturn(bookCatalogPath);
    if (["alphabet_round", "letter_spelling"].includes(interactionType)) return renderScene(<WorkbookOneFoundationChallenge
        challenge={challenge}
        firebaseUser={firebaseUser}
        onComplete={markScored}
        staffPreview={staffPreview}
        adminScoringPreview={adminScoringPreview}
        onStartRound={() => startSpeakingFoundationRound(firebaseUser, challenge.id)}
        onStartAlphabetIntro={() => startAlphabetIntroListen(firebaseUser, challenge.id)}
        onCompleteAlphabetIntro={listenSessionId => completeAlphabetIntroListen(firebaseUser, challenge.id, listenSessionId)}
        onExit={returnToBookCatalog}
        onFinished={showCompletion}
        audioWorking={audioWorking}
        onPlayModelAudio={playModelAudio}
        audioError={audioError}
    />);
    if (["picture_qa", "picture_gap_sentence"].includes(interactionType)) return renderScene(<WorkbookOnePictureChallenge
        challenge={challenge}
        firebaseUser={firebaseUser}
        challengeMode={challengeMode}
        onRevealHint={revealHint}
        staffAudioPreview={staffPreview}
        onComplete={markScored}
        staffPreview={staffPreview}
        adminScoringPreview={adminScoringPreview}
        onExit={returnToBookCatalog}
        onFinished={showCompletion}
    />);
    const completedCount = questions.filter(question => question.progress_status === "completed").length;
    const remainingCount = questions.length - completedCount;
    const progressPercent = questions.length ? Math.round((completedCount / questions.length) * 100) : 0;

    if (!activeQuestion) return renderScene(<main className="speaking-challenge-page"><section className="speaking-challenge-empty"><FiBookOpen /><h1>這個大挑戰還沒有小關卡</h1><p>請稍後再回來練習。</p><button type="button" className="speaking-back" onClick={returnToBookCatalog}><FiChevronLeft />關卡列表</button></section></main>);

    const isCompleted = staffPreview || activeQuestion.progress_status === "completed";
    const activeInteractionType = String(activeQuestion.picture_interaction?.type || activeQuestion.interaction_type || "");
    const declaredQuestionType = interactionType === "mixed"
        ? challenge.generation_metadata?.question_modes?.find(mode => Number(mode.sort_order) === Number(activeQuestion.sort_order))?.interaction_type
        : activeInteractionType;
    const activeReadAloud = singlePractice || isReadAloudType(declaredQuestionType);
    const activePictureMode = ["picture_qa", "picture_gap_sentence"].includes(activeInteractionType);
    const activeTextQa = activeInteractionType === "text_qa";
    const activePromptMode = activeQuestion.prompt_mode || questionPromptMode(challenge?.generation_metadata, activeQuestion);
    const activeZhToEn = activeTextQa && activePromptMode === "zh_to_en";
    const activeGrammarCue = activeTextQa && activePromptMode === "grammar_cue";
    const groupedTextQaClue = activeTextQa
        && challenge?.generation_metadata?.candidate_filter?.generation_strategy === "ai_grouped_numbered_text_qa"
        ? String(activeQuestion.hint_zh || "").match(/^題目線索：([^。]+)。/)?.[1] : null;
    // Older published Workbook 2 questions kept the object clue only in the
    // hint. Show it next to the question without mutating published content.
    const inlineLegacyClue = Number(challenge?.book_id) === 2 && groupedTextQaClue
        && !/[\u3400-\u9fff]/.test(String(activeQuestion.question_text || ""));
    const activePrompt = activeInteractionType === "picture_gap_sentence"
        ? activeQuestion.picture_interaction?.sentence_pattern || "看圖片補完整句"
        : activeInteractionType === "picture_qa" ? "看圖片，說出完整問句與回答"
            : inlineLegacyClue ? `${activeQuestion.question_text}（${groupedTextQaClue}）` : activeQuestion.question_text;
    const isLastQuestion = activeQuestionIndex === questions.length - 1;
    const goForward = () => {
        if (staffPreview || questions.every(question => question.progress_status === "completed")) {
            if (isLastQuestion) { showCompletion({ demo_mode: staffPreview }); return; }
            setActiveQuestionIndex(current => current + 1);
            return;
        }
        const nextIndex = questions.findIndex((question, index) => index > activeQuestionIndex && question.progress_status !== "completed");
        if (nextIndex >= 0) { setActiveQuestionIndex(nextIndex); return; }
        if (questions.every(question => question.progress_status === "completed")) { showCompletion(); return; }
        setRetryNotice(true);
    };

    return renderScene(<main className="speaking-challenge-page speaking-challenge-detail speaking-immersive-play">
        {staffPreview && <aside className="speaking-staff-preview-banner" role="status"><FiBookOpen aria-hidden="true" /><span><strong>{adminScoringPreview ? "管理員評分示範" : "工作人員唯讀預覽"}</strong>{adminScoringPreview ? "可以送出評分；不會寫入學生進度、發放獎勵或計入每日挑戰額度。" : "所有已發布題目都可查看，不會寫入學生進度或發放獎勵。"}</span></aside>}
        <header className="speaking-lesson-header">
            <button className="speaking-back" onClick={returnToBookCatalog}><FiChevronLeft />關卡列表</button>
            <strong className="speaking-lesson-page">{levelReference(challenge) || challenge.title}</strong>
            <div className="speaking-lesson-heading">
                <span>{challenge.books?.name || "教材"}</span>
                <h1>{challenge.title}</h1>
                <p>{challenge.topic} · {singlePractice ? "朗讀練習：看著文字念" : challengeMode === "challenge" ? "挑戰：看問題回答" : "簡單：看答案說"}</p>
            </div>
            <div className="speaking-lesson-progress">
                <div><span>第 {activeQuestionIndex + 1} / {questions.length} 題</span><strong>{progressPercent}%</strong></div>
                <div className="speaking-progress-track" role="progressbar" aria-label="大挑戰完成進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progressPercent}><span style={{ width: `${progressPercent}%` }} /></div>
            </div>
            {Number.isFinite(Number(challenge.reward_xp)) && <div className="speaking-lesson-reward"><FiAward aria-hidden="true" /><span>通關獎勵</span><strong>{Number(challenge.reward_xp)} XP</strong></div>}
        </header>

        <section className="speaking-question-stage">
            <article key={activeQuestion.id} className={`speaking-focus-card ${isCompleted ? "done" : ""}`}>
                <div className="speaking-game-question-card">
                    <SpeakingVisualAid aid={activeQuestion.visual_aid} />
                    <header className="speaking-question-heading">
                        <span className="speaking-question-number">{isCompleted ? <FiCheck aria-hidden="true" /> : `第 ${activeQuestionIndex + 1} 題`}</span>
                        <div><small>{isCompleted ? "已完成本題" : `小關卡 ${activeQuestionIndex + 1}`}</small><h2 ref={questionHeadingRef} tabIndex="-1">{activePrompt}</h2>{groupedTextQaClue && !inlineLegacyClue && <p>題目線索：{groupedTextQaClue}</p>}<p>{activePictureMode ? "看圖片後，按下麥克風直接說出完整答案。" : activeZhToEn ? "看中文句子，按下麥克風說出完整英文翻譯。" : activeGrammarCue ? "依照題目提供的文法提示，說出完整英文句子。" : activeTextQa ? "閱讀問題後，用一個符合題目線索的完整句子回答。" : activeReadAloud ? "看著文字念，按下麥克風開始練習。" : "閱讀問題後，按下麥克風直接回答。"}</p></div>
                    </header>
                </div>
                {staffPreview && activeInteractionType === "picture_gap_sentence" && <button type="button" className="speaking-gap-sentence-audio" onClick={() => playModelAudio({ ...activeQuestion, model_audio_url: activeQuestion.picture_interaction?.sentence_audio_url })} disabled={!activeQuestion.picture_interaction?.sentence_audio_url || audioWorking === String(activeQuestion.id)}><FiVolume2 aria-hidden="true" />{audioWorking === String(activeQuestion.id) ? "整句播放中…" : "聽整句（每個挖空停 2 秒）"}</button>}
                {staffPreview && !adminScoringPreview ? <p className="speaking-staff-preview-banner" role="status">老師唯讀預覽：可使用下方按鈕逐題查看，不啟用麥克風。</p> : <SpeakingPracticeSteps firebaseUser={firebaseUser} question={activeQuestion} challengeSessionId={challengeSessionId} challengeMode={challengeMode} showAnswerByDefault={!activeReadAloud && challengeMode === "easy"} onRevealHint={revealHint} interactionType={activeInteractionType} hideHelp={activeReadAloud || (activePictureMode && staffPreview && !adminScoringPreview)} readAloud={activeReadAloud} deferAnswerHelp={activeZhToEn || activeGrammarCue} allowModelAudio={activeReadAloud || staffPreview} audioWorking={audioWorking === String(activeQuestion.id)} onPlayAudio={() => playModelAudio(activeQuestion)} onCompleted={() => markScored(activeQuestion)} promptTitle={activeReadAloud ? "看著文字，開口念" : activeZhToEn ? "看中文，說英文" : activeGrammarCue ? "看提示，說完整句" : activeTextQa ? "看題目，完整回答" : "直接開口回答"} promptDetail={activeReadAloud ? "照著題目文字念，需要時可以先聽示範。" : activeZhToEn ? "先自己說一次完整英文翻譯，之後可以查看提示。" : activeGrammarCue ? "依照文法提示說完整英文句子，之後可以查看示範答案。" : activeTextQa ? "不用圖片；題目未指定性別時，男生或女生答案選一種說完整即可。" : "不用打字，按下麥克風後用完整英文句子回答。"} />}
                {audioError && <p className="speaking-audio-notice" role="alert">{audioError}</p>}
                <small className="speaking-no-reward">{staffPreview ? "示範評分不會寫入學生進度、發放獎勵或計入每日挑戰額度。" : challengeMode === "challenge" ? "挑戰成就會獨立記錄；簡單模式通關才會解鎖下一頁與領取首次獎勵。" : singlePractice ? "首次通關可獲得 XP 與 AE Points，並解鎖下一頁。" : "簡單模式首次通關可獲得 XP 與 AE Points，並解鎖下一頁。"}</small>
            </article>
        </section>

        {staffPreview ? <nav className="speaking-question-navigation" aria-label="小關卡切換">
            <button type="button" onClick={() => setActiveQuestionIndex(current => current - 1)} disabled={activeQuestionIndex === 0}><FiChevronLeft />上一題</button>
            <span>預覽第 {activeQuestionIndex + 1} / {questions.length} 題</span>
            <button type="button" className="primary" onClick={goForward} disabled={!isCompleted}>{isLastQuestion ? "完成大挑戰" : "下一題"}<FiChevronRight /></button>
        </nav> : !completionNotice && !retryNotice && <button type="button" className="speaking-continue-button" onClick={goForward}>{isCompleted ? "繼續挑戰" : "先看下一題"}<FiChevronRight aria-hidden="true" /></button>}
        {retryNotice && <div className="speaking-reward-dialog" role="dialog" aria-modal="true" aria-labelledby="speaking-retry-title"><section>
            <p>已完成 {completedCount}／{questions.length} 題</p>
            <h2 id="speaking-retry-title">只剩 {remainingCount} 題，再試一次！</h2>
            <p>已通過的題目會保留，不必重念。</p>
            {challengeMode === "challenge" && <p>看過提示的題目，這次試著不用提示回答。</p>}
            <div><button type="button" onClick={returnToBookCatalog}>回到關卡列表</button><button type="button" className="primary" onClick={() => {
                setChallengeSessionId(createSpeakingChallengeSessionId());
                setActiveQuestionIndex(questions.findIndex(question => question.progress_status !== "completed"));
                setRetryNotice(false);
            }}>{`再挑戰這 ${remainingCount} 題`}</button></div>
        </section></div>}
    </main>);
}
