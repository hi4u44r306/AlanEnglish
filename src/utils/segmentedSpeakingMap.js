// The visible road and markers share world coordinates and sampled arc length.
export const SPEAKING_MAP_WIDTH = 430;
export const SPEAKING_ROAD_WIDTH = 110;
export const SPEAKING_MARKER_DIAMETER = SPEAKING_ROAD_WIDTH * 2 / 3;
export const SPEAKING_SCENE_HEIGHT = 1030;
export const SPEAKING_SCENE_OVERLAP = 170;
const SCENE_STEP = SPEAKING_SCENE_HEIGHT - SPEAKING_SCENE_OVERLAP;
const ROW_STEP = SCENE_STEP / 2;
const BIOMES = ["meadow", "forest", "snow", "volcano"];
const round = value => Math.round(value * 1000) / 1000;

export function buildSegmentedSpeakingRoute(bookId, lessons = []) {
    const count = lessons.length;
    const sceneCount = Math.max(1, Math.ceil(count / 4));
    const height = sceneCount * SCENE_STEP + SPEAKING_SCENE_OVERLAP;
    const rowCount = sceneCount * 2;
    const samples = [];
    let length = 0;
    const add = (x, y) => {
        const previous = samples[samples.length - 1];
        if (previous) length += Math.hypot(x - previous.x, y - previous.y);
        samples.push({ x, y, distance: length });
    };
    const line = (x, y) => {
        const start = samples[samples.length - 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(x - start.x, y - start.y) / 3));
        for (let i = 1; i <= steps; i++) add(start.x + (x - start.x) * i / steps, start.y + (y - start.y) * i / steps);
    };
    // Radius 100 rounded corners keep the full road and marker inside each bend.
    const curve = (c1x, c1y, c2x, c2y, x, y) => {
        const start = samples[samples.length - 1];
        for (let i = 1; i <= 60; i++) {
            const t = i / 60, u = 1 - t;
            add(u ** 3 * start.x + 3 * u ** 2 * t * c1x + 3 * u * t ** 2 * c2x + t ** 3 * x,
                u ** 3 * start.y + 3 * u ** 2 * t * c1y + 3 * u * t ** 2 * c2y + t ** 3 * y);
        }
    };
    add(110, height - 300);
    for (let row = 0; row < rowCount; row++) {
        const y = height - 300 - row * ROW_STEP;
        const right = row % 2 === 0;
        if (row === rowCount - 1) { line(right ? 320 : 110, y); break; }
        const nextY = y - ROW_STEP;
        if (right) {
            line(250, y);
            curve(305.228, y, 350, y - 44.772, 350, y - 100);
            line(350, nextY + 100);
            curve(350, nextY + 44.772, 305.228, nextY, 250, nextY);
        } else {
            line(180, y);
            curve(124.772, y, 80, y - 44.772, 80, y - 100);
            line(80, nextY + 100);
            curve(80, nextY + 44.772, 124.772, nextY, 180, nextY);
        }
    }
    const atDistance = distance => {
        let low = 0, high = samples.length - 1;
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (samples[middle].distance < distance) low = middle + 1;
            else high = middle;
        }
        const end = samples[low], start = samples[Math.max(0, low - 1)];
        const fraction = (distance - start.distance) / (end.distance - start.distance || 1);
        return { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction };
    };
    const margin = 50;
    const nodes = lessons.map((lesson, index) => {
        const distance = count <= 1 ? margin : margin + index / (count - 1) * (length - margin * 2);
        const point = atDistance(distance);
        const x = point.x / SPEAKING_MAP_WIDTH * 100;
        return { id: lesson.id, x, xMobile: x, y: point.y / height * 100,
            worldX: point.x, worldY: point.y, distance,
            zone: BIOMES[Math.min(3, Math.floor(index / Math.max(1, count) * 4))] };
    });
    const scenes = Array.from({ length: sceneCount }, (_, index) => {
        const progress = sceneCount === 1 ? 0 : (sceneCount - 1 - index) / (sceneCount - 1);
        const biome = BIOMES[Math.min(3, Math.floor(progress * 4))];
        return { id: `${bookId}-scene-${index}`, index, biome, asset: biome,
            top: index * SCENE_STEP, height: SPEAKING_SCENE_HEIGHT,
            first: index === 0, last: index === sceneCount - 1 };
    });
    return { bookId, width: SPEAKING_MAP_WIDTH, height, aspectRatio: `${SPEAKING_MAP_WIDTH} / ${height}`,
        roadWidth: SPEAKING_ROAD_WIDTH, markerDiameter: SPEAKING_MARKER_DIAMETER, nodes, scenes,
        bridge: null, length,
        path: samples.map((point, index) => `${index === 0 ? "M" : "L"}${round(point.x)},${round(point.y)}`).join(" "),
        startsAtBottom: true };
}
