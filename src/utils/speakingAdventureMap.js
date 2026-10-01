const MAP_WIDTH = 941;
const MAP_HEIGHT = 1672;
const MAX_ROWS = 7;
const PREFERRED_LEVELS_PER_ROW = 4;

// Measured from the illustrated v2 road, starting beside the flag at the
// bottom and ending at the castle. Sampling this same centreline keeps every
// HTML level control on the painted road while students climb upward.
const ROAD_POINTS = [
    [135, 1575], [240, 1550], [360, 1505], [500, 1440], [620, 1370], [690, 1285],
    [675, 1210], [560, 1150], [440, 1105], [410, 1050], [450, 1000], [570, 955],
    [700, 910], [765, 860], [740, 805], [620, 770], [500, 735], [425, 690],
    [420, 640], [470, 590], [580, 540], [700, 490], [780, 435], [770, 385],
    [650, 345], [500, 315], [340, 300], [225, 280], [245, 245], [360, 220],
    [510, 205], [650, 175], [760, 130], [825, 85]
];

const ROAD_SEGMENTS = ROAD_POINTS.slice(1).map((point, index) => {
    const previous = ROAD_POINTS[index];
    return {
        from: previous,
        to: point,
        length: Math.hypot(point[0] - previous[0], point[1] - previous[1])
    };
});
const ROAD_LENGTH = ROAD_SEGMENTS.reduce((sum, segment) => sum + segment.length, 0);

const sampleRoad = progress => {
    const clampedProgress = Math.min(1, Math.max(0, progress));
    if (clampedProgress === 1) {
        const [x, y] = ROAD_POINTS[ROAD_POINTS.length - 1];
        return {
            x: Number((x / MAP_WIDTH * 100).toFixed(2)),
            y: Number((y / MAP_HEIGHT * 100).toFixed(2))
        };
    }
    let remaining = clampedProgress * ROAD_LENGTH;
    const segment = ROAD_SEGMENTS.find(current => {
        if (remaining <= current.length) return true;
        remaining -= current.length;
        return false;
    }) || ROAD_SEGMENTS[ROAD_SEGMENTS.length - 1];
    const ratio = segment.length ? remaining / segment.length : 0;
    const x = segment.from[0] + (segment.to[0] - segment.from[0]) * ratio;
    const y = segment.from[1] + (segment.to[1] - segment.from[1]) * ratio;
    return {
        x: Number((x / MAP_WIDTH * 100).toFixed(2)),
        y: Number((y / MAP_HEIGHT * 100).toFixed(2))
    };
};

const evenlySpacedExtraRows = (rowCount, extraCount) => {
    if (!extraCount) return new Set();
    if (extraCount === 1) return new Set([Math.floor(rowCount / 2)]);
    return new Set(Array.from({ length: extraCount }, (_, index) =>
        Math.round(index * (rowCount - 1) / (extraCount - 1))
    ));
};

export const distributeSpeakingLevels = total => {
    if (!Number.isInteger(total) || total <= 0) return [];
    const rowCount = Math.min(MAX_ROWS, Math.max(1,
        total < PREFERRED_LEVELS_PER_ROW ? total : Math.ceil(total / PREFERRED_LEVELS_PER_ROW)
    ));
    const baseCount = Math.floor(total / rowCount);
    const extraRows = evenlySpacedExtraRows(rowCount, total % rowCount);
    return Array.from({ length: rowCount }, (_, rowIndex) => baseCount + (extraRows.has(rowIndex) ? 1 : 0));
};

export const buildSpeakingAdventureRoute = (_bookKey, items) => {
    const rowCounts = distributeSpeakingLevels(items.length);
    const nodes = items.map((item, index) => {
        const progress = items.length > 1 ? index / (items.length - 1) : 0;
        const point = sampleRoad(progress);
        return {
            id: item.id,
            x: point.x,
            xMobile: point.x,
            y: point.y,
            row: Math.min(MAX_ROWS, Math.floor(progress * MAX_ROWS) + 1),
            zone: progress >= 0.72 ? "volcano" : progress >= 0.43 ? "highland" : "grassland"
        };
    });

    return {
        nodes,
        rowCounts,
        aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}`,
        startsAtBottom: true
    };
};
