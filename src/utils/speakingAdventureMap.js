// These percentages are calibrated to the winding road in the single Workbook
// world illustration. The same coordinate system scales with the image, so
// the 25 live markers remain on the road at desktop and mobile widths.
const TRAIL_LANDMARKS = [
    [43.0, 9.50], [34.0, 12.80], [39.0, 16.10], [52.0, 19.40], [55.0, 22.70],
    [60.0, 26.00], [43.0, 29.30], [45.0, 32.60], [55.0, 35.90], [57.0, 39.20],
    [52.0, 42.50], [43.0, 45.80], [36.0, 49.10], [47.0, 52.40], [47.0, 55.70],
    [51.0, 59.00], [49.0, 62.30], [43.0, 65.60], [46.0, 68.90], [48.0, 72.20],
    [43.0, 75.50], [46.0, 78.80], [49.0, 82.10], [45.0, 85.40], [51.0, 89.00]
];

const landmarkAt = progress => {
    const position = progress * (TRAIL_LANDMARKS.length - 1);
    const startIndex = Math.floor(position);
    const endIndex = Math.min(TRAIL_LANDMARKS.length - 1, Math.ceil(position));
    const ratio = position - startIndex;
    const [startX, startY] = TRAIL_LANDMARKS[startIndex];
    const [endX, endY] = TRAIL_LANDMARKS[endIndex];
    return {
        x: Number((startX + (endX - startX) * ratio).toFixed(2)),
        y: Number((startY + (endY - startY) * ratio).toFixed(2))
    };
};

export const buildSpeakingAdventureRoute = (_bookKey, items) => {
    const interval = items.length > 1 ? 1 / (items.length - 1) : 0;
    const nodes = items.map((item, index) => {
        const progress = index * interval;
        const point = landmarkAt(progress);
        return {
            id: item.id,
            ...point,
            xMobile: Number(Math.min(88, Math.max(12, ((point.x * 7.93) - 206.5) / 3.8)).toFixed(2)),
            zone: progress >= 0.72 ? "volcano" : progress >= 0.43 ? "highland" : "grassland"
        };
    });
    return { nodes, aspectRatio: "793 / 1983" };
};
