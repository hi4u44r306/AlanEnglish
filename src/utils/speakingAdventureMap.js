// The painted road is one continuous curve in both versions of the same map.
// Record its centre in full-image percentages, then sample it at evenly spaced
// heights. Keeping a single coordinate source prevents mobile markers drifting
// away from the road when its centre crop changes with the screen width.
const ROAD_CENTERLINE = [
    44, 36, 41, 55, 62, 59, 39, 43, 68, 64,
    39, 40, 39, 47, 39, 51, 52, 46, 50, 44,
    43, 39, 53, 52, 39
].map((x, index) => [x, 9.5 + index * 79.5 / 24]);

const roadPointAt = progress => {
    const y = 9.5 + progress * 79.5;
    const endIndex = ROAD_CENTERLINE.findIndex(([, roadY]) => roadY >= y);
    const [startX, startY] = ROAD_CENTERLINE[Math.max(0, endIndex - 1)];
    const [endX, endY] = ROAD_CENTERLINE[endIndex < 0 ? ROAD_CENTERLINE.length - 1 : endIndex];
    const ratio = endY === startY ? 0 : (y - startY) / (endY - startY);
    return {
        x: Number((startX + (endX - startX) * ratio).toFixed(2)),
        y: Number(y.toFixed(2))
    };
};

export const buildSpeakingAdventureRoute = (_bookKey, items) => {
    const interval = items.length > 1 ? 1 / (items.length - 1) : 0;
    const nodes = items.map((item, index) => {
        const progress = index * interval;
        const point = roadPointAt(progress);
        return {
            id: item.id,
            ...point,
            xMobile: Number(Math.min(88, Math.max(12, ((point.x * 7.93) - 206.5) / 3.8)).toFixed(2)),
            zone: progress >= 0.72 ? "volcano" : progress >= 0.43 ? "highland" : "grassland"
        };
    });
    return { nodes, aspectRatio: "793 / 1983" };
};
