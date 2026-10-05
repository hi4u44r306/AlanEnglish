const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const fractions = [.38, .76, .23, .65, .31, .8, .42, .2, .7];

export function distanceToScenery(point, scenery) {
    const dx = Math.max(Math.abs(point.x - scenery.x) - scenery.size / 2, 0);
    const dy = Math.max(Math.abs(point.y - scenery.y) - scenery.size / 2, 0);
    return Math.hypot(dx, dy);
}

// Layout is calculated in CSS pixels. A wide screen changes the bends, not sprite proportions.
export function buildResponsiveSpeakingRoute(lessons = [], viewportWidth = 412, viewportHeight = 915) {
    const width = clamp(viewportWidth, 280, 1600);
    const roadWidth = clamp(width * .22, 108, 132);
    const markerDiameter = roadWidth * 2 / 3;
    const step = clamp((viewportHeight - 260) / 3.5, 145, 200);
    const height = Math.max(viewportHeight, 440 + Math.max(0, lessons.length - 1) * step);
    const inset = roadWidth / 2 + 22;
    const amplitude = width - inset * 2;
    const travel = height - 400;
    const turns = Math.max(1, Math.ceil(travel / (step * (width > 900 ? 2.9 : 1.9))));
    const knots = Array.from({ length: turns + 1 }, (_, i) => ({
        x: inset + amplitude * fractions[i % fractions.length],
        y: height - 200 - travel * i / turns,
    }));
    const points = [];
    for (let k = 0; k < turns; k++) {
        const a = knots[k], b = knots[k + 1];
        const samples = Math.ceil((a.y - b.y) / 6);
        for (let i = 0; i < samples; i++) {
            const t = i / samples, eased = t * t * (3 - 2 * t);
            points.push({ x: a.x + (b.x - a.x) * eased, y: a.y + (b.y - a.y) * t });
        }
    }
    points.push(knots[knots.length - 1]);
    let length = 0;
    points.forEach((p, i) => {
        if (i) length += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
        p.distance = length;
    });
    const nodes = lessons.map((lesson, index) => {
        const target = lessons.length < 2 ? 0 : length * index / (lessons.length - 1);
        const j = Math.max(1, points.findIndex(p => p.distance >= target));
        const a = points[j - 1], b = points[j];
        const t = (target - a.distance) / (b.distance - a.distance || 1);
        return { id: lesson.id, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, distance: target };
    });
    const scenery = [];
    const size = clamp(width * .33, 118, 265);
    for (let y = 95, row = 0; y < height - 50; y += size * .83, row++) {
        const itemSize = size * (.88 + .12 * Math.sin(row * 2.3) ** 2);
        const candidates = [.08, .92, .3, .7, .5].map((f, column) => ({
            x: clamp(width * (f + .035 * Math.sin(row * 1.7 + column)), itemSize * .42, width - itemSize * .42),
            y: y + 15 * Math.sin(row), size: itemSize,
            kind: (row + column) % 4 === 1 ? "pond" : "grove",
        }));
        for (const candidate of candidates) {
            if (points.some(p => Math.abs(p.y - candidate.y) < size && distanceToScenery(p, candidate) < roadWidth / 2 + 12)) continue;
            if (scenery.some(s => Math.abs(s.x - candidate.x) < size * .86 && Math.abs(s.y - y) < size * .83)) continue;
            scenery.push({ ...candidate, id: "scenery-" + row + "-" + candidate.x });
            if (width < 600) break;
        }
    }
    return { width, height, roadWidth, markerDiameter, nodes, points, scenery, length,
        path: points.map((p, i) => (i ? "L" : "M") + p.x.toFixed(2) + " " + p.y.toFixed(2)).join(" ") };
}
