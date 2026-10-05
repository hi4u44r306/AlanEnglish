import { buildResponsiveSpeakingRoute, distanceToScenery } from "./responsiveSpeakingRoute";

const lessons = n => Array.from({ length: n }, (_, i) => ({ id: "lesson-" + i }));
describe("responsive forest route", () => {
    test.each([0, 1, 25, 50, 101])("preserves all %i lesson ids and upward order", count => {
        const route = buildResponsiveSpeakingRoute(lessons(count), 412, 915);
        expect(route.nodes.map(n => n.id)).toEqual(lessons(count).map(n => n.id));
        expect(route.markerDiameter / route.roadWidth).toBeCloseTo(2 / 3);
        route.nodes.forEach((n, i) => {
            expect(n.x - route.markerDiameter / 2).toBeGreaterThan(0);
            expect(n.x + route.markerDiameter / 2).toBeLessThan(route.width);
            if (i) expect(n.y).toBeLessThan(route.nodes[i - 1].y);
            expect(n.distance).toBeCloseTo(count < 2 ? 0 : route.length * i / (count - 1), 5);
        });
    });
    test("desktop recomputes bends rather than stretching the mobile path", () => {
        const mobile = buildResponsiveSpeakingRoute(lessons(50), 412, 915);
        const desktop = buildResponsiveSpeakingRoute(lessons(50), 1440, 915);
        expect(desktop.nodes[6].x / desktop.width).not.toBeCloseTo(mobile.nodes[6].x / mobile.width, 2);
        expect(desktop.markerDiameter).toBe(88);
        expect(mobile.markerDiameter).toBe(72);
    });
    test.each([320, 412, 768, 1024, 1440, 1920])("keeps scenery outside road at %i px", width => {
        const route = buildResponsiveSpeakingRoute(lessons(50), width, 915);
        expect(route.scenery.length).toBeGreaterThan(0);
        for (const item of route.scenery) {
            for (const point of route.points.filter(p => Math.abs(p.y - item.y) < item.size)) {
                expect(distanceToScenery(point, item)).toBeGreaterThanOrEqual(route.roadWidth / 2 + 12);
            }
        }
    });
});
