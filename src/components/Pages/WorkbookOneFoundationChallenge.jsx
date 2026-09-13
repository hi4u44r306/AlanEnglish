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
    const segmentTimerRef = useRef(null);
    const audioOperationRef = useRef(0);
    const copy = interactionCopy[interactionType] || interactionCopy.letter_spelling;
    const alphabetAudio = challenge?.alphabet_audio;
    const alphabetSegments = useMemo(() => Array.isArray(alphabetAudio?.segments)
        ? alphabetAudio.segments : [], [alphabetAudio]);
    const segmentByQuestionId = useMemo(() => new Map(alphabetSegments.map(segment => [
        Number(segment.question_id), segment
    ])), [alphabetSegments]);
    const allAlphabetAudioReady = sourceQuestions.length === 26
        && Boolean(alphabetAudio?.audio_url)
        && alphabetSegments.length === 26
        && sourceQuestions.every(question => {
            const segment = segmentByQuestionId.get(Number(question.id));
            return Number.isFinite(Number(segment?.start_ms))
                && Number(segment?.end_ms) > Number(segment?.start_ms);
        });

    const stopAudio = useCallback(() => {
        audioOperationRef.current += 1;
        if (segmentTimerRef.current) {
            window.clearTimeout(segmentTimerRef.current);
            segmentTimerRef.current = null;
        }
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.onended = null;
            audioRef.current.onerror = null;
            audioRef.current.ontimeupdate = null;
            audioRef.current.onloadedmetadata = null;
            audioRef.current.oncanplay = null;
        }
        setIntroPlaying(false);
    }, []);

    useEffect(() => {
        if (!alphabetMode || !alphabetAudio?.audio_url) return undefined;
        const audio = new Audio(alphabetAudio.audio_url);
        audio.preload = "auto";
        audioRef.current = audio;
        return () => {
            stopAudio();
            if (audioRef.current === audio) audioRef.current = null;
        };
    }, [alphabetAudio?.audio_url, alphabetMode, stopAudio]);
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
    const playAlphabetAudio = useCallback(({ segment = null, startIndex = 0, onEnded, markIntro = false } = {}) => {
        stopAudio();
        const operationId = audioOperationRef.current;
        const audio = audioRef.current;
        if (!audio || !allAlphabetAudioReady) {
            setPromptBlocked(true);
            setStatusError("A–Z 單一慢速音檔尚未準備完成，請稍後再試");
            return false;
        }
        if (markIntro) setIntroPlaying(true);
        let finished = false;
        const finish = () => {
            if (finished || operationId !== audioOperationRef.current) return;
            finished = true;
            if (segmentTimerRef.current) {
                window.clearTimeout(segmentTimerRef.current);
                segmentTimerRef.current = null;
            }
            audio.pause();
            audio.onended = null;
            audio.onerror = null;
            audio.ontimeupdate = null;
            audio.onloadedmetadata = null;
            audio.oncanplay = null;
            if (markIntro) setIntroPlaying(false);
            onEnded?.();
        };
        const startSeconds = segment
            ? Number(segment.start_ms) / 1000
            : Number(alphabetSegments[Math.min(startIndex, alphabetSegments.length - 1)]?.start_ms || 0) / 1000;
        if (segment) {
            const endSeconds = Number(segment.end_ms) / 1000;
            audio.ontimeupdate = () => {
                if (audio.currentTime >= endSeconds) finish();
            };
        } else {
            audio.ontimeupdate = () => {
                const currentMs = Number(audio.currentTime || 0) * 1000;
                const activeSegmentIndex = alphabetSegments.findIndex(item => (
                    currentMs >= Number(item.start_ms) && currentMs < Number(item.end_ms)
                ));
                if (activeSegmentIndex >= 0) setIntroIndex(activeSegmentIndex);
            };
        }
        audio.onended = finish;
        audio.onerror = () => {
            stopAudio();
            if (markIntro) setIntroPlaying(false);
            setPromptBlocked(true);
            setStatusError("標準發音暫時無法播放，請重新整理後再試");
        };
        const handlePlayBlocked = () => {
            if (operationId !== audioOperationRef.current) return;
            stopAudio();
            if (markIntro) setIntroPlaying(false);
            setPromptBlocked(true);
            setStatusError("瀏覽器暫時無法播放標準發音，請再按一次");
        };
        const beginPlayback = () => {
            if (operationId !== audioOperationRef.current) return;
            if (typeof audio.readyState === "number" && audio.readyState < 1) {
                const resumeWhenReady = () => {
                    audio.onloadedmetadata = null;
                    audio.oncanplay = null;
                    beginPlayback();
                };
                audio.onloadedmetadata = resumeWhenReady;
                audio.oncanplay = resumeWhenReady;
                return;
            }
            try {
                audio.currentTime = startSeconds;
            } catch {
                audio.onloadedmetadata = () => {
                    audio.onloadedmetadata = null;
                    beginPlayback();
                };
                return;
            }
            Promise.resolve(audio.play()).then(() => {
                if (operationId !== audioOperationRef.current || finished) return;
                if (segment && !segmentTimerRef.current) {
                    const watchdogStartedAt = Date.now();
                    const maxWaitMs = Math.max(15000, (Number(segment.end_ms) - Number(segment.start_ms)) * 4 + 5000);
                    const checkSegmentProgress = () => {
                        if (operationId !== audioOperationRef.current || finished) return;
                        if (Number(audio.currentTime) >= Number(segment.end_ms) / 1000 - 0.05) {
                            finish();
                            return;
                        }
                        if (Date.now() - watchdogStartedAt >= maxWaitMs) {
                            handlePlayBlocked();
                            return;
                        }
                        segmentTimerRef.current = window.setTimeout(checkSegmentProgress, 250);
                    };
                    segmentTimerRef.current = window.setTimeout(checkSegmentProgress, 250);
                }
            }).catch(handlePlayBlocked);
        };
        beginPlayback();
        return true;
    }, [allAlphabetAudioReady, alphabetSegments, stopAudio]);

    const playIntroFrom = useCallback(index => {
        setIntroIndex(index);
        playAlphabetAudio({
            startIndex: index,
            markIntro: true,
            onEnded: () => {
                setIntroIndex(sourceQuestions.length - 1);
                setIntroComplete(true);
            }
        });
    }, [playAlphabetAudio, sourceQuestions]);

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
        const segment = segmentByQuestionId.get(Number(activeQuestion.id));
        playAlphabetAudio({ segment, onEnded: () => setPromptReady(true) });
    }, [activeQuestion, playAlphabetAudio, segmentByQuestionId]);

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
            {!allAlphabetAudioReady && <p className="speaking-foundation-warning" role="alert">A–Z 單一慢速音檔尚未準備完成，這個關卡暫時不能開始。</p>}
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
