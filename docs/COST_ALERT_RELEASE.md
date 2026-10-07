# 成本持續提醒發布與回復

2026-10-07；本機功能分支 `feature/cost-alert-email-ack`，基準 `dc866e7a`。尚未部署。

## 範圍與驗證界線

- 新增兩張 service-only／RLS 表，保存唯一收件管理員及月份提醒、明確確認時間、五分鐘寄送時段與失敗代碼；不讀寫學生學習紀錄，不變更既有預算或付款設定。
- 三個資料庫 RPC：完整月估算聚合／警示升級、原子寄送領取、只允許收件管理員確認。全部撤銷 PUBLIC／anon／authenticated 執行權限，僅 service_role 可用；由 Edge Function 重新驗證 Firebase 身分。
- 新增 `cost-alert-manager`，沿用現有 Resend 及家長寄信設定；排程使用現有 Vault 憑證驗證，不能用前端管理員 Token 執行寄信。
- 新增獨立 `*/5 * * * *` cron；不改原家長每小時排程。精度為排程時段，首次最多五分鐘，加上供應商投遞延遲；不依賴瀏覽器常駐或登入 Session。
- 一個月警戒／100% 升級，只有按鈕才停止當階段；新月新提醒，舊月未確認仍提醒。異常率／月底預估／外部帳單不觸發重複寄信。
- 收件管理員第一次自行按「使用我的 Email 接收提醒」啟用；migration 不猜測管理員身分或設定私人 Email。LINE 未接入。

## 正式發布（待使用者針對本批授權）

1. 核對最新 main 並只合併本批分支，保留其他未發布草稿。
2. 從 main 部署 `cost-alert-manager`；沿用既有 Secret，核對名稱／是否設定即可，禁止取出值。
3. 只套用 `20261007024653_cost_alert_acknowledgement.sql`，不執行大量 db push。確認 Vault 的兩個現有名稱存在，migration 會原子建立表／RPC／獨立排程。
4. 等待 Cloudflare 的唯一 production build；未登入與非 admin API 驗證，確認表 RLS／RPC grants／cron active。
5. 收件管理員啟用自己的 Email 後，使用明確核准的測試預算／真實用量驗證實際收信、未登入的下一時段提醒、確認後停止，再恢復原預算。不得創造學生用量或修改學習帳本來觸發。
6. 更新狀態／手冊；真實收件、兩個五分鐘時段與確認停止需要線上驗收，隔離 stub 不是實際投遞證據。

## 回復

先停用新 cron `alan-english-api-cost-alerts`（只處理這個 job）；必要時將成本提醒專用 `COST_ALERTS_ENABLED=false` 作為停止寄送開關。回復前端與新增 Function，保留 additive 表與確認紀錄，既有家長通知／付款／學生功能不受影響。不能取消已提交寄信服務的 Email。
