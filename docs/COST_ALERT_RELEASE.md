# 網站成本統整與持續提醒發布／回復

2026-10-07；PR #440／#444 已合併；正式後端基準 main `b6924ae2`。使用者已同意直接正式部署與驗收，兩個 migration 與成本頁已發布；帳務權限、收件啟用及實際投遞驗收待補。

## 正式驗收紀錄

- 五張表 RLS 與六個 service-only RPC、兩個 migration 原版本 history、獨立五分鐘 cron 已核對；原家長排程維持。六個未登入 action 401，OPTIONS 200。
- 初版發生 Reply-To 欄位不相容，PR #444 修正並補 PostgreSQL 真實欄位及投遞內容斷言；41 項後端／採集器回歸再次通過。cost-alert-manager v2 部署後，14:40 正式 cron succeeded／Edge HTTP 200／sent=0／failed=0。尚無收件人，不是實際投遞驗收。
- Secret 僅核對名稱，未讀取或建立帳務 reader；OpenAI／Azure／Google／Cloudflare／GitHub 顯示 missing_configuration，Resend Usage 401，Stripe test_mode_only。Supabase 完整帳單與舊訂閱尚缺金額；網站估算及目前 DB 大小可查。
- PR #440 的 Cloudflare build 在 14:34:53、PR #444 的修復 build 791e7f7d-a1b5-4a55-ba0b-eb80f30533f6 在 14:42:55 台灣時間 success；後者精確對應 main b6924ae2。正式路由與新資產 200，已核對成本標題／服務設定／我已經看到按鈕程式。瀏覽器 runtime 初始化失敗，登入後操作、桌面／412px／iPhone 仍未驗收；沒有繞過工具限制。

## 範圍與驗證界線

- 新增五張 service-only／RLS 表：收件管理員、月份提醒、服務設定、固定費用歷史、月份帳務／用量快照。保存明確確認時間、五分鐘寄送時段及失敗代碼；不讀寫學生學習紀錄，不變更既有預算或付款設定。
- 三個資料庫 RPC：完整月估算聚合／警示、原子寄送領取、只允許收件管理員確認。全部撤銷 PUBLIC／anon／authenticated 執行權限，僅 service_role 可用；由 Edge Function 重新驗證 Firebase 身分。
- 新增 `cost-alert-manager`，沿用現有 Resend 及家長寄信設定；排程使用現有 Vault 憑證驗證，不能用前端管理員 Token 執行寄信。
- 新增獨立 `*/5 * * * *` cron；不改原家長每小時排程。精度為排程時段，首次最多五分鐘，加上供應商投遞延遲；不依賴瀏覽器常駐或登入 Session。
- 每月已知網站總成本達警戒線即提醒，包含已接通費用、網站估算、固定月費或自行登錄完整金額。只有按鈕才停止當月通知；確認後該月費用再增加或達 100% 都不重新通知，新月新提醒，舊月未確認仍提醒。額度接近上限於頁面提示，尚未另行寄送額度提醒。
- 收件管理員第一次自行按「使用我的 Email 接收提醒」啟用；migration 不猜測管理員身分或設定私人 Email。LINE 未接入。

## 採集範圍與頻率

每分鐘刷新頁面，獨立後端每五分鐘啟動監測；採集器有原子租約、各來源快取間隔、40 秒整批上限與每次請求 10 秒逾時。不能把「剛查詢」當成「供應商已完成本月結帳」。

| 服務 | 自動讀取 | 核對頻率／剩餘缺口 |
| --- | --- | --- |
| OpenAI | 指定網站 project 的 Costs API，完整分頁 | 每小時；未接通前採全量 Token 估算 |
| Google TTS／Firebase／其他 Google 費用 | 標準 Cloud Billing BigQuery export，依網站 project 篩選，計入 credits，服務分開 | 每 6 小時；export 有延遲，空匯出不得當成免費 |
| Azure Speech | 限網站 resource group 的 ActualCost／PreTaxCost | 每日；即時可見已結束錄音請求秒數，非計費秒數 |
| Supabase | 目前 DB 大小；固定月費歷史 | Compute、流量、Functions 完整組織帳單未接通，金額仍有缺口 |
| Cloudflare Worker／R2 | 指定 Worker 請求、bucket 操作／儲存 | 每 15 分鐘；analytics 並非完整計費來源，CPU、GB-month、Class A/B／建置費仍需核對 |
| Resend | 帳戶每日／本期已用與額度、reset 時間 | 每 5 分鐘；需 full-access 權限，用量 API 不提供完整帳單金額 |
| Stripe | 正式帳戶 balance transactions 費用，排除交易本金 | 每小時；test key 不計入真實費用；帳戶可含其他網站交易，需確認範圍 |
| GitHub | 指定 repo 的 billing usage summary 淨費用 | 每小時；供應商月份，固定 GitHub 方案費另計 |
| 舊 Netlify、網域、其他／PAYUNi | 固定月費／年費攤提或本月完整總額 | 未自動接通，不猜測舊服務是否仍付費 |

原成本頁的 daily／recent 仍為 AI／TTS 應用程式資料，清楚標示此範圍；總額／預算／Email 共同使用新資料庫聚合。供應商同服務金額取代 local estimate，不再相加；完整總額不再加固定費。GitHub usage-only 費用另加已設定固定方案費。查詢失敗保留上次成功快照及時間，顯示過期／錯誤；未取得金額為 NULL，不是免費。固定費從本月起生效，保留歷史。

## 接通設定（僅後端 Secret，不接受在頁面／聊天貼值）

