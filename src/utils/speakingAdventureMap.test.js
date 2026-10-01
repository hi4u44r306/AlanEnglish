import { buildSpeakingAdventureRoute, distributeSpeakingLevels } from "./speakingAdventureMap";

it("places Workbook 1 levels along the shared storybook road centreline", () => {
    const items = Array.from({ length: 25 }, (_, id) => ({ id }));
    const route = buildSpeakingAdventureRoute("book-1", items);

    expect(route.rowCounts).toEqual([4, 3, 4, 3, 4, 3, 4]);
    expect(route.nodes).toHaveLength(25);
    expect(route.nodes.map(node => node.y)).toEqual([...route.nodes.map(node => node.y)].sort((a, b) => a - b));
    expect(route.nodes.every(node => node.xMobile === node.x)).toBe(true);
    expect(route.nodes[0]).toMatchObject({ x: 14, y: 7.83, row: 1, zone: "grassland" });
    expect(route.nodes.at(-1)).toMatchObject({ x: 18, y: 96, row: 7, zone: "volcano" });
    expect(route.aspectRatio).toBe("1000 / 6000");
});

it("balances other workbook totals without leaving a sparse last row", () => {
    expect(distributeSpeakingLevels(30)).toEqual([5, 4, 4, 4, 4, 4, 5]);
    expect(distributeSpeakingLevels(35)).toEqual([5, 5, 5, 5, 5, 5, 5]);
    expect(distributeSpeakingLevels(36)).toEqual([5, 5, 5, 6, 5, 5, 5]);
    expect(distributeSpeakingLevels(0)).toEqual([]);
});

it("keeps every marker inside the responsive vector map safe area", () => {
    const route = buildSpeakingAdventureRoute("book-3", Array.from({ length: 36 }, (_, id) => ({ id })));
    expect(route.nodes.every(node => node.x >= 14 && node.x <= 86)).toBe(true);
    expect(route.nodes.every(node => node.y >= 7.83 && node.y <= 96)).toBe(true);
    expect(new Set(route.nodes.map(node => `${node.x}:${node.y}`)).size).toBe(36);
    expect(route.nodes.every(node => node.row >= 1 && node.row <= 7)).toBe(true);
});
