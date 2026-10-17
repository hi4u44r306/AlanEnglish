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

// 第 2 步：用字母方塊拼出挖空的單字。全部填滿才檢查；錯的字母標紅，可以點掉重拼。
export function GuidedSpellStep({ answers, onDone, clip }) {
    const slots = useMemo(() => spellingPlan(answers).map(slot => ({ ...slot, fixed: !slot.spell })), [answers]);
    const letterSlots = slots.filter(slot => !slot.fixed);
    const [tiles] = useState(() => letterTiles([letterSlots.map(slot => slot.char).join("")]));
    const [filled, setFilled] = useState([]);
    const [checked, setChecked] = useState(false);
    const complete = filled.length === letterSlots.length;
    const correct = complete && filled.every((tile, index) => tile.letter === letterSlots[index].char.toLowerCase());

    useEffect(() => { setChecked(complete); }, [complete]);

    const place = tile => {
        if (complete || filled.some(item => item.id === tile.id)) return;
        setFilled(current => [...current, tile]);
    };
    const removeLast = () => setFilled(current => current.slice(0, -1));
    const removeAt = position => setFilled(current => current.slice(0, position));

    // 鍵盤也能拼：打字母填入、Backspace 刪掉。
    useEffect(() => {
        const onKey = event => {
            if (event.target?.closest?.("input, textarea")) return;
            if (event.key === "Backspace") { removeLast(); return; }
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
        <p className="speaking-guided-step__title">拼出空格裡的單字</p>
        {clip?.type === "audio" && <SpeakingQuestionClip clip={clip} label="再聽一次" />}
        <div style={{ "--spell-word": Math.max(...words.map(word => word.length)) }} className={`speaking-spell-slots${letterSlots.length > 9 ? " is-many" : ""}${checked && !correct ? " is-wrong" : ""}${correct ? " is-right" : ""}`} aria-live="polite" aria-label={`已拼 ${filled.length}／${letterSlots.length} 個字母`}>
            {words.map(word => <span key={word[0].index} className="speaking-spell-word">{word.map(slot => {
                if (slot.fixed) return <span key={slot.index} className={/[A-Za-z]/.test(slot.char) ? "speaking-spell-given" : "speaking-spell-mark"} aria-hidden="true">{slot.char}</span>;
                letterIndex += 1;
                const position = letterIndex;
                const tile = filled[position];
                const wrong = checked && tile && tile.letter !== slot.char.toLowerCase();
                return <button type="button" key={slot.index} className={`speaking-spell-slot${tile ? " is-filled" : ""}${wrong ? " is-wrong" : ""}`} onClick={() => tile && !correct && removeAt(position)} disabled={!tile || correct} aria-label={tile ? `第 ${position + 1} 個字母 ${tile.letter}${wrong ? "，不對" : ""}，點一下可以刪掉` : `第 ${position + 1} 個字母，空白`}>
                    {tile?.letter || ""}
                </button>;
            })}</span>)}
        </div>
        {checked && !correct && <p className="speaking-spell-feedback" role="status">紅色的字母不對，點一下刪掉再拼一次。</p>}
        {correct ? <>
            <p className="speaking-spell-feedback is-right" role="status"><FiCheck aria-hidden="true" />拼對了！</p>
            <button type="button" className="speaking-guided-next is-ready" onClick={onDone}>下一步：看著句子念<FiChevronRight aria-hidden="true" /></button>
        </> : <div className={`speaking-spell-tiles${tiles.length > 11 ? " is-many" : ""}`}>
            {tiles.map(tile => <button type="button" key={tile.id} className="speaking-spell-tile" onClick={() => place(tile)} disabled={complete || filled.some(item => item.id === tile.id)} aria-label={`字母 ${tile.letter}`}>{tile.letter}</button>)}
            <button type="button" className="speaking-spell-tile speaking-spell-tile--back" onClick={removeLast} disabled={!filled.length} aria-label="刪掉最後一個字母"><FiDelete aria-hidden="true" /></button>
        </div>}
    </section>;
}
