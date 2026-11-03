import { useEffect, useRef } from "react";
import { recordSpeakingAttention } from "../services/learningActivityService";

export const SPEAKING_IDLE_MS = 90 * 1000;
export const SPEAKING_ATTENTION_THROTTLE_MS = 30 * 1000;

// 口說關卡進行中：切到別的分頁或 App 記一次 hidden；90 秒沒有任何點擊、觸控或按鍵記一次 idle
// （錄音或評分中不算）。同一種原因 30 秒內只記一次；只記學生本人，失敗不影響練習。
export default function useSpeakingAttention({ firebaseUser, role, questionSetId, mode, busy }) {
    const lastSentRef = useRef({});
    const busyRef = useRef(busy);
    busyRef.current = busy;
    const armIdleRef = useRef(null);

    // 錄音／評分結束（busy 變 false）時重新計時；否則 busy 期間到期的那次 timer 被略過後，
    // 要等學生下一次點擊才會再開始偵測閒置。
    useEffect(() => {
        if (!busy) armIdleRef.current?.();
    }, [busy]);

    useEffect(() => {
        if (role !== "student" || !firebaseUser || !questionSetId) return undefined;
        const send = reason => {
            const now = Date.now();
            if (now - (lastSentRef.current[reason] || 0) < SPEAKING_ATTENTION_THROTTLE_MS) return;
            lastSentRef.current[reason] = now;
            try { recordSpeakingAttention(firebaseUser, { reason, question_set_id: Number(questionSetId), mode })?.catch?.(() => {}); } catch (error) { /* 記錄失敗不影響練習 */ }
        };
        let idleTimer = null;
        const armIdle = () => {
            window.clearTimeout(idleTimer);
            idleTimer = window.setTimeout(() => {
                if (!busyRef.current && document.visibilityState !== "hidden") send("idle");
            }, SPEAKING_IDLE_MS);
        };
        const onVisibility = () => {
            if (document.visibilityState === "hidden") send("hidden");
            else armIdle();
        };
        armIdleRef.current = armIdle;
        const events = ["pointerdown", "keydown", "touchstart"];
        events.forEach(name => window.addEventListener(name, armIdle, { passive: true }));
        document.addEventListener("visibilitychange", onVisibility);
        armIdle();
        return () => {
            window.clearTimeout(idleTimer);
            armIdleRef.current = null;
            events.forEach(name => window.removeEventListener(name, armIdle));
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [firebaseUser, role, questionSetId, mode]);
}
