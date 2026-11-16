// 前台巡邏員：只看、不登入、不送出表單。逐頁 × 逐寬度檢查跑版與錯誤，並截圖。
// 用法：node patrol/ui-patrol.mjs [--base https://alanenglish.com.tw] [--out patrol-out]
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const base = arg("base", process.env.PATROL_BASE_URL || "https://alanenglish.com.tw").replace(/\/$/, "");
const outDir = arg("out", "patrol-out");
const config = JSON.parse(readFileSync(new URL("./pages.json", import.meta.url), "utf8"));
mkdirSync(path.join(outDir, "shots"), { recursive: true });

// 在頁面內執行：只讀取，不改頁面。回傳跑版問題。
const inspectPage = () => {
    const issues = [];
    const vw = document.documentElement.clientWidth;
    const describe = el => {
        const id = el.id ? "#" + el.id : "";
        const cls = typeof el.className === "string" && el.className.trim()
            ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
        return el.tagName.toLowerCase() + id + cls;
    };
    const visible = el => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };

    // 1. 橫向溢出
    const sw = document.documentElement.scrollWidth;
    if (sw > vw + 1) {
        const culprits = [];
        for (const el of document.body.querySelectorAll("*")) {
            if (!visible(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.right > vw + 1 && getComputedStyle(el).position !== "fixed") culprits.push(describe(el) + "(右緣 " + Math.round(r.right) + ")");
            if (culprits.length >= 5) break;
        }
        issues.push({ level: "red", type: "橫向溢出", detail: "頁面寬 " + sw + " 超過視窗 " + vw + "；疑似：" + (culprits.join("、") || "未知") });
    }

    // 2. 文字被切掉（overflow 隱藏、沒有省略號、內容比框大）
    const clipped = [];
    for (const el of document.body.querySelectorAll("button, a, h1, h2, h3, p, span, label, li")) {
        if (!visible(el) || !el.textContent.trim()) continue;
        const s = getComputedStyle(el);
        if (!["hidden", "clip"].includes(s.overflowX)) continue;
        const r0 = el.getBoundingClientRect();
        // 螢幕閱讀器專用的隱藏文字、防機器人的藏在畫面外欄位，本來就不給人看，略過
        if (r0.width <= 2 || r0.height <= 2 || r0.right < 0 || r0.left > vw || r0.bottom < 0) continue;
        if (el.className && /honeypot|sr-only|visually-hidden|__sr/.test(String(el.className))) continue;
        if (s.textOverflow === "ellipsis") continue;
        if (el.scrollWidth > el.clientWidth + 2) clipped.push(describe(el) + "「" + el.textContent.trim().slice(0, 12) + "」");
        if (clipped.length >= 6) break;
    }
    if (clipped.length) issues.push({ level: "yellow", type: "文字可能被切掉", detail: clipped.join("、") });

    // 3. 按鈕太小（觸控範圍），只在手機／平板寬度報，列為參考
    if (vw <= 768) {
        const small = [];
        for (const el of document.querySelectorAll("button, [role=button], input[type=submit]")) {
            if (!visible(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.height < 40 || r.width < 40) small.push(describe(el) + "(" + Math.round(r.width) + "×" + Math.round(r.height) + ")");
            if (small.length >= 5) break;
        }
        if (small.length) issues.push({ level: "gray", type: "按鈕偏小", detail: small.join("、") });
    }

    // 4. 壞掉的圖片
    const broken = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && visible(i)).slice(0, 5)
        .map(i => i.currentSrc || i.src);
    if (broken.length) issues.push({ level: "red", type: "圖片載入失敗", detail: broken.join("、") });

    // 5. 固定定位元素互相重疊（導覽列、播放器、浮動按鈕）
    const fixed = [...document.querySelectorAll("body *")]
        .filter(el => visible(el) && getComputedStyle(el).position === "fixed")
        .map(el => ({ el, r: el.getBoundingClientRect() }))
        .filter(x => x.r.width * x.r.height > 400).slice(0, 12);
    const overlaps = [];
    for (let i = 0; i < fixed.length; i++) {
        for (let j = i + 1; j < fixed.length; j++) {
            const a = fixed[i], b = fixed[j];
            if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
            const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
            const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
            if (w > 8 && h > 8) overlaps.push(describe(a.el) + " × " + describe(b.el));
        }
    }
    if (overlaps.length) issues.push({ level: "yellow", type: "固定元素重疊", detail: overlaps.slice(0, 4).join("、") });

    return issues;
};

