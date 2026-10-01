import React, { useEffect, useRef } from "react";
import { FiBookOpen, FiMic } from "react-icons/fi";
import "./css/SpeakingChallengeLoading.scss";

export default function SpeakingChallengeLoading({ mode, bookLabel, levelLabel, onReturn }) {
    const isChallenge = mode === "challenge";
    const headingRef = useRef(null);
    const reference = [bookLabel, levelLabel].filter(Boolean).join(" · ");

    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true });
    }, [mode]);

    return <main className={`speaking-challenge-page speaking-mode-loading-page is-${isChallenge ? "challenge" : "easy"}`}>
        <section className="speaking-mode-loading-card" aria-labelledby="speaking-mode-loading-title">
            <div className="speaking-mode-loading-card__badge" aria-hidden="true">{isChallenge ? <FiMic /> : <FiBookOpen />}</div>
            {reference && <p className="speaking-mode-loading-card__reference">{reference}</p>}
            <div role="status" aria-live="polite" aria-atomic="true">
                <h1 id="speaking-mode-loading-title" ref={headingRef} tabIndex={-1} aria-label={`正在進入${isChallenge ? "挑戰" : "簡單"}模式…`}>正在進入<br />{isChallenge ? "挑戰模式…" : "簡單模式…"}</h1>
            </div>
            <div className="speaking-mode-loading-card__track" role="progressbar" aria-label="題目載入中" aria-busy="true"><span /></div>
            <div className="speaking-mode-loading-card__copy">
                <p>{isChallenge ? "看問題，試著自己回答" : "看著答案，勇敢說出口"}</p>
                <small>準備題目中</small>
            </div>
            <button type="button" className="speaking-mode-loading-card__return" onClick={onReturn}>返回地圖</button>
        </section>
    </main>;
}
