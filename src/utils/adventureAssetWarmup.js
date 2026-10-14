// 學生登入後，趁網路閒置時把「冒險地圖」的圖片先放進瀏覽器快取，第一次進冒險頁就不用等下載。
// 圖片檔名帶雜湊、長期快取（見 public/_headers），所以每張圖整個瀏覽器只會下載一次。
// 不會在省流量模式或較慢的網路下執行，也不保留解碼後的圖片，避免佔用記憶體。
let started = false;

const connection = () => (typeof navigator === "undefined" ? undefined : navigator.connection);

export const canWarmAdventureAssets = () => {
    if (typeof window === "undefined" || typeof fetch !== "function") return false;
    const net = connection();
    if (net?.saveData) return false;
    if (net?.effectiveType && net.effectiveType !== "4g") return false;
    return true;
};

const runWhenIdle = callback => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(callback, { timeout: 8000 });
    else window.setTimeout(callback, 4000);
};

export const warmAdventureAssets = () => {
    if (started || !canWarmAdventureAssets()) return;
    started = true;
    runWhenIdle(async () => {
        try {
            // 先載入小縮圖（書本卡片，體積小、最先看到），再慢慢載入大張地圖。
            const [{ SPEAKING_BOOK_THUMBS }, { CARTOON_ASSETS, CARTOON_SIDE_ASSETS }] = await Promise.all([
                import("../components/Pages/speakingBookThumbs"),
                import("../components/Pages/speakingCartoonAssets")
            ]);
            const urls = [...Object.values(SPEAKING_BOOK_THUMBS), ...Object.values(CARTOON_ASSETS), ...Object.values(CARTOON_SIDE_ASSETS)]
                .filter(url => typeof url === "string" && !url.startsWith("data:"));
            // 一張一張慢慢載，不和學生正在做的事搶網路。
            for (const url of urls) {
                if (!canWarmAdventureAssets() || document.hidden) break;
                await fetch(url, { priority: "low" }).then(response => response.arrayBuffer()).catch(() => {});
            }
        } catch {
            // 預先載入只是加速，失敗就等進冒險頁時再載入。
        }
    });
};

export const resetAdventureAssetWarmupForTests = () => { started = false; };
