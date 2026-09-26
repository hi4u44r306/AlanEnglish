// Markers follow the painted trail, while the complete illustration scales with the catalog.
const TRAIL_LANDMARKS = [
    [0, 360], [0.13, 450], [0.21, 565], [0.3, 470], [0.39, 340],
    [0.48, 490], [0.55, 590], [0.63, 410], [0.71, 330],
    [0.78, 430], [0.85, 555], [0.93, 600], [1, 650]
];

const trailX = progress => {
    const nextIndex = TRAIL_LANDMARKS.findIndex(([position]) => position >= progress);
    if (nextIndex <= 0) return TRAIL_LANDMARKS[0][1];
    const [start, startX] = TRAIL_LANDMARKS[nextIndex - 1];
    const [end, endX] = TRAIL_LANDMARKS[nextIndex];
    return Math.round(startX + (endX - startX) * (progress - start) / (end - start));
};

export const buildSpeakingAdventureRoute = (_bookKey, items) => {
    const height = Math.max(1200, items.length * 88);
    const top = 155;
    const bottom = height - 150;
    const interval = items.length > 1 ? (bottom - top) / (items.length - 1) : 0;
    const nodes = items.map((item, index) => ({
        id: item.id,
        x: trailX((top + index * interval) / height),
        y: Math.round(top + index * interval),
        zone: index >= Math.ceil(items.length * 0.72) ? "volcano"
            : index >= Math.ceil(items.length * 0.43) ? "highland" : "grassland"
    }));
    return { nodes, height };
};
