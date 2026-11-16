// 單字島造型：每座島是 16 塊六角地塊拼成。
// 一般島依編號輪流換主題（草原／沙灘／森林／冰雪）；
// 節日期間「完成」的島，會永遠是那個節日的限定島，夾在一般島之間（不是節日一到全部都換）。
// 造型只是畫面，不影響答題，不需要後端；日期由程式依下表自動判斷。
// 圖放在 public/island-art/，網址用 PUBLIC_URL，所以測試與 build 都不需要另外處理圖檔。
export const ART_BASE = `${process.env.PUBLIC_URL || ""}/island-art`;

// 每種地形可用的地塊（第一個一定是空地）。名稱對應 public/island-art/tile-<名稱>.webp。
export const TERRAIN_TILES = {
    grass: ["grass-plain", "grass-tree", "grass-flowers", "grass-cabin"],
    sand: ["sand-plain", "sand-palm", "sand-shells", "sand-umbrella", "sand-castle"],
    forest: ["forest-plain", "forest-pine", "forest-mushroom", "forest-rock", "forest-camp"],
    snow: ["snow-plain", "snow-pine", "snow-snowman", "snow-igloo", "snow-penguin"],
    xmas: ["xmas-plain", "xmas-tree", "xmas-gift", "xmas-snowman", "xmas-candy"],
    hallo: ["hallo-plain", "hallo-pumpkin", "hallo-ghost", "hallo-tree", "hallo-cauldron"],
    cny: ["cny-plain", "cny-lantern", "cny-ingot", "cny-cracker", "cny-lion"],
    midautumn: ["midautumn-plain", "midautumn-lantern", "midautumn-rabbit", "midautumn-pavilion", "midautumn-pond"],
    love: ["love-plain", "love-heart", "love-rose", "love-balloon", "love-choco"]
};

// 整座島升滿後融合成的完整島圖：四種一般主題在這裡；節日主題的圖寫在各自的 fused 欄位。
export const FUSED_ISLANDS = {
    grass: `${ART_BASE}/island-hd-grass.webp`,
    sand: `${ART_BASE}/island-hd-sand.webp`,
    forest: `${ART_BASE}/island-hd-forest.webp`,
    snow: `${ART_BASE}/island-hd-snow.webp`
};
export const fusedImageFor = skin => (skin.fused ? `${ART_BASE}/${skin.fused}` : FUSED_ISLANDS[skin.id] || null);

// 徽章（ChatGPT 生成，現代手遊風）。star：單塊升級；silver：升級過半；island：全島佔領；crown：完全升級；gem：複習完成。
export const BADGES = {
    star: `${ART_BASE}/badge2-star.webp`,
    silver: `${ART_BASE}/badge2-silver.webp`,
    island: `${ART_BASE}/badge2-island.webp`,
    crown: `${ART_BASE}/badge2-crown.webp`,
    gem: `${ART_BASE}/badge2-gem.webp`
};

// 一般造型（依島的編號輪流）。
export const BASE_SKINS = [
    { id: "grass", name: "草原島", terrains: ["grass"] },
    { id: "sand", name: "沙灘島", terrains: ["sand"] },
    { id: "forest", name: "森林島", terrains: ["forest"] },
    { id: "snow", name: "冰雪島", terrains: ["snow"] }
];

