// 教學影片的「真的看過的部分」：和聽力一樣，只累計連續播放經過的秒數，
// 快轉、拖曳不會增加；同一段重看也不會重複計算。看滿八成才算看完一次。
export const VIDEO_COMPLETE_RATIO = 0.8;
// 兩次取樣之間超過這個秒數視為跳轉，不累計。
export const VIDEO_MAX_STEP_SECONDS = 2.5;

export const createVideoCoverage = (start, end) => {
    let intervals = [];
    const length = Math.max(0, Number(end) - Number(start));
    const add = (from, to) => {
        const left = Math.max(Number(start), Math.min(from, to));
        const right = Math.min(Number(end), Math.max(from, to));
        if (!(right > left)) return;
        const merged = [];
        let current = [left, right];
        for (const interval of intervals) {
            if (interval[1] < current[0] || interval[0] > current[1]) merged.push(interval);
            else current = [Math.min(interval[0], current[0]), Math.max(interval[1], current[1])];
        }
        merged.push(current);
        intervals = merged.sort((a, b) => a[0] - b[0]);
    };
    const watchedSeconds = () => intervals.reduce((sum, [left, right]) => sum + (right - left), 0);
    return {
        // previous／current 是連續兩次取樣的播放時間；跳轉（倒退或一次跳太多）不算。
        step(previous, current) {
            const delta = current - previous;
            if (delta > 0 && delta <= VIDEO_MAX_STEP_SECONDS) add(previous, current);
        },
        watchedSeconds,
        ratio: () => (length > 0 ? Math.min(1, watchedSeconds() / length) : 0)
    };
};
