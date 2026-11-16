import { BASE_SKINS, CENTER_TILE, SEASONAL_SKINS, TERRAIN_TILES, baseSkinFor, fusedImageFor, fusedSkinFor, seasonalSkinAt, skinForClaim, skinForIsland, tileArtFor, tileImageFor } from "./wordIslandSkins";

const day = value => new Date(`${value}T12:00:00`);

test("every skin has a unique id, a name and only terrains that have tile art", () => {
    const all = [...BASE_SKINS, ...SEASONAL_SKINS];
    expect(new Set(all.map(skin => skin.id)).size).toBe(all.length);
    expect(all.every(skin => Boolean(skin.name) && skin.terrains.every(terrain => TERRAIN_TILES[terrain]))).toBe(true);
    expect(BASE_SKINS).toHaveLength(4);
    expect(SEASONAL_SKINS).toHaveLength(6);
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

test("lunar holidays use the listed dates for their year (checked against several web sources)", () => {
    expect(seasonalSkinAt(day("2027-02-06")).id).toBe("cny");
    expect(seasonalSkinAt(day("2027-02-21"))).toBeNull();
    // 春節初一：每年一個日期，區間是前 4 天到元宵節。
    ["2028-01-26", "2029-02-13", "2030-02-03", "2031-01-23", "2032-02-11", "2033-01-31", "2034-02-19", "2035-02-08"].forEach(first => {
        expect(seasonalSkinAt(day(first)).id).toBe("cny");
    });
    expect(seasonalSkinAt(day("2029-02-27")).id).toBe("cny"); // 元宵節
    expect(seasonalSkinAt(day("2029-02-28"))).toBeNull();
    // 中秋節：八月十五。
    ["2026-09-25", "2027-09-15", "2028-10-03", "2029-09-22", "2030-09-12", "2031-10-01", "2032-09-19", "2033-09-08", "2034-09-27", "2035-09-16"].forEach(mid => {
        expect(seasonalSkinAt(day(mid)).id).toBe("midautumn");
    });
    expect(seasonalSkinAt(day("2026-09-21"))).toBeNull();
    expect(seasonalSkinAt(day("2026-09-28"))).toBeNull();
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

test("tile art goes plain -> decorated; the center tile is the one big flag; every theme has a fused island picture", () => {
    const art = { terrain: "grass", deco: "grass-tree" };
    expect(tileImageFor(art, 0)).toMatchObject({ gold: false });
    expect(tileImageFor(art, 0).src).toMatch(/tile-grass-plain\.webp$/);
    expect(tileImageFor(art, 1)).toMatchObject({ gold: true });
    expect(tileImageFor(art, 1).src).toMatch(/tile-grass-tree\.webp$/);
    expect(tileImageFor(art, 1, { center: true }).src).toMatch(/tile-grass-flag\.webp$/);
    expect(CENTER_TILE).toBe(9);
    expect(BASE_SKINS.every(skin => /island-hd-.*\.webp$/.test(fusedImageFor(skin)))).toBe(true);
    expect(SEASONAL_SKINS.every(skin => /island-hd-.*\.webp$/.test(fusedImageFor(skin)))).toBe(true);
});

// 每塊地依「哪天佔領」決定樣子；融合看多數。時間用台北時間判斷（UTC 16:00 = 台北隔天 00:00）。
test("each tile looks like the day it was claimed: a holiday claim is a holiday tile, other days are the island's own terrain", () => {
    expect(baseSkinFor(1).id).toBe("sand");
    expect(skinForClaim(1, "2026-11-02T04:00:00.000Z").id).toBe("sand");
    expect(skinForClaim(1, "2026-09-25T04:00:00.000Z").id).toBe("midautumn");
    expect(skinForClaim(1, null).id).toBe("sand");
    // 台北 12/1 00:30 = UTC 11/30 16:30：已經是聖誕節。
    expect(skinForClaim(0, "2026-11-30T16:30:00.000Z").id).toBe("christmas");
    expect(skinForClaim(0, "2026-11-30T15:30:00.000Z").id).toBe("grass");
    expect(skinForClaim(0, "2026-03-01T04:00:00.000Z", { override: "halloween" }).id).toBe("halloween");
});

test("a fused island follows the majority of its tiles; ties go to the holiday; holiday tiles are counted", () => {
    const normal = "2026-11-02T04:00:00.000Z";
    const mid = "2026-09-25T04:00:00.000Z";
    // 15 塊平常日 + 1 塊中秋：一般島，但記得有 1 塊中秋地塊。
    const mostly = fusedSkinFor(1, [...Array(15).fill(normal), mid]);
    expect(mostly.skin.id).toBe("sand");
    expect(mostly.holidayCounts.map(entry => [entry.skin.id, entry.n])).toEqual([["midautumn", 1]]);
    // 9 塊中秋 + 7 塊平常日：中秋島。
    expect(fusedSkinFor(1, [...Array(7).fill(normal), ...Array(9).fill(mid)]).skin.id).toBe("midautumn");
    // 8 比 8：節日優先。
    expect(fusedSkinFor(1, [...Array(8).fill(normal), ...Array(8).fill(mid)]).skin.id).toBe("midautumn");
    // 全部平常日：一般島、沒有節日地塊。
    const plain = fusedSkinFor(2, Array(16).fill(normal));
    expect(plain.skin.id).toBe("forest");
    expect(plain.holidayCounts).toEqual([]);
});

test("every skin has tile art for its terrains, including the mid-autumn set", () => {
    expect(TERRAIN_TILES.midautumn).toHaveLength(5);
    expect(tileArtFor(SEASONAL_SKINS.find(skin => skin.id === "midautumn"), 0).every(item => item.terrain === "midautumn")).toBe(true);
});
