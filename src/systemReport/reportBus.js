// 讓任何地方（錯誤邊界、全域錯誤處理）都能請對話框跳出來；對話框本身不依賴任何 React context。
const listeners = new Set();
let current = null;
const SEEN_KEY = "ae-reported-signatures";

const readSeen = () => {
    try { return JSON.parse(window.sessionStorage.getItem(SEEN_KEY) || "[]"); } catch (error) { return []; }
};
const writeSeen = list => {
    try { window.sessionStorage.setItem(SEEN_KEY, JSON.stringify(list.slice(-20))); } catch (error) { /* 存不了就算了 */ }
};

export const subscribeReport = listener => {
    listeners.add(listener);
    if (current) listener(current);
    return () => listeners.delete(listener);
};

// 同一種錯誤在同一個瀏覽分頁只跳一次，避免一直打擾。
export const showSystemReport = report => {
    const seen = readSeen();
    if (seen.includes(report.signature)) return false;
    writeSeen([...seen, report.signature]);
    current = report;
    listeners.forEach(listener => listener(current));
    return true;
};

export const clearSystemReport = () => {
    current = null;
    listeners.forEach(listener => listener(null));
};
