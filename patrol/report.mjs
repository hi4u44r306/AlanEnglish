// 把 ui.json 與 backend.json 整理成白話 HTML 報告與 summary.json（供通知判斷）。
// 用法：node patrol/report.mjs [--out patrol-out]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const i = process.argv.indexOf("--out");
const outDir = i > -1 ? process.argv[i + 1] : "patrol-out";
const load = name => (existsSync(path.join(outDir, name)) ? JSON.parse(readFileSync(path.join(outDir, name), "utf8")) : null);
const ui = load("ui.json");
const backend = load("backend.json");

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const labels = { red: "紅（馬上處理）", yellow: "黃（本週處理）", gray: "灰（參考）", unreachable: "巡邏員連不上", info: "資訊" };

// 前台：同一頁同一問題跨寬度合併，報告才不會被灌爆
const merged = new Map();
for (const r of ui?.results || []) {
    for (const is of r.issues) {
        const key = [is.level, is.type, r.path, is.detail].join("|");
        const hit = merged.get(key) || { ...is, page: r.page, path: r.path, widths: [], shots: [] };
        hit.widths.push(r.width);
        if (r.shot) hit.shots.push(r.shot);
        merged.set(key, hit);
    }
}
const uiIssues = [...merged.values()];
const backIssues = (backend?.findings || []).filter(f => f.level !== "info");
const count = lvl => uiIssues.filter(x => x.level === lvl).length + backIssues.filter(x => x.level === lvl).length;
const summary = {
    finishedAt: new Date().toISOString(),
    red: count("red"), yellow: count("yellow"), gray: count("gray"), unreachable: count("unreachable"),
    // 只有「紅色」才當天通知；連不上是巡邏員自己的狀況，另外標示
    shouldNotify: count("red") > 0,
    checked: { uiCombos: ui?.results?.length || 0, base: ui?.base || null }
};
writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));

const section = (level, list, render) => {
    const rows = list.filter(x => x.level === level);
    if (!rows.length) return "";
    return `<h2>${labels[level]}（${rows.length}）</h2><ul>${rows.slice(0, 15).map(render).join("")}</ul>${rows.length > 15 ? `<p>…另有 ${rows.length - 15} 項，詳見 ui.json／backend.json</p>` : ""}`;
};
const renderUi = x => `<li><b>${esc(x.page)}</b>（${esc(x.path)}）${esc(x.type)}：${esc(x.detail)}<br><small>寬度 ${x.widths.join("、")}px${x.shots[0] ? `｜<a href="${esc(x.shots[0])}">看截圖</a>` : ""}</small></li>`;
const renderBack = x => `<li><b>[${esc(x.id)}]</b> ${esc(x.title)}：${esc(x.detail)}</li>`;

const headline = summary.red
    ? `今天發現 ${summary.red} 個需要馬上處理的問題`
    : "今天沒有發現需要馬上處理的問題";
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AlanEnglish 巡邏報告</title>
<style>body{font-family:system-ui,"Microsoft JhengHei",sans-serif;max-width:860px;margin:0 auto;padding:16px;line-height:1.6;color:#1a2540}
h1{font-size:22px}h2{font-size:18px;margin-top:24px}li{margin:8px 0}small{color:#667}.ok{color:#0a7d3b}.bad{color:#c4261d}</style>
<h1>AlanEnglish 巡邏報告</h1>
<p class="${summary.red ? "bad" : "ok"}"><b>${headline}</b></p>
<p>時間：${esc(summary.finishedAt)}｜巡邏網址：${esc(ui?.base || "—")}｜前台 ${summary.checked.uiCombos} 組（頁面×寬度）｜紅 ${summary.red}、黃 ${summary.yellow}、灰 ${summary.gray}、連不上 ${summary.unreachable}</p>
${section("red", uiIssues, renderUi)}${section("red", backIssues, renderBack)}
${section("yellow", uiIssues, renderUi)}${section("yellow", backIssues, renderBack)}
${section("unreachable", uiIssues, renderUi)}${section("unreachable", backIssues, renderBack)}
${section("gray", uiIssues, renderUi)}${section("gray", backIssues, renderBack)}
<h2>這份報告沒有涵蓋</h2><ul>${(backend?.notCovered || ["（後台巡邏沒有執行）"]).map(n => `<li>${esc(n)}</li>`).join("")}</ul>
<p><small>巡邏員只看、不修改任何東西；證據層級：正式站公開頁面的自動檢查，不含登入後頁面與實機。</small></p>`;
writeFileSync(path.join(outDir, "patrol-report.html"), html);
console.log(`報告完成：紅 ${summary.red}、黃 ${summary.yellow}、灰 ${summary.gray}、連不上 ${summary.unreachable} → ${outDir}/patrol-report.html`);
