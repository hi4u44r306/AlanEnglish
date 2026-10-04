import { buildSegmentedSpeakingRoute, SPEAKING_MARKER_DIAMETER, SPEAKING_ROAD_WIDTH, SPEAKING_SCENE_OVERLAP } from "./segmentedSpeakingMap";

const lessons = count => Array.from({ length: count }, (_, index) => ({ id: index + 1 }));

describe("continuous speaking map geometry", () => {
    test.each([25, 36, 60, 100])("%i levels use equal road distances and stay inside the world", count => {
        const route = buildSegmentedSpeakingRoute("book-3", lessons(count));
        expect(route.nodes).toHaveLength(count);
        const interval = route.nodes[1].distance - route.nodes[0].distance;
        expect(interval).toBeGreaterThan(165);
        const points = route.path.split(" ").map(command => command.slice(1).split(",").map(Number));
        route.nodes.forEach((node, index) => {
            expect(node.worldX - route.roadWidth / 2).toBeGreaterThan(0);
            expect(node.worldX + route.roadWidth / 2).toBeLessThan(route.width);
            expect(node.worldY).toBeGreaterThan(200);
            expect(node.worldY).toBeLessThan(route.height - 200);
            expect(node.xMobile).toBe(node.x);
            // The HTML center lies on a segment of the actual rendered path.
            const endIndex = points.findIndex(point => point[1] <= node.worldY);
            const [ax, ay] = points[endIndex - 1], [bx, by] = points[endIndex];
            const expectedX = ax + (bx - ax) * (node.worldY - ay) / (by - ay);
            expect(Math.abs(node.worldX - expectedX)).toBeLessThan(.002);
            if (index) {
                expect(node.distance - route.nodes[index - 1].distance).toBeCloseTo(interval, 6);
                expect(node.worldY).toBeLessThan(route.nodes[index - 1].worldY);
            }
        });
        expect(route.scenes[0].top).toBeGreaterThanOrEqual(100);
        route.scenes.slice(1).forEach((scene, index) => {
            expect(route.scenes[index].top + route.scenes[index].height - scene.top).toBe(SPEAKING_SCENE_OVERLAP);
        });
        const last = route.scenes[route.scenes.length - 1];
        expect(last.top + last.height).toBeGreaterThanOrEqual(route.height);
        expect(route.scenes.filter(scene => scene.asset === "summit")).toHaveLength(1);
    });

    test("extra levels extend the map without shrinking the road or buttons", () => {
        const small = buildSegmentedSpeakingRoute("book-1", lessons(25));
        const large = buildSegmentedSpeakingRoute("book-1", lessons(60));
        expect(large.height).toBeGreaterThan(small.height * 2);
        expect(large.roadWidth).toBe(small.roadWidth);
        expect(large.markerDiameter).toBe(small.markerDiameter);
        expect(SPEAKING_MARKER_DIAMETER / SPEAKING_ROAD_WIDTH).toBeCloseTo(2 / 3, 10);
    });

    test("river crossing is in a gap between level buttons", () => {
        const route = buildSegmentedSpeakingRoute("book-1", lessons(25));
        expect(route.bridge).not.toBeNull();
        expect(Math.min(...route.nodes.map(node => Math.hypot(node.worldX - route.bridge.x, node.worldY - route.bridge.y))))
            .toBeGreaterThan(route.markerDiameter / 2 + 43);
    });

    test.each([0, 1, 2])("handles %i levels without invalid coordinates", count => {
        const route = buildSegmentedSpeakingRoute("book-1", lessons(count));
        expect(route.nodes).toHaveLength(count);
        expect(route.path).not.toMatch(/NaN|Infinity/);
        expect(route.bridge).toBeNull();
    });
});
