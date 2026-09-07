import React, { useCallback, useMemo, useState } from "react";
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
    questionAudioWorking = false,
    answerAudioWorking = false,
    onPlayQuestionAudio,
    onPlayAnswerAudio,
    onCompleted,
    onBusyChange,
    demoMode = false
}) {
    const [showHelp, setShowHelp] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const [autoStartToken, setAutoStartToken] = useState(0);
    const [scoringBusy, setScoringBusy] = useState(false);
    const answerPattern = useMemo(() => answerPatternForLearner(question.model_answer), [question.model_answer]);
    const example = useMemo(() => naturalExample(question), [question]);
    const handleBusyChange = useCallback(busy => {
        setScoringBusy(busy);
        onBusyChange?.(busy);
    }, [onBusyChange]);

    const handleScored = result => {
        setLastResult(result);
        if (result?.answer_match !== false) onCompleted?.(result);
    };

    const beginAnswerTurn = () => setAutoStartToken(current => current + 1);
    const playPrompt = () => onPlayQuestionAudio?.(demoMode ? undefined : beginAnswerTurn);
    const playAnswer = () => onPlayAnswerAudio?.(demoMode ? undefined : beginAnswerTurn);

    return <section className="speaking-practice-flow">
        <button type="button" className="speaking-question-audio" disabled={scoringBusy || !question.question_audio_url || questionAudioWorking} onClick={playPrompt}>
            <FiVolume2 aria-hidden="true" />
            <span><strong>{questionAudioWorking ? "外國朋友正在問你…" : "聽問題並回答"}</strong><small>{question.question_audio_url ? "問題播完後，想5秒就會自動開始錄音。" : "問題自然語音準備中"}</small></span>
        </button>

        <div className="speaking-direct-prompt"><FiMic aria-hidden="true" /><div><strong>先自己想一想</strong><span>不用打字；真的不知道怎麼回答，再打開下面的提示。</span></div></div>

        <button type="button" className="speaking-help-toggle" aria-expanded={showHelp} disabled={scoringBusy} onClick={() => setShowHelp(current => !current)}>
            <FiHelpCircle aria-hidden="true" />{showHelp ? "收起回答提示" : "不知道怎麼說？"}
        </button>

        {showHelp && <div className="speaking-help-panel">
            {question.hint_zh && <p>{question.hint_zh}</p>}
            <div><small>可以這樣說</small><strong>{answerPattern}</strong></div>
            <button type="button" disabled={scoringBusy || !question.model_audio_url || answerAudioWorking} onClick={playAnswer}>
                <FiVolume2 aria-hidden="true" />{question.model_audio_url ? (answerAudioWorking ? "播放中…" : "聽回答範例") : "語音準備中"}
            </button>
            {example && <small>示範：{example}</small>}
            {question.pronunciation_notes_zh && <small>發音提醒：{question.pronunciation_notes_zh}</small>}
            <small className="speaking-audio-volume-hint"><FiVolume2 aria-hidden="true" />聽不到聲音時，請用裝置音量鍵調整媒體音量。</small>
        </div>}

        {demoMode ? <div className="speaking-staff-demo-note" role="note"><FiMic aria-hidden="true" /><div><strong>學生錄音與評分</strong><span>請切換學生帳號示範這項操作；老師／管理員頁面不會保存錄音或學習進度。</span></div></div> : <SpeakingPronunciationRecorder
            key={question.id}
            firebaseUser={firebaseUser}
            question={question}
            onScored={handleScored}
            onBusyChange={handleBusyChange}
            autoStartToken={autoStartToken}
            countdownSeconds={5}
            onReplayQuestion={playPrompt}
        />}

        {lastResult?.answer_match !== false && lastResult && <p className="speaking-practice-finished"><FiCheck aria-hidden="true" /> 本題已完成，可以前往下一題或再練一次。</p>}
        {lastResult?.answer_match === false && <p className="speaking-practice-retry"><FiHelpCircle aria-hidden="true" /> 先用提示中的完整句型回答，再送出一次。</p>}
    </section>;
}
