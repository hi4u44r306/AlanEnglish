// 後台巡邏員（第一階段）：只讀、不登入、不碰學生資料。
//  B3 未登入探測：每個 Edge Function 不帶身分呼叫，不應回 5xx；預檢請求（CORS）要允許正式網域。
//  B8 金鑰外洩掃描：掃 git 追蹤中的檔案，找長得像密鑰的字串（只回報檔名與行號，不印出內容）。
// 尚未做（需要 Victor 決定 Supabase 唯讀存取權杖）：B1 Edge 與程式逐檔比對、B2 migration 對帳。
// 用法：node patrol/backend-patrol.mjs [--out patrol-out]
import { execFileSync } from "node:child_process";
import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const outDir = arg("out", "patrol-out");
mkdirSync(outDir, { recursive: true });

// 公開的專案網址與正式網域（這些本來就在前端程式裡，不是密鑰）
const supabaseUrl = (process.env.PATROL_SUPABASE_URL || "https://rszabtuzsvhaooajnvgc.supabase.co").replace(/\/$/, "");
const siteOrigin = process.env.PATROL_SITE_ORIGIN || "https://alanenglish.com.tw";

// 這些函式本來就可能接受未登入請求（簽章連結、Webhook、登入前信件等），回 2xx/4xx 都正常
// 伺服器對瀏覽器沒有 CORS 需求的函式（只被 Stripe 等伺服器呼叫）
const noCorsNeeded = new Set(["stripe-webhook"]);
const publicByDesign = new Set(["guardian-weekly-unsubscribe", "stripe-webhook", "auth-email", "store-commerce", "commerce-manager"]);

const findings = [];
const add = (level, id, title, detail) => findings.push({ level, id, title, detail });

// ---------- B3 ----------
const functionsDir = "supabase/functions";
const slugs = readdirSync(functionsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith("_") && existsSync(path.join(functionsDir, d.name, "index.ts")))
    .map(d => d.name);

const timed = async (url, init) => {
    const started = Date.now();
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
            return { res, ms: Date.now() - started };
        } catch (e) {
            if (attempt === 2) return { error: String(e.message).slice(0, 120), ms: Date.now() - started };
        }
    }
};

let probed = 0;
for (const slug of slugs) {
    const url = `${supabaseUrl}/functions/v1/${slug}`;
    const post = await timed(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    if (post.error) { add("unreachable", "B3", `${slug}：巡邏員連不上`, post.error); continue; }
    probed++;
    const status = post.res.status;
    if (status === 404) add("red", "B3", `${slug}：線上找不到這個函式`, "程式裡有、線上沒有（可能尚未部署）");
    else if (status === 503 && (await post.res.clone().text().catch(() => "")).includes("_paused")) { /* 刻意暫停（例如付款尚未開放），不是故障 */ }
    else if (status >= 500) add("red", "B3", `${slug}：未登入就回 ${status}`, "應該回 401/403/400，而不是伺服器錯誤");
    else if (status >= 200 && status < 300 && !publicByDesign.has(slug)) add("yellow", "B3", `${slug}：未登入也回 ${status}`, "請確認這個函式是否本來就該公開");
    if (post.ms > 5000) add("gray", "B3", `${slug}：回應偏慢`, `${post.ms} ms`);

    const pre = await timed(url, {
        method: "OPTIONS",
        headers: { origin: siteOrigin, "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type,apikey" }
    });
    if (pre.res && !noCorsNeeded.has(slug)) {
        const allow = pre.res.headers.get("access-control-allow-origin");
        if (pre.res.status >= 500) add("red", "B3", `${slug}：預檢請求回 ${pre.res.status}`, "瀏覽器會因此無法呼叫");
        else if (allow !== "*" && allow !== siteOrigin) add("yellow", "B3", `${slug}：CORS 沒有允許正式網域`, `allow-origin=${allow ?? "（空）"}`);
    }
}
add("info", "B3", "未登入探測", `已探測 ${probed}/${slugs.length} 個函式`);

// ---------- B8 ----------
const secretPatterns = [
    { name: "私密金鑰區塊", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, nextLineBase64: true },
    { name: "Stripe 私鑰", re: /\bsk_(live|test)_[0-9A-Za-z]{16,}/ },
    { name: "Stripe Webhook 密鑰", re: /\bwhsec_[0-9A-Za-z]{16,}/ },
    { name: "Supabase service_role 金鑰（JWT）", re: /eyJ[\w-]{10,}\.eyJ[\w-]*c2VydmljZV9yb2xl[\w-]*\.[\w-]{10,}/ },
    { name: "AWS／R2 存取金鑰", re: /\bAKIA[0-9A-Z]{16}\b/ },
    { name: "Resend 金鑰", re: /\bre_[0-9A-Za-z]{20,}\b/ },
    { name: "GitHub 權杖", re: /\bgh[pousr]_[0-9A-Za-z]{30,}\b/ }
];
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\0").filter(Boolean)
    .filter(f => !/\.(png|jpe?g|webp|gif|mp3|wav|m4a|mp4|pdf|ico|woff2?|ttf|zip|lock)$/i.test(f) && !f.endsWith("package-lock.json"));
let scanned = 0;
for (const file of files) {
    let text;
    try { text = readFileSync(file, "utf8"); } catch { continue; }
    if (text.length > 3_000_000) continue;
    scanned++;
    const lines = text.split("\n");
    lines.forEach((line, idx) => {
        for (const p of secretPatterns) {
            if (p.re.test(line) && (!p.nextLineBase64 || /^[A-Za-z0-9+/=]{40,}s*$/.test(lines[idx + 1] || "")) && !/example|placeholder|your[-_ ]|fake|dummy|test[-_]key|\.\.\./i.test(line)) {
                // 只回報位置與類型，絕不印出內容
                add("red", "B8", `疑似${p.name}`, `${file}:${idx + 1}`);
            }
        }
    });
}
add("info", "B8", "金鑰外洩掃描", `已掃描 ${scanned} 個檔案`);

const notCovered = [
    "B1 Edge Function 線上版與程式逐檔比對：尚未做（需要 Supabase 唯讀存取權杖，等你決定）",
    "B2 migration 對帳：尚未做（同上）",
    "學習紀錄／XP 異常、權限與作業隔離、資料一致性：第二階段",
    "iPhone Safari 實機、音質、教材內容正確性：巡邏看不到，仍需人眼"
];
writeFileSync(path.join(outDir, "backend.json"), JSON.stringify({ finishedAt: new Date().toISOString(), supabaseUrl, findings, notCovered }, null, 2));
const red = findings.filter(f => f.level === "red").length;
console.log(`後台巡邏完成：紅色 ${red} 項。輸出：${outDir}/backend.json`);
