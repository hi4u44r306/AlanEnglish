import { buildSpeakingAdventureRoute } from "./speakingAdventureMap";

it("positions ordered markers along the measured painted-road centreline", () => {
    const items = [{ id: 14 }, { id: 20 }, { id: 21 }, { id: 22 }];
    const route = buildSpeakingAdventureRoute("book-1", items);
    expect(route.nodes.map(node => node.id)).toEqual(items.map(item => item.id));
    expect(route.nodes.map(node => node.y)).toEqual([...route.nodes.map(node => node.y)].sort((a, b) => a - b));
    expect(route.nodes.every(node => node.x >= 29 && node.x <= 63)).toBe(true);
    expect(route.nodes.every(node => node.xMobile >= 12 && node.xMobile <= 88)).toBe(true);
    expect(route.nodes.every(node => node.y >= 9 && node.y <= 95)).toBe(true);
    expect(route).not.toHaveProperty("path");
    expect(route.aspectRatio).toBe("793 / 1983");
    expect(buildSpeakingAdventureRoute("book-1", items)).toEqual(route);
});

it("distributes all 25 levels across the complete road by travelled distance", () => {
    const route = buildSpeakingAdventureRoute("book-1", Array.from({ length: 25 }, (_, id) => ({ id })));
    expect(route.nodes[0].zone).toBe("grassland");
    expect(route.nodes.at(-1).zone).toBe("volcano");
    expect(route.nodes).toHaveLength(25);
    expect(route.nodes[0]).toMatchObject({ x: 45, xMobile: 40.99, y: 9 });
    expect(route.nodes[12]).toMatchObject({ x: 45.15, xMobile: 41.26, y: 51.15 });
    expect(route.nodes.at(-1)).toMatchObject({ x: 51, xMobile: 51.8, y: 94.5 });
    expect(route.nodes.slice(1).every((node, index) => node.y > route.nodes[index].y)).toBe(true);
    expect(Math.max(...route.nodes.map(node => node.x)) - Math.min(...route.nodes.map(node => node.x))).toBeGreaterThan(25);
    expect(route.nodes.every(node => Math.abs(node.xMobile - ((node.x * 7.93 - 176.5) / 4.4)) < .02)).toBe(true);
});
