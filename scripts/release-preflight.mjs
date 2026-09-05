import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const requirePushed = process.argv.includes("--require-pushed");
const issues = [];

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

let branch = "";
let upstream = "";
let ahead = 0;
let behind = 0;

try {
  branch = git(["branch", "--show-current"]);
  if (!branch) issues.push("目前不是 Git 分支，無法安全發布。");
  if (branch === "main") issues.push("不得直接從 main 發布；請使用功能分支與 PR。");

  if (git(["status", "--porcelain=v1"])) {
    issues.push("工作目錄尚有未提交變更；請先建立 checkpoint。");
  }

  upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  const [behindCount, aheadCount] = git(["rev-list", "--left-right", "--count", "@{u}...HEAD"])
    .split(/\s+/)
    .map(Number);
  behind = behindCount || 0;
  ahead = aheadCount || 0;

  if (behind > 0) issues.push(`遠端分支已有 ${behind} 個新 commit；請先整合後再發布。`);
  if (requirePushed && ahead > 0) {
    issues.push(`本機尚有 ${ahead} 個未推送 commit；部署前請先推送至遠端分支。`);
  }
} catch {
  issues.push("無法讀取 Git upstream；請先設定並推送功能分支。");
}

try {
  const config = readFileSync("supabase/config.toml", "utf8");
  if (!/\[functions\.speaking-content-manager\]\s*\r?\nverify_jwt\s*=\s*false/.test(config)) {
    issues.push("speaking-content-manager 必須維持 verify_jwt = false，由函式內驗證 Firebase Token。");
  }
} catch {
  issues.push("無法讀取 supabase/config.toml。");
}

if (issues.length) {
  console.error("發布前檢查未通過：");
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log("發布前檢查通過");
console.log(`- branch: ${branch}`);
console.log(`- upstream: ${upstream}`);
console.log(`- ahead/behind: ${ahead}/${behind}`);
console.log(`- mode: ${requirePushed ? "deploy" : "checkpoint"}`);
