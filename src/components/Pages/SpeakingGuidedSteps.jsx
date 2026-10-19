import React, { useEffect, useMemo, useState } from "react";
import { FiCheck, FiChevronRight, FiDelete } from "react-icons/fi";
import SpeakingQuestionClip from "./SpeakingQuestionClip";
import { letterTiles, spellingPlan } from "../../utils/speakingGuidedSteps";

const STEPS = [
    { key: "listen", label: "聽" },
    { key: "spell", label: "拼" },
    { key: "speak", label: "念" }
];

// 上方的三步提示：只列出這題真的有的步驟。
export function GuidedStepper({ steps, current }) {
    const visible = STEPS.filter(step => steps.includes(step.key));
    const currentIndex = visible.findIndex(step => step.key === current);
    return <ol className="speaking-guided-stepper" aria-label="這題的步驟">
        {visible.map((step, index) => <li key={step.key} className={index < currentIndex ? "is-done" : index === currentIndex ? "is-current" : ""} aria-current={index === currentIndex ? "step" : undefined}>
            <span aria-hidden="true">{index < currentIndex ? <FiCheck /> : index + 1}</span>{step.label}
        </li>)}
    </ol>;
}

// 第 1 步：先聽這題。聽完一次才亮「下一步」，也可以重聽。
export function GuidedListenStep({ clip, onNext, nextLabel }) {
    const [heard, setHeard] = useState(false);
    return <section className="speaking-guided-step speaking-guided-listen" aria-label="第 1 步：先聽這題">
        <p className="speaking-guided-step__title">先聽這一題</p>
        <SpeakingQuestionClip clip={clip} variant="hero" label="聽這題" onPlayed={() => setHeard(true)} />
        <button type="button" className={`speaking-guided-next${heard ? " is-ready" : ""}`} onClick={onNext}>
            {nextLabel}<FiChevronRight aria-hidden="true" />
        </button>
    </section>;
}

// 第 2 步：用字母方塊拼出挖空的單字。全部填滿才檢查；拼錯只說「拼錯了」，不標出哪個字母錯，
// 格子清空重拼。最多 3 次機會，3 次都錯這題就不過（不用念），直接到下一題，下一輪會再出現。
export const SPELL_TRIES = 3;
const CLEAR_AFTER_MS = 900;

