// 口說大挑戰地圖：回到地圖時要停在「目前要挑戰的關卡」，而不是最上面（最後一關）。
// 換頁、資料更新、圖片與版面載入的先後時間不固定，只捲一次可能被後面的捲動或版面位移蓋掉，
// 所以在地圖出現後的前兩秒內重複對準；學生一動手（捲動、觸控、按鍵、點擊）就立刻停止，不搶控制權。
const INTERACTION_EVENTS = ["wheel", "touchmove", "keydown", "pointerdown"];
const RETRY_DELAYS_MS = [60, 200, 500, 1000, 2000];

// state：同一次進入地圖共用（呼叫端用 ref 保存）。學生動手之後，後續的資料更新也不再把畫面拉回去。
export const centerOnLevel = (findNode, { delays = RETRY_DELAYS_MS, state = { moved: false } } = {}) => {
    const timers = [];
    const stopWatching = () => INTERACTION_EVENTS.forEach(name => window.removeEventListener(name, markInteracted));
    function markInteracted() { state.moved = true; stopWatching(); }
    if (!state.moved) INTERACTION_EVENTS.forEach(name => window.addEventListener(name, markInteracted, { passive: true }));

    const run = () => {
        if (state.moved) return;
        findNode()?.scrollIntoView?.({ block: "center", behavior: "auto" });
    };
    run();
    delays.forEach((delay, index) => timers.push(window.setTimeout(() => {
        run();
        if (index === delays.length - 1) stopWatching();
    }, delay)));

    return () => {
        timers.forEach(window.clearTimeout);
        stopWatching();
    };
};

// 要對準哪一關：剛離開的那一關 → 下一個要挑戰的 → 目前進行中的 → 最後完成的 → 第一關。
export const findLevelToFocus = (root, returnedId) => {
    const lessons = ".speaking-challenge-lesson";
    const completed = root.querySelectorAll(`${lessons}.is-completed`);
    return (returnedId && root.querySelector(`[data-question-set-id="${returnedId}"]`))
        || root.querySelector(`${lessons}.is-next-target`)
        || root.querySelector(`${lessons}.is-current`)
        || (completed.length ? completed[completed.length - 1] : null)
        || root.querySelector(lessons);
};
