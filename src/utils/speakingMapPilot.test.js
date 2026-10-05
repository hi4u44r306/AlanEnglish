import { buildSpeakingMapPilot } from "./speakingMapPilot";

const lessons = Array.from({ length: 8 }, (_, i) => ({ id: "source-" + i }));
describe("eight-level art pilot", () => {
    test("each horizontal row holds two levels in alternating travel order", () => {
        const route = buildSpeakingMapPilot(lessons);
        expect(route.nodes.map(n => n.id)).toEqual(lessons.map(l => l.id));
        for (let row = 0; row < 4; row++) {
            const [a, b] = route.nodes.filter(n => n.row === row);
            expect(a.worldY).toBeCloseTo(b.worldY, 8);
            expect(Math.abs(a.worldX - b.worldX)).toBeGreaterThan(route.markerDiameter * 2);
            expect(row % 2 === 0 ? b.worldX > a.worldX : b.worldX < a.worldX).toBe(true);
            expect(b.distance).toBeGreaterThan(a.distance);
        }
    });
    test("the full road stays inside the world and marker centers lie on its rendered path", () => {
        const route = buildSpeakingMapPilot(lessons);
        const points = route.path.split(" ").map(command => command.slice(1).split(",").map(Number));
        expect(route.markerDiameter / route.roadWidth).toBeCloseTo(2 / 3, 10);
        points.forEach(([x, y]) => {
            expect(x - route.roadWidth / 2).toBeGreaterThan(0);
            expect(x + route.roadWidth / 2).toBeLessThan(route.width);
            expect(y).toBeGreaterThan(200);
            expect(y).toBeLessThan(route.height - 200);
        });
        route.nodes.forEach(node => {
            expect(Math.min(...points.map(([x, y]) => Math.hypot(x - node.worldX, y - node.worldY)))).toBeLessThan(.001);
        });
    });
    test("two distinct landmarks overlap across a continuous scene boundary", () => {
        const { scenes, height } = buildSpeakingMapPilot(lessons);
        expect(scenes[0].asset).not.toBe(scenes[1].asset);
        expect(scenes[0].top).toBe(0);
        expect(scenes[0].height - scenes[1].top).toBe(scenes[1].overlap);
        expect(scenes[1].top + scenes[1].height).toBe(height);
    });
    test("does not silently substitute the pilot for full-book layouts", () => {
        expect(() => buildSpeakingMapPilot(lessons.slice(0, 4))).toThrow(RangeError);
        expect(() => buildSpeakingMapPilot([...lessons, { id: "extra" }])).toThrow(RangeError);
    });
});
