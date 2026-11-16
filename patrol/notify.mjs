// 通知：有紅色問題當天寄信；全部正常時只在每週一寄一封「平安信」。
// 需要三個 GitHub Secret（沒設定就安靜跳過，不影響巡邏）：
//   PATROL_RESEND_API_KEY  寄信用的 Resend 金鑰
//   PATROL_FROM_EMAIL      已在 Resend 驗證過的寄件信箱
//   PATROL_NOTIFY_EMAIL    收通知的信箱
// 信件只放數量與報告連結，不放任何學生資料。
import { readFileSync, existsSync } from "node:fs";

const key = process.env.PATROL_RESEND_API_KEY;
const from = process.env.PATROL_FROM_EMAIL;
const to = process.env.PATROL_NOTIFY_EMAIL;
if (!key || !from || !to) {
    console.log("通知設定未完成（缺 PATROL_RESEND_API_KEY / PATROL_FROM_EMAIL / PATROL_NOTIFY_EMAIL），略過寄信。");
    process.exit(0);
}
const file = "patrol-out/summary.json";
if (!existsSync(file)) {
    console.log("找不到 summary.json，略過寄信。");
    process.exit(0);
}
const s = JSON.parse(readFileSync(file, "utf8"));
const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "";

// 台北時間星期幾（週一 = 1）
const weekday = new Date(Date.now() + 8 * 3600 * 1000).getUTCDay();
const forced = process.env.PATROL_FORCE_MAIL === "1";

let subject;
let lines;
if (s.red > 0) {
    subject = `【巡邏】發現 ${s.red} 個需要馬上處理的問題`;
    lines = [`今天巡邏發現 ${s.red} 個紅色問題（另有黃 ${s.yellow}、灰 ${s.gray}）。`, "請打開報告看哪一頁、哪個寬度、有沒有截圖。"];
} else if (weekday === 1 || forced) {
    subject = "【巡邏】本週平安";
    lines = [`今天沒有發現需要馬上處理的問題（黃 ${s.yellow}、灰 ${s.gray}、巡邏員連不上 ${s.unreachable}）。`, `前台檢查了 ${s.checked.uiCombos} 組（頁面×寬度）。`];
} else {
    console.log("沒有紅色問題，也不是週一，不寄信。");
    process.exit(0);
}
if (runUrl) lines.push(`報告與截圖（保留 30 天）：${runUrl}`);
lines.push("", "巡邏員只看、不修改任何東西；沒有涵蓋登入後頁面與 iPhone 實機。");

const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text: lines.join("\n") })
});
console.log(res.ok ? "通知信已寄出。" : `寄信失敗（HTTP ${res.status}）；不影響巡邏結果。`);
