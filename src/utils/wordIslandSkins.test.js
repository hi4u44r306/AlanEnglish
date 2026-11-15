import { BASE_SKINS, CENTER_TILE, SEASONAL_SKINS, TERRAIN_TILES, fusedImageFor, seasonalSkinAt, skinForIsland, tileArtFor, tileImageFor } from "./wordIslandSkins";

const day = value => new Date(`${value}T12:00:00`);

test("every skin has a unique id, a name and only terrains that have tile art", () => {
    const all = [...BASE_SKINS, ...SEASONAL_SKINS];
    expect(new Set(all.map(skin => skin.id)).size).toBe(all.length);
    expect(all.every(skin => Boolean(skin.name) && skin.terrains.every(terrain => TERRAIN_TILES[terrain]))).toBe(true);
    expect(BASE_SKINS).toHaveLength(4);
    expect(SEASONAL_SKINS).toHaveLength(5);
});

test("islands rotate through the base skins on an ordinary day", () => {
    const ordinary = day("2026-11-15");
    expect(seasonalSkinAt(ordinary)).toBeNull();
    expect(skinForIsland(0, { date: ordinary }).id).toBe("grass");
    expect(skinForIsland(3, { date: ordinary }).id).toBe("snow");
    expect(skinForIsland(4, { date: ordinary }).id).toBe("grass");
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
    expect(seasonalSkinAt(day("2027-02-06")).id).toBe("cny");
    expect(seasonalSkinAt(day("2027-02-21"))).toBeNull();
});

test("a holiday island is the one COMPLETED during the holiday; other islands stay ordinary", () => {
    const today = day("2026-11-15");
    // 聖誕節完成的第 2 座島，永遠是聖誕島；同一時間完成在平日的第 3 座島仍是一般造型。
    expect(skinForIsland(1, { completedAt: "2026-12-10T04:00:00.000Z", date: today }).id).toBe("christmas");
    expect(skinForIsland(2, { completedAt: "2026-11-02T04:00:00.000Z", date: today }).id).toBe("forest");
    // 還沒完成的島，節日期間先預覽成節日造型。
    expect(skinForIsland(0, { date: day("2026-12-10") }).id).toBe("christmas");
    expect(skinForIsland(0, { date: today, override: "halloween" }).id).toBe("halloween");
    expect(skinForIsland(2, { date: today, override: "nope" }).id).toBe("forest");
});

test("an island always gets the same 16 tiles, one terrain, every tile has a decoration", () => {
    const skin = BASE_SKINS[1];
    const first = tileArtFor(skin, 3);
    expect(first).toHaveLength(16);
    expect(tileArtFor(skin, 3)).toEqual(first);
    expect(tileArtFor(skin, 4)).not.toEqual(first);
    expect(first.every(item => item.deco && !item.deco.endsWith("-plain"))).toBe(true);
    expect(new Set(first.map(item => item.terrain))).toEqual(new Set(["sand"]));
    // 同一種裝飾平均出現：4 種裝飾分 16 塊，每種 4 塊上下。
    const counts = {};
    first.forEach(item => { counts[item.deco] = (counts[item.deco] || 0) + 1; });
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(4);
    expect(tileArtFor(SEASONAL_SKINS[0], 1).every(item => item.terrain === "xmas")).toBe(true);
});

test("tile art goes plain -> decorated; the center tile is the one big flag; four themes have a fused island picture", () => {
    const art = { terrain: "grass", deco: "grass-tree" };
    expect(tileImageFor(art, 0)).toMatchObject({ gold: false });
    expect(tileImageFor(art, 0).src).toMatch(/tile-grass-plain\.webp$/);
    expect(tileImageFor(art, 1)).toMatchObject({ gold: true });
    expect(tileImageFor(art, 1).src).toMatch(/tile-grass-tree\.webp$/);
    expect(tileImageFor(art, 1, { center: true }).src).toMatch(/tile-grass-flag\.webp$/);
    expect(CENTER_TILE).toBe(9);
    expect(BASE_SKINS.every(skin => /island-hd-.*\.webp$/.test(fusedImageFor(skin)))).toBe(true);
    expect(SEASONAL_SKINS.every(skin => fusedImageFor(skin) === null)).toBe(true);
});
