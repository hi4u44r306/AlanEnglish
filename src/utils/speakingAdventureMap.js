const MAP_WIDTH = 1000;
const MAP_HEIGHT = 6000;
const MAX_ROWS = 7;
const PREFERRED_LEVELS_PER_ROW = 4;

// This centreline is shared with storybook-adventure-map.svg. Sampling the same
// geometry keeps every HTML level control centred on the painted SVG road at
// any responsive width without baking labels into the artwork.
const ROAD_POINTS = [
    [140, 470], [250, 520], [390, 600], [550, 720], [690, 860], [820, 1040],
    [860, 1260], [740, 1460], [590, 1600], [440, 1740], [310, 1910], [220, 2110],
    [270, 2330], [410, 2520], [570, 2660], [720, 2840], [800, 3040], [750, 3260],
    [620, 3440], [470, 3620], [330, 3810], [220, 4010], [260, 4230], [390, 4400],
    [550, 4520], [700, 4690], [820, 4880], [840, 5100], [730, 5300], [580, 5440],
    [430, 5570], [280, 5680], [180, 5760]
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
    let remaining = Math.min(1, Math.max(0, progress)) * ROAD_LENGTH;
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
        aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}`
    };
};
