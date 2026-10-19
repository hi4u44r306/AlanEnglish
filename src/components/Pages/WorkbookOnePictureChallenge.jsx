import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiRefreshCw, FiVolume2 } from "react-icons/fi";
import { createPictureChallengeRound, tokenizeSpeakingSentence } from "../../utils/speakingPictureChallenge";
import SpeakingPracticeSteps from "./SpeakingPracticeSteps";
import SpeakingQuestionClip from "./SpeakingQuestionClip";
import SpeakingVisualAid from "./SpeakingVisualAid";
import { createSpeakingChallengeSessionId } from "../../utils/speakingChallengeSession";
import { initialGuidedStep, spellingFocusIndex, spellingTargetFor } from "../../utils/speakingGuidedSteps";

const copyByType = {
    picture_qa: {
        eyebrow: "P21 看圖問答",
        title: "看到圖片，問完再回答",
        instruction: "畫面只會顯示圖片。請把完整英文問句和完整回答連在一起說出來。",
        promptTitle: "輪到你看圖問答",
        promptDetail: "按下麥克風，先說完整問句，再接著說完整回答。"
    },
    picture_gap_sentence: {
        eyebrow: "看圖補完整句",
        title: "看圖片，說完整句子",
        instruction: "先看圖片和句型。每個空格都要補上答案，再把整句英文說出來。",
        promptTitle: "輪到你說完整句子",
        promptDetail: "看圖片與句型補上空格，再說出完整英文句子。"
    }
};

