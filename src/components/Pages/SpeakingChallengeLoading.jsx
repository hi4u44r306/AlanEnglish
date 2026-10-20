import React, { useEffect, useRef } from "react";
import "./css/SpeakingChallengeLoading.scss";
import { SPEAKING_LEVELS } from "../../constants/speakingLevels";

export default function SpeakingChallengeLoading({ mode, singlePractice = false, bookLabel, levelLabel, workbookEntry = false, complete = false, onReturn }) {
    const isChallenge = mode === "challenge";
    const modeLabel = singlePractice ? "朗讀練習" : isChallenge ? SPEAKING_LEVELS.challenge.label : SPEAKING_LEVELS.easy.label;
    const headingRef = useRef(null);
    const reference = workbookEntry ? "" : [bookLabel, levelLabel].filter(Boolean).join(" · ");
    const headingLabel = workbookEntry ? `正在進入 ${bookLabel || "Workbook"} 口說大挑戰…` : `正在進入${modeLabel}…`;

    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true });
    }, [mode, bookLabel, workbookEntry]);

    return <main className={`speaking-challenge-page speaking-mode-loading-page is-${isChallenge ? "challenge" : "easy"}${workbookEntry ? " is-workbook-entry" : ""}${complete ? " is-complete" : ""}`}>
        <section className="speaking-mode-loading-card" aria-labelledby="speaking-mode-loading-title">
            {/* 小朋友只看到進度條；標題與說明只給螢幕閱讀器，避免分心。 */}
            {reference && <p className="speaking-mode-loading-card__reference speaking-mode-loading-card__sr">{reference}</p>}
            <div className="speaking-mode-loading-card__sr" role="status" aria-live="polite" aria-atomic="true">
                <h1 id="speaking-mode-loading-title" ref={headingRef} tabIndex={-1} aria-label={headingLabel}>正在進入<br />{workbookEntry ? <><span>{bookLabel || "Workbook"}</span><br />口說大挑戰…</> : <>{modeLabel}…</>}</h1>
            </div>
            <p className="speaking-mode-loading-card__label" aria-hidden="true">{workbookEntry ? "打開地圖中…" : "進入關卡中…"}</p>
            <div className="speaking-mode-loading-card__track" role="progressbar" aria-label={workbookEntry ? "關卡地圖載入中" : "題目載入中"} aria-busy="true"><span /></div>
            <div className="speaking-mode-loading-card__copy speaking-mode-loading-card__sr">
                <p>{workbookEntry ? "準備好，開始你的口說冒險！" : singlePractice ? "看著文字開口念，需要時可以聽示範" : isChallenge ? "看問題，試著自己回答" : "看著答案，勇敢說出口"}</p>
                <small>{workbookEntry ? "正在準備關卡與冒險地圖" : "準備題目中"}</small>
            </div>
            <button type="button" className="speaking-mode-loading-card__return" onClick={onReturn}>{workbookEntry ? "返回全部教材" : "回到地圖"}</button>
        </section>
    </main>;
}
