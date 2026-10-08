import traces from "./speakingCartoonTraces.json";
import unifiedTraces from "./speakingUnifiedTraces.json";
import unifiedSeams from "./speakingUnifiedSeams.json";
import { buildSpeakingMapJoins, repairSpeakingMapPoints } from "./speakingMapJoins";

// Traces follow the final painted assets; no visible SVG road is added.
export const CARTOON_WIDTH = 500;
export const CARTOON_ROAD_WIDTH = 120;
export const CARTOON_TILE_HEIGHT = 1000;
export const CARTOON_OVERLAP = 100;

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
    return [key, { samples, anchors: trace.anchors, startAnchor: trace.startAnchor }];
}));

function distributeAlongRoad(points, count) {
    if (!points.length || !count) return [];
    const first = points[0], last = points[points.length - 1];
    const step = count > 1 ? (last.distance - first.distance) / (count - 1) : 0;
    const nearest = target => {
        let low = 0, high = points.length - 1;
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (points[middle].distance < target) low = middle + 1;
            else high = middle;
        }
        const before = points[Math.max(0, low - 1)], after = points[low];
        return Math.abs(before.distance - target) <= Math.abs(after.distance - target) ? before : after;
    };
    if (count === 1) return [first];
    // Minimise the largest spacing deviation across the whole journey. This
    // distributes bend avoidance among neighbours instead of making one large gap.
    let row = [{ point: first, error: 0, sum: 0, previous: null }];
    for (let i = 1; i < count; i++) {
        const target = first.distance + i * step;
        const candidates = i === count - 1 ? [last] : points.filter(p => Math.abs(p.distance - target) <= step / 2);
        const previousRow = row;
        row = candidates.flatMap(point => {
            let best = null;
            for (const previous of previousRow) {
                const gap = point.distance - previous.point.distance;
                if (gap <= 0) continue;
                const deviation = Math.abs(gap - step);
                const error = Math.max(previous.error, deviation), sum = previous.sum + deviation ** 2;
                if (!best || error < best.error || (error === best.error && sum < best.sum)) best = { point, error, sum, previous };
            }
            return best ? [best] : [];
        });
    }
    if (!row.length) return Array.from({ length: count }, (_, i) => nearest(first.distance + i * step));
    const result = [];
    for (let entry = row[0]; entry; entry = entry.previous) result.push(entry.point);
    return result.reverse();
}

export function buildCartoonSpeakingRoute(bookId, lessons = [], { unified = true } = {}) {
    const count = lessons.length, theme = getSpeakingBookTheme(bookId);
    const isUnifiedMap = unified;
    const overlap = isUnifiedMap ? unifiedSeams[theme.id + "-a"].overlap : CARTOON_OVERLAP;
    const step = CARTOON_TILE_HEIGHT - overlap;
    const sceneCount = Math.max(1, Math.ceil(count / 4));
    const height = step * sceneCount + overlap;
    const scenes = Array.from({ length: sceneCount }, (_, index) => {
        const journeyIndex = sceneCount - 1 - index;
        const variant = journeyIndex % 2 ? "b" : "a";
        const seam = isUnifiedMap ? unifiedSeams[theme.id + "-" + variant] : null;
        return { id: bookId + "-cartoon-" + index, index, variant, biome: theme.id,
            asset: (isUnifiedMap ? "unified-" : "") + theme.id + "-" + variant, unified: isUnifiedMap,
            top: index * step, height: CARTOON_TILE_HEIGHT,
            overlap, fadeOverlap: overlap,
            seamCut: index > 0 ? seam?.cut : undefined,
            first: index === 0, last: index === sceneCount - 1 };
    });
    const points = [], slots = [];
    let distance = 0;
    for (let journeyIndex = 0; journeyIndex < sceneCount; journeyIndex++) {
        const scene = scenes[sceneCount - 1 - journeyIndex], tile = tiles[scene.asset];
        const seam = isUnifiedMap ? unifiedSeams[theme.id + "-" + scene.variant] : null;
        const samples = seam ? (scene.first ? seam.plain : seam.joined).map(([x, y, safe]) => ({ x, y, safe })) : tile.samples;
        const localPoints = samples.filter(p => journeyIndex === 0 || p.y < step);
        for (const p of localPoints) {
            const y = p.y + scene.top, previous = points[points.length - 1];
            if (previous) distance += Math.hypot(p.x - previous.x, y - previous.y);
            points.push({ x: p.x, y, distance, safe: p.safe, scene: scene.index });
        }
        // Legacy narrow artwork retains its reviewed positions.
        const anchors = journeyIndex === 0 && tile.startAnchor
            ? [tile.startAnchor, ...tile.anchors.slice(1)]
            : tile.anchors;
        for (const [x, y] of anchors) {
            const worldY = y + scene.top;
            const world = points.reduce((a, b) => Math.abs(a.y-worldY) < Math.abs(b.y-worldY) ? a : b);
            slots.push({ worldX: x, worldY, distance: world.distance, scene: scene.index });
        }
    }
    // Place markers over the entire journey, not a subset of four slots per tile.
    // Clearance is sampled on the final visible road, including the terrain joins.
    const joins = isUnifiedMap ? buildSpeakingMapJoins(scenes) : [];
    const roadPoints = isUnifiedMap ? repairSpeakingMapPoints(points, joins) : points;
    const available = roadPoints.filter(p => p.safe && p.y <= height - 320 && p.y >= 175);
    const distributed = distributeAlongRoad(available, count);
    const nodes = lessons.map((lesson, i) => {
        const slotIndex = count <= 1 ? 0 : Math.round(i * (slots.length - 1) / (count - 1));
        const point = isUnifiedMap ? distributed[i] : null;
        const p = point ? { worldX: point.x, worldY: point.y, distance: point.distance, scene: point.scene } : slots[slotIndex];
        return { ...p, id: lesson.id, x: p.worldX / CARTOON_WIDTH * 100,
            xMobile: p.worldX / CARTOON_WIDTH * 100, y: p.worldY / height * 100, zone: theme.id };
    });
    return { bookId, theme, width: CARTOON_WIDTH, height, aspectRatio: CARTOON_WIDTH + " / " + height,
        roadWidth: CARTOON_ROAD_WIDTH, markerDiameter: CARTOON_ROAD_WIDTH * 2 / 3,
        isCartoon: true, isUnifiedMap, paintedRoad: true, scenes, joins, nodes,
        length: roadPoints[roadPoints.length - 1]?.distance ?? distance, bridge: null, startsAtBottom: true,
        path: roadPoints.map((p, i) => (i ? "L" : "M") + p.x.toFixed(3) + "," + p.y.toFixed(3)).join(" ") };
}