const results = [];
// 優先用 Playwright 內建瀏覽器；沒有就退而使用電腦上已安裝的 Chrome／Edge
const launchBrowser = async () => {
    for (const options of [{}, { channel: "chrome" }, { channel: "msedge" }]) {
        try { return await chromium.launch(options); } catch { /* 試下一個 */ }
    }
    throw new Error("找不到可用的瀏覽器；請執行 npx playwright install chromium");
};
const browser = await launchBrowser();
for (const vp of config.viewports) {
    const context = await browser.newContext({
        viewport: vp,
        reducedMotion: "reduce",
        userAgent: "AlanEnglishPatrol/1.0 (read-only)"
    });
    for (const pg of config.pages) {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", e => errors.push({ level: "red", type: "頁面例外", detail: e.message.slice(0, 200) }));
        page.on("console", m => {
            if (m.type() === "error") errors.push({ level: "yellow", type: "Console 錯誤", detail: m.text().slice(0, 200) });
        });
        page.on("response", r => {
            const type = r.request().resourceType();
            if (r.status() >= 400 && ["document", "script", "stylesheet", "image", "font", "media"].includes(type)) {
                errors.push({ level: "red", type: "資源載入失敗", detail: r.status() + " " + r.url().split("?")[0] });
            }
        });
        const entry = { page: pg.name, path: pg.path, width: vp.width, issues: [], shot: null };
        try {
            // 連線失敗自動重試，避免網路瞬斷誤報
            let response;
            for (let attempt = 0; attempt < 3 && !response; attempt++) {
                try {
                    response = await page.goto(base + pg.path, { waitUntil: "networkidle", timeout: 30000 });
                } catch (e) {
                    if (attempt === 2) throw e;
                }
            }
            if (!response || response.status() >= 400) {
                entry.issues.push({ level: "red", type: "頁面打不開", detail: "HTTP " + (response && response.status()) });
            } else {
                await page.waitForTimeout(500);
                if (await page.getByRole("heading", { name: "404", exact: true }).count()) {
                    entry.issues.push({ level: "red", type: "顯示 404", detail: "頁面內容是 404" });
                }
                if (!(await page.locator("body").innerText()).trim()) {
                    entry.issues.push({ level: "red", type: "空白頁", detail: "沒有任何文字" });
                }
                entry.issues.push(...await page.evaluate(inspectPage));
                const shot = "shots/" + (pg.path.replace(/\W+/g, "_") || "home") + "_" + vp.width + ".png";
                await page.screenshot({ path: path.join(outDir, shot), fullPage: true });
                entry.shot = shot;
            }
        } catch (e) {
            // 連不上＝「看不到」，不等於網站壞掉
            entry.issues.push({ level: "unreachable", type: "巡邏員連不上", detail: String(e.message).slice(0, 160) });
        }
        entry.issues.push(...errors);
        results.push(entry);
        await page.close();
    }
    await context.close();
}
await browser.close();

writeFileSync(path.join(outDir, "ui.json"), JSON.stringify({ base, finishedAt: new Date().toISOString(), results }, null, 2));
const red = results.flatMap(r => r.issues).filter(i => i.level === "red").length;
console.log("前台巡邏完成：" + results.length + " 組（頁面×寬度），紅色 " + red + " 項。輸出：" + outDir + "/ui.json");
