import { buildSegmentedSpeakingRoute, SPEAKING_MARKER_DIAMETER, SPEAKING_ROAD_WIDTH, SPEAKING_SCENE_OVERLAP } from "./segmentedSpeakingMap";

const lessons = count => Array.from({ length: count }, (_, index) => ({ id: `lesson-${index + 1}` }));
const distanceToSegment = (node, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((node.worldX - a[0]) * dx + (node.worldY - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(node.worldX - a[0] - t * dx, node.worldY - a[1] - t * dy);
};

describe("serpentine speaking map geometry", () => {
    test.each([15, 25, 36, 50, 60, 100, 101])("%i levels keep IDs, arc spacing and full button circles inside the road", count => {
        const input = lessons(count);
        const route = buildSegmentedSpeakingRoute("book-3", input);
        expect(route.nodes.map(node => node.id)).toEqual(input.map(lesson => lesson.id));
        expect(route.scenes).toHaveLength(Math.ceil(count / 4));
        const points = route.path.split(" ").map(command => command.slice(1).split(",").map(Number));
        const interval = route.nodes[1].distance - route.nodes[0].distance;
        expect(interval).toBeGreaterThan(230);
        route.nodes.forEach((node, index) => {
            expect(node.worldX - route.roadWidth / 2).toBeGreaterThan(0);
            expect(node.worldX + route.roadWidth / 2).toBeLessThan(route.width);
            expect(node.worldY).toBeGreaterThanOrEqual(300);
            expect(node.worldY).toBeLessThanOrEqual(route.height - 300);
            expect(node.xMobile).toBe(node.x);
            // Verify against the rendered polyline, including horizontal sections.
            const error = Math.min(...points.slice(1).map((p, i) => distanceToSegment(node, points[i], p)));
            expect(error).toBeLessThan(.002);
            if (index) {
                expect(node.distance - route.nodes[index - 1].distance).toBeCloseTo(interval, 6);
                expect(node.worldY).toBeLessThanOrEqual(route.nodes[index - 1].worldY);
            }
            route.nodes.slice(index + 1).forEach(other => {
                expect(Math.hypot(node.worldX - other.worldX, node.worldY - other.worldY))
                    .toBeGreaterThan(route.markerDiameter + 20);
            });
        });
        expect(route.scenes[0].top).toBe(0);
        route.scenes.slice(1).forEach((scene, index) => {
            expect(route.scenes[index].top + route.scenes[index].height - scene.top).toBe(SPEAKING_SCENE_OVERLAP);
        });
        const last = route.scenes[route.scenes.length - 1];
        expect(last.top + last.height).toBe(route.height);
        expect(last.biome).toBe("meadow");
        expect(route.scenes[0].biome).toBe("volcano");
        // All road edges stay inside the map, even between markers.
        points.forEach(([x]) => {
            expect(x - route.roadWidth / 2).toBeGreaterThan(0);
            expect(x + route.roadWidth / 2).toBeLessThan(route.width);
        });
    });

    test("50 levels use 13 connected scenes; fewer lessons shorten the world", () => {
        const small = buildSegmentedSpeakingRoute("book-1", lessons(25));
        const large = buildSegmentedSpeakingRoute("book-1", lessons(50));
        expect(large.scenes).toHaveLength(13);
        expect(small.scenes).toHaveLength(7);
        expect(large.height).toBeGreaterThan(small.height * 1.8);
        expect(large.roadWidth).toBe(small.roadWidth);
        expect(large.markerDiameter).toBe(small.markerDiameter);
        expect(SPEAKING_MARKER_DIAMETER / SPEAKING_ROAD_WIDTH).toBeCloseTo(2 / 3, 10);
        // There is one road, with broad east/west runs, not a vertical sine wave.
        expect(Math.max(...large.nodes.map(n => n.worldX)) - Math.min(...large.nodes.map(n => n.worldX))).toBeGreaterThan(250);
        expect(large.bridge).toBeNull();
    });

    test.each([0, 1, 2, 3, 4, 5])("handles %i lessons without inventing lessons or invalid coordinates", count => {
        const route = buildSegmentedSpeakingRoute("book-1", lessons(count));
        expect(route.nodes).toHaveLength(count);
        expect(route.path).not.toMatch(/NaN|Infinity/);
        expect(route.scenes.length).toBeGreaterThan(0);
    });
});
