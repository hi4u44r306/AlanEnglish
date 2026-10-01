const MAP_WIDTH = 941;
const MAP_HEIGHT = 1672;
const MAX_ROWS = 7;
const PREFERRED_LEVELS_PER_ROW = 4;

// Approved 2026-10-01 centreline preview: trace the road and wooden bridge,
// starting at the bottom flag and stopping on the road before the castle.
const ROAD_POINTS = [
    [135, 1587], [240, 1568], [360, 1519], [500, 1473], [620, 1431],
    [669, 1400], [690, 1380], [703, 1360], [708, 1340], [706, 1320], [698, 1300], [683, 1280],
    [650, 1255], [605, 1230], [548, 1205], [498, 1182],
    [455, 1160], [424, 1140], [407, 1120], [405, 1100], [415, 1080], [438, 1060], [477, 1040],
    [570, 1012], [700, 976], [744, 950], [764, 930], [772, 910], [771, 890], [762, 870], [742, 850],
    [700, 832], [620, 799], [500, 760], [447, 730], [427, 710], [421, 690], [426, 670], [443, 650], [470, 630],
    [580, 582], [700, 546], [735, 530], [773, 510], [791, 490], [787, 470], [768, 453], [723, 430],
    [650, 418], [500, 367], [340, 336], [284, 330], [241, 310], [223, 290], [243, 270], [289, 250],
    [360, 236], [510, 214], [650, 181], [700, 155], [735, 128], [760, 115]
];

const ROAD_CURVES = ROAD_POINTS.slice(0, -1).map((point, index) => {
    const previous = ROAD_POINTS[Math.max(0, index - 1)];
    const next = ROAD_POINTS[index + 1];
    const after = ROAD_POINTS[Math.min(ROAD_POINTS.length - 1, index + 2)];
    return [
        point,
        [point[0] + (next[0] - previous[0]) / 6, point[1] + (next[1] - previous[1]) / 6],
        [next[0] - (after[0] - point[0]) / 6, next[1] - (after[1] - point[1]) / 6],
        next
    ];
});

const formatPoint = point => point.map(value => Number(value.toFixed(3))).join(" ");
export const SPEAKING_ADVENTURE_ROAD_PATH = `M ${formatPoint(ROAD_POINTS[0])} ${ROAD_CURVES.map(curve =>
    `C ${curve.slice(1).map(formatPoint).join(" ")}`
).join(" ")}`;

// Use the same cubic curves and arc-length sampling as the approved SVG.
// Build the table once, so responsive placement never depends on DOM size.
const ROAD_SAMPLES = ROAD_CURVES.flatMap(curve => Array.from({ length: 40 }, (_, index) => {
    const t = index / 40;
    const u = 1 - t;
    return [0, 1].map(axis =>
        u ** 3 * curve[0][axis] + 3 * u ** 2 * t * curve[1][axis]
        + 3 * u * t ** 2 * curve[2][axis] + t ** 3 * curve[3][axis]
    );
}));
ROAD_SAMPLES.push(ROAD_POINTS[ROAD_POINTS.length - 1]);

const ROAD_SEGMENTS = ROAD_SAMPLES.slice(1).map((point, index) => {
    const previous = ROAD_SAMPLES[index];
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
        // Keep the first marker on the road, but clear the painted start flag.
        const point = sampleRoad(index === 0 ? 32 / ROAD_LENGTH : progress);
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
