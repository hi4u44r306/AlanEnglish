import { buildSpeakingAdventureRoute } from "./speakingAdventureMap";

it("positions ordered markers on one painted adventure trail", () => {
    const items = [{ id: 14 }, { id: 20 }, { id: 21 }, { id: 22 }];
    const route = buildSpeakingAdventureRoute("book-1", items);
    expect(route.nodes.map(node => node.id)).toEqual(items.map(item => item.id));
    expect(route.nodes.map(node => node.y)).toEqual([...route.nodes.map(node => node.y)].sort((a, b) => a - b));
    expect(route.nodes.every(node => node.x >= 34 && node.x <= 60)).toBe(true);
    expect(route.nodes.every(node => node.xMobile >= 12 && node.xMobile <= 88)).toBe(true);
    expect(route.nodes.every(node => node.y >= 9 && node.y <= 89)).toBe(true);
    expect(route).not.toHaveProperty("path");
    expect(route.aspectRatio).toBe("793 / 1983");
    expect(buildSpeakingAdventureRoute("book-1", items)).toEqual(route);
});

it("scales the same complete map when all 25 levels are published", () => {
    const route = buildSpeakingAdventureRoute("book-1", Array.from({ length: 25 }, (_, id) => ({ id })));
    expect(route.nodes[0].zone).toBe("grassland");
    expect(route.nodes.at(-1).zone).toBe("volcano");
    expect(route.nodes).toHaveLength(25);
    expect(route.nodes[0]).toMatchObject({ x: 43, xMobile: 35.39, y: 9.5 });
    expect(route.nodes.at(-1)).toMatchObject({ x: 51, xMobile: 52.09, y: 89 });
    expect(route.nodes.slice(1).every((node, index) => node.y > route.nodes[index].y)).toBe(true);
});
