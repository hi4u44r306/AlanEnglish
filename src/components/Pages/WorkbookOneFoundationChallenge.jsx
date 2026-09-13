import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiHeadphones, FiPause, FiPlay, FiRefreshCw, FiVolume2 } from "react-icons/fi";
import { createFoundationRound } from "../../utils/speakingChallengeRound";
import SpeakingPracticeSteps from "./SpeakingPracticeSteps";

const interactionCopy = {
    alphabet_round: {
        eyebrow: "A–Z 起始關",
        instruction: "先聽完 A 到 Z，再看大小寫字母開口唸。",
        prompt: "看清楚字母，聽完提示音後照著唸。"
    },
    letter_spelling: {
        eyebrow: "看字拼讀",
        instruction: "每題只看一個單字，請把每個字母依序唸出來。",
        prompt: "慢慢逐字母拼讀，順序不能改變。"
    }
};

export default function WorkbookOneFoundationChallenge({ challenge, firebaseUser, onComplete, onStartRound, onExit }) {
    const interactionType = String(challenge?.generation_metadata?.interaction_type || "");
    const alphabetMode = interactionType === "alphabet_round";
    const sourceQuestions = useMemo(() => [...(challenge?.speaking_questions || [])]
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order)), [challenge]);
    const [phase, setPhase] = useState(alphabetMode ? "intro" : "instructions");
    const [round, setRound] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [introIndex, setIntroIndex] = useState(0);
    const [introPlaying, setIntroPlaying] = useState(false);
    const [introComplete, setIntroComplete] = useState(false);
    const [countdown, setCountdown] = useState(3);
    const [promptReady, setPromptReady] = useState(!alphabetMode);
    const [promptBlocked, setPromptBlocked] = useState(false);
    const [roundId, setRoundId] = useState("");
    const [startingRound, setStartingRound] = useState(false);
    const [statusError, setStatusError] = useState("");
    const audioRef = useRef(null);
    const phaseFocusRef = useRef(null);
    const startPendingRef = useRef(false);
    const startRequestRef = useRef(0);
    const copy = interactionCopy[interactionType] || interactionCopy.letter_spelling;
    const allAlphabetAudioReady = sourceQuestions.length === 26
        && sourceQuestions.every(question => Boolean(question.model_audio_url));

    const stopAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.onended = null;
            audioRef.current.onerror = null;
            audioRef.current = null;
        }
        setIntroPlaying(false);
    }, []);

    useEffect(() => () => stopAudio(), [stopAudio]);
    useEffect(() => {
        startRequestRef.current += 1;
        stopAudio();
        setPhase(alphabetMode ? "intro" : "instructions");
        setRound([]);
        setActiveIndex(0);
        setIntroIndex(0);
        setIntroComplete(false);
        setRoundId("");
        setStartingRound(false);
        setStatusError("");
        startPendingRef.current = false;
    }, [alphabetMode, challenge?.id, stopAudio]);
    const playAudio = useCallback((question, { onEnded, markIntro = false } = {}) => {
        stopAudio();
        if (!question?.model_audio_url) {
            setPromptBlocked(true);
            setStatusError("標準發音尚未準備完成，請稍後再試");
            return false;
        }
        const audio = new Audio(question.model_audio_url);
        audioRef.current = audio;
        if (markIntro) setIntroPlaying(true);
        audio.onended = () => {
            audioRef.current = null;
            if (markIntro) setIntroPlaying(false);
            onEnded?.();
        };
        audio.onerror = () => {
            audioRef.current = null;
            if (markIntro) setIntroPlaying(false);
            setPromptBlocked(true);
            setStatusError("標準發音暫時無法播放，請重新整理後再試");
        };
        audio.play().catch(() => {
            audioRef.current = null;
            if (markIntro) setIntroPlaying(false);
            setPromptBlocked(true);
            setStatusError("瀏覽器暫時無法播放標準發音，請再按一次");
        });
        return true;
    }, [stopAudio]);

    const playIntroFrom = useCallback(index => {
        if (index >= sourceQuestions.length) {
            stopAudio();
            setIntroIndex(sourceQuestions.length - 1);
            setIntroComplete(true);
            return;
        }
        setIntroIndex(index);
        playAudio(sourceQuestions[index], {
            markIntro: true,
            onEnded: () => playIntroFrom(index + 1)
        });
    }, [playAudio, sourceQuestions, stopAudio]);

    const startRound = useCallback(async () => {
        if (startPendingRef.current) return;
        startPendingRef.current = true;
        const requestId = startRequestRef.current + 1;
        startRequestRef.current = requestId;
        stopAudio();
        setStartingRound(true);
        setStatusError("");
        try {
            let nextRound;
            let nextRoundId = "";
            if (alphabetMode) {
                const response = await onStartRound?.();
                if (requestId !== startRequestRef.current) return;
                const serverRound = response?.round;
                const questionById = new Map(sourceQuestions.map(question => [Number(question.id), question]));
                nextRound = (serverRound?.questions || []).map(item => ({
                    ...questionById.get(Number(item.question_id)),
                    display_text: String(item.display_text || "")
                })).filter(question => Number.isInteger(Number(question.id)) && /^[A-Za-z]$/.test(question.display_text));
                nextRoundId = String(serverRound?.round_id || "");
                if (!nextRoundId || nextRound.length !== 26 || new Set(nextRound.map(question => Number(question.id))).size !== 26) {
                    throw new Error("A–Z 挑戰回合尚未準備完成");
                }
            } else {
                nextRound = createFoundationRound(sourceQuestions, interactionType);
            }
            if (requestId !== startRequestRef.current) return;
            setRound(nextRound);
            setRoundId(nextRoundId);
            setActiveIndex(0);
            setPromptBlocked(false);
            setPromptReady(!alphabetMode);
            setPhase("challenge");
        } catch (cause) {
            if (requestId === startRequestRef.current) {
                setStatusError(cause?.message || "目前無法開始這一輪挑戰");
            }
        } finally {
            if (requestId === startRequestRef.current) {
                startPendingRef.current = false;
                setStartingRound(false);
            }
        }
    }, [alphabetMode, interactionType, onStartRound, sourceQuestions, stopAudio]);

    const activeQuestion = round[activeIndex];
    useEffect(() => {
        if (["challenge", "failed", "result"].includes(phase)) {
            phaseFocusRef.current?.focus({ preventScroll: true });
        }
    }, [activeQuestion?.id, phase]);
    const playChallengePrompt = useCallback(() => {
        if (!activeQuestion) return;
        setPromptBlocked(false);
        setPromptReady(false);
        playAudio(activeQuestion, { onEnded: () => setPromptReady(true) });
    }, [activeQuestion, playAudio]);

    useEffect(() => {
        if (!alphabetMode || phase !== "challenge" || !activeQuestion) return undefined;
        let remaining = 3;
        setCountdown(remaining);
        setPromptReady(false);
        setPromptBlocked(false);
        const timer = window.setInterval(() => {
            remaining -= 1;
            setCountdown(remaining);
            if (remaining === 0) {
                window.clearInterval(timer);
                playChallengePrompt();
            }
        }, 1000);
        return () => window.clearInterval(timer);
    }, [activeQuestion, alphabetMode, phase, playChallengePrompt]);

    const handleIncorrect = () => {
        if (!alphabetMode) return;
        stopAudio();
        setRound([]);
        setRoundId("");
        setActiveIndex(0);
        setPhase("failed");
    };

    const handleCorrect = async result => {
        if (alphabetMode) {
            const expectedStatus = activeIndex >= round.length - 1 ? "completed" : "open";
            if (result?.foundation_round?.status !== expectedStatus) {
                handleIncorrect();
                return;
            }
        } else {
            const saved = await onComplete?.(activeQuestion, result);
            if (saved === false) return;
        }
        if (activeIndex >= round.length - 1) setPhase("result");
        else setActiveIndex(index => index + 1);
    };
    const statusAlert = statusError
        ? <p className="speaking-foundation-warning" role="alert">{statusError}</p>
        : null;

    if (phase === "intro") return <main className="speaking-challenge-page speaking-challenge-detail speaking-foundation-page">
        <header className="speaking-lesson-header">
            <button className="speaking-back" type="button" onClick={onExit}><FiChevronLeft />全部大挑戰</button>
            <div className="speaking-lesson-heading"><span>{copy.eyebrow}</span><h1>{challenge.title}</h1><p>{copy.instruction}</p></div>
        </header>
        <section className="speaking-foundation-intro">
            <FiHeadphones aria-hidden="true" />
            <h2>先聽一遍 A 到 Z</h2>
            <p>跟著亮起來的字母仔細聽，全部聽完就能開始挑戰。</p>
            <div className="speaking-alphabet-list" aria-label="英文字母 A 到 Z">{sourceQuestions.map((question, index) => <span className={index === introIndex && introPlaying ? "active" : index < introIndex || introComplete ? "heard" : ""} key={question.id}>{question.question_text}</span>)}</div>
            {!allAlphabetAudioReady && <p className="speaking-foundation-warning" role="alert">26 個標準發音尚未全部準備完成，這個關卡暫時不能開始。</p>}
            {statusAlert}
            <div className="speaking-foundation-actions">
                <button type="button" onClick={() => playIntroFrom(introComplete ? 0 : introIndex)} disabled={!allAlphabetAudioReady || introPlaying}><FiPlay />{introComplete ? "重新聽 A–Z" : introIndex > 0 ? "繼續聽" : "開始聽 A–Z"}</button>
                {introPlaying && <button type="button" className="secondary" onClick={stopAudio}><FiPause />暫停</button>}
                <button type="button" className="primary" onClick={startRound} disabled={!introComplete || startingRound}>{startingRound ? "正在準備…" : "開始挑戰"}</button>
            </div>
        </section>
    </main>;

    if (phase === "instructions") return <main className="speaking-challenge-page speaking-challenge-detail speaking-foundation-page">
        <header className="speaking-lesson-header"><button className="speaking-back" type="button" onClick={onExit}><FiChevronLeft />全部大挑戰</button><div className="speaking-lesson-heading"><span>{copy.eyebrow}</span><h1>{challenge.title}</h1><p>{copy.instruction}</p></div></header>
        <section className="speaking-foundation-intro"><FiVolume2 aria-hidden="true" /><h2>看到單字，就把字母唸出來</h2><p>每個字母分開唸，題目順序每次都不一樣。</p>{statusAlert}<button type="button" className="primary" onClick={startRound} disabled={startingRound}>{startingRound ? "正在準備…" : "開始拼讀"}</button></section>
    </main>;

    if (phase === "failed") return <main className="speaking-challenge-page speaking-challenge-detail speaking-foundation-page">
        <section className="speaking-foundation-result is-retry"><FiRefreshCw aria-hidden="true" /><h1 ref={phaseFocusRef} tabIndex="-1">沒關係，我們從第一題再來！</h1><p>這一輪已重新歸零。你可以再聽一次 A–Z，或直接換一個新順序挑戰。</p>{statusAlert}<div className="speaking-foundation-actions"><button type="button" onClick={() => { setIntroIndex(0); setIntroComplete(false); setPhase("intro"); }}><FiHeadphones />重新聽 A–Z</button><button type="button" className="primary" onClick={startRound} disabled={startingRound}><FiRefreshCw />{startingRound ? "正在準備…" : "直接再玩一次"}</button></div></section>
    </main>;

    if (phase === "result") return <main className="speaking-challenge-page speaking-challenge-detail speaking-foundation-page">
        <section className="speaking-foundation-result"><span aria-hidden="true">★</span><h1 ref={phaseFocusRef} tabIndex="-1">太棒了，全部完成！</h1><p>你把這一關的每一道題目都說完了。</p>{statusAlert}<div className="speaking-foundation-actions">{alphabetMode && <button type="button" onClick={() => { setIntroIndex(0); setIntroComplete(false); setPhase("intro"); }}><FiHeadphones />再聽 A–Z</button>}<button type="button" className="primary" onClick={startRound} disabled={startingRound}><FiRefreshCw />{startingRound ? "正在準備…" : "再玩一次"}</button><button type="button" className="secondary" onClick={onExit}>回全部大挑戰</button></div></section>
    </main>;

    if (!activeQuestion) return null;
    const disabledReason = alphabetMode && !promptReady
        ? (promptBlocked ? "請先按「播放提示音」，聽完後再錄音。" : countdown > 0 ? `先看清楚，${countdown} 秒後播放提示音。` : "正在播放提示音，聽完就輪到你。")
        : "";

    return <main className="speaking-challenge-page speaking-challenge-detail speaking-foundation-page">
        <header className="speaking-lesson-header">
            <button className="speaking-back" type="button" onClick={onExit}><FiChevronLeft />退出本輪</button>
            <div className="speaking-lesson-heading"><span>{copy.eyebrow}</span><h1>{challenge.title}</h1><p>{copy.prompt}</p></div>
            <div className="speaking-lesson-progress"><div><span>第 {activeIndex + 1} / {round.length} 題</span><strong>{Math.round((activeIndex / Math.max(round.length, 1)) * 100)}%</strong></div><div className="speaking-progress-track" role="progressbar" aria-label="本輪進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round((activeIndex / Math.max(round.length, 1)) * 100)}><span style={{ width: `${Math.round((activeIndex / Math.max(round.length, 1)) * 100)}%` }} /></div></div>
        </header>
        <section className="speaking-question-stage"><article key={activeQuestion.id} className="speaking-focus-card speaking-foundation-card">
            <span className="speaking-foundation-count">第 {activeIndex + 1} 題，共 {round.length} 題</span>
            <div ref={phaseFocusRef} tabIndex="-1" className={alphabetMode ? "speaking-foundation-letter" : "speaking-foundation-word"} aria-label={alphabetMode ? `字母 ${activeQuestion.display_text}` : `單字 ${activeQuestion.question_text}`}>{alphabetMode ? activeQuestion.display_text : activeQuestion.question_text}</div>
            {alphabetMode && countdown > 0 && <div className="speaking-foundation-countdown" role="timer"><strong>{countdown}</strong><span>先看清楚</span></div>}
            {alphabetMode && <p className="speaking-sr-only" role="status" aria-live="polite" aria-atomic="true">{promptBlocked ? "提示音播放失敗，請按播放提示音重試。" : promptReady ? "提示音播放完畢，可以開始錄音。" : countdown > 0 ? "三秒後播放提示音。" : "正在播放提示音。"}</p>}
            {alphabetMode && promptBlocked && <button type="button" className="speaking-foundation-replay" onClick={playChallengePrompt}><FiVolume2 />播放提示音</button>}
            <SpeakingPracticeSteps
                key={activeQuestion.id}
                firebaseUser={firebaseUser}
                question={activeQuestion}
                interactionType={interactionType}
                foundationRoundId={roundId}
                disabledReason={disabledReason}
                hideHelp
                promptTitle={alphabetMode ? "輪到你唸這個字母" : "輪到你逐字母拼讀"}
                promptDetail={alphabetMode ? "按下麥克風，只唸畫面上的字母。" : "按下麥克風，把每個字母依序唸清楚。"}
                onCompleted={handleCorrect}
                onIncorrect={handleIncorrect}
                onRoundInvalid={handleIncorrect}
            />
            {statusAlert}
        </article></section>
    </main>;
}
