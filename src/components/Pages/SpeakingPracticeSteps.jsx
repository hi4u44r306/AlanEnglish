import React, { useEffect, useMemo, useState } from "react";
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
    disabledReason = "",
    hideHelp = false,
    promptTitle = "直接開口回答",
    promptDetail = "不用打字，按下麥克風後用完整英文句子回答。"
}) {
    const [showHelp, setShowHelp] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const answerPattern = useMemo(() => answerPatternForLearner(question.model_answer), [question.model_answer]);
    const example = useMemo(() => naturalExample(question), [question]);

    useEffect(() => {
        setShowHelp(false);
        setLastResult(null);
    }, [question.id]);

    const handleScored = result => {
        setLastResult(result);
        if (result?.answer_match !== false) onCompleted?.(result);
        else onIncorrect?.(result);
    };

    return <section className="speaking-practice-flow">
        <div className="speaking-direct-prompt">
            <FiMic aria-hidden="true" />
            <div><strong>{promptTitle}</strong><span>{promptDetail}</span></div>
        </div>

        {!hideHelp && <button type="button" className="speaking-help-toggle" aria-expanded={showHelp} onClick={() => setShowHelp(current => !current)}>
            <FiHelpCircle aria-hidden="true" />{showHelp ? "收起回答提示" : "不知道怎麼說？"}
        </button>}

        {!hideHelp && showHelp && <div className="speaking-help-panel">
            {question.hint_zh && <p>{question.hint_zh}</p>}
            <div><small>可以這樣說</small><strong>{answerPattern}</strong></div>
            <button type="button" disabled={!question.model_audio_url || audioWorking} onClick={onPlayAudio}>
                <FiVolume2 aria-hidden="true" />{question.model_audio_url ? (audioWorking ? "播放中…" : "聽回答範例") : "語音準備中"}
            </button>
            {example && <small>示範：{example}</small>}
            {question.pronunciation_notes_zh && <small>發音提醒：{question.pronunciation_notes_zh}</small>}
            <small className="speaking-audio-volume-hint"><FiVolume2 aria-hidden="true" />聽不到聲音時，請用裝置音量鍵調整媒體音量。</small>
        </div>}

        <SpeakingPronunciationRecorder
            key={question.id}
            firebaseUser={firebaseUser}
            question={question}
            foundationRoundId={foundationRoundId}
            disabledReason={disabledReason}
            onScored={handleScored}
            onRoundInvalid={onRoundInvalid}
        />

        {lastResult?.answer_match !== false && lastResult && <p className="speaking-practice-finished"><FiCheck aria-hidden="true" /> 本題已完成，可以前往下一題或再練一次。</p>}
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
