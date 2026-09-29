import React, { useEffect, useState } from "react";
import { FiCheck, FiHelpCircle, FiMic, FiVolume2 } from "react-icons/fi";
import SpeakingPronunciationRecorder from "./SpeakingPronunciationRecorder";

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
    promptTitle = "直接開口回答",
    promptDetail = "不用打字，按下麥克風後用完整英文句子回答。"
}) {
    const [showHelp, setShowHelp] = useState(false);
    const [revealedAnswer, setRevealedAnswer] = useState(null);
    const [helpError, setHelpError] = useState("");
    const [helpLoading, setHelpLoading] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const answerQuestion = revealedAnswer ? { ...question, ...revealedAnswer } : question;
    const answerPattern = answerPatternForLearner(answerQuestion.model_answer);
    const example = naturalExample(answerQuestion);

    useEffect(() => {
        setShowHelp(false);
        setRevealedAnswer(null);
        setHelpError("");
        setLastResult(null);
    }, [question.id, challengeSessionId]);

    const handleScored = async result => {
        if (result?.answer_match !== false && !result?.hint_used) {
            const saved = await onCompleted?.(result);
            if (saved === false) {
                const failedResult = { ...result, save_failed: true };
                setLastResult(failedResult);
                onIncorrect?.(failedResult);
                return;
            }
        } else onIncorrect?.(result);
        setLastResult(result);
    };

    const toggleHelp = async () => {
        if (showHelp) { setShowHelp(false); return; }
        if (challengeMode === "challenge" && onRevealHint && !revealedAnswer) {
            setHelpLoading(true);
            setHelpError("");
            try {
                setRevealedAnswer(await onRevealHint(question, challengeSessionId));
            } catch (cause) {
                setHelpError(cause?.message || "暫時無法顯示提示，請再試一次");
                return;
            } finally { setHelpLoading(false); }
        }
        setShowHelp(true);
    };

    return <section className="speaking-practice-flow">
        <div className="speaking-direct-prompt">
            <FiMic aria-hidden="true" />
            <div><strong>{promptTitle}</strong><span>{promptDetail}</span></div>
        </div>

        {showAnswerByDefault && answerPattern && <div className="speaking-help-panel speaking-easy-answer" aria-label="簡單模式參考答案">
            <small>看著題目與答案，勇敢說出完整句子</small><strong>{answerPattern}</strong>
        </div>}

        {!hideHelp && !showAnswerByDefault && (!deferAnswerHelp || lastResult || challengeMode === "challenge") && <button type="button" className="speaking-help-toggle" aria-expanded={showHelp} onClick={toggleHelp} disabled={helpLoading}>
            <FiHelpCircle aria-hidden="true" />{helpLoading ? "正在開啟提示…" : showHelp ? "收起回答提示" : challengeMode === "challenge" ? "看提示（本輪此題不計通關）" : "不知道怎麼說？"}
        </button>}

        {helpError && <p className="speaking-practice-retry" role="alert">{helpError}</p>}

        {!hideHelp && showHelp && <div className="speaking-help-panel">
            {answerQuestion.hint_zh && <p>{answerQuestion.hint_zh}</p>}
            <div><small>可以這樣說</small><strong>{answerPattern}</strong></div>
            {allowModelAudio && <button type="button" disabled={!question.model_audio_url || audioWorking} onClick={onPlayAudio}>
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
            foundationRoundId={foundationRoundId}
            challengeSessionId={challengeSessionId}
            challengeMode={challengeMode}
            disabledReason={disabledReason}
            onScored={handleScored}
            onRoundInvalid={onRoundInvalid}
        />

        {lastResult?.answer_match !== false && lastResult && !lastResult.hint_used && !lastResult.save_failed && <p className="speaking-practice-finished"><FiCheck aria-hidden="true" /> 本題已完成！你可以繼續挑戰或再練一次。</p>}
        {lastResult?.save_failed && <p className="speaking-practice-retry" role="alert">這次回答尚未記錄為通關，請重新錄音再試一次。</p>}
        {lastResult?.hint_used && <p className="speaking-practice-retry">你已看過提示，本輪這題不計通關；稍後只需重試這題。</p>}
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
