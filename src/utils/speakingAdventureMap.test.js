import { buildSpeakingAdventureRoute } from "./speakingAdventureMap";

it("中間插關與尾端加關會延長地圖，既有節點位置不會重新隨機", () => {
    const original = buildSpeakingAdventureRoute("book-1", [{ id: 14 }, { id: 21 }, { id: 22 }]);
    const inserted = buildSpeakingAdventureRoute("book-1", [{ id: 14 }, { id: 20 }, { id: 21 }, { id: 22 }]);
    const appended = buildSpeakingAdventureRoute("book-1", [{ id: 14 }, { id: 20 }, { id: 21 }, { id: 22 }, { id: 99 }]);

    expect(inserted.nodes.map(node => node.id)).toEqual([14, 20, 21, 22]);
    expect(inserted.nodes[2].x).toBe(original.nodes[1].x);
    expect(inserted.nodes[2].y - original.nodes[1].y).toBe(184);
    expect(inserted.height - original.height).toBe(184);
    expect(appended.height - inserted.height).toBe(184);
    expect(buildSpeakingAdventureRoute("book-1", [{ id: 14 }, { id: 20 }, { id: 21 }, { id: 22 }])).toEqual(inserted);
});
