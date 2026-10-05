// Eight-level visual pilot only. The existing full-book allocator stays unchanged.
export function buildSpeakingMapPilot(lessons) {
    if (lessons.length !== 8) throw new RangeError("The visual pilot requires exactly eight lessons.");
    const width = 500, height = 1800, roadWidth = 120;
    const samples = [], nodes = [];
    let length = 0;
    function add(x, y) {
        const previous = samples[samples.length - 1];
        if (previous) length += Math.hypot(x - previous.x, y - previous.y);
        samples.push({ x, y, distance: length });
    }
    function curve(c1x, c1y, c2x, c2y, x, y, markerRow = null) {
        const start = samples[samples.length - 1];
        for (let i = 1; i <= 120; i++) {
            const t = i / 120, u = 1 - t;
            add(u ** 3 * start.x + 3 * u ** 2 * t * c1x + 3 * u * t ** 2 * c2x + t ** 3 * x,
                u ** 3 * start.y + 3 * u ** 2 * t * c1y + 3 * u * t ** 2 * c2y + t ** 3 * y);
            if (markerRow !== null && (i === 6 || i === 114)) {
                const point = samples[samples.length - 1], index = nodes.length;
                nodes.push({ id: lessons[index].id, row: markerRow, distance: length,
                    worldX: point.x, worldY: point.y, x: point.x / width * 100,
                    xMobile: point.x / width * 100, y: point.y / height * 100,
                    zone: index < 4 ? "meadow" : "forest" });
            }
        }
    }
    add(100, 1480);
    curve(120, 1480, 140, 1480, 160, 1480);
    for (let row = 0; row < 4; row++) {
        const y = 1480 - row * 400, right = row % 2 === 0;
        if (right) {
            curve(220, y, 280, y, 340, y, row);
            if (row < 3) curve(470, y, 470, y - 400, 340, y - 400);
        } else {
            curve(280, y, 220, y, 160, y, row);
            if (row < 3) curve(30, y, 30, y - 400, 160, y - 400);
        }
    }
    curve(138, 280, 116, 280, 95, 280);
    const details = samples.filter((p, i) => i % 13 === 0 &&
        nodes.every(node => Math.hypot(p.x - node.worldX, p.y - node.worldY) > 66))
        .map((p, i) => ({ x: p.x, y: p.y, angle: i * 37 % 180 }));
    return { bookId: "eight-level-art-pilot", isPilot: true, width, height, roadWidth,
        markerDiameter: roadWidth * 2 / 3, aspectRatio: width + " / " + height, nodes,
        scenes: [
            { id: "pilot-forest", index: 0, top: 0, height: 1000, overlap: 200, asset: "pilotForest", biome: "forest", first: true },
            { id: "pilot-meadow", index: 1, top: 800, height: 1000, overlap: 200, asset: "pilotMeadow", biome: "meadow", last: true }
        ],
        details, bridge: null, startsAtBottom: true, length,
        path: samples.map((p, i) => (i ? "L" : "M") + p.x.toFixed(3) + "," + p.y.toFixed(3)).join(" ") };
}