// 節日限定造型。windows：每年重複的日期區間（月-日，含頭尾，可跨年）；
// lunar：農曆節日每年日期不同，直接列出各年的日期區間（YYYY-MM-DD，含頭尾）。
// 春節日期（初一）：2027/2/6、2028/1/26、2029/2/13、2030/2/3、2031/1/23、2032/2/11、2033/1/31、2034/2/19、2035/2/8，
// 區間＝初一前 4 天（除夕前夕）到元宵節（初一後 14 天）；中秋節（八月十五）：2026/9/25、2027/9/15、2028/10/3、2029/9/22、2030/9/12、2031/10/1、2032/9/19、2033/9/8、2034/9/27、2035/9/16，
// 區間＝前 3 天到後 2 天。日期 2026-11-16 查自多個網路來源互相對照；到 2035 年之後要再補。
// fused：這個節日的融合島圖（放 public/island-art/）。節日的島在地塊階段用 terrains 的地塊、升滿後換成 fused。
export const SEASONAL_SKINS = [
    { id: "christmas", name: "聖誕島", label: "聖誕限定", terrains: ["xmas"], fused: "island-hd-xmas.webp", windows: [{ from: "12-01", to: "12-26" }] },
    { id: "newyear", name: "新年島", label: "新年限定", terrains: ["xmas"], fused: "island-hd-xmas.webp", windows: [{ from: "12-27", to: "01-03" }] },
    { id: "cny", name: "春節島", label: "春節限定", terrains: ["cny"], fused: "island-hd-cny.webp", lunar: [["2027-02-02", "2027-02-20"], ["2028-01-22", "2028-02-09"], ["2029-02-09", "2029-02-27"], ["2030-01-30", "2030-02-17"], ["2031-01-19", "2031-02-06"], ["2032-02-07", "2032-02-25"], ["2033-01-27", "2033-02-14"], ["2034-02-15", "2034-03-05"], ["2035-02-04", "2035-02-22"]] },
    { id: "valentine", name: "情人節島", label: "情人節限定", terrains: ["love"], fused: "island-hd-love.webp", windows: [{ from: "02-07", to: "02-14" }] },
    { id: "halloween", name: "萬聖島", label: "萬聖節限定", terrains: ["hallo"], fused: "island-hd-hallo.webp", windows: [{ from: "10-20", to: "10-31" }] },
    { id: "midautumn", name: "中秋島", label: "中秋限定", terrains: ["midautumn"], fused: "island-hd-midautumn.webp", lunar: [["2026-09-22", "2026-09-27"], ["2027-09-12", "2027-09-17"], ["2028-09-30", "2028-10-05"], ["2029-09-19", "2029-09-24"], ["2030-09-09", "2030-09-14"], ["2031-09-28", "2031-10-03"], ["2032-09-16", "2032-09-21"], ["2033-09-05", "2033-09-10"], ["2034-09-24", "2034-09-29"], ["2035-09-13", "2035-09-18"]] }
];

const SKIN_BY_ID = new Map([...BASE_SKINS, ...SEASONAL_SKINS].map(skin => [skin.id, skin]));

const pad = value => String(value).padStart(2, "0");
const dateKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// 這個日期落在哪個節日造型？沒有就回傳 null。
export function seasonalSkinAt(date = new Date()) {
    const key = dateKey(date);
    const monthDay = key.slice(5);
    for (const skin of SEASONAL_SKINS) {
        const yearly = (skin.windows || []).some(({ from, to }) => (from <= to ? monthDay >= from && monthDay <= to : monthDay >= from || monthDay <= to));
        const lunar = (skin.lunar || []).some(([from, to]) => key >= from && key <= to);
        if (yearly || lunar) return skin;
    }
    return null;
}

// 第 index 座島的造型：
//   * 已完成的島：完成那天若是節日，就永遠是那個節日的限定島；否則依編號輪流的一般造型。
//   * 還沒完成的島：節日期間先預覽成節日造型，完成時是不是節日才算數。
// override 只給預覽用（網址 ?skin=christmas）。
export function skinForIsland(index, { completedAt = null, date = new Date(), override = "" } = {}) {
    const forced = override ? SKIN_BY_ID.get(override) : null;
    if (forced) return forced;
    const when = completedAt ? new Date(completedAt) : date;
    return seasonalSkinAt(when) || BASE_SKINS[index % BASE_SKINS.length];
}

export const isSeasonal = skin => SEASONAL_SKINS.some(item => item.id === skin.id);

