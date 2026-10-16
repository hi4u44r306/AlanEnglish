import React, { useEffect, useId, useRef, useState } from "react";
import { FiCheck, FiHelpCircle, FiMic, FiVolume2 } from "react-icons/fi";
import SpeakingPronunciationRecorder from "./SpeakingPronunciationRecorder";
import SpeakingLearningJourney from "./SpeakingLearningJourney";

const ANSWER_SLOT_PATTERN = /[\u005B［]([^\u005D］]{1,80})[\u005D］]/g;

export const extractAnswerSlots = answer => {
    const labels = [];
    for (const match of String(answer || "").matchAll(ANSWER_SLOT_PATTERN)) {
        const label = String(match[1] || "").trim();
        if (label && !labels.includes(label)) labels.push(label);
    }
    return labels;
};

export const answerPatternForLearner = answer => String(answer || "")
    .replace(ANSWER_SLOT_PATTERN, "_____")
    .replace(/\s+/g, " ")
    .trim();

// Blanks keep their Chinese label so the student knows what belongs there ("My name is 名字.").
const answerPatternWithSlots = answer => {
    const text = String(answer || "").replace(/\s+/g, " ").trim();
    const parts = [];
    let cursor = 0;
    for (const match of text.matchAll(ANSWER_SLOT_PATTERN)) {
        if (match.index > cursor) parts.push(text.slice(cursor, match.index));
        parts.push(<span className="speaking-answer-slot" key={match.index}>{String(match[1] || "").trim()}</span>);
        cursor = match.index + match[0].length;
    }
    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts;
};

const naturalExample = question => {
    const simple = String(question.simple_answer || "").trim();
    if (simple && !extractAnswerSlots(simple).length) return simple;
    return String(question.model_answer || "")
        .replace(ANSWER_SLOT_PATTERN, (_placeholder, rawLabel) => {
            const label = String(rawLabel || "");
            if (label.includes("姓氏")) return "Lee";
            if (label.includes("全名")) return "Amy Lee";
            if (label.includes("名字")) return "Amy";
            return "something";
        })
        .replace(/\s+/g, " ")
        .trim();
};

