import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { speakingListeningContext } from "../utils/speakingListening";

// 口說關卡的「先聽本關教材」頁：學生在這一頁時只能聽教材或回到原口說關卡。
// 鎖定記在 sessionStorage（同一個分頁有效），在網址列改網址、上一頁、站內連結都會被帶回聽力頁。
// 另開新分頁或關閉瀏覽器無法阻擋。30 分鐘後、到達原口說關卡、換帳號或登出時自動解除。
export const SPEAKING_FOCUS_KEY = "ae-speaking-focus-v1";
export const SPEAKING_FOCUS_TTL_MS = 30 * 60 * 1000;

export const isSpeakingListeningFocus = location => (
    location.pathname.startsWith("/student/books/")
    && !new URLSearchParams(location.search).get("assignment")
    && Boolean(speakingListeningContext(location.search))
);

const readLock = () => {
    try { return JSON.parse(sessionStorage.getItem(SPEAKING_FOCUS_KEY) || "null"); } catch (error) { return null; }
};

const writeLock = value => {
    try {
        if (value) sessionStorage.setItem(SPEAKING_FOCUS_KEY, JSON.stringify(value));
        else sessionStorage.removeItem(SPEAKING_FOCUS_KEY);
    } catch (error) { /* 無法使用 sessionStorage 時不鎖定 */ }
};

const validLock = (lock, uid) => Boolean(lock
    && lock.uid === uid
    && Number(lock.expiresAt) > Date.now()
    && typeof lock.prepPath === "string" && lock.prepPath.startsWith("/student/books/")
    && typeof lock.returnPath === "string" && lock.returnPath.startsWith("/student/speaking-challenges/"));

export default function useSpeakingFocusLock({ uid, role, authLoading, onLeaveBlocked }) {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (authLoading) return;
        if (!uid || role !== "student") {
            if (!uid || role) writeLock(null);
            return;
        }
        if (isSpeakingListeningFocus(location)) {
            const context = speakingListeningContext(location.search);
            writeLock({ uid, prepPath: `${location.pathname}${location.search}`, returnPath: context.returnPath, expiresAt: Date.now() + SPEAKING_FOCUS_TTL_MS });
            return;
        }
        const lock = readLock();
        if (!lock) return;
        if (!validLock(lock, uid) || location.pathname === lock.returnPath.split("?")[0]) {
            writeLock(null);
            return;
        }
        onLeaveBlocked?.();
        navigate(lock.prepPath, { replace: true, state: { speakingFocusBlocked: true } });
    }, [location, uid, role, authLoading, navigate, onLeaveBlocked]);
}
