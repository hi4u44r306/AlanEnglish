// 單字大挑戰第一階段：成績只存在這台裝置（localStorage），不上傳。
// 私密瀏覽、清除網站資料或瀏覽器禁止儲存時，讀寫都可能失敗；失敗就當作沒有紀錄，不影響遊戲。

const STORAGE_PREFIX = "ae-word-challenge";
const MAX_KEYS_PER_LIST = 400;

const storageKey = (bankVersion, mode) => `${STORAGE_PREFIX}:${bankVersion}:${mode}`;

const emptyProgress = () => ({ best: {}, mastered: [], missed: [] });

export function loadLocalProgress(bankVersion, mode) {
    try {
        const raw = window.localStorage.getItem(storageKey(bankVersion, mode));
        if (!raw) return emptyProgress();
        const parsed = JSON.parse(raw);
        return {
            best: parsed && typeof parsed.best === "object" && parsed.best ? parsed.best : {},
            mastered: Array.isArray(parsed?.mastered) ? parsed.mastered : [],
            missed: Array.isArray(parsed?.missed) ? parsed.missed : []
        };
    } catch {
        return emptyProgress();
    }
}

// results：[{ key, correct, hinted }]
export function recordLocalRound(bankVersion, mode, level, results) {
    const progress = loadLocalProgress(bankVersion, mode);
    const correctCount = results.filter(result => result.correct).length;
    const levelKey = String(level);
    const best = { ...progress.best };
    if (level && (!best[levelKey] || correctCount > best[levelKey])) best[levelKey] = correctCount;

    const mastered = new Set(progress.mastered);
    const missed = new Set(progress.missed);
    for (const result of results) {
        if (result.correct && !result.hinted) {
            mastered.add(result.key);
            missed.delete(result.key);
        } else if (!result.correct) {
            missed.add(result.key);
        }
    }
    const next = {
        best,
        mastered: [...mastered].slice(-MAX_KEYS_PER_LIST),
        missed: [...missed].slice(-MAX_KEYS_PER_LIST)
    };
    try {
        window.localStorage.setItem(storageKey(bankVersion, mode), JSON.stringify(next));
    } catch {
        // 存不了就算了，這一輪的結果畫面照常顯示。
    }
    return next;
}
