import { buildCartoonSpeakingRoute, getSpeakingBookTheme, SPEAKING_BOOK_THEMES } from "./speakingCartoonMap";

describe("full Workbook cartoon maps", () => {
    test("unified maps keep lesson order and map every node to the painted trace", () => {
        for (const count of [0, 1, 5, 25, 50, 101]) {
            const lessons = Array.from({ length: count }, (_, id) => ({ id }));
            const route = buildCartoonSpeakingRoute("book-1", lessons, { unified: true });
            expect(route.isUnifiedMap).toBe(true);
            expect(route.nodes.map(n => n.id)).toEqual(lessons.map(l => l.id));
            const points = route.path.split(" ").map(p => p.slice(1).split(",").map(Number));
            route.nodes.forEach((node, index) => {
                expect(Math.min(...points.map(([x, y]) => Math.hypot(x - node.worldX, y - node.worldY)))).toBeLessThan(.001);
                expect(node.worldX).toBeGreaterThan(40);
                expect(node.worldX).toBeLessThan(460);
                if (index) {
                    const prior = route.nodes[index - 1];
                    expect(node.worldY).toBeLessThan(prior.worldY);
                    expect(Math.hypot(node.worldX-prior.worldX, node.worldY-prior.worldY)).toBeGreaterThan(120);
                }
            });
        }
        expect(buildCartoonSpeakingRoute("book-1").isUnifiedMap).toBe(true);
        expect(buildCartoonSpeakingRoute("book-4").isUnifiedMap).toBe(true);
        expect(buildCartoonSpeakingRoute("book-1", [], { unified: false }).isUnifiedMap).toBe(false);
    });
    test.each([0, 1, 2, 3, 4, 5, 15, 25, 36, 50, 60, 100, 101])("%i lessons keep source order and expand without shrinking markers", count => {
        const lessons = Array.from({ length: count }, (_, i) => ({ id: "lesson-" + i }));
        for (let book = 1; book <= 6; book++) {
            const route = buildCartoonSpeakingRoute("book-" + book, lessons);
            expect(route.nodes.map(n => n.id)).toEqual(lessons.map(l => l.id));
            expect(route.scenes).toHaveLength(Math.max(1, Math.ceil(count / 4)));
            expect(route.markerDiameter).toBe(80);
            expect(route.markerDiameter / route.roadWidth).toBeCloseTo(2 / 3);
            const points = route.path.split(" ").map(p => p.slice(1).split(",").map(Number));
            for (const node of route.nodes) {
                expect(node.worldX).toBeGreaterThan(40);
                expect(node.worldX).toBeLessThan(route.width - 40);
                expect(node.worldY).toBeGreaterThan(130);
                expect(node.worldY).toBeLessThan(route.height - 200);
                expect(Math.min(...points.map(([x, y]) => Math.hypot(x - node.worldX, y - node.worldY)))).toBeLessThan(.001);
            }
            route.nodes.slice(1).forEach((node, i) => {
                const previous = route.nodes[i];
                expect(node.worldY).toBeLessThan(previous.worldY);
                expect(node.distance).toBeGreaterThan(previous.distance);
                expect(Math.hypot(node.worldX - previous.worldX, node.worldY - previous.worldY)).toBeGreaterThan(120);
            });
            route.scenes.slice(1).forEach((scene, i) => {
                expect(scene.top).toBe(route.scenes[i].top + route.scenes[i].height - scene.overlap);
            });
        }
    });
    test("each Workbook has its own two assets and a traced road; unknown IDs remain usable", () => {
        expect(new Set(SPEAKING_BOOK_THEMES.map(t => t.id)).size).toBe(6);
        for (let book = 1; book <= 6; book++) {
            const route = buildCartoonSpeakingRoute("book-" + book, Array.from({ length: 50 }, (_, id) => ({ id })));
            expect(new Set(route.scenes.map(s => s.asset))).toEqual(new Set(["unified-" + route.theme.id + "-a", "unified-" + route.theme.id + "-b"]));
            expect(route.paintedRoad).toBe(true);
            expect(route.isCartoon).toBe(true);
        }
        expect(getSpeakingBookTheme("unknown")).toEqual(SPEAKING_BOOK_THEMES[0]);
    });
});
