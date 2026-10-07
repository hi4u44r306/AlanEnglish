import React, { useEffect, useRef } from "react";
import { FiArrowRight, FiMap, FiZap, FiHexagon } from "react-icons/fi";
import "./css/SpeakingChallengeAnimation.scss";

export function SpeakingChallengeReturn({ toCatalog = false }) {
    return <main className="speaking-transition-page" role="status" aria-live="polite">
        <div className="speaking-return-card"><FiMap aria-hidden="true" /><strong>{toCatalog ? "返回教材列表中…" : "返回地圖中…"}</strong></div>
    </main>;
}

const awardedAmount = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

function AnimatedReward({ amount }) {
    const valueRef = useRef(null);
    useEffect(() => {
        const node = valueRef.current;
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        node.textContent = reduced ? `+${amount}` : "+0";
        if (reduced || amount === 0) return undefined;
        let frame;
        let started;
        const delay = window.setTimeout(() => {
            const count = now => {
                started ??= now;
                const progress = Math.min(1, (now - started) / 650);
                node.textContent = `+${Math.round(amount * (1 - (1 - progress) ** 3))}`;
                if (progress < 1) frame = window.requestAnimationFrame(count);
            };
            frame = window.requestAnimationFrame(count);
        }, 1000);
        return () => { window.clearTimeout(delay); window.cancelAnimationFrame(frame); };
    }, [amount]);
    return <span ref={valueRef} aria-hidden="true">+0</span>;
}

export function SpeakingChallengeCompletion({ notice, mode, reference, staffPreview, onReturn, onNext, nextTopic }) {
    const dialogRef = useRef(null);
    const xp = staffPreview || mode === "easy" ? 0 : awardedAmount(notice?.xp_awarded ?? notice?.reward_xp);
    const points = staffPreview || mode === "easy" ? 0 : awardedAmount(notice?.ae_points_awarded);
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialogRef.current?.querySelector("button")?.focus({ preventScroll: true });
        return () => { document.body.style.overflow = previousOverflow; };
    }, []);
    const onKeyDown = event => {
        if (event.key === "Escape") { event.preventDefault(); onReturn(); }
        if (event.key !== "Tab") return;
        const buttons = [...dialogRef.current.querySelectorAll("button")];
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    return <main className="speaking-transition-page speaking-celebration-page">
        <div className="speaking-celebration-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <span key={index} style={{ "--confetti-x": `${(index * 37 + 11) % 98}%`, "--confetti-delay": `${index % 6 * .07}s`, "--confetti-color": ["#ffd168", "#77c967", "#71b5ef"][index % 3] }} />)}</div>
        <section ref={dialogRef} className="speaking-celebration-card" role="dialog" aria-modal="true" aria-labelledby="speaking-celebration-title" aria-describedby="speaking-celebration-description" onKeyDown={onKeyDown}>
            <p className="speaking-celebration-reference">{reference}</p>
            <div className="speaking-celebration-stars" aria-hidden="true">{[0, 1, 2].map(index => <span key={index} style={{ "--star-delay": `${.35 + index * .26}s` }}>★</span>)}</div>
            <h1 id="speaking-celebration-title">{staffPreview ? "通關動畫預覽" : mode === "easy" ? "練習完成！" : "闖關成功！"}</h1>
            <p id="speaking-celebration-description">{staffPreview ? "預覽不會寫入進度或發放獎勵" : mode === "challenge" ? "挑戰通關已記錄！" : "練習不計正式通關；準備好後再試挑戰模式。"}</p>
            <span className="speaking-celebration-star-count">全部完成！</span>
            <div className="speaking-celebration-rewards">
                <div aria-label={`本次獲得 ${xp} XP`}><span className="speaking-celebration-rewards__icon is-xp"><FiZap aria-hidden="true" /></span><small>經驗值</small><strong><AnimatedReward amount={xp} /><em>XP</em></strong></div>
                <div aria-label={`本次獲得 ${points} AE Points`}><span className="speaking-celebration-rewards__icon is-points"><FiHexagon aria-hidden="true" /></span><small>獲得點數</small><strong><AnimatedReward amount={points} /><em>AE Points</em></strong></div>
            </div>
            {!staffPreview && xp === 0 && points === 0 && <small className="speaking-celebration-reward-note">{mode === "challenge" ? "獎勵只在首次通關發放" : "練習不發放 XP 或 AE Points"}</small>}
            {nextTopic && onNext && <p className="speaking-celebration-next-topic"><small>下一個目標</small><strong>{nextTopic}</strong></p>}
            <button type="button" className="speaking-celebration-next" onClick={onNext || onReturn}>{onNext ? "前往下一關" : "回地圖繼續冒險"}<FiArrowRight aria-hidden="true" /></button>
            <button type="button" className="speaking-celebration-return" onClick={onReturn}>返回地圖</button>
        </section>
    </main>;
}