export default function SpeakingPracticeSteps({
    firebaseUser,
    question,
    audioWorking,
    onPlayAudio,
    onCompleted,
    onIncorrect,
    onRoundInvalid,
    onPracticeOnly,
    interactionType = "",
    foundationRoundId = "",
    challengeSessionId = "",
    challengeMode = "easy",
    showAnswerByDefault = false,
    onRevealHint,
    disabledReason = "",
    hideHelp = false,
    deferAnswerHelp = false,
    allowModelAudio = true,
    readAloud = false,
    promptTitle = "直接開口回答",
    promptDetail = "不用打字，按下麥克風後用完整英文句子回答。"
}) {
    const [showHelp, setShowHelp] = useState(false);
    const [revealedAnswer, setRevealedAnswer] = useState(null);
    const [helpError, setHelpError] = useState("");
    const [helpLoading, setHelpLoading] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const [saving, setSaving] = useState(false);
    const [recorderPhase, setRecorderPhase] = useState("ready");
    const helpId = useId();
    const busy = ["recording", "preparing", "assessing"].includes(recorderPhase) || saving;
    const canListen = allowModelAudio && Boolean(question.model_audio_url);
    const hintRequestRef = useRef(0);
    // Looking at the hint voids this question for the run: always in challenge mode, and in
    // easy mode for blanked sentences (the server marks those).
    const hintVoidsPass = challengeMode === "challenge" || question.hint_voids_pass === true;
    const answerQuestion = revealedAnswer ? { ...question, ...revealedAnswer } : question;
    const answerPattern = answerPatternForLearner(answerQuestion.model_answer);
    const example = naturalExample(answerQuestion);

    useEffect(() => {
        hintRequestRef.current += 1;
        setShowHelp(false);
        setRevealedAnswer(null);
        setHelpError("");
        setHelpLoading(false);
        setLastResult(null);
        setSaving(false);
        setRecorderPhase("ready");
        return () => { hintRequestRef.current += 1; };
    }, [question.id, challengeSessionId, challengeMode]);

    const handleScored = async result => {
        if (result?.assessment_status === "uncertain") return false;
        const request = hintRequestRef.current;
        const scoredResult = hintVoidsPass && revealedAnswer
            ? { ...result, hint_used: true }
            : result;
        if (scoredResult?.answer_match !== false && !scoredResult?.hint_used) {
            setSaving(true);
            try {
                const saved = await onCompleted?.(scoredResult);
                if (request !== hintRequestRef.current) return false;
                if (saved?.hint_used) {
                    const practiceResult = { ...scoredResult, hint_used: true, save_failed: false };
                    setLastResult(practiceResult);
                    onIncorrect?.(practiceResult);
                    return false;
                }
                if (saved === false) {
                    setLastResult({ ...scoredResult, save_failed: true });
                    return false;
                }
            } catch {
                if (request === hintRequestRef.current) setLastResult({ ...scoredResult, save_failed: true });
                return false;
            } finally { if (request === hintRequestRef.current) setSaving(false); }
        } else onIncorrect?.(scoredResult);
        if (request === hintRequestRef.current) setLastResult({ ...scoredResult, save_failed: false });
        return !scoredResult.hint_used && scoredResult.answer_match !== false;
    };

    const toggleHelp = async () => {
        if (showHelp) { setShowHelp(false); return; }
        if (hintVoidsPass && onRevealHint && !revealedAnswer) {
            const request = hintRequestRef.current;
            setHelpLoading(true);
            setHelpError("");
            try {
                const answer = await onRevealHint(question, challengeSessionId);
                if (request !== hintRequestRef.current) return;
                setRevealedAnswer(answer);
            } catch (cause) {
                if (request !== hintRequestRef.current) return;
                setHelpError(cause?.message || "暫時無法顯示提示，請再試一次");
                return;
            } finally { if (request === hintRequestRef.current) setHelpLoading(false); }
        }
        setShowHelp(true);
    };

    return <section className="speaking-practice-flow">
        <SpeakingLearningJourney phase={saving ? "assessing" : lastResult ? "feedback" : recorderPhase} canListen={canListen} />
        <details className="speaking-practice-instructions">
            <summary>這題怎麼練？</summary>
            <div className="speaking-direct-prompt">
            <FiMic aria-hidden="true" />
            <div><strong>{promptTitle}</strong><span>{promptDetail}</span></div>
            </div>
        </details>

        {showAnswerByDefault && answerPattern && !(question.hint_voids_pass && revealedAnswer) && <div className="speaking-help-panel speaking-easy-answer" aria-label="跟著念參考答案">
            <small>看著題目與答案，勇敢說出完整句子</small><span className="speaking-easy-answer__cue"><FiMic aria-hidden="true" />念這句</span><strong>{answerPatternWithSlots(answerQuestion.model_answer)}</strong>
            {canListen && <button type="button" disabled={audioWorking || busy} onClick={onPlayAudio}>
                <FiVolume2 aria-hidden="true" />{question.model_audio_url ? (audioWorking ? "播放中…" : "聽回答範例") : "語音準備中"}
            </button>}
        </div>}

        {readAloud && canListen && <button type="button" className="speaking-help-toggle" disabled={audioWorking || busy} onClick={onPlayAudio}>
            <FiVolume2 aria-hidden="true" />{audioWorking ? "播放中…" : "聽示範發音"}
        </button>}

        {!hideHelp && (!showAnswerByDefault || question.hint_voids_pass) && (!deferAnswerHelp || lastResult || hintVoidsPass) && <button type="button" className="speaking-help-toggle" aria-expanded={showHelp} aria-controls={helpId} onClick={toggleHelp} disabled={helpLoading || busy}>
            <FiHelpCircle aria-hidden="true" />{hintVoidsPass ? (helpLoading ? "正在打開答案…" : showHelp ? "收起答案" : "看答案（看了這題就不算通過）") : helpLoading ? "正在開啟提示…" : showHelp ? "收起回答提示" : "不知道怎麼說？"}
        </button>}

        {helpError && <p className="speaking-practice-retry" role="alert">{helpError}</p>}
        {hintVoidsPass && revealedAnswer && <p className="speaking-hint-practice-notice" role="status">
            <strong>這題先練習，稍後不看答案再試一次。</strong>
            <span>這題這次不算通過；已通過的題目會保留。</span>
        </p>}

        {/* 「自己說」看答案：只顯示這題的答案，不放提示、示範或發音說明。 */}
        {!hideHelp && showHelp && hintVoidsPass && <div className="speaking-help-panel speaking-answer-only" id={helpId} aria-label="這題的答案">
            <strong>{answerPatternWithSlots(answerQuestion.model_answer)}</strong>
        </div>}

        {!hideHelp && showHelp && !hintVoidsPass && <div className="speaking-help-panel" id={helpId}>
            {answerQuestion.hint_zh && <p>{answerQuestion.hint_zh}</p>}
            <div><small>可以這樣說</small><strong>{answerPatternWithSlots(answerQuestion.model_answer)}</strong></div>
            {canListen && <button type="button" disabled={audioWorking || busy} onClick={onPlayAudio}>
                <FiVolume2 aria-hidden="true" />{question.model_audio_url ? (audioWorking ? "播放中…" : "聽回答範例") : "語音準備中"}
            </button>}
            {example && <small>示範：{example}</small>}
            {answerQuestion.pronunciation_notes_zh && <small>發音提醒：{answerQuestion.pronunciation_notes_zh}</small>}
            {allowModelAudio && <small className="speaking-audio-volume-hint"><FiVolume2 aria-hidden="true" />聽不到聲音時，請用裝置音量鍵調整媒體音量。</small>}
        </div>}

        <SpeakingPronunciationRecorder
            key={question.id}
            firebaseUser={firebaseUser}
            question={question}
            interactionType={interactionType}
            foundationRoundId={foundationRoundId}
            challengeSessionId={challengeSessionId}
            challengeMode={challengeMode}
            disabledReason={disabledReason}
            onScored={handleScored}
            onRoundInvalid={onRoundInvalid}
            onPracticeOnly={onPracticeOnly}
            onPhaseChange={setRecorderPhase}
            onRetry={() => setLastResult(null)}
            onListenAgain={canListen ? onPlayAudio : undefined}
            audioWorking={audioWorking}
        />

        {saving && <p className="speaking-practice-saving" role="status">正在儲存本題進度，請稍候…</p>}
        {!saving && lastResult?.answer_match !== false && lastResult && !lastResult.hint_used && !lastResult.save_failed && <p className="speaking-practice-finished" role="status"><FiCheck aria-hidden="true" /> 本題已完成！你可以繼續挑戰或再練一次。</p>}
        {lastResult?.save_failed && <div className="speaking-save-retry" role="alert"><strong>回答已評分，通關紀錄尚未儲存。</strong><p>保留這次回答，重試儲存即可。</p><button type="button" onClick={() => handleScored(lastResult)} disabled={saving}>{saving ? "儲存中…" : "重試儲存"}</button></div>}
        {lastResult?.hint_used && !revealedAnswer && <p className="speaking-practice-retry" role="status">這題先練習，稍後不看答案再試一次。這題這次不算通過。</p>}
        {lastResult?.answer_match === false && (
          <p className="speaking-practice-retry">
            <FiHelpCircle aria-hidden="true" />{" "}
            {lastResult.feedback || (
              interactionType === "letter_spelling"
                ? "請慢慢逐字母再試一次。"
                : interactionType === "alphabet_round"
                  ? "再聽一次提示後重試。"
                  : "先用提示中的完整句型回答，再送出一次。"
            )}
          </p>
        )}
    </section>;
}
