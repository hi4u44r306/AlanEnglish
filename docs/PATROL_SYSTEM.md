# AI 巡邏系統（第一階段，只讀）

- 狀態：程式完成、本機驗證通過；**尚未 push、尚未合併、排程尚未啟用**。
- 目的：定時主動檢查正式站公開頁面與 Edge Function，只報告、不修改、不登入、不碰學生資料。
- 指令：`npm run patrol`（前台＋後台＋報告）；單獨跑 `node patrol/ui-patrol.mjs --base <網址>`。輸出在 `patrol-out/`（已加入 .gitignore）：`patrol-report.html`、`ui.json`、`backend.json`、`summary.json`、`shots/`。
- 前台（`patrol/ui-patrol.mjs`、`patrol/pages.json`）：12 個公開頁 × 320／360／412／768／1280／1440。檢查橫向溢出、文字被切、按鈕偏小、圖片壞掉、固定元素重疊、Console／頁面例外、資源 4xx、404／空白頁；連線失敗重試 2 次，連不上標「巡邏員連不上」而不是網站壞掉。
- 後台（`patrol/backend-patrol.mjs`）：B3 對 41 個 Edge Function 做未登入探測（不應回 5xx；CORS 允許正式網域；刻意暫停的 `*_paused` 與刻意公開的函式有白名單）；B8 掃描 git 追蹤檔案的疑似金鑰（只回報檔名與行號）。
- 通知（`patrol/notify.mjs`，尚未啟用）：有紅色問題當天寄信、全部正常時只在週一寄「平安」信。需要三個 GitHub Secret：`PATROL_RESEND_API_KEY`、`PATROL_FROM_EMAIL`（Resend 已驗證的寄件信箱）、`PATROL_NOTIFY_EMAIL`；沒設定就自動略過。信件只含數量與報告連結，不含學生資料。
- **尚未做**：B1 Edge 與程式逐檔比對、B2 migration 對帳排程版（需要 Supabase 存取權杖，且該權杖權限很大，待擁有者決定）；登入後頁面；學習紀錄／XP 異常；心跳。
- B2 一次性對帳（2026-11-16，用唯讀 MCP 手動比對，名稱為準）：線上有 150 個名稱、程式 122 個。**只在線上 29 個**（多為 8 月中以前或早期手動套用的，例如 create_assignment_system、complete_product_platform、assignment_effort_rewards、spiral_review_stage1、speaking_learning_history）；**只在程式 1 個**：create_links_table（線上沒有同名，需確認是否改名套用或從未套用）。時間戳不同但名稱相同者（如 add_r2_audio_storage_tracking）視為已套用。這是歷史基準，不是新問題；排程版應以此為基準只提醒「新增的差異」。
- 排程：`.github/workflows/patrol.yml`，每天台北 06:00 與手動；有紅色問題時工作失敗，GitHub 寄信給擁有者。信箱不寫進程式。
- 驗證（2026-11-16，本機對正式站公開頁）：72 組 0 紅；後台 41/41 函式已探測、1,235 檔已掃描、0 紅。自我測試：故意寬 500px 頁面在 320px 被抓到溢出、壞圖、按鈕過小。
- 回復：刪除 `patrol/`、`.github/workflows/patrol.yml` 與 `package.json` 的 `patrol` 一行即可；無 migration、無正式資料變更。