export function GuidedSpellStep({ answers, onDone, onFail, clip }) {
    const slots = useMemo(() => spellingPlan(answers).map(slot => ({ ...slot, fixed: !slot.spell })), [answers]);
    const letterSlots = slots.filter(slot => !slot.fixed);
    const [tiles] = useState(() => letterTiles([letterSlots.map(slot => slot.char).join("")]));
    const [filled, setFilled] = useState([]);
    const [misses, setMisses] = useState(0);
    const complete = filled.length === letterSlots.length;
    const correct = complete && filled.every((tile, index) => tile.letter === letterSlots[index].char.toLowerCase());
    const wrong = complete && !correct;
    const failed = misses >= SPELL_TRIES;
    const triesLeft = SPELL_TRIES - misses;

    // 填滿但拼錯：記一次，還有機會就稍等一下清空格子重拼。
    useEffect(() => {
        if (!wrong) return undefined;
        setMisses(current => current + 1);
        return undefined;
    }, [wrong]);
    useEffect(() => {
        if (!wrong || failed) return undefined;
        const timer = setTimeout(() => setFilled([]), CLEAR_AFTER_MS);
        return () => clearTimeout(timer);
    }, [wrong, failed]);

    const place = tile => {
        if (complete || failed || filled.some(item => item.id === tile.id)) return;
        setFilled(current => [...current, tile]);
    };
    // 填滿以後就不能再改（拼錯會整排清空），免得一個一個字母試出哪裡錯。
    const removeLast = () => setFilled(current => current.length >= letterSlots.length ? current : current.slice(0, -1));
    const removeAt = position => setFilled(current => current.length >= letterSlots.length ? current : current.slice(0, position));

    // 鍵盤也能拼：打字母填入、Backspace 刪掉。
    useEffect(() => {
        const onKey = event => {
            if (event.target?.closest?.("input, textarea")) return;
            if (event.key === "Backspace") { setFilled(current => current.length >= letterSlots.length ? current : current.slice(0, -1)); return; }
            const letter = String(event.key || "").toLowerCase();
            if (!/^[a-z]$/.test(letter)) return;
            setFilled(current => {
                if (current.length >= letterSlots.length) return current;
                const tile = tiles.find(item => item.letter === letter && !current.some(used => used.id === item.id));
                return tile ? [...current, tile] : current;
            });
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [tiles, letterSlots.length]);

    // 一個字的格子放在一起，換行時不會把同一個字拆成兩行。
    const words = slots.reduce((groups, slot) => {
        if (slot.char === " ") groups.push([]);
        else groups[groups.length - 1].push(slot);
        return groups;
    }, [[]]).filter(word => word.length);
    let letterIndex = -1;
    return <section className="speaking-guided-step speaking-guided-spell" aria-label="第 2 步：拼出挖空的單字">
        <p className="speaking-guided-step__title">拼出空格裡的單字{!correct && !failed && <span className={`speaking-spell-tries${triesLeft < SPELL_TRIES ? " is-used" : ""}`}>還有 {triesLeft} 次機會</span>}</p>
        {clip?.type === "audio" && <SpeakingQuestionClip clip={clip} label="再聽一次" />}
        <div style={{ "--spell-word": Math.max(...words.map(word => word.length)) }} className={`speaking-spell-slots${letterSlots.length > 9 ? " is-many" : ""}${wrong ? " is-wrong" : ""}${correct ? " is-right" : ""}`} aria-live="polite" aria-label={`已拼 ${filled.length}／${letterSlots.length} 個字母`}>
            {words.map(word => <span key={word[0].index} className="speaking-spell-word">{word.map(slot => {
                if (slot.fixed) return <span key={slot.index} className={/[A-Za-z]/.test(slot.char) ? "speaking-spell-given" : "speaking-spell-mark"} aria-hidden="true">{slot.char}</span>;
                letterIndex += 1;
                const position = letterIndex;
                const tile = filled[position];
                return <button type="button" key={slot.index} className={`speaking-spell-slot${tile ? " is-filled" : ""}`} onClick={() => tile && !complete && removeAt(position)} disabled={!tile || complete} aria-label={tile ? `第 ${position + 1} 個字母 ${tile.letter}，點一下可以刪掉` : `第 ${position + 1} 個字母，空白`}>
                    {tile?.letter || ""}
                </button>;
            })}</span>)}
        </div>
        {wrong && !failed && <p className="speaking-spell-feedback" role="status">拼錯了，還有 {triesLeft} 次機會。</p>}
        {failed ? <>
            <p className="speaking-spell-feedback" role="status">3 次都沒拼對，這題先不過，下一輪會再出現。</p>
            {onFail && <button type="button" className="speaking-guided-next is-ready" onClick={onFail}>下一題<FiChevronRight aria-hidden="true" /></button>}
        </> : correct ? <>
            <p className="speaking-spell-feedback is-right" role="status"><FiCheck aria-hidden="true" />拼對了！</p>
            <button type="button" className="speaking-guided-next is-ready" onClick={onDone}>下一步：看著句子念<FiChevronRight aria-hidden="true" /></button>
        </> : <div className={`speaking-spell-tiles${tiles.length > 11 ? " is-many" : ""}`}>
            {tiles.map(tile => <button type="button" key={tile.id} className="speaking-spell-tile" onClick={() => place(tile)} disabled={complete || filled.some(item => item.id === tile.id)} aria-label={`字母 ${tile.letter}`}>{tile.letter}</button>)}
            <button type="button" className="speaking-spell-tile speaking-spell-tile--back" onClick={removeLast} disabled={!filled.length || complete} aria-label="刪掉最後一個字母"><FiDelete aria-hidden="true" /><span aria-hidden="true">刪除</span></button>
        </div>}
    </section>;
}
