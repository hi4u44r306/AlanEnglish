// These percentages are calibrated to the winding road in the single Workbook
// world illustration. The same coordinate system scales with the image, so
// the 25 live markers remain on the road at desktop and mobile widths.
const TRAIL_LANDMARKS = [
    [18.8, 7.05], [42.2, 10.62], [32.8, 13.09], [32.6, 16.97], [61.9, 20.14],
    [55.8, 22.86], [19.4, 26.28], [23.0, 30.11], [44.9, 34.29], [31.7, 37.16],
    [22.3, 39.53], [49.2, 43.35], [63.0, 45.47], [49.9, 50.30], [35.1, 52.22],
    [19.4, 54.63], [42.7, 58.91], [53.8, 61.68], [66.0, 64.60], [42.0, 69.34],
    [28.4, 71.75], [38.4, 74.52], [65.9, 79.86], [72.6, 87.51], [58.8, 91.19]
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
            xMobile: Number(Math.min(88, Math.max(12, ((point.x * 7.92) - 120) / 4.8)).toFixed(2)),
            zone: progress >= 0.72 ? "volcano" : progress >= 0.43 ? "highland" : "grassland"
        };
    });
    return { nodes, aspectRatio: "792 / 1986" };
};
