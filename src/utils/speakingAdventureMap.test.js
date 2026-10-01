import { buildSpeakingAdventureRoute, distributeSpeakingLevels } from "./speakingAdventureMap";

it("places Workbook 1 from the bottom flag to the castle", () => {
    const items = Array.from({ length: 25 }, (_, id) => ({ id }));
    const route = buildSpeakingAdventureRoute("book-1", items);

    expect(route.rowCounts).toEqual([4, 3, 4, 3, 4, 3, 4]);
    expect(route.nodes).toHaveLength(25);
    expect(route.nodes.map(node => node.y)).toEqual([...route.nodes.map(node => node.y)].sort((a, b) => b - a));
    expect(route.nodes.every(node => node.xMobile === node.x)).toBe(true);
    expect(route.nodes[0]).toMatchObject({ x: 14.35, y: 94.2, row: 1, zone: "grassland" });
    expect(route.nodes.at(-1)).toMatchObject({ x: 87.67, y: 5.08, row: 7, zone: "volcano" });
    expect(route.aspectRatio).toBe("941 / 1672");
    expect(route.startsAtBottom).toBe(true);
});

it("balances other workbook totals without leaving a sparse last row", () => {
    expect(distributeSpeakingLevels(30)).toEqual([5, 4, 4, 4, 4, 4, 5]);
    expect(distributeSpeakingLevels(35)).toEqual([5, 5, 5, 5, 5, 5, 5]);
    expect(distributeSpeakingLevels(36)).toEqual([5, 5, 5, 6, 5, 5, 5]);
    expect(distributeSpeakingLevels(0)).toEqual([]);
});

it("keeps every marker inside the responsive illustrated map safe area", () => {
    const route = buildSpeakingAdventureRoute("book-3", Array.from({ length: 36 }, (_, id) => ({ id })));
    expect(route.nodes.every(node => node.x >= 14 && node.x <= 88)).toBe(true);
    expect(route.nodes.every(node => node.y >= 5 && node.y <= 95)).toBe(true);
    expect(new Set(route.nodes.map(node => `${node.x}:${node.y}`)).size).toBe(36);
    expect(route.nodes.every(node => node.row >= 1 && node.row <= 7)).toBe(true);
});
