// 單字島造型：每座島依編號輪流換一張背景圖；遇到節日期間，所有島換成節日限定造型。
// 造型只是畫面，不影響答題、不需要後端；日期由程式依下表自動判斷，不需要人工切換。
import grass from "../assets/islands/grass.webp";
import beach from "../assets/islands/beach.webp";
import forest from "../assets/islands/forest.webp";
import snow from "../assets/islands/snow.webp";
import volcano from "../assets/islands/volcano.webp";
import candy from "../assets/islands/candy.webp";
import sky from "../assets/islands/sky.webp";
import christmas from "../assets/islands/christmas.webp";
import newyear from "../assets/islands/newyear.webp";
import cny from "../assets/islands/cny.webp";
import valentine from "../assets/islands/valentine.webp";
import halloween from "../assets/islands/halloween.webp";
import midautumn from "../assets/islands/midautumn.webp";

// 一般造型（依島的編號輪流）。
export const BASE_SKINS = [
    { id: "grass", name: "草原島", image: grass },
    { id: "beach", name: "沙灘島", image: beach },
    { id: "forest", name: "森林島", image: forest },
    { id: "snow", name: "冰雪島", image: snow },
    { id: "volcano", name: "火山島", image: volcano },
    { id: "candy", name: "糖果島", image: candy },
    { id: "sky", name: "星空島", image: sky }
];

// 節日限定造型。windows：每年重複的日期區間（月-日，含頭尾，可跨年）；
// lunar：農曆節日每年日期不同，直接列出各年的日期區間（YYYY-MM-DD，含頭尾），每年要補。
export const SEASONAL_SKINS = [
    { id: "christmas", name: "聖誕島", label: "聖誕限定", image: christmas, windows: [{ from: "12-01", to: "12-26" }] },
    { id: "newyear", name: "新年島", label: "新年限定", image: newyear, windows: [{ from: "12-27", to: "01-03" }] },
    { id: "cny", name: "春節島", label: "春節限定", image: cny, lunar: [["2027-02-02", "2027-02-20"], ["2028-01-22", "2028-02-09"]] },
    { id: "valentine", name: "情人節島", label: "情人節限定", image: valentine, windows: [{ from: "02-07", to: "02-14" }] },
    { id: "halloween", name: "萬聖島", label: "萬聖節限定", image: halloween, windows: [{ from: "10-20", to: "10-31" }] },
    { id: "midautumn", name: "中秋島", label: "中秋限定", image: midautumn, lunar: [["2026-09-22", "2026-09-27"], ["2027-09-12", "2027-09-17"]] }
];

const SKIN_BY_ID = new Map([...BASE_SKINS, ...SEASONAL_SKINS].map(skin => [skin.id, skin]));

const pad = value => String(value).padStart(2, "0");
const dateKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// 現在落在哪個節日造型？沒有就回傳 null。
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

// 第 index 座島的造型：節日期間用節日造型，否則依編號輪流。override 只給預覽用（網址 ?skin=christmas）。
export function skinForIsland(index, { date = new Date(), override = "" } = {}) {
    const forced = override ? SKIN_BY_ID.get(override) : null;
    if (forced) return forced;
    return seasonalSkinAt(date) || BASE_SKINS[index % BASE_SKINS.length];
}

export const isSeasonal = skin => SEASONAL_SKINS.some(item => item.id === skin.id);
