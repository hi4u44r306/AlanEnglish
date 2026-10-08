import traces from "./speakingMapJoinTraces.json";

export const SPEAKING_JOIN_HEIGHT = 500;
export const SPEAKING_JOIN_OFFSET = 200;
export const SPEAKING_JOIN_FEATHER = 60;

export function buildSpeakingMapJoins(scenes) {
    return scenes.slice(1).map(scene => ({
        ...scene, id: `${scene.id}-join`, isJoin: true,
        asset: `join-${scene.biome}-${scene.variant}`,
        top: scene.top - SPEAKING_JOIN_OFFSET, height: SPEAKING_JOIN_HEIGHT,
        first: false, last: false, seamCut: undefined,
    }));
}

function sample(trace, y) {
    const index = Math.min(trace.length - 2, Math.floor(y / 5));
    const before = trace[index], after = trace[index + 1];
    const t = (y - before[1]) / (after[1] - before[1]);
    const x = before[0] + (after[0] - before[0]) * t;
    const width = before[3] - before[2] + ((after[3] - after[2]) - (before[3] - before[2])) * t;
    const slope = (after[0] - before[0]) / (after[1] - before[1]);
    return { x, clearance: width / 2 / Math.hypot(1, slope) };
}

// Match markers to the final painted repair, including its faded outer edges.
// This changes display coordinates only; lesson IDs and progress stay untouched.
export function repairSpeakingMapPoints(points, joins) {
    let distance = 0;
    let previous;
    return points.map(point => {
        const join = joins.find(scene => point.y >= scene.top && point.y <= scene.top + scene.height);
        const patch = join ? sample(traces[`${join.biome}-${join.variant}`], point.y - join.top) : null;
        const repaired = { ...point, x: patch?.x ?? point.x,
            safe: point.safe && (!patch || patch.clearance >= 46) };
        if (previous) distance += Math.hypot(repaired.x - previous.x, repaired.y - previous.y);
        previous = repaired;
        return { ...repaired, distance };
    });
}
