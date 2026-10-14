// 冒險頁「書本卡片」的小縮圖：從大張地圖（1536×1024、約 200–300KB）縮成 640×427 的小圖（約 30KB 以下）。
// 地圖圖片換版時再執行：PWA_CHROMIUM=<瀏覽器路徑> node scripts/generate-speaking-book-thumbs.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mapDir = path.join(root, "src", "components", "assets", "speaking-map");
const outDir = path.join(mapDir, "thumbs");
// 與 src/components/Pages/speakingUnifiedAssets.js 的 "-a" 圖一致。
const SOURCES = {
    forest: "unified-forest-a-v1.webp", island: "unified-island-a-v1.webp", candy: "unified-candy-a-v1.webp",
    snow: "unified-snow-a-v1.webp", sky: "unified-sky-a-v2.webp", magic: "unified-magic-a-v2.webp"
};
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PWA_CHROMIUM || undefined });
const page = await browser.newPage();
for (const [theme, file] of Object.entries(SOURCES)) {
    const source = `data:image/webp;base64,${(await readFile(path.join(mapDir, file))).toString("base64")}`;
    const base64 = await page.evaluate(async src => {
        const image = new Image(); image.src = src; await image.decode();
        const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 427;
        const ctx = canvas.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(image, 0, 0, 640, 427);
        return canvas.toDataURL("image/webp", 0.78).split(",")[1];
    }, source);
    const bytes = Buffer.from(base64, "base64");
    await writeFile(path.join(outDir, `book-${theme}-v1.webp`), bytes);
    console.log(theme, Math.round(bytes.length / 1024) + " KB");
}
await browser.close();