只提供名稱與所需範圍；尚未建立／修改正式 IAM、API Key 或 Secret。現有服務呼叫 key 不必然有帳務讀取權限，不能直接擴大其權限。

- OpenAI：`COST_OPENAI_ADMIN_KEY`、`COST_OPENAI_PROJECT_IDS`（逗號分隔網站 project）。Admin key 只用 Costs API；不沿用一般生成 key。
- Azure：`COST_AZURE_TENANT_ID`、`COST_AZURE_CLIENT_ID`、`COST_AZURE_CLIENT_SECRET`、`COST_AZURE_SCOPE`（`/subscriptions/<id>/resourceGroups/<site-group>`）。僅在該 resource group 提供 Cost Management Reader，不授予寫入權限；Speech API key 無法取代帳務權限。
- Google：`COST_GOOGLE_SERVICE_ACCOUNT_JSON`（新的 billing reader，不取出 Firebase／TTS 既有 SA）、`COST_GOOGLE_BILLING_TABLE`（project.dataset.table）、`COST_GOOGLE_QUERY_PROJECT`、`COST_GOOGLE_PROJECT_IDS`、`COST_GOOGLE_BIGQUERY_LOCATION`。須一次開啟標準 Cloud Billing export；reader 僅需該 dataset Data Viewer 與 query project Job User，單次 maximumBytesBilled=1GB，cache 啟用；查詢可能產生少量 BigQuery 費用並有延遲。
- Cloudflare：`COST_CLOUDFLARE_ACCOUNT_ID`、`COST_CLOUDFLARE_READ_TOKEN`（Account Analytics Read，限網站帳戶）、`COST_CLOUDFLARE_WORKER_NAME=alanenglish`、`COST_CLOUDFLARE_R2_BUCKET=alanenglish-audio`。不要重用 R2 寫入 key。
- Resend：`COST_RESEND_READ_KEY`（目前官方 Usage API 需要 full-access），未設定時可嘗試既有 `RESEND_API_KEY`；sending-only 被拒絕時卡片顯示缺口，不擅自擴權。
- Stripe：`COST_STRIPE_READ_KEY`（restricted live，僅 Balance transactions Read），未設定時可嘗試現有 key；目前 test-only 則顯示未取得，不能自動切正式付款模式。
- GitHub：`COST_GITHUB_BILLING_OWNER`、`COST_GITHUB_BILLING_KIND=user` 或 `organization`、`COST_GITHUB_REPOSITORY=hi4u44r306/AlanEnglish`、`COST_GITHUB_BILLING_READ_TOKEN`（billing read）。API 月曆月份可能和台灣應用程式月份邊界不同，卡片會說明。
- 固定費可在成本頁一次設定；未接通自動帳單的服務可填本月完整金額。這是替代資料，不代表已自動取得所有服務帳單。未知留空、已確認免費才填 0；本月完整金額留空恢復自動讀取。不要把停止正式部署等同已取消訂閱。

依官方資料： [OpenAI Costs](https://developers.openai.com/api/reference/python/resources/admin/subresources/organization/subresources/usage/methods/costs)、[Azure Query](https://learn.microsoft.com/en-us/rest/api/cost-management/query/usage?view=rest-cost-management-2025-03-01)、[Azure 更新／限流](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/manage-automation)、[Google 標準帳務匯出](https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-tables/standard-usage)、[BigQuery query](https://docs.cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query)、[Cloudflare Worker](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/)、[R2 analytics](https://developers.cloudflare.com/r2/platform/metrics-analytics/)、[Supabase Billing](https://supabase.com/docs/guides/platform/billing-on-supabase)、[Resend Usage](https://www.resend.com/docs/api-reference/usage/retrieve-usage)、[Stripe fees](https://docs.stripe.com/api/balance_transactions/list)、[GitHub usage](https://docs.github.com/en/rest/billing/usage)。Cloudflare billable v2 目前 Alpha Restricted 且未完成成本欄位，不把範例 BilledCost=0 當成實際免費。

## 正式發布（本批已獲使用者授權）

1. 核對最新 main 並只合併本批分支，保留其他未發布草稿。
2. 從 main 部署 `cost-alert-manager`；沿用既有 Secret，核對名稱／是否設定即可，禁止取出值。
3. 只依序套用 `20261007024653_cost_alert_acknowledgement.sql`、`20261007041718_unified_service_costs.sql`，不執行大量 db push。確認 Vault 的兩個現有名稱存在，migration 原子建立 service-only 表／RPC／獨立排程；保留現有學生／學習資料。
4. 等待 Cloudflare 的唯一 production build；未登入與非 admin API 驗證，確認表 RLS／RPC grants／cron active。
5. 收件管理員啟用自己的 Email 後，使用明確核准的測試預算／真實用量驗證實際收信、未登入的下一時段提醒、確認後停止，再恢復原預算。不得創造學生用量或修改學習帳本來觸發。
6. 更新狀態／手冊；真實收件、兩個五分鐘時段與確認停止需要線上驗收，隔離 stub 不是實際投遞證據。

## 回復

先停用新 cron `alan-english-api-cost-alerts`（只處理這個 job）；`COST_ALERTS_ENABLED=false` 只停止寄信、保留帳務採集；`COST_MONITORING_ENABLED=false` 停止採集、仍可查看舊資料。回復前端與新增 Function，保留 additive 表與確認紀錄，撤銷新 billing reader 而不更改既有服務使用 key。既有家長通知／付款／學生功能不受影響。不能取消已提交寄信服務的 Email。
