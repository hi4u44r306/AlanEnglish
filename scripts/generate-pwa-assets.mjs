// 產生「加入主畫面」用的圖片：maskable 圖示與 iOS 啟動畫面（apple-touch-startup-image）。
// 底色白色（與金色獅子搭配）。母圖：public/android-chrome-512x512-v3.png（金色獅子、白底）。只在圖片需要重做時手動執行：
//   node scripts/generate-pwa-assets.mjs          產生圖片
//   node scripts/generate-pwa-assets.mjs --tags   另外印出 index.html 要用的 <link> 標籤
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const BRAND_BG = "#ffffff";

// [裝置寬, 裝置高, 倍率]（直向，CSS 像素）
const DEVICES = [
    [440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3],
    [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3],
    [375, 667, 2], [320, 568, 2],
    [1024, 1366, 2], [834, 1194, 2], [820, 1180, 2], [810, 1080, 2], [768, 1024, 2], [744, 1133, 2]
];

// 把白底獅子轉成透明底，並裁到獅子本體的範圍。
const loadLion = async () => {
    const png = PNG.sync.read(await readFile(path.join(publicDir, "android-chrome-512x512-v3.png")));
    const gold = [184, 134, 11];
    let minX = png.width, minY = png.height, maxX = 0, maxY = 0;
    for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
            const i = (y * png.width + x) * 4;
            const darkest = Math.min(png.data[i], png.data[i + 1], png.data[i + 2]);
            const alpha = Math.max(0, Math.min(255, Math.round(((255 - darkest) / (255 - gold[2])) * 255)));
            png.data[i] = gold[0]; png.data[i + 1] = gold[1]; png.data[i + 2] = gold[2]; png.data[i + 3] = alpha;
            if (alpha > 40) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
        }
    }
    const width = maxX - minX + 1, height = maxY - minY + 1;
    const cropped = new PNG({ width, height });
    PNG.bitblt(png, cropped, minX, minY, width, height, 0, 0);
    return { dataUri: `data:image/png;base64,${PNG.sync.write(cropped).toString("base64")}`, ratio: width / height };
};

const render = async (page, lion, width, height, lionHeight) => {
    await page.setViewportSize({ width, height });
    await page.setContent(`<style>html,body{margin:0;width:${width}px;height:${height}px;background:${BRAND_BG};display:flex;align-items:center;justify-content:center}
        img{height:${lionHeight}px;width:${lionHeight * lion.ratio}px}</style><img src="${lion.dataUri}">`);
    return page.screenshot({ type: "png" });
};

const lion = await loadLion();
const wordmarkSvg = await readFile(path.join(root, "src", "components", "assets", "img", "alan-english-rounded.svg"));
const wordmarkUri = `data:image/svg+xml;base64,${wordmarkSvg.toString("base64")}`;
// 網頁內啟動畫面使用的獅子本體（透明底、已裁切），尺寸與 iOS 啟動圖的獅子比例一致。
await mkdir(path.join(publicDir, "pwa"), { recursive: true });
await writeFile(path.join(publicDir, "pwa", "lion.png"), Buffer.from(lion.dataUri.split(",")[1], "base64"));
const browser = await chromium.launch({ executablePath: process.env.PWA_CHROMIUM || undefined });
await mkdir(path.join(publicDir, "pwa", "splash"), { recursive: true });
const page = await browser.newPage({ deviceScaleFactor: 1 });

// 啟動畫面用的組合圖（獅子在上、Alan English 字樣在下，透明底）。三個階段都用這張，大小與位置才會一致。
const LOGO_W = 1120, LION_H = 640, GAP = 76, WORD_H = Math.round(LOGO_W * 134 / 1328);
const LOGO_H = LION_H + GAP + WORD_H;
await page.setViewportSize({ width: LOGO_W, height: LOGO_H });
await page.setContent(`<style>html,body{margin:0;background:transparent}div{width:${LOGO_W}px;height:${LOGO_H}px;display:flex;flex-direction:column;align-items:center}
    .l{height:${LION_H}px;width:${Math.round(LION_H * lion.ratio)}px}.w{margin-top:${GAP}px;width:${LOGO_W}px;height:${WORD_H}px}</style>
    <div><img class="l" src="${lion.dataUri}"><img class="w" src="${wordmarkUri}"></div>`);
const launchLogoPng = await page.screenshot({ type: "png", omitBackground: true });
await writeFile(path.join(publicDir, "pwa", "launch-logo.png"), launchLogoPng);
const launchLogoUri = `data:image/png;base64,${launchLogoPng.toString("base64")}`;
const LAUNCH_LOGO_VMIN = 56; // 組合圖寬度占短邊的百分比，須與 index.html 的 .ae-launch-logo 一致
const LAUNCH_LOGO_RATIO = LOGO_W / LOGO_H;

for (const size of [192, 512]) {
    // maskable 安全區是中央 80% 圓，獅子高度取 54% 以內。
    await writeFile(path.join(publicDir, "pwa", `maskable-${size}.png`), await render(page, lion, size, size, Math.round(size * 0.54)));
}

const tags = [];
for (const [w, h, ratio] of DEVICES) {
    const pxW = w * ratio, pxH = h * ratio;
    const name = `splash-${pxW}x${pxH}.png`;
    await writeFile(path.join(publicDir, "pwa", "splash", name), await render(page, { dataUri: launchLogoUri, ratio: LAUNCH_LOGO_RATIO }, pxW, pxH, Math.round(Math.min(pxW, pxH) * LAUNCH_LOGO_VMIN / 100 / LAUNCH_LOGO_RATIO)));
    tags.push(`<link rel="apple-touch-startup-image" media="screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)" href="%PUBLIC_URL%/pwa/splash/${name}" />`);
}
await browser.close();
console.log(`已產生 maskable 圖示與 ${DEVICES.length} 張 iOS 啟動畫面。`);
if (process.argv.includes("--tags")) console.log(tags.join("\n"));
