// World coordinates are shared by the road SVG and the HTML level buttons.
// Adding levels extends the world; it never reduces road or marker dimensions.
export const SPEAKING_MAP_WIDTH = 430;
export const SPEAKING_ROAD_WIDTH = 124;
export const SPEAKING_MARKER_DIAMETER = SPEAKING_ROAD_WIDTH * 2 / 3;
export const SPEAKING_SCENE_HEIGHT = 645;
export const SPEAKING_SCENE_OVERLAP = 96;
const SCENE_STEP = SPEAKING_SCENE_HEIGHT - SPEAKING_SCENE_OVERLAP;
const BIOMES = ["meadow", "forest", "snow", "volcano"];

const round = value => Math.round(value * 1000) / 1000;

export function buildSegmentedSpeakingRoute(bookId, lessons = []) {
    const count = lessons.length;
    const height = Math.max(1100, 520 + Math.max(0, count - 1) * 170);
    const travelHeight = height - 360;
    const samples = [];
    let length = 0;
    const sampleCount = Math.ceil(travelHeight / 4);
    for (let index = 0; index <= sampleCount; index++) {
        const climb = index / sampleCount * travelHeight;
        const point = { x: 215 - 70 * Math.cos(climb / 1000 * Math.PI * 2), y: height - 180 - climb };
        const previous = samples[index - 1];
        if (previous) length += Math.hypot(point.x - previous.x, point.y - previous.y);
        samples.push({ ...point, distance: length });
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
        return { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction,
            angle: Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI };
    };
    const margin = 65;
    const distances = lessons.map((_, index) => count === 1 ? margin : margin + index / (count - 1) * (length - margin * 2));
    const nodes = distances.map((distance, index) => {
        const point = atDistance(distance);
        const x = point.x / SPEAKING_MAP_WIDTH * 100;
        return { id: lessons[index].id, x, xMobile: x, y: point.y / height * 100,
            worldX: point.x, worldY: point.y, distance, zone: BIOMES[Math.min(3, Math.floor(index / Math.max(1, count) * 4))] };
    });
    const sceneTopSpace = 120;
    const sceneCount = Math.ceil((height - sceneTopSpace - SPEAKING_SCENE_OVERLAP) / SCENE_STEP);
    const scenes = Array.from({ length: sceneCount }, (_, index) => {
        const top = sceneTopSpace + index * SCENE_STEP;
        const progress = 1 - Math.min(height, top + SPEAKING_SCENE_HEIGHT / 2) / height;
        const biome = BIOMES[Math.min(3, Math.max(0, Math.floor(progress * 4)))];
        return { id: `${bookId}-scene-${index}`, index, biome, asset: index === 0 ? "summit" : biome,
            top, height: SPEAKING_SCENE_HEIGHT, first: index === 0, last: index === sceneCount - 1 };
    });
    // Place the river between buttons. The deck uses the road's own tangent,
    // so there is a single crossing with no second road next to the bridge.
    const crossingIndex = Math.floor(count * .36);
    const bridge = count >= 8 ? atDistance((distances[crossingIndex] + distances[crossingIndex + 1]) / 2) : null;
    return { bookId, width: SPEAKING_MAP_WIDTH, height, aspectRatio: `${SPEAKING_MAP_WIDTH} / ${height}`,
        roadWidth: SPEAKING_ROAD_WIDTH, markerDiameter: SPEAKING_MARKER_DIAMETER, nodes, scenes, bridge,
        path: samples.map((point, index) => `${index === 0 ? "M" : "L"}${round(point.x)},${round(point.y)}`).join(" "),
        startsAtBottom: true };
}
