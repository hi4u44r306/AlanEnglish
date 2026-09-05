import React, { useMemo, useState } from "react";
import { FiCheck, FiEye, FiEyeOff, FiKey, FiVolume2 } from "react-icons/fi";
import SpeakingPronunciationRecorder from "./SpeakingPronunciationRecorder";

const ANSWER_SLOT_PATTERN = /[\u005B［]([^\u005D］]{1,80})[\u005D］]/g;
const ENGLISH_SLOT_VALUE = /^[A-Za-z0-9][A-Za-z0-9 .,'!?&-]{0,59}$/;

export const extractAnswerSlots = answer => {
    const labels = [];
    for (const match of String(answer || "").matchAll(ANSWER_SLOT_PATTERN)) {
        const label = String(match[1] || "").trim();
        if (label && !labels.includes(label)) labels.push(label);
    }
    return labels;
};

export const fillAnswerSlots = (answer, slotValues = {}) => String(answer || "").replace(
    ANSWER_SLOT_PATTERN,
    (placeholder, label) => slotValues[String(label || "").trim()] || placeholder
);

const normalizeKeywords = value => {
    if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean).slice(0, 8);
    return String(value || "").split(/[,、]/).map(item => item.trim()).filter(Boolean).slice(0, 8);
};

const MODES = [
    { id: "repeat", label: "看著念", helper: "先聽範例，照著完整句子慢慢念。", icon: FiEye },
    { id: "keywords", label: "看提示說", helper: "把答案藏起來，只看關鍵字完成整句。", icon: FiKey },
    { id: "independent", label: "自己說", helper: "不看答案與關鍵字，自己完成整句。", icon: FiEyeOff }
];

export default function SpeakingPracticeSteps({ firebaseUser, question, audioWorking, onPlayAudio, onCompleted }) {
    const slots = useMemo(() => extractAnswerSlots(question.model_answer), [question.model_answer]);
    const keywords = useMemo(() => normalizeKeywords(question.keywords), [question.keywords]);
    const [mode, setMode] = useState("repeat");
    const [slotValues, setSlotValues] = useState({});
    const [showHelp, setShowHelp] = useState(false);
    const [scores, setScores] = useState({});
    const previouslyCompleted = question.progress_status === "completed";
    const currentMode = MODES.find(item => item.id === mode) || MODES[0];
    const answer = fillAnswerSlots(question.model_answer, slotValues);
    const invalidSlot = slots.find(label => !ENGLISH_SLOT_VALUE.test(String(slotValues[label] || "").trim()));
    const disabledReason = invalidSlot
        ? `請先用英文填寫「${invalidSlot}」，再開始錄音。`
        : "";

    const handleMode = nextMode => {
        const nextIndex = MODES.findIndex(item => item.id === nextMode);
        if (!previouslyCompleted && nextIndex === 1 && scores.repeat === undefined) return;
        if (!previouslyCompleted && nextIndex === 2 && scores.keywords === undefined) return;
        setMode(nextMode);
        setShowHelp(false);
    };

    const handleScored = score => {
        setScores(current => ({ ...current, [mode]: Math.round(score?.scores?.pronunciation || 0) }));
        if (mode === "independent") onCompleted?.(score);
    };

    const goNext = () => {
        const index = MODES.findIndex(item => item.id === mode);
        if (index < MODES.length - 1) handleMode(MODES[index + 1].id);
    };

    return <section className="speaking-practice-flow">
        <nav className="speaking-practice-tabs" aria-label="口說練習步驟">
            {MODES.map((item, index) => {
                const Icon = item.icon;
                const locked = !previouslyCompleted && ((index === 1 && scores.repeat === undefined) || (index === 2 && scores.keywords === undefined));
                return <button
                    type="button"
                    key={item.id}
                    className={mode === item.id ? "active" : ""}
                    aria-current={mode === item.id ? "step" : undefined}
                    aria-label={`${item.label}${locked ? "（請先完成前一步）" : ""}`}
                    disabled={locked}
                    onClick={() => handleMode(item.id)}
                >
                    <span>{scores[item.id] !== undefined ? <FiCheck aria-hidden="true" /> : index + 1}</span>
                    <Icon aria-hidden="true" />
                    {item.label}
                    {scores[item.id] !== undefined && <small>{scores[item.id]} 分</small>}
                </button>;
            })}
        </nav>

        {slots.length > 0 && <fieldset className="speaking-answer-slots">
            <legend>先把答案換成自己的</legend>
            <p>請填英文；評分時會依你填的內容判定，不會把括號提示念進去。</p>
            <div>{slots.map(label => <label key={label}>
                <span>{label}</span>
                <input
                    type="text"
                    maxLength={60}
                    autoComplete="off"
                    value={slotValues[label] || ""}
                    placeholder="例如 Amy"
                    aria-invalid={Boolean(slotValues[label]) && !ENGLISH_SLOT_VALUE.test(String(slotValues[label]).trim())}
                    onChange={event => setSlotValues(current => ({ ...current, [label]: event.target.value }))}
                />
            </label>)}</div>
        </fieldset>}

        <div className={`speaking-practice-guide is-${mode}`}>
            <header><strong>{currentMode.label}</strong><span>{currentMode.helper}</span></header>
            {mode === "repeat" && <div className="speaking-answer">
                <strong>完整練習句</strong>
                <span>{answer}</span>
                <button type="button" disabled={!question.model_audio_url || audioWorking} onClick={onPlayAudio}>
                    <FiVolume2 />{question.model_audio_url ? (audioWorking ? "播放中…" : "先聽自然範例") : "語音準備中"}
                </button>
                {slots.length > 0 && <small>示範語音會念自然範例；你的評分會依上方填入的英文。</small>}
            </div>}
            {mode === "keywords" && <div className="speaking-keyword-guide">
                <strong>關鍵字</strong>
                <div>{(keywords.length ? keywords : [question.simple_answer]).filter(Boolean).map(keyword => <span key={keyword}>{keyword}</span>)}</div>
                <button type="button" onClick={() => setShowHelp(current => !current)}>{showHelp ? "再次藏起答案" : "真的想不起來？看答案"}</button>
                {showHelp && <p>{answer}</p>}
            </div>}
            {mode === "independent" && <div className="speaking-independent-guide">
                <strong>不看提示，完成整句</strong>
                <button type="button" onClick={() => setShowHelp(current => !current)}>{showHelp ? "收起提示" : "需要一點提示"}</button>
                {showHelp && <div><p>{question.hint_zh}</p>{keywords.length > 0 && <p>關鍵字：{keywords.join("、")}</p>}</div>}
            </div>}
        </div>

        <SpeakingPronunciationRecorder
            key={`${question.id}-${mode}-${slots.map(label => slotValues[label] || "").join("|")}`}
            firebaseUser={firebaseUser}
            question={question}
            slotValues={slotValues}
            disabledReason={disabledReason}
            onScored={handleScored}
        />
        {scores[mode] !== undefined && mode !== "independent" && <button type="button" className="speaking-practice-next" onClick={goNext}>
            下一步：{MODES[MODES.findIndex(item => item.id === mode) + 1].label}
        </button>}
        {scores.independent !== undefined && mode === "independent" && <p className="speaking-practice-finished"><FiCheck /> 三段練習完成，可以再挑戰一次讓分數更好。</p>}
    </section>;
}
