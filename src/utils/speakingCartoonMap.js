import traces from "./speakingCartoonTraces.json";
import unifiedTraces from "./speakingUnifiedTraces.json";

// Traces follow the final painted assets; no visible SVG road is added.
export const CARTOON_WIDTH = 500;
export const CARTOON_ROAD_WIDTH = 120;
export const CARTOON_TILE_HEIGHT = 1000;
export const CARTOON_OVERLAP = 100;
const STEP = CARTOON_TILE_HEIGHT - CARTOON_OVERLAP;

export const SPEAKING_BOOK_THEMES = [
    { id: "forest", title: "森林池塘", color: "#438548", ground: "#a1ce59" },
    { id: "island", title: "海島沙灘", color: "#148997", ground: "#86d98a" },
    { id: "candy", title: "糖果花園", color: "#be5387", ground: "#e9c6e3" },
    { id: "snow", title: "雪地極光", color: "#537fc0", ground: "#deedf6" },
    { id: "sky", title: "雲端天空", color: "#8470c3", ground: "#c4c9f6" },
    { id: "magic", title: "魔法火山", color: "#bb6843", ground: "#ad99c9" }
];
export const getSpeakingBookTheme = bookId => {
    const match = /^book-([1-6])$/.exec(String(bookId));
    return SPEAKING_BOOK_THEMES[match ? Number(match[1]) - 1 : 0];
};


const tiles = Object.fromEntries(Object.entries({
    ...traces,
    ...Object.fromEntries(Object.entries(unifiedTraces).map(([key, value]) => ["unified-" + key, value])),
}).map(([key, trace]) => {
    let distance = 0;
    const samples = trace.points.map(([x, y], index) => {
        const prior = trace.points[index - 1];
        if (prior) distance += Math.hypot(x - prior[0], y - prior[1]);
        return { x, y, distance };
    });
    return [key, { samples, anchors: trace.anchors }];
}));

export function buildCartoonSpeakingRoute(bookId, lessons = [], { unified = true } = {}) {
    const count = lessons.length, theme = getSpeakingBookTheme(bookId);
    const isUnifiedMap = unified;
    const sceneCount = Math.max(1, Math.ceil(count / 4));
    const height = STEP * sceneCount + CARTOON_OVERLAP;
    const scenes = Array.from({ length: sceneCount }, (_, index) => {
        const journeyIndex = sceneCount - 1 - index;
        const variant = journeyIndex % 2 ? "b" : "a";
        return { id: bookId + "-cartoon-" + index, index, variant, biome: theme.id,
            asset: (isUnifiedMap ? "unified-" : "") + theme.id + "-" + variant, unified: isUnifiedMap,
            top: index * STEP, height: CARTOON_TILE_HEIGHT,
            overlap: CARTOON_OVERLAP, fadeOverlap: CARTOON_OVERLAP, first: index === 0, last: index === sceneCount - 1 };
    });
    const points = [], slots = [];
    let distance = 0;
    for (let journeyIndex = 0; journeyIndex < sceneCount; journeyIndex++) {
        const scene = scenes[sceneCount - 1 - journeyIndex], tile = tiles[scene.asset];
        const localPoints = tile.samples.filter(p => journeyIndex === 0 || p.y < STEP);
        for (const p of localPoints) {
            const y = p.y + scene.top, previous = points[points.length - 1];
            if (previous) distance += Math.hypot(p.x - previous.x, y - previous.y);
            points.push({ x: p.x, y, distance });
        }
        // Four independently reviewed positions per illustration. No markers at tile seams.
        for (const [x, y] of tile.anchors) {
            const worldY = y + scene.top;
            const world = points.reduce((a, b) => Math.abs(a.y-worldY) < Math.abs(b.y-worldY) ? a : b);
            slots.push({ worldX: x, worldY, distance: world.distance, scene: scene.index });
        }
    }
    const nodes = lessons.map((lesson, i) => {
        const slotIndex = count <= 1 ? 0 : Math.round(i * (slots.length - 1) / (count - 1));
        const p = slots[slotIndex];
        return { ...p, id: lesson.id, x: p.worldX / CARTOON_WIDTH * 100,
            xMobile: p.worldX / CARTOON_WIDTH * 100, y: p.worldY / height * 100, zone: theme.id };
    });
    return { bookId, theme, width: CARTOON_WIDTH, height, aspectRatio: CARTOON_WIDTH + " / " + height,
        roadWidth: CARTOON_ROAD_WIDTH, markerDiameter: CARTOON_ROAD_WIDTH * 2 / 3,
        isCartoon: true, isUnifiedMap, paintedRoad: true, scenes, nodes, length: distance, bridge: null, startsAtBottom: true,
        path: points.map((p, i) => (i ? "L" : "M") + p.x.toFixed(3) + "," + p.y.toFixed(3)).join(" ") };
}
