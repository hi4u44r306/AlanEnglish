import { buildSpeakingAdventureRoute, distributeSpeakingLevels } from "./speakingAdventureMap";

it("places Workbook 1 from the bottom flag to the castle", () => {
    const items = Array.from({ length: 25 }, (_, id) => ({ id }));
    const route = buildSpeakingAdventureRoute("book-1", items);

    expect(route.rowCounts).toEqual([4, 3, 4, 3, 4, 3, 4]);
    expect(route.nodes).toHaveLength(25);
    expect(route.nodes.map(node => node.y)).toEqual([...route.nodes.map(node => node.y)].sort((a, b) => b - a));
    expect(route.nodes.every(node => node.xMobile === node.x)).toBe(true);
    expect(route.nodes[0]).toMatchObject({ x: 17.71, y: 94.65, row: 1, zone: "grassland" });
    expect(route.nodes.at(-1)).toMatchObject({ x: 80.77, y: 6.88, row: 7, zone: "volcano" });
    expect(route.aspectRatio).toBe("941 / 1672");
    expect(route.startsAtBottom).toBe(true);
});

it("keeps the approved road centres with the first level moved clear of the flag", () => {
    const route = buildSpeakingAdventureRoute("book-1", Array.from({ length: 25 }, (_, id) => ({ id })));
    // Approved preview measurements, with the first centre advanced along the road.
    expect(route.nodes.map(({ x, y }) => [x, y])).toEqual([
        [17.71, 94.65], [29.64, 92.91], [44.32, 89.7], [59.3, 86.94], [72.99, 82.76],
        [69.93, 75.38], [55.82, 71.45], [43.03, 66.61], [54.47, 61.52], [69.67, 59.16],
        [82.05, 54.41], [71.25, 49], [56.37, 46.09], [44.76, 40.95], [56.94, 35.87],
        [71.89, 33.08], [83.94, 28.44], [69.94, 25.13], [55.03, 22.25], [39.62, 20.42],
        [24.65, 18.15], [36.12, 14.31], [51.72, 13.04], [67.12, 11.14], [80.77, 6.88]
    ]);
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
