// Markers follow the three painted biomes. The map grows with the catalog so
// Workbook 1's 25 levels keep game-like breathing room on every viewport.
const TRAIL_LANDMARKS = [
    [0, 190], [0.07, 390], [0.14, 610], [0.22, 330], [0.29, 720],
    [0.34, 770], [0.4, 220], [0.47, 650], [0.54, 760], [0.61, 280],
    [0.67, 210], [0.73, 690], [0.8, 360], [0.87, 720], [0.94, 420], [1, 580]
];

const trailX = progress => {
    const nextIndex = TRAIL_LANDMARKS.findIndex(([position]) => position >= progress);
    if (nextIndex <= 0) return TRAIL_LANDMARKS[0][1];
    const [start, startX] = TRAIL_LANDMARKS[nextIndex - 1];
    const [end, endX] = TRAIL_LANDMARKS[nextIndex];
    return Math.round(startX + (endX - startX) * (progress - start) / (end - start));
};

export const buildSpeakingAdventureRoute = (_bookKey, items) => {
    const height = Math.max(1800, items.length * 128 + 520);
    const top = 340;
    const bottom = height - 220;
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