// Image descriptions read like "一把鑰匙" or "一顆蘋果和一棵蘋果樹"; the cue is the first thing
// named, without its measure word.
export const pictureCueZh = alt => String(alt || "")
    .split(/[和與跟及、，,。；;（(]/)[0]
    .trim()
    .replace(/^[一兩二三四五六七八九十幾]?[顆隻條個把張本支枝件雙棵朵台臺輛位片塊杯瓶頂座間架艘匹頭群些對枚根盒碗盤包串粒種名]/, "")
    .trim();

// 句子越長字越小，長對話題也能和拼字、麥克風留在同一個畫面。
const sentenceSizeClass = text => {
    const length = String(text || "").length;
    return length > 110 ? " is-very-long" : length > 60 ? " is-long" : "";
};

// 答對後停一下讓學生看到結果、聽到音效再換題；有發音提醒（例如 th）時停久一點。
const CORRECT_PAUSE_MS = 1200;
const TIP_PAUSE_MS = 2600;

export default function WorkbookOnePictureChallenge({ challenge, firebaseUser, staffAudioPreview = false, onComplete, onPracticeOnly, onExit, onFinished, staffPreview = false, adminScoringPreview = false, challengeMode = "easy", onRevealHint, correctPauseMs = CORRECT_PAUSE_MS, tipPauseMs = TIP_PAUSE_MS }) {
    const interactionType = String(challenge?.generation_metadata?.interaction_type || "");
    const gapMode = interactionType === "picture_gap_sentence";
    const copy = copyByType[interactionType] || copyByType.picture_qa;
    const sourceQuestions = useMemo(() => [...(challenge?.speaking_questions || [])]
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order)), [challenge]);
    const [phase, setPhase] = useState("instructions");
    const [round, setRound] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [audioToken, setAudioToken] = useState(null);
    const [audioError, setAudioError] = useState("");
    const [challengeSessionId, setChallengeSessionId] = useState("");
    const [canSkip, setCanSkip] = useState(false);
    const [completedIds, setCompletedIds] = useState(() => new Set());
    const [guided, setGuided] = useState({ id: null, step: null });
    const [exitDialogOpen, setExitDialogOpen] = useState(false);
    const audioRef = useRef(null);
    const phaseFocusRef = useRef(null);
    // 背景存檔用：這一輪的題目、已完成的題目、還在存的請求、最後一次存檔結果、換題計時器。
    const roundRef = useRef([]);
    const doneRef = useRef(new Set());
    const pendingSavesRef = useRef(new Set());
    const lastSavedRef = useRef(null);
    const advanceTimerRef = useRef(null);

    const stopAudio = () => {
        audioRef.current?.pause();
        audioRef.current = null;
        setAudioToken(null);
    };

    const markDone = (questionId, done) => {
        const next = new Set(doneRef.current);
        if (done) next.add(questionId); else next.delete(questionId);
        doneRef.current = next;
        setCompletedIds(next);
    };

    useEffect(() => () => { stopAudio(); window.clearTimeout(advanceTimerRef.current); }, []);
    useEffect(() => {
        stopAudio();
        window.clearTimeout(advanceTimerRef.current);
        setPhase("instructions");
        roundRef.current = [];
        doneRef.current = new Set();
        setRound([]);
        setActiveIndex(0);
        setAudioError("");
        setChallengeSessionId("");
        setCanSkip(false);
        setCompletedIds(new Set());
        setExitDialogOpen(false);
    }, [challenge?.id, interactionType]);

    const startRound = () => {
        stopAudio();
        const remaining = staffPreview ? sourceQuestions : sourceQuestions.filter(question => question.progress_status !== "completed" && !completedIds.has(question.id));
        const roundQuestions = remaining.length ? remaining : sourceQuestions;
        window.clearTimeout(advanceTimerRef.current);
        roundRef.current = staffPreview ? roundQuestions : createPictureChallengeRound(roundQuestions);
        setRound(roundRef.current);
        setActiveIndex(0);
        setCanSkip(false);
        setAudioError("");
        setChallengeSessionId(createSpeakingChallengeSessionId());
        setPhase("challenge");
    };

    const activeQuestion = round[activeIndex];
    useEffect(() => {
        if (["challenge", "result"].includes(phase)) {
            phaseFocusRef.current?.focus({ preventScroll: true });
        }
    }, [activeQuestion?.id, phase]);
    // 第一級（easy）在「念」這一步才顯示完整句子；聽與拼的時候先顯示挖空句，避免先看到答案。
    // 第二級只顯示挖空句。舊版後端在 easy 模式不給答案時，退回挖空句。
    const guidedStep = guided.id === activeQuestion?.id ? guided.step : initialGuidedStep(activeQuestion, challengeMode);
    const fullSentence = gapMode && challengeMode === "easy" && guidedStep === "speak" ? String(activeQuestion?.model_answer || "").trim() : "";
    const sentenceText = fullSentence || activeQuestion?.picture_interaction?.sentence_pattern;
    const sentenceTokens = useMemo(() => tokenizeSpeakingSentence(sentenceText), [sentenceText]);

    // The picture is replaced by its Chinese description: inside the blank when the sentence
    // has one blank, as a single cue line when it has several.
    const gapCue = pictureCueZh(activeQuestion?.visual_aid?.alt_zh);
    const blankCue = !fullSentence && sentenceTokens.filter(token => token.kind === "blank").length === 1 ? gapCue : "";
    // 拼字時：不用拼的空格直接填上答案，要拼的空格用黃框標出來，學生知道正在拼哪一格。
    // 相鄰的空格（____ ____）算同一格，和拼字的答案一一對應。
    const spellAnswers = gapMode && !fullSentence && guidedStep === "spell" ? spellingTargetFor(activeQuestion) : null;
    const spellFocus = spellAnswers ? spellingFocusIndex(spellAnswers) : -1;
    const blankGroups = useMemo(() => {
        let group = -1;
        let previousBlank = false;
        return sentenceTokens.map(token => {
            if (token.kind !== "blank") { previousBlank = false; return null; }
            const first = !previousBlank;
            if (first) group += 1;
            previousBlank = true;
            return { group, first };
        });
    }, [sentenceTokens]);

    const playAudio = (url, token, errorMessage, blockedMessage) => {
        if (!url) return;
        stopAudio();
        setAudioError("");
        setAudioToken(token);
        const audio = new Audio(url);
        audioRef.current = audio;
        const clear = () => {
            audioRef.current = null;
            setAudioToken(null);
        };
        audio.onended = clear;
        audio.onerror = () => {
            clear();
            setAudioError(errorMessage);
        };
        audio.play().catch(() => {
            clear();
            setAudioError(blockedMessage);
        });
    };

    const playSentence = () => playAudio(
        activeQuestion?.picture_interaction?.sentence_audio_url,
        "sentence",
        "整句發音暫時無法播放，請稍後再試。",
        "瀏覽器阻擋了播放，請再按一次聽整句。"
    );

    // 伺服器已判定答對並記下這次評分；這裡把進度存在背景（上層會自動重試），畫面不等。
    // 真的存不到（或這題看過提示）就改回未完成，加到這一輪最後面再念一次。
    const handleCorrect = result => {
        const question = activeQuestion;
        const index = activeIndex;
        markDone(question.id, true);
        const save = Promise.resolve(onComplete?.(question, result, challengeSessionId))
            .catch(() => false)
            .then(saved => {
                if (saved === false || saved?.hint_used) {
                    markDone(question.id, false);
                    roundRef.current = [...roundRef.current, question];
                    setRound(roundRef.current);
                } else lastSavedRef.current = saved;
                return saved;
            });
        pendingSavesRef.current.add(save);
        save.finally(() => pendingSavesRef.current.delete(save));
        setCanSkip(false);
        window.clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = window.setTimeout(async () => {
            stopAudio();
            if (index < roundRef.current.length - 1) { setActiveIndex(index + 1); return; }
            // 最後一題：等所有存檔都有結果，才結算這一輪。
            await Promise.all([...pendingSavesRef.current]);
            if (index < roundRef.current.length - 1) { setActiveIndex(index + 1); return; }
            setPhase("result");
            const allCompleted = staffPreview || sourceQuestions.every(item => item.progress_status === "completed" || doneRef.current.has(item.id));
            if (allCompleted) onFinished?.(lastSavedRef.current ?? true);
        }, result?.pronunciation_tips?.length ? tipPauseMs : correctPauseMs);
        return true;
    };
    const skipQuestion = () => {
        stopAudio();
        setCanSkip(false);
        if (activeIndex >= round.length - 1) setPhase("result");
        else setActiveIndex(index => index + 1);
    };
    // 進行中的一輪按「退出本輪」要先確認，避免誤按；老師預覽沒有進度，直接離開。
    const requestExit = () => { if (staffPreview) onExit?.(); else setExitDialogOpen(true); };
    const confirmExit = () => {
        setExitDialogOpen(false);
        stopAudio();
        window.clearTimeout(advanceTimerRef.current);
        onExit?.();
    };
    const remainingCount = staffPreview ? 0 : sourceQuestions.filter(question => question.progress_status !== "completed" && !completedIds.has(question.id)).length;

    if (phase === "instructions") return <main className="speaking-challenge-page speaking-challenge-detail speaking-foundation-page speaking-picture-page speaking-immersive-play">
        <header className="speaking-lesson-header"><button className="speaking-back" type="button" onClick={onExit}><FiChevronLeft />全部大挑戰</button><div className="speaking-lesson-heading"><span>{copy.eyebrow}</span><h1>{challenge.title}</h1><p>{copy.instruction}</p></div></header>
        <section className="speaking-foundation-intro"><FiVolume2 aria-hidden="true" /><h2>{copy.title}</h2><p>{copy.instruction}</p><button type="button" className="primary" onClick={startRound}>{staffPreview ? "預覽題目" : "開始挑戰"}</button></section>
    </main>;

    if (phase === "result") return <main className="speaking-challenge-page speaking-challenge-detail speaking-foundation-page speaking-picture-page speaking-immersive-play">
        <section className="speaking-foundation-result">
            <span aria-hidden="true">★</span>
            <p>已完成 {sourceQuestions.length - remainingCount}／{sourceQuestions.length} 題</p>
            <h1 ref={phaseFocusRef} tabIndex="-1">{remainingCount ? `只剩 ${remainingCount} 題，再試一次！` : "太棒了，全部完成！"}</h1>
            <p>{remainingCount ? "已通過的題目會保留，不必重念。" : "你已完成這一組看圖口說挑戰。"}</p>
            {remainingCount > 0 && challengeMode === "challenge" && <p>看過提示的題目，這次試著不用提示回答。</p>}
            <div className="speaking-foundation-actions"><button type="button" className="primary" onClick={startRound}><FiRefreshCw />{remainingCount ? `再挑戰這 ${remainingCount} 題` : "再玩一次"}</button><button type="button" className="secondary" onClick={onExit}>返回地圖</button></div>
        </section>
    </main>;

    if (!activeQuestion) return null;
    const progress = Math.round((activeIndex / Math.max(round.length, 1)) * 100);

    return <main className="speaking-challenge-page speaking-challenge-detail speaking-foundation-page speaking-picture-page speaking-immersive-play">
        <header className="speaking-lesson-header">
            <button className="speaking-back" type="button" onClick={requestExit}><FiChevronLeft />退出本輪</button>
            <div className="speaking-lesson-heading"><span>{copy.eyebrow}</span><h1>{challenge.title}</h1><p>{copy.instruction}</p></div>
            <div className="speaking-lesson-progress"><div><span>第 {activeIndex + 1} / {round.length} 題</span><strong>{progress}%</strong></div><div className="speaking-progress-track" role="progressbar" aria-label="本輪進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div></div>
        </header>
        <section className="speaking-question-stage"><article ref={phaseFocusRef} tabIndex="-1" aria-label={`第 ${activeIndex + 1} 題，共 ${round.length} 題`} key={activeQuestion.id} className="speaking-focus-card speaking-foundation-card speaking-picture-card">
            <div className="speaking-game-question-card">
                <span className="speaking-foundation-count">第 {activeIndex + 1} 題，共 {round.length} 題</span>
                <SpeakingVisualAid aid={activeQuestion.visual_aid} showCaption={false} />
                {staffAudioPreview && gapMode && <button
                type="button"
                className="speaking-gap-sentence-audio"
                onClick={playSentence}
                disabled={!activeQuestion.picture_interaction?.sentence_audio_url || audioToken !== null}
                aria-label="播放整句發音；每個挖空處停留 2 秒"
            ><FiVolume2 aria-hidden="true" />{audioToken === "sentence" ? "整句播放中…" : "聽整句（每個挖空停 2 秒）"}</button>}
                {gapMode && <div className={`speaking-gap-sentence${fullSentence ? " is-full" : ""}${sentenceSizeClass(sentenceText)}`} aria-label={sentenceText}>
                {sentenceTokens.map((token, position) => token.kind === "word"
                    ? <span key={token.tokenIndex} className="sentence-word">{token.text}</span>
                    : token.kind === "blank"
                        ? spellAnswers && spellFocus >= 0 && blankGroups[position]?.group !== spellFocus
                            ? blankGroups[position]?.first ? <span key={token.tokenIndex} className="answer-given">{spellAnswers[blankGroups[position].group]}</span> : null
                            : <span key={token.tokenIndex} className={`answer-blank${blankCue ? " has-cue" : ""}${spellAnswers ? " is-spell-target" : ""}`} aria-label={`${blankCue ? `要補上的答案：${blankCue}` : "要補上的答案"}${spellAnswers ? "，正在拼這一格" : ""}`}>{blankCue || "____"}</span>
                        : <span key={token.tokenIndex} className="punctuation" aria-hidden="true">{token.text}</span>)}
            </div>}
                {gapMode && !fullSentence && gapCue && !blankCue && <p className="speaking-gap-cue">（{gapCue}）</p>}
                {audioError && <p className="speaking-foundation-warning" role="alert">{audioError}</p>}
            </div>
            {staffPreview && !adminScoringPreview ? <>{activeQuestion.clip && <SpeakingQuestionClip clip={activeQuestion.clip} />}<p className="speaking-staff-preview-banner" role="status">老師唯讀預覽：可使用下方按鈕逐題查看，不啟用麥克風。</p></> : <SpeakingPracticeSteps
                key={activeQuestion.id}
                firebaseUser={firebaseUser}
                question={activeQuestion}
                challengeSessionId={challengeSessionId}
                interactionType={interactionType}
                challengeMode={challengeMode}
                showAnswerByDefault={challengeMode === "easy" && !fullSentence}
                onRevealHint={onRevealHint}
                hideHelp={(staffPreview && !adminScoringPreview) || (challengeMode === "easy" && !activeQuestion.hint_voids_pass)}
                promptTitle={copy.promptTitle}
                promptDetail={copy.promptDetail}
                onCompleted={handleCorrect}
                onGuidedStepChange={step => setGuided({ id: activeQuestion.id, step })}
                onPracticeOnly={onPracticeOnly}
                onIncorrect={() => setCanSkip(true)}
                onSpellFailed={skipQuestion}
            />}
        </article></section>
        {!staffPreview && canSkip && <button type="button" className="speaking-continue-button" onClick={skipQuestion}>先看下一題 <FiChevronRight aria-hidden="true" /></button>}
        {staffPreview && <nav className="speaking-question-navigation" aria-label="小關卡預覽切換"><button type="button" onClick={() => { stopAudio(); setActiveIndex(index => index - 1); }} disabled={activeIndex === 0}><FiChevronLeft />上一題</button><span>預覽第 {activeIndex + 1} / {round.length} 題</span><button type="button" className="primary" onClick={() => {
            stopAudio();
            if (activeIndex >= round.length - 1) { setPhase("result"); onFinished?.({ demo_mode: true }); }
            else setActiveIndex(index => index + 1);
        }}>{activeIndex >= round.length - 1 ? "完成大挑戰" : "下一題"}<FiChevronRight /></button></nav>}
        {exitDialogOpen && <div className="speaking-exit-dialog-backdrop" role="presentation">
            <section className="speaking-exit-dialog" role="alertdialog" aria-modal="true" aria-labelledby="speaking-picture-exit-title" aria-describedby="speaking-picture-exit-description">
                <h2 id="speaking-picture-exit-title">確定要離開這一輪嗎？</h2>
                <p id="speaking-picture-exit-description">已經通過的題目會保留；這一輪還沒念完的題目，下次要再念一次。</p>
                <div><button type="button" className="secondary" autoFocus onClick={() => setExitDialogOpen(false)}>取消</button><button type="button" className="primary" onClick={confirmExit}>確定離開</button></div>
            </section>
        </div>}
    </main>;
}
