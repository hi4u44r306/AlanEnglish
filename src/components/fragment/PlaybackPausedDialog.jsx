import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function PlaybackPausedDialog({ onResume }) {
    const buttonRef = useRef(null);
    const [error, setError] = useState("");
    const [resuming, setResuming] = useState(false);
    useEffect(() => {
        const previousFocus = document.activeElement;
        buttonRef.current?.focus();
        const keepFocus = event => {
            if (event.key === "Tab" || event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                buttonRef.current?.focus();
            }
        };
        const redirectFocus = event => {
            if (!event.target.closest?.(".playback-paused-dialog")) buttonRef.current?.focus();
        };
        document.addEventListener("keydown", keepFocus, true);
        document.addEventListener("focusin", redirectFocus);
        return () => {
            document.removeEventListener("keydown", keepFocus, true);
            document.removeEventListener("focusin", redirectFocus);
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, []);

    const resume = async () => {
        if (resuming) return;
        setResuming(true);
        setError("");
        try {
            await onResume();
        } catch {
            setError("暫時無法播放，請確認網路後再試一次。");
        } finally {
            setResuming(false);
        }
    };

    return createPortal(
        <div className="playback-paused-overlay">
            <section className="playback-paused-dialog" role="alertdialog" aria-modal="true"
                aria-labelledby="playback-paused-title" aria-describedby="playback-paused-description">
                <span className="playback-paused-icon" aria-hidden="true">Ⅱ</span>
                <h2 id="playback-paused-title">播放已暫停</h2>
                <p id="playback-paused-description">切換分頁或鎖定畫面期間不計入有效聆聽。<br />請留在學習頁面，準備好後再繼續。</p>
                <p className="playback-paused-note">已聽過的有效進度會保留，不需要從頭開始。</p>
                {error && <p role="alert">{error}</p>}
                <button ref={buttonRef} type="button" onClick={resume} aria-disabled={resuming}>
                    {resuming ? "正在恢復播放…" : "我知道了，繼續播放"}
                </button>
            </section>
        </div>, document.body
    );
}
