import { buildSpeakingAdventureRoute } from "./speakingAdventureMap";

it("positions ordered markers on one painted adventure trail", () => {
    const items = [{ id: 14 }, { id: 20 }, { id: 21 }, { id: 22 }];
    const route = buildSpeakingAdventureRoute("book-1", items);
    expect(route.nodes.map(node => node.id)).toEqual(items.map(item => item.id));
    expect(route.nodes.map(node => node.y)).toEqual([...route.nodes.map(node => node.y)].sort((a, b) => a - b));
    expect(route.nodes.every(node => node.x >= 300 && node.x <= 650)).toBe(true);
    expect(route).not.toHaveProperty("path");
    expect(route.height).toBe(1200);
    expect(buildSpeakingAdventureRoute("book-1", items)).toEqual(route);
});

it("scales the same complete map when many levels are published", () => {
    const route = buildSpeakingAdventureRoute("book-1", Array.from({ length: 20 }, (_, id) => ({ id })));
    expect(route.height).toBe(1760);
    expect(route.nodes[0].zone).toBe("grassland");
    expect(route.nodes.at(-1).zone).toBe("volcano");
});