// 台北時間的日期（YYYY-MM-DD）。節日用「台北的那一天」判斷，不受裝置時區影響。
const taipeiDay = iso => new Date(Date.parse(iso) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
const dateOfDay = day => new Date(`${day}T12:00:00`);

// 一般島的造型（依島的編號輪流）。
export const baseSkinFor = index => BASE_SKINS[index % BASE_SKINS.length];

// 一塊地的樣子：哪天佔領的就長那天的樣子——節日當天佔領的是節日地塊，其他日子是這座島的一般地塊。
// override 只給預覽用（網址 ?skin=christmas 讓全部地塊都用同一種）。
export function skinForClaim(index, claimedAt, { override = "" } = {}) {
    const forced = override ? SKIN_BY_ID.get(override) : null;
    if (forced) return forced;
    if (!claimedAt || !Number.isFinite(Date.parse(claimedAt))) return baseSkinFor(index);
    return seasonalSkinAt(dateOfDay(taipeiDay(claimedAt))) || baseSkinFor(index);
}

// 整座島融合成哪一張圖：看哪一種樣子的地塊最多（一般島算一種）；一樣多時節日優先。
// 回傳 { skin, holidayCounts }，holidayCounts 是各節日地塊的數量（沒有就是空陣列），畫面用來標「含 N 塊中秋限定地塊」。
export function fusedSkinFor(index, claimedAtList, { override = "" } = {}) {
    const counts = new Map();
    const base = baseSkinFor(index);
    claimedAtList.forEach(claimedAt => {
        const skin = skinForClaim(index, claimedAt, { override });
        const entry = counts.get(skin.id) || { skin, n: 0, latest: 0 };
        entry.n += 1;
        entry.latest = Math.max(entry.latest, Date.parse(claimedAt) || 0);
        counts.set(skin.id, entry);
    });
    const ranked = [...counts.values()].sort((a, b) => b.n - a.n || Number(isSeasonal(b.skin)) - Number(isSeasonal(a.skin)) || b.latest - a.latest);
    const skin = ranked[0]?.skin || base;
    const holidayCounts = ranked.filter(entry => isSeasonal(entry.skin)).map(entry => ({ skin: entry.skin, n: entry.n }));
    return { skin, holidayCounts };
}

// 簡單的可重現亂數：同一座島每次打開都是一樣的排列。
const hashSeed = text => {
    let value = 2166136261;
    for (let i = 0; i < text.length; i += 1) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
    return value || 1;
};
const makeRandom = seed => () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
};

export const CENTER_TILE = 9; // 正中間那一格插唯一的一面大旗

// 16 塊地塊各自的地形與裝飾：整座島是同一種地形；每塊都有一個裝飾（升級時才看得到），同一種裝飾盡量平均出現。
// 回傳 [{ terrain, deco }]，deco 是 TERRAIN_TILES 裡的名稱（不含空地）。
export function tileArtFor(skin, islandIndex, size = 16) {
    const random = makeRandom(hashSeed(`${skin.id}:${islandIndex}`));
    const shuffle = list => {
        for (let i = list.length - 1; i > 0; i -= 1) {
            const j = Math.floor(random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    };
    const decos = [];
    skin.terrains.forEach(terrain => TERRAIN_TILES[terrain].filter(name => !name.endsWith("-plain")).forEach(name => decos.push({ terrain, deco: name })));
    const deck = [];
    while (deck.length < size) deck.push(...shuffle([...decos]));
    return shuffle(deck.slice(0, size));
}

// 這塊地塊現在該用哪張圖：等級 0 剛佔領（空地）、等級 1 繁榮（有裝飾，並加金色光暈）。正中間那一塊升級後是唯一的一面大旗。
export function tileImageFor(art, level, { center = false } = {}) {
    const plain = TERRAIN_TILES[art.terrain][0];
    if (level <= 0) return { src: `${ART_BASE}/tile-${plain}.webp`, gold: false };
    const name = center ? "grass-flag" : art.deco;
    return { src: `${ART_BASE}/tile-${name}.webp`, gold: true };
}

// 還沒佔領的格子：沉在海底的空地輪廓。
export const ghostImageFor = art => `${ART_BASE}/tile-${TERRAIN_TILES[art.terrain][0]}.webp`;
