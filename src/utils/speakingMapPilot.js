// Opt-in eight-level artwork review; never selected by the full-book allocator.
export function buildSpeakingMapPilot(lessons) {
    if (lessons.length !== 8) throw new RangeError("The visual pilot requires exactly eight lessons.");
    const width = 500, height = 1800, roadWidth = 120;
    const samples = [];
    let length = 0;
    function add(x, y, bridge = false) {
        const previous = samples[samples.length - 1];
        if (previous) length += Math.hypot(x - previous.x, y - previous.y);
        samples.push({ x, y, distance: length, bridge });
    }
    function curve(c1x, c1y, c2x, c2y, x, y, bridge = false) {
        const start = samples[samples.length - 1];
        for (let i = 1; i <= 120; i++) {
            const t = i / 120, u = 1 - t;
            add(u ** 3 * start.x + 3 * u ** 2 * t * c1x + 3 * u * t ** 2 * c2x + t ** 3 * x,
                u ** 3 * start.y + 3 * u ** 2 * t * c1y + 3 * u * t ** 2 * c2y + t ** 3 * y, bridge);
        }
    }
    // Unequal bends follow the pond bank and woodland clearing.
    add(325, 1660);
    curve(325, 1590, 235, 1540, 265, 1470);
    curve(295, 1400, 365, 1425, 400, 1340);
    curve(435, 1255, 430, 1180, 360, 1120);
    curve(290, 1060, 170, 1090, 140, 1010);
    curve(110, 930, 175, 895, 235, 850);
    curve(295, 805, 340, 750, 325, 690);
    curve(315, 650, 314, 620, 300, 600);
    const bridgeStart = length;
    curve(265, 550, 230, 500, 195, 450, true);
    const bridgeEnd = length;
    curve(160, 400, 185, 355, 235, 300);
    curve(285, 245, 310, 245, 315, 180);

    const safe = samples.filter((p, i) => {
        if (p.distance < 150 || p.distance > length - 65 ||
            (p.distance > bridgeStart - 70 && p.distance < bridgeEnd + 70)) return false;
        const a = samples[Math.max(0, i - 10)], b = samples[Math.min(samples.length - 1, i + 10)];
        const angle = Math.atan2(b.y - p.y, b.x - p.x) - Math.atan2(p.y - a.y, p.x - a.x);
        return Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) < .2;
    });
    const nodes = lessons.map((lesson, index) => {
        const target = 155 + (length - 225) * index / (lessons.length - 1);
        const p = safe.reduce((best, point) => Math.abs(point.distance - target) < Math.abs(best.distance - target) ? point : best);
        return { id: lesson.id, distance: p.distance, worldX: p.x, worldY: p.y,
            x: p.x / width * 100, xMobile: p.x / width * 100, y: p.y / height * 100,
            zone: p.y > 900 ? "meadow" : "forest" };
    });
    const command = (p, move) => (move ? "M" : "L") + p.x.toFixed(3) + "," + p.y.toFixed(3);
    const roadPath = samples.map((p, i) => p.bridge ? "" : command(p, i === 0 || samples[i - 1].bridge)).filter(Boolean).join(" ");
    const details = samples.filter((p, i) => !p.bridge && i % 19 === 0 &&
        nodes.every(node => Math.hypot(p.x - node.worldX, p.y - node.worldY) > 70))
        .map((p, i) => ({ x: p.x, y: p.y, angle: i * 37 % 180 }));
    return { bookId: "eight-level-art-pilot", isPilot: true, width, height, roadWidth,
        markerDiameter: roadWidth * 2 / 3, aspectRatio: width + " / " + height, nodes,
        scenes: [
            { id: "pilot-forest", index: 0, top: 0, height: 1000, overlap: 200, asset: "pilotForest", biome: "forest", first: true },
            { id: "pilot-meadow", index: 1, top: 800, height: 1000, overlap: 200, asset: "pilotMeadow", biome: "meadow", last: true }
        ],
        details, bridge: { from: { x: 300, y: 600 }, to: { x: 195, y: 450 }, start: bridgeStart, end: bridgeEnd },
        startsAtBottom: true, length, roadPath, ends: [samples[0], samples[samples.length - 1]],
        path: samples.map((p, i) => command(p, i === 0)).join(" ") };
}
