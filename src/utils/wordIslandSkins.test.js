import { BASE_SKINS, SEASONAL_SKINS, seasonalSkinAt, skinForIsland } from "./wordIslandSkins";

const day = value => new Date(`${value}T12:00:00`);

test("every skin has an image and a unique id", () => {
    const all = [...BASE_SKINS, ...SEASONAL_SKINS];
    expect(new Set(all.map(skin => skin.id)).size).toBe(all.length);
    expect(all.every(skin => Boolean(skin.image) && Boolean(skin.name))).toBe(true);
    expect(BASE_SKINS).toHaveLength(7);
    expect(SEASONAL_SKINS).toHaveLength(6);
});

test("islands rotate through the seven base skins on an ordinary day", () => {
    const ordinary = day("2026-11-15");
    expect(seasonalSkinAt(ordinary)).toBeNull();
    expect(skinForIsland(0, { date: ordinary }).id).toBe("grass");
    expect(skinForIsland(6, { date: ordinary }).id).toBe("sky");
    expect(skinForIsland(7, { date: ordinary }).id).toBe("grass");
});

test("yearly holidays switch on and off at the right days, including across new year", () => {
    expect(seasonalSkinAt(day("2026-11-30"))).toBeNull();
    expect(seasonalSkinAt(day("2026-12-01")).id).toBe("christmas");
    expect(seasonalSkinAt(day("2026-12-26")).id).toBe("christmas");
    expect(seasonalSkinAt(day("2026-12-27")).id).toBe("newyear");
    expect(seasonalSkinAt(day("2027-01-03")).id).toBe("newyear");
    expect(seasonalSkinAt(day("2027-01-04"))).toBeNull();
    expect(seasonalSkinAt(day("2026-02-10")).id).toBe("valentine");
    // 兩個節日重疊時，排在前面的春節優先（2027 年春節期間涵蓋 2/14）。
    expect(seasonalSkinAt(day("2027-02-14")).id).toBe("cny");
    expect(seasonalSkinAt(day("2026-10-19"))).toBeNull();
    expect(seasonalSkinAt(day("2026-10-31")).id).toBe("halloween");
});

test("lunar holidays use the listed dates for their year", () => {
    expect(seasonalSkinAt(day("2026-09-25")).id).toBe("midautumn");
    expect(seasonalSkinAt(day("2027-09-12")).id).toBe("midautumn");
    expect(seasonalSkinAt(day("2027-02-06")).id).toBe("cny");
    expect(seasonalSkinAt(day("2027-02-21"))).toBeNull();
});

test("during a holiday every island wears the holiday skin, and ?skin= can force any skin", () => {
    const christmas = day("2026-12-10");
    expect([0, 3, 6].map(index => skinForIsland(index, { date: christmas }).id)).toEqual(["christmas", "christmas", "christmas"]);
    expect(skinForIsland(0, { date: day("2026-11-15"), override: "halloween" }).id).toBe("halloween");
    expect(skinForIsland(2, { date: day("2026-11-15"), override: "nope" }).id).toBe("forest");
});
