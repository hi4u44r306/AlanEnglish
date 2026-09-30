import { buildSpeakingAdventureRoute, distributeSpeakingLevels } from "./speakingAdventureMap";

it("balances Workbook 1 across seven alternating road rows", () => {
    const items = Array.from({ length: 25 }, (_, id) => ({ id }));
    const route = buildSpeakingAdventureRoute("book-1", items);

    expect(route.rowCounts).toEqual([4, 3, 4, 3, 4, 3, 4]);
    expect(route.nodes).toHaveLength(25);
    expect(route.nodes.slice(0, 4).map(node => node.x)).toEqual([14, 38, 62, 86]);
    expect(route.nodes.slice(4, 7).map(node => node.x)).toEqual([86, 50, 14]);
    expect(route.nodes.map(node => node.y)).toEqual([...route.nodes.map(node => node.y)].sort((a, b) => a - b));
    expect(route.nodes.every(node => node.xMobile === node.x)).toBe(true);
    expect(route.nodes[0]).toMatchObject({ x: 14, y: 10.8, row: 1, zone: "grassland" });
    expect(route.nodes.at(-1)).toMatchObject({ x: 86, y: 84.8, row: 7, zone: "volcano" });
    expect(route.aspectRatio).toBe("793 / 1983");
});

it("balances other workbook totals without leaving a sparse last row", () => {
    expect(distributeSpeakingLevels(30)).toEqual([5, 4, 4, 4, 4, 4, 5]);
    expect(distributeSpeakingLevels(35)).toEqual([5, 5, 5, 5, 5, 5, 5]);
    expect(distributeSpeakingLevels(36)).toEqual([5, 5, 5, 6, 5, 5, 5]);
    expect(distributeSpeakingLevels(0)).toEqual([]);
});

it("keeps every marker inside the horizontal road safe area", () => {
    const route = buildSpeakingAdventureRoute("book-3", Array.from({ length: 36 }, (_, id) => ({ id })));
    expect(route.nodes.every(node => node.x >= 14 && node.x <= 86)).toBe(true);
    expect(route.nodes.every(node => [10.8, 21.7, 34.1, 47.1, 59.6, 72.2, 84.8].includes(node.y))).toBe(true);
    expect(route.nodes.every(node => node.row >= 1 && node.row <= 7)).toBe(true);
});
