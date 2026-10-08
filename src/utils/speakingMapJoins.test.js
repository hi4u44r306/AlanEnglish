import { buildCartoonSpeakingRoute } from "./speakingCartoonMap";
import traces from "./speakingMapJoinTraces.json";

describe("repaired painted road joins", () => {
    test.each([[1, 25], [2, 35], [3, 36], [4, 30], [5, 35], [6, 33]])(
        "Workbook %i keeps every lesson and circles within the repaired road (%i lessons)", (book, count) => {
            const lessons = Array.from({ length: count }, (_, id) => ({ id: `lesson-${id}` }));
            const route = buildCartoonSpeakingRoute(`book-${book}`, lessons);
            expect(route.nodes.map(n => n.id)).toEqual(lessons.map(l => l.id));
            expect(route.joins).toHaveLength(route.scenes.length - 1);
            expect(new Set(route.joins.map(s => s.variant))).toEqual(new Set(["a", "b"]));
            expect(route.height).toBe(route.scenes.length * 900 + 100);
            let repairedNodes = 0;
            for (const join of route.joins) {
                expect(join.top).toBeGreaterThan(0);
                expect(join.top + join.height).toBeLessThan(route.height);
                const rows = traces[`${join.biome}-${join.variant}`];
                for (const node of route.nodes.filter(n => n.worldY >= join.top && n.worldY <= join.top + join.height)) {
                    repairedNodes++;
                    const y = node.worldY - join.top;
                    const index = Math.min(rows.length - 2, Math.floor(y / 5));
                    const a = rows[index], b = rows[index + 1], fraction = (y - a[1]) / (b[1] - a[1]);
                    const left = a[2] + (b[2] - a[2]) * fraction;
                    const right = a[3] + (b[3] - a[3]) * fraction;
                    const slope = (b[0] - a[0]) / (b[1] - a[1]);
                    const clearance = Math.min(node.worldX - left, right - node.worldX) / Math.hypot(1, slope);
                    // Compare to independently sampled asset edges, not the SVG path.
                    expect(clearance).toBeGreaterThanOrEqual(route.markerDiameter / 2 + 5.9);
                }
            }
            expect(repairedNodes).toBeGreaterThan(0);
        }
    );

    test.each([0, 1, 4])("%i lessons have no unnecessary seam asset", count => {
        const route = buildCartoonSpeakingRoute("book-1", Array.from({ length: count }, (_, id) => ({ id })));
        expect(route.joins).toEqual([]);
        expect(route.path).not.toMatch(/NaN|Infinity/);
    });
});
