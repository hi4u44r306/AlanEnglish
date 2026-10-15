// 防止無限重新整理：錯誤若一直發生，只讓使用者重整有限次數，超過就改成「回首頁」與「聯絡客服」。
const KEY = "ae-reload-guard";
const PENDING_KEY = "ae-reload-pending";
const USER_WINDOW_MS = 5 * 60 * 1000;
const AUTO_WINDOW_MS = 10 * 60 * 1000;

const read = () => {
    try { return JSON.parse(window.sessionStorage.getItem(KEY) || "{}"); } catch (error) { return {}; }
};
const write = value => {
    try { window.sessionStorage.setItem(KEY, JSON.stringify(value)); return true; } catch (error) { return false; }
};
export const storageWorks = () => {
    try { window.sessionStorage.setItem("ae-probe", "1"); window.sessionStorage.removeItem("ae-probe"); return true; } catch (error) { return false; }
};

// 使用者按下重新整理：5 分鐘內最多 2 次。
export const canUserReload = (now = Date.now()) => {
    const record = read();
    if (!record.user || now - record.user.firstAt > USER_WINDOW_MS) return true;
    return record.user.count < 2;
};

// 系統自動重新整理（部署後的新舊版本不一致）：同一種原因 10 分鐘內最多 1 次；存不了狀態時完全不自動重整。
export const canAutoReload = (reason, now = Date.now()) => {
    if (!storageWorks()) return false;
    const last = read().auto?.[reason];
    return !last || now - last > AUTO_WINDOW_MS;
};

// 重新整理「真的發生」之後才計次（如果使用者在瀏覽器的「離開網站？」提示按取消，就不算）。
export const markReloadPending = (auto, reason, now = Date.now()) => {
    try { window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ auto, reason, at: now })); } catch (error) { /* 忽略 */ }
};

export const settleReload = (now = Date.now()) => {
    let pending = null;
    try {
        pending = JSON.parse(window.sessionStorage.getItem(PENDING_KEY) || "null");
        window.sessionStorage.removeItem(PENDING_KEY);
    } catch (error) { return; }
    if (!pending || now - pending.at > 2 * 60 * 1000) return;
    const record = read();
    if (pending.auto) {
        write({ ...record, auto: { ...(record.auto || {}), [pending.reason]: pending.at } });
        return;
    }
    const user = record.user && now - record.user.firstAt <= USER_WINDOW_MS ? record.user : { count: 0, firstAt: now };
    write({ ...record, user: { count: user.count + 1, firstAt: user.firstAt } });
};
