import { buildSpeakingMapPilot } from "./speakingMapPilot";

const lessons = Array.from({ length: 8 }, (_, i) => ({ id: "source-" + i }));
describe("eight-level art pilot", () => {
    test("levels ascend in source order with usable separation and no repeated rows", () => {
        const route = buildSpeakingMapPilot(lessons);
        expect(route.nodes.map(n => n.id)).toEqual(lessons.map(l => l.id));
        for (let i = 1; i < route.nodes.length; i++) {
            const [a, b] = [route.nodes[i - 1], route.nodes[i]];
            expect(b.worldY).toBeLessThan(a.worldY);
            expect(Math.hypot(a.worldX - b.worldX, a.worldY - b.worldY)).toBeGreaterThan(route.markerDiameter * 1.5);
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
            expect(y - route.roadWidth / 2).toBeGreaterThan(100);
            expect(y + route.roadWidth / 2).toBeLessThan(route.height);
        });
        route.nodes.forEach(node => {
            expect(Math.min(...points.map(([x, y]) => Math.hypot(x - node.worldX, y - node.worldY)))).toBeLessThan(.001);
        });
    });
    test("bridge replaces the earth road and has no level on its deck or approaches", () => {
        const route = buildSpeakingMapPilot(lessons);
        expect(route.roadPath.match(/M/g)).toHaveLength(2);
        const earthPoints = route.roadPath.split(" ").map(command => command.slice(1).split(",").map(Number));
        expect(earthPoints.some(([, y]) => y > 450 && y < 600)).toBe(false);
        route.nodes.forEach(n => expect(n.distance <= route.bridge.start - 70 || n.distance >= route.bridge.end + 70).toBe(true));
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
