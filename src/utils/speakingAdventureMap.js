const MAP_WIDTH = 793;
const MAP_HEIGHT = 1983;
const MOBILE_VIEW_WIDTH = 440;
const MOBILE_VIEW_LEFT = (MAP_WIDTH - MOBILE_VIEW_WIDTH) / 2;

// Full-image percentages measured along the centre of the painted road. The
// points are deliberately denser around bends so interpolated lesson markers
// stay on the road instead of cutting across scenery.
const ROAD_CENTERLINE = [
    [45, 9], [43, 10], [37, 11.5], [32, 13.5], [33, 15.5],
    [40, 17.2], [50, 18.6], [59, 20], [63, 21.8], [62, 23.5],
    [57, 25], [48, 26.5], [39, 28], [35, 29.5], [38, 31],
    [46, 32.5], [55, 34], [61, 35.5], [61, 37], [57, 38.5],
    [49, 40], [40, 41], [35, 42.5], [34, 44], [38, 45.5],
    [45, 47], [50, 48.5], [49, 50], [44, 51.5], [36, 52.5],
    [31, 54], [29, 55.5], [31, 57], [37, 58.5], [46, 59.5],
    [54, 61], [57, 62.5], [55, 64], [50, 65.5], [44, 66.5],
    [39, 68], [38, 69.5], [41, 71], [46, 72.5], [48, 74],
    [45, 75.5], [40, 77], [37, 78.5], [38, 80], [43, 81.5],
    [50, 82.5], [54, 84], [52, 85.5], [46, 87], [38, 88],
    [32, 89.5], [31, 91], [35, 92.5], [43, 93.5], [51, 94.5]
];

const roadSegments = ROAD_CENTERLINE.slice(1).map((end, index) => {
    const start = ROAD_CENTERLINE[index];
    const width = (end[0] - start[0]) * MAP_WIDTH / 100;
    const height = (end[1] - start[1]) * MAP_HEIGHT / 100;
    return { start, end, length: Math.hypot(width, height) };
});

const ROAD_LENGTH = roadSegments.reduce((total, segment) => total + segment.length, 0);

const roadPointAt = progress => {
    const target = Math.min(1, Math.max(0, progress)) * ROAD_LENGTH;
    let travelled = 0;

    for (const segment of roadSegments) {
        if (travelled + segment.length >= target) {
            const ratio = segment.length === 0 ? 0 : (target - travelled) / segment.length;
            return {
                x: Number((segment.start[0] + (segment.end[0] - segment.start[0]) * ratio).toFixed(2)),
                y: Number((segment.start[1] + (segment.end[1] - segment.start[1]) * ratio).toFixed(2))
            };
        }
        travelled += segment.length;
    }

    const [x, y] = ROAD_CENTERLINE.at(-1);
    return { x, y };
};

const mobilePosition = x => Number(Math.min(88, Math.max(12,
    (x * MAP_WIDTH / 100 - MOBILE_VIEW_LEFT) / MOBILE_VIEW_WIDTH * 100
)).toFixed(2));

export const buildSpeakingAdventureRoute = (_bookKey, items) => {
    const interval = items.length > 1 ? 1 / (items.length - 1) : 0;
    const nodes = items.map((item, index) => {
        const progress = index * interval;
        const point = roadPointAt(progress);
        return {
            id: item.id,
            ...point,
            xMobile: mobilePosition(point.x),
            zone: progress >= 0.72 ? "volcano" : progress >= 0.43 ? "highland" : "grassland"
        };
    });
    return { nodes, aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` };
};
