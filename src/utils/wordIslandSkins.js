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
    love: ["love-plain", "love-heart", "love-rose", "love-balloon", "love-choco"]
};

// 整座島升滿後融合成的完整島圖（只有四種一般主題有；節日主題暫時沒有，升滿時維持地塊畫面）。
export const FUSED_ISLANDS = {
    grass: `${ART_BASE}/island-hd-grass.webp`,
    sand: `${ART_BASE}/island-hd-sand.webp`,
    forest: `${ART_BASE}/island-hd-forest.webp`,
    snow: `${ART_BASE}/island-hd-snow.webp`
};
export const fusedImageFor = skin => FUSED_ISLANDS[skin.id] || null;

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
// lunar：農曆節日每年日期不同，直接列出各年的日期區間（YYYY-MM-DD，含頭尾），每年要補。
// 中秋節的圖還沒有，補圖後再加進來。
export const SEASONAL_SKINS = [
    { id: "christmas", name: "聖誕島", label: "聖誕限定", terrains: ["xmas"], windows: [{ from: "12-01", to: "12-26" }] },
    { id: "newyear", name: "新年島", label: "新年限定", terrains: ["xmas"], windows: [{ from: "12-27", to: "01-03" }] },
    { id: "cny", name: "春節島", label: "春節限定", terrains: ["cny"], lunar: [["2027-02-02", "2027-02-20"], ["2028-01-22", "2028-02-09"]] },
    { id: "valentine", name: "情人節島", label: "情人節限定", terrains: ["love"], windows: [{ from: "02-07", to: "02-14" }] },
    { id: "halloween", name: "萬聖島", label: "萬聖節限定", terrains: ["hallo"], windows: [{ from: "10-20", to: "10-31" }] }
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
