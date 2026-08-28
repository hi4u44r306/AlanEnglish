# Alan English 專案狀態

最後更新：2026-08-27

本次進行中（2026-08-28，尚未推送／部署）：

- Sidebar：補齊學生主要功能路由的目前頁面反白，開啟手機 Sidebar 時自動將目前路由捲動至接近中段；教材分類也會依目前教材路由標示 active。
- 商城教材自動開通：新增付款商城訂單以已驗證 email 對應新建立的 Firebase 學生帳號，將已付款商品包的 Workbook／聽力本／網站教材寫入教材權限，並建立 90 天網站使用權；商城登入與聽力平台登入仍維持分離。正式套用 migration、部署 Edge Function 與付款端到端驗收尚未完成。

正式網站：<https://alanenglish.com.tw>

GitHub：<https://github.com/hi4u44r306/AlanEnglish>

正式部署分支：`main`

正式基準 commit：`b293a125`（Netlify production deploy `6a9044db755e5800084fe0fb`，狀態 `ready`）

> 本文件只記錄目前開發狀態。永久架構、安全與工作規則請閱讀根目錄 `AGENTS.md`。
> 目前產品、角色、權限與跨功能邏輯請閱讀根目錄 `PROJECT_LOGIC.md`。

## 1. 專案目前階段

## 已部署：會員續用、班級教材與教材商品包

以下規則已由 PR #50 實作、PR #51 對齊第一版 migration，並由 PR #52 完成授權與商務安全強化；正式 migration、Edge Functions 與 Netlify production 均已部署：

- 教材擁有權與網站使用權分開。購買／兌換教材永久保留教材擁有權與歷史紀錄，另附自兌換日起 90 天網站使用權，且不自動續費。
- 七天試用不需信用卡、不自動續費，只能使用獨立體驗內容，不能查看正式教材或英文班作業。
- 基本會員每月 NT$299，只延續已擁有教材的網站功能，不包含新實體教材，也不解鎖下一級；AI 方案維持 NT$99／NT$129 獨立加購。
- 教材來源採疊加式 ledger：在校班級、自購、管理員贈送、開通碼與試用互不覆蓋。班級固定 E1、E3、E5、E7。
- 離校不是停用帳號；班級來源與新作業於生效日結束，自購／贈送教材、XP、AE Points、等級、歷史作業與進度保留。已付款月費與 AI 使用至 `current_period_end`。
- 月費支援 Customer Portal、本期結束取消、到期前恢復與付款失敗；Checkout 前必須有有效家長 Email。通知事件、學生收件匣、去重鍵與 Email 佇列已納入實作，寄送沿用既有 Resend adapter，未設定 provider 時保留待送。
- 班級教材設定與教材商品包分開管理。商品包必須有一本 Workbook、一本聽力本、完整價格及 Stripe 測試 Product／Price 才能上架。
- 三本組合教材包的一般售價已確認為 NT$1,380；有效會員教材價尚未確認，不得猜測或建立正式 Price。目前已建立一組同價 NT$1,380 的 Stripe 沙盒 Level 1 試賣商品供購買流程驗收，正式上線前仍須另建確認後的會員價 Price。
- 目前不建立年費。累積月費續訂率、取消原因與客服資料後，才評估年費的折扣、退款、教材升級與客服成本條件。

Alan English 已從舊 React／Firebase 網站修復，進入 Firebase Authentication、Supabase、Cloudflare R2 與 Netlify 的產品化階段。

目前已完成：

- 基本登入與角色分流
- Firebase Auth 與 Supabase 學生資料對應
- 教材及音檔基本播放
- Cloudflare R2 私有音檔搬移
- 學生類型與疊加式會員權限
- 英文班分班週期
- 英文班學生帳號建立
- 英文班學生邀請式帳號建立（已部署）
- 英文班學生帳號名稱＋登入卡流程（已部署）
- Firebase 忘記／修改密碼與客服案件流程（已部署）
- AI 教材額度卡顯示每日及每月重新計算倒數（已部署）
- 首次登入與全站 Session 同時載入資料時共用請求，避免成功後被競態登出
- 公開產品首頁
- 會員方案展示
- 固定 Navbar
- 手機 Sidebar 第一版
- 作業頁固定迷你播放器

最近完成：

- PR #60：Navbar 的重複「建立音檔／管理音檔」入口已合併為「音檔管理」，管理員桌面與手機選單新增 `/admin/links` 的「新增連結」入口；已合併至 `main` commit `b293a125`，Netlify production deploy `6a9044db755e5800084fe0fb` 已發布且為 `ready`。
- PR #57：商城驗證信重寄、驗證完成頁與 Stripe Checkout locale 修正已合併至 `main` commit `2fead503`；Netlify production deploy `6a9022d207447f0008a03b45` 已發布且為 `ready`。正式 `/shop/register` 已顯示重新寄送入口，失效驗證連結會進入 `/shop/verified` 提示頁；仍待以新的可收信沙盒地址完成收信、驗證、重新登入與 Stripe 沙盒付款端到端驗收。
- PR #55：公開 `/shop` 獨立教材商城已合併至 `main` commit `96b7877` 並正式發布。商城商品與程度推薦可匿名瀏覽，購物車保存於瀏覽器；結帳、寄送資料與歷史訂單使用獨立 Supabase Auth 商城帳號，不讀取或覆蓋聽力平台 Firebase Session，同一 Email 可分別註冊。新增商城訂單／地址／商品快照／狀態歷程／配送方式資料模型、有限庫存原子保留與逾時釋放、Stripe Hosted Checkout、簽章 webhook 付款核對、全額退款、客戶訂單／物流查詢，以及 Firebase 管理員出貨與運費設定。正式 migration `storefront_orders` 與 `store_order_foreign_key_indexes` 已套用；`store-commerce` v1、`commerce-manager` v4、`stripe-webhook` v19 均為 ACTIVE，商品目錄遠端呼叫回傳 200。11 個商城契約、22 個教材商務契約、10 支 Edge Function 語法檢查、Production build 與 Netlify Deploy Preview 均成功；Netlify production deploy `6a8fdd817ae3a3d38f4c6e7c` 已發布，正式 `/shop`、登入、購物車、訂單、管理員訂單與 sitemap 路由皆回傳 200。仍需由管理員確認退換貨／隱私條款、Supabase 驗證信 redirect、Stripe Webhook 事件訂閱，並完成 Stripe 沙盒端到端付款。
- PR #54：網站使用手冊、教材商品頁導覽與正式根路徑懸浮 Header 已完成；一次性教材 Checkout 不再被 `sync` 誤判為月費訂閱，付款成功頁會核對登入學生、Stripe Customer、purchase、package 與 Checkout Session 後顯示教材付款結果並返回教材頁。`commerce-manager` v3、`billing-manager` v20 均為 ACTIVE，後者無登入請求仍回傳 401；22 個教材商務契約測試、`git diff --check` 與 Production build 通過。Netlify production deploy `6a8fb5de1cfd58cc7c08cda3` 已發布至 `alanenglish.com.tw`。
- PR #50／#51／#52：會員續用、班級教材與教材商品包已合併至 `main`；安全稽核修正教材 Checkout webhook、離校生班級教材存取、會員教材價方案代碼、已上架商品包完整性、離校生恢復與 Stripe 訂閱取消／恢復、家長 Email 驗證及到期通知排程。正式 migration `20260827013903_membership_commerce_authorization_hardening.sql` 已套用並驗證函式、三個 trigger 及角色權限；`record-play` v21、`content-access` v17、`billing-manager` v19、`stripe-webhook` v18、`guardian-email` v14、`commerce-manager` v2、`notification-manager` v2 均為 ACTIVE 且維持 `verify_jwt=false`。20 項商務 contract、9 支 Edge Function 語法檢查、3 份前端測試共 10 項及 Production build 均成功；Netlify production deploy `6a8f95142703d100093c816b` 已發布 `558437c` 且為 `ready`。
- PR #48：離校生會員 grant 同步錯誤已修正並合併至 `main` commit `86e519e`；additive migration `20260826163017_fix_membership_grant_plan_sync.sql` 讓 Stripe 會員保留實際方案與來源，並停止舊版在校會員鏡像產生第二份 `academy_internal` 權限，在校資格只由 `academy_enrollments` 管理。Migration 已套用正式 Supabase，7 筆有效／暫停中的錯誤 grant 已整理，整體有效不一致數量為 0。`aeplanalumni` 已確認為無有效在校 enrollment、有效 `basic_membership_monthly` Stripe 方案，作業權限為 false、AI 權限為 false，可再選購離校生 NT$99 AI 加購。會員中心測試 5/5、Production build 與 `git diff --check` 通過；Netlify Production deploy `6a8f1813ccd0757e9a9d75a6` 已發布且為 ready。
- PR #21：AI 加購付款按鈕載入狀態、AI Premium 啟用卡、每月續訂日與 Navbar／手機 Sidebar 徽章；已合併並部署正式 Netlify。
- `membership-manager` v19：只回傳 AI 加購的續訂日期與週期結束取消狀態，不回傳 Stripe 識別碼或任何金鑰；已部署且為 ACTIVE。
- PR #23：在校生會員名稱與 iPhone 日期欄位寬度修正；已合併至 `main` 並完成 Netlify 正式部署。
- `membership-manager` v20：修正無期限英文班權限被顯示為剩餘 0 天；已部署且為 ACTIVE。

進行中：

- `codex/link-edit-track-order`：教材連結管理新增名稱與 URL 編輯、HTTP(S) 格式驗證與管理員後端 update contract；公開連結改為分類內依名稱自然升冪，音檔管理頁依 `sort_order`、頁碼／檔名與 id 穩定升冪。2 份測試共 4 個案例、`link-manager` TypeScript 語法檢查、`git diff --check` 與 Production build 已成功；尚未 push、建立 PR、部署 Netlify 或重新部署 `link-manager`。
- `codex/seo-public-foundation`：SEO 第一階段已在隔離工作樹完成但尚未推送或部署。品牌首頁改為 `/`，教材音檔入口固定為 `/links`，`/home` 與 `/showcase` 在 Netlify 回傳 301 至 `/`；`/`、`/links`、`/shop`、`/materials` 的 build 會產生各自獨立 title、description、canonical 與社群分享 metadata。其他登入、付款、會員、後台與未知路由首次 HTML 回應統一使用 `noindex,nofollow` 且不輸出 canonical，sitemap 只列四個公開可索引頁。本機 Netlify 模擬已確認四頁皆為 200 且 canonical 正確、兩個舊首頁為 301、私人／未知路由為 noindex；SEO 合約 4/4、相關元件 6/6 與 Production build 成功。下一階段才新增方案、功能、家長／老師與商品詳情內容頁，部署後才提交 Search Console。
- `codex/store-email-verification-resend`：商城註冊頁新增真正呼叫 Supabase `auth.resend` 的「重新寄送驗證信」，成功請求有 60 秒冷卻，提示不洩漏帳號是否存在或是否已驗證；新驗證信導向獨立 `/shop/verified`，成功時顯示「謝謝，已完成驗證」與 5 秒倒數，清除目前商城 session 後回到原結帳目的地的商城登入頁，過期／已使用連結則提供登入與重寄入口。Supabase Auth 已允許正式站與固定測試站的 `/shop/login`、`/shop/verified` 共 4 個 Redirect URLs。商城 Checkout 500 已由 Edge Function log 確認為 Stripe locale 誤用 `zh_TW`，修正為 `zh-TW` 後 `store-commerce` v2 已部署並為 ACTIVE；失敗訂單仍安全標為 failed／cancelled、不會出貨。驗證／重寄前端測試 4/4、商城契約 11/11、`git diff --check` 與 Production build 成功。功能 commit `d43af95` 已推送並建立 PR #57，兩個 Netlify Deploy Preview 皆通過；固定測試站 deploy `6a8ffd01012805d73b60bf2d` 已發布且為 `ready`，已確認 `/shop/verified` 的失效提示、重寄入口與 `/shop/register` 重寄按鈕。正式 `main` 尚未合併／發布，需使用者再次明確授權；另待以未驗證的可收信沙盒地址完成「重寄、收信、驗證完成頁、重新登入、Stripe 沙盒結帳」端到端驗收。Supabase 專案目前仍使用預設寄信服務；正式開放一般學生收信前必須設定既有 Resend 或其他自訂 SMTP，且不得把 SMTP 密碼提交到 Git。
- PR #47：學生手機版 Header 將通知與漢堡按鈕整合為右側操作群組，修正通知貼近 Logo、漢堡單獨靠右的不自然間距；已合併至 `main` commit `fca1612`。`MainNavbar` 測試、`git diff --check` 與 Production build 已通過，固定學生測試站 deploy `6a8ef77517662da3aeca86a2` 已發布；仍待手機實機視覺驗收。
- `codex/delete-test-accounts`：後台帳號管理新增管理員專用「永久刪除」入口，Email 帳號需輸入完整 Email，校內帳號則需輸入完整登入名稱確認。Migration `20260826143450_allow_admin_test_account_deletion.sql` 允許清除一般測試資料；後續 `20260826145459_stripe_test_account_cleanup.sql` 增加 Stripe test/live 標記，使測試模式訂閱與付款可在刪除帳號前一併安全清理，正式或無法確認模式的付款、教材購買及啟用碼兌換仍會拒絕刪除。Webhook 與付款同步會保存 Stripe 模式。兩個刪除 migrations 已套用，`academy-student-manager` v20、`billing-manager` v17、`stripe-webhook` v16 為 ACTIVE；v20 僅新增固定測試站來源白名單。三組零付款測試帳號已建立、啟用、登入並驗證目前皆可刪除：一般會員無英文班歷史、在校生保有有效在學、離校生保留已退班歷史。
- `codex/membership-ai-pricing`（功能 commit `e08445a`）：基本自主學習會員為 NT$299／月；一般會員 AI 加購為 NT$129／月，合計 NT$428；英文班在校生與離校生 AI 優惠為 NT$99／月，離校生需搭配基本會員，合計 NT$398。Additive migration `20260826132237_membership_ai_pricing.sql` 已套用；Stripe 沙盒 NT$299／NT$129 Price 已建立並寫回方案，NT$99 沿用既有測試 Price。`membership-manager` v26 已部署正確資格篩選；測試站已驗證一般會員只先顯示 NT$299、在校生只顯示 NT$99、離校生只先顯示 NT$299。NT$299 付款完成後的 NT$129／NT$99 解鎖仍待實際 Stripe 測試付款驗收。19 份前端測試共 52 個案例、8 個純後端資格／Stripe 金額測試、8 支 Edge Function TypeScript 語法解析、`git diff --check` 與 Production build 均成功；固定測試站 deploy `6a8f036f97d14d06abc85be8` 已發布。
- PR #45：預設頭像與完成裁切的自訂照片都必須經過最後確認才會儲存；確認前不呼叫套用／上傳 API，取消預設頭像不變更資料，自訂照片則可返回繼續調整。已合併至 `main` commit `3654e2bc`，Netlify production deploy `6a8ee69aa4ba77000897303a` 已發布且為 ready。相關 `StudentSettings` 3 個測試案例、`git diff --check` 與 Production build 已通過；固定學生測試站已用登入中的學生帳號驗證預設頭像確認／取消流程與 Console，自訂照片仍待手機實機選檔驗收。
- PR #40：生日欄位手機版垂直排列、頭像裁切的 iPhone Touch 支援，以及獨立 `/student/notifications` 通知頁已合併至 `main` commit `5518922c` 並完成 Netlify 正式部署；`membership-manager` v25 已部署且為 ACTIVE。
- PR #42：修正頭像拖移座標回傳欄位錯誤，並讓 Pointer capture 使用數字型 ID、保留舊版 Safari Touch fallback；已合併至 `main` commit `87cf36a4` 並完成 Netlify 正式部署。
- `codex/default-avatars-required-names`：將生日欄位改為年／月／日三個原生選單，避開 iPhone Safari 日期控制項的固有寬度；新增五款遊戲化預設頭像與後端白名單選擇 action，切換預設頭像時移除舊的私人上傳檔，正式站透過 Netlify Image CDN 提供縮圖。新建／CSV 學生與首次登入卡啟用均要求中英文姓名，前後端同步驗證；同時保留 activation／recovery 查詢的明確 `student_id` 外鍵，避免 relation ambiguity 回歸。4 份相關測試共 16 個案例、兩支 Edge Function TypeScript 語法解析、`git diff --check` 與 Production build 均成功；尚待 iPhone Safari 實機視覺驗收、GitHub push、Netlify 與兩個 Edge Functions 部署。
- PR #36：學生「我的設定」頁面已於 2026-08-26 合併至 `main` commit `29e1e567`，並由 Netlify 正式發布。頁面集中顯示／安全管理頭像、中文／英文姓名、班級、等級、XP、AE Points、AI Premium／AI 教材權限與出生年月日；排行榜改為導向設定頁更換頭像。Header／手機 Navbar 新增通知入口與未讀徽章，通知資料表僅供受 Firebase 驗證的 Edge Function 依自己的 `student_id` 讀取與標記已讀。新邀請啟用卡在密碼欄位下新增出生年月日與基本資料預覽。頭像接受 JPG／PNG／WebP，儲存桶與後端上限同步改為 5MB，超過上限且不超過 20MB 的照片會先在瀏覽器縮放／壓縮。`student_profile_notifications` migration 已套用；已確認 `students.date_of_birth` 與 `student_notifications` 存在，後者啟用 RLS 且 `anon`／`authenticated` 無直接 DML 權限。`membership-manager` v24、`academy-student-manager` v15 與 `gamification` v3 已部署且為 ACTIVE，儲存桶限制已確認為 5MB。三個相關 Jest 測試與 Production build 成功，仍需以學生帳號進行桌機、412px 與 iPhone Safari 實機驗收。
- `codex/dark-gamified-sidebar`：學生 Sidebar 已統一為深藍遊戲化視覺，桌機寬視窗不再回退成白色；學生名稱下方新增目前 Lv、總 XP、金色 XP 進度條與距離下一級提示，資料僅讀取既有 `gamification` summary。`MainNavbar` 單元測試與 Production build 已通過，2026-08-25 已直接快轉至 `main` commit `a21146d`；本機未安裝 GitHub CLI，因此未建立 PR，Netlify 自動部署狀態尚未驗證。仍需以登入中的真實學生帳號完成視覺驗收。
- 新建立英文班在校生改用唯一帳號、一次性 QR 啟用卡、兩組復原碼與自行設定密碼；家長 Email 改為選填聯絡資料。
- 重新發登入卡功能已部署：僅管理員可對尚未啟用、使用中的英文班帳號產生新 QR 與兩組復原碼，舊卡會撤銷。`academy-student-manager` v12 的啟用／復原查詢調整曾造成全體學生帳號服務失效，已立即回復為 v13；後續必須先以隔離沙盒資料驗證，再處理 QR 掃碼查詢問題。
- 非英文班帳號的 Firebase 驗證／重設 action link 改由 Edge Function 產生，再使用既有 Resend 寄件網域寄出品牌信件。
- 後台帳號生命週期使用安全停用／恢復；已停用帳號預設從清單隱藏，管理員可切換帳號狀態篩選後恢復。已建立的學生帳號不再提供永久刪除入口，未領取且尚未建立帳號的邀請仍可刪除。
- 後台方案顯示依學生類型與有效權限自動判定，不再讓櫃檯編輯舊版 `allcover`／`listeningonly` 欄位。
- 學生 Dashboard 對尚未購買 AI 教材加購的帳號顯示 AI POWER-UP 宣傳卡；已購買者不顯示。
- 後續階段：使用小批量測試學生驗證 CSV 實際建立、部分失敗與結果下載。

PR #29 預覽部署與後端狀態（`codex/admin-ui-csv-student-import`）：

- 管理 Dashboard 已將 9 欄資訊合併為 6 欄、移除重複快速管理卡與未啟用的 LINE 預留欄位，並降低管理頁字重、提高小字與表單可讀性。
- 學生 Dashboard 已放大今日學習路線的任務進度數字，加入老師作業 XP／AE Points 獎勵提示，並將學習累積卡改為圖示與數據並排，減少手機版空白。
- 發布作業介面已移除需要學生個別加購的 AI 測驗／完整任務包，只保留全體英文班學生可完成的聽力作業；一份作業可跨多本教材累加音檔，並依教材顯示已選頁碼／Unit 摘要。已發布作業可由建立者或管理員安全停用，學生不再看到但既有進度仍保留。`assignment-manager` v18 已於 2026-08-24 部署並為 ACTIVE；前端介面尚未部署 Netlify。
- 學生 Dashboard 的 AI 專屬練習只對有效 AI 權限顯示；未加購者從其他入口進入 AI 教材頁時會回到頁首看到加購卡。既有 AI 類作業也由後端依有效 AI 權限過濾與拒絕提交。
- 智慧錯題複習只使用既有錯題資料與間隔排程，不呼叫生成式 AI、不消耗 AI 額度，因此維持所有具 `review` 權限的學生可用。
- CSV 批次建立學生第一版已完成：範本下載、CSV 解析、伺服器預覽、E1／E3／E5／E7 與 Email 驗證、每批 25 位上限、admin-only 批次建立、逐列成功／失敗、結果下載、request ID 防重複提交與不保存臨時密碼的操作紀錄。
- Additive migration `20260824124647_academy_student_csv_batches.sql` 已於 2026-08-24 套用遠端 Supabase；兩張資料表啟用 RLS，`anon` 無讀取權，`service_role` 可執行伺服器 audit 寫入。
- 管理員帳號清單已改為預設只顯示使用中帳號，並新增 Role、Class、Plan、開通狀態、帳號狀態與是否啟用的組合篩選；停用後從預設清單隱藏，切換為「已停用」即可恢復。已建立學生帳號的永久刪除入口已移除，未領取邀請仍需輸入完整 Email 才能刪除。
- Additive migration `20260824143810_admin_safe_account_deletion.sql` 已套用，RPC 只授權 `service_role`；一次性 Sandbox Test 刪除嘗試未刪除 Firebase 或 Supabase 資料，`20260824154915` 與 `20260824155347` 已依序套用並恢復原本嚴格刪除政策。專案擁有者已設定 `FIREBASE_SERVICE_ACCOUNT_JSON`，未讀取或輸出內容；因產品改採停用隱藏，不再繼續帳號永久刪除流程。
- PR #29 的內容已包含在 PR #30，兩者於 2026-08-25 一併標記為已合併；`main` merge commit 為 `199b02a`，Netlify Production 已發布同一 commit 並為 `ready`。
- 全部 13 份測試檔共 34 個案例通過，Production build 成功，Supabase security advisors 無警告；帳號管理已於本機管理員 Session 驗證預設隱藏、已停用篩選、恢復入口與永久刪除按鈕移除。412px Preview 公開頁／登入導向正常，登入後 CSV 伺服器預覽已用虛構資料驗證且未寫入學生，Console 無錯誤。本機沒有 Deno，Edge Function 的正式型別驗證由 Supabase 部署 bundling 完成。
- 2026-08-25：全站 Router／顯示邏輯稽核、管理員手機卡片、停用帳號標示、Dashboard RWD、權限式作業捷徑與 AI 宣傳判斷已隨 PR #30 合併並部署。
- 2026-08-25：根目錄 `PROJECT_LOGIC.md` 已隨 PR #30 合併，集中記錄身分、疊加式權限、方案、頁面顯示、AI、作業、聽力、帳號生命週期、CSV、付款與 RWD 邏輯。
- 2026-08-25：英文班登入第一階段已隨 PR #30 合併並部署。正式 Supabase migration `20260825125826_academy_student_login_activation` 已成功套用；`membership-manager` v23、`academy-student-manager` v9、`auth-email` v1 均為 ACTIVE，OPTIONS 健康檢查成功。Netlify Production 已發布 `main` commit `199b02a`；首頁、學生啟用與復原路由皆回應 HTTP 200。16 份測試檔共 41 個案例通過，Production build 成功；既有英文班假 Email 帳號尚未轉換，真實寄信收件與垃圾郵件表現尚未驗證。
- 2026-08-25：`codex/student-nav-password` 已推送 GitHub。學生桌面 Navbar 改為常用入口＋完整 Sidebar；英文班首次啟用、復原與帳號安全頁改為學生自訂至少 6 個字元的密碼，並加入小寫鍵盤提示、顯示／隱藏與清楚的長度錯誤。17 份測試檔共 43 個案例、Edge Function TypeScript 語法解析、Production build 與 `git diff --check` 均成功；412px 密碼頁欄位、顯示切換與 Console 已驗收。`academy-student-manager` v10 已部署為 ACTIVE，未修改 migration 或正式資料，OPTIONS 健康檢查回應 204。桌面學生 Navbar 尚未用登入中的真實學生 Session 做視覺驗收；PR 與 Netlify Deploy Preview 尚未建立。
- Supabase CLI `db push --dry-run` 仍會被歷史 migration 時間戳差異阻擋；本次只透過 migration API 套用已確認缺少的新 migration，未將任何正式 migration 標記為 reverted。後續不得直接使用 `db push --include-all` 或盲目 repair。

目前下一個主要開發方向：

1. 以明確標記的沙盒學生驗證「CSV 建立 → 列印登入卡 → 掃碼啟用 → 帳號登入 → 復原碼重設」完整流程
2. 使用專用測試收件地址驗證品牌驗證信／重設信、垃圾郵件分類與寄件網域 SPF／DKIM／DMARC
3. 另行規劃 Supabase migration history 對齊，不修改已正確執行的正式 schema
3. 確認 Resend 寄件子網域的 SPF、DKIM、DMARC 與寄件設定後，以非英文班沙盒 Email 驗證收件匣／垃圾郵件結果
4. 盤點既有英文班假 Email 帳號並產生只讀轉換預覽；未經逐批確認不得改正式帳號
5. MusicPlayer 80% 聆聽與防作弊測試

## 2. 目前正式版本

最近完成並合併：

- PR #9：固定 Navbar 與 iPhone 捲動修正
- PR #10：英文班學生帳號建立
- PR #11：公開產品首頁、方案版面、固定播放器與手機 Sidebar
- PR #15：Stripe AI 加購、學生邀請、密碼復原、客服與 AI 額度倒數
- PR #18：修正首次登入 Session 競態並公開 Stripe 沙盒 AI 加購方案

目前已知的正式基準 commit：

```text
87cf36a4
```

接手前仍應執行以下指令確認最新狀態，不可假設上述 commit 永遠不變：

```bash
git switch main
git pull --ff-only origin main
git log -1 --oneline
git status --short
```

Netlify 已確認該版本正式部署為 `ready`。

## 3. 目前架構

### 前端

- React
- Redux
- React Router
- SCSS
- react-h5-audio-player
- Firebase Authentication

### 後端

- Supabase PostgreSQL
- Supabase Edge Functions
- Firebase ID Token 驗證
- Cloudflare R2 私有音檔
- R2 預簽播放網址

### 部署

- GitHub 儲存程式碼
- Netlify 部署 React 網站
- `main` 為正式環境
- Feature branch／Pull Request 用於測試與驗收

## 4. 帳號與權限現況

系統角色：

- `student`
- `teacher`
- `admin`

學生類型：

- `academy_student`
- `textbook_customer`
- `trial_user`

英文班班級：

- E1
- E3
- E5
- E7

在學狀態設計：

- 在學
- 暫停
- 退班
- 畢業

會員權限已改為疊加模式，英文班、教材購買、試用、訂閱及管理員贈送可以同時存在，不應互相覆蓋。

## 5. 目前商業方案

### 七天試用

- 免費七天
- 目前不需要信用卡
- AI 教材共 7 次、每日最多 2 次
- 不提供英文班作業
- 尚需建立不依賴實體教材的七天引導內容

### 教材購買

- 購買教材後提供 90 天非自動續費網站權限
- 權限從兌換日開始
- 到期後可選擇每月 NT$299 的基本自主學習會員
- AI 教材不因購書或基本會員自動取得；一般會員可另加購 NT$129／月
- 三本組合教材包一般售價已決定為 NT$1,380；有效會員教材價仍待確認

### 英文班在校學生

- 在校期間免費使用網站
- 英文班月費目前為 NT$2,800
- 可以收到班級作業
- 不包含 AI 教材生成；可加購 AI 教材方案（NT$99／月、每日 5 次、每月最多 150 次且不累積）

### 英文班離校學生

- 保留歷史學習紀錄
- 不再收到新作業
- 可用每月 NT$299 的基本會員繼續使用
- 可另加購 AI 教材 NT$99／月；基本會員加 AI 合計 NT$398／月

## 6. 已完成的資料庫 Migration

### 第一階段：學生類型及英文班資料

```text
supabase/migrations/20260821161801_phase_01_student_types_and_academy_enrollments.sql
```

內容包括：

- learner type
- 英文班班級
- 中文／英文姓名
- 登入及家長 Email
- 英文班在學紀錄
- 在學狀態
- 舊資料相容

### 第二階段：疊加式會員權限

```text
supabase/migrations/20260821161809_phase_02_additive_membership_access.sql
```

相關共用程式：

```text
supabase/functions/_shared/effective-access.ts
```

### AI 教材加購與試用額度

```text
supabase/migrations/20260823090000_ai_material_addon_access.sql
```

已於正式 Supabase 套用：

- 英文班在學方案不包含 AI 教材生成。
- 新增 `ai_materials_addon_monthly`（NT$99／月、每日 5 次）。
- 七天試用可使用 AI 教材每日 2 次；7 天共 7 次總額度已由 `generate-ai-material` v19 實施。
- 會員後台已拆分核心方案資料與家長週報狀態載入；週報請求失敗不再清空方案及會員資料，且會常駐顯示實際錯誤訊息。已部署正式 Netlify。
- 會員後台方案卡片已調整為桌面 3 欄、平板 2 欄、手機 1 欄，長方案代碼及表單欄位不再溢出卡片；已部署正式 Netlify。
- Stripe 測試環境的 NT$99 recurring Price 已填入 AI 加購方案；經專案擁有者同意，方案已開放給有效在校英文班學生進行沙盒付款測試。
- Additive migration `20260824033104_publish_ai_materials_sandbox_plan.sql` 已套用；方案維持 Stripe 沙盒模式，不會真實扣款。
- `billing-manager` 已修正 TWD 方案金額驗證：網站 NT$99 會以 Stripe 最小金額單位 `9900` 比對，避免誤判價格不一致。
- Checkout、Customer Portal、Webhook 與獨立 `student_access_grants` 授權流程已完成；付款不會覆蓋英文班、教材或其他既有權限。Migration `20260823230023_stripe_additive_subscription_grants.sql` 已套用正式 Supabase。
- AI 加購額度為每日 5 次、台灣時間每月 150 次；每月 150 次只套用 AI 加購，不影響其他完整付費方案。
- 新註冊及既有未轉付費的公開試用會員會使用 `trial_7_day` 方案，讓 7 天內總共 7 次、每日 2 次的限制可以正確辨識；正式資料已校正 3 筆，剩餘不一致為 0。
- 2026-08-24 已部署：`membership-manager` v18、`billing-manager` v14、`stripe-webhook` v14、`generate-ai-material` v21，狀態均為 ACTIVE。
- Supabase 的 Stripe Secrets 已由專案擁有者在 Dashboard 儲存；不得從終端機讀取或顯示其內容。
- Stripe 沙盒 NT$99 訂閱付款、Webhook、AI 權限啟用、教材生成與撤銷後剩餘 0 次已完成端到端驗收；未使用真實付款。
- PR #15 已合併至 `main`，正式合併 commit 為 `38a421f`，Netlify Production 狀態為 `ready`。

### 帳號邀請、Email 與客服（已部署）

- 管理員／老師改為建立 72 小時單次邀請連結，不再產生、顯示或保管學生臨時密碼。
- 學生或家長使用邀請指定的可收信 Email，自行設定密碼；完成 Firebase Email 驗證後才啟用英文班權限。
- 公開註冊頁明確要求可收信 Email，並拒絕 `example.*`、`.invalid` 與 `localhost` 等測試地址。
- 網路購買教材者可自行註冊，登入會員中心後輸入教材兌換碼；英文班在校生仍由工作人員建立邀請，以避免自行選班取得英文班權限。
- 新增 Firebase 密碼重設、登入後修改密碼、公開客服表單與管理員客服案件頁。
- Additive migration `20260824031102_academy_account_invitations_and_support.sql` 已套用；`academy-student-manager` v5、`membership-manager` v18、`support-manager` v1 已部署並為 ACTIVE。
- AI 教材額度卡新增「今日總次數／剩餘」、「本月總次數／剩餘」及台灣時間重新計算倒數。

### 第三階段：分班週期

```text
supabase/migrations/20260822013851_phase_03_academy_placement_cycles.sql
supabase/migrations/20260822015404_phase_03_placement_foreign_key_indexes.sql
```

內容包括：

- 分班週期
- 升級、原班、降級決定
- 班級異動歷史
- 外鍵索引

### 第三階段：英文班學生帳號

```text
supabase/migrations/20260822030358_phase_03_academy_student_accounts.sql
```

相關檔案：

```text
supabase/functions/academy-student-manager/index.ts
src/services/academyStudentService.js
```

已驗證管理員可以建立學生帳號。

## 7. 已更新的 Edge Functions

疊加式權限目前涉及：

```text
membership-manager
content-access
record-play
review-center
learning-activity
learning-progress
assignment-manager
generate-ai-material
academy-student-manager
```

這些 Function 已在先前階段部署；修改前必須先比較本機檔案與目前遠端版本。

不要因為本機有檔案就直接假設遠端版本完全相同。

## 8. 音檔儲存現況

- 音檔已搬移至 Cloudflare R2。
- R2 音檔維持私有。
- 使用預簽網址播放。
- 已確認複製後音檔可播放。
- R2 CORS 已設定正式網域。
- 播放器需要保留 Range Request。
- 原始備份在完整驗收前不得任意刪除。

## 9. 公開首頁現況

首頁 `/` 已改為公開產品 Landing Page，不再直接作為登入頁。

登入頁：

```text
/login
```

公開首頁目前包含：

- 產品主標語
- 功能特色
- 學習方式
- 會員方案
- 方案比較
- 常見問題
- 登入入口
- 七天試用入口

桌面 Navbar 固定於頂部。

登入後 Navbar 在視窗寬度 `1500px` 以下會切換為側邊欄漢堡選單。

側邊欄已移除舊的 `xl` 隱藏類別，確保 `1200px` 至 `1500px` 之間亦可正常開啟。

手機版已有漢堡選單，但仍需要與登入後頁面的 Sidebar 進一步統一視覺及互動。

## 10. MusicPlayer 現況

目前播放器：

- 一般頁面固定在底部
- 部分作業頁使用固定迷你播放器
- 已移除容易拖出畫面外的自由拖曳位置記憶
- 作業捷徑會避開播放器
- 進入作業頁後會隱藏重複的浮動作業捷徑

已完成：

- 桌面與手機播放器第一版
- 真正聆聽不重複區段覆蓋率
- 聽滿 80% 才送出有效完成
- 拖曳與重複小段不列入完整聆聽
- 伺服器 listening session 驗證
- `record-play` Edge Function v16 已部署並為 ACTIVE
- `listening_coverage_sessions` migration 已部署

仍需處理：

- 用真實學生帳號完成「聽滿 80% → 次數 +1」端到端驗收
- 曾使用加速播放後，整個 session 是否永久失效的規則與測試
- 播放器實機手機視覺驗收
- 字幕與逐字稿
- 播放進度更直覺的提示

## 11. 已完成：MusicPlayer 與 80% 聆聽

### 目標

重新設計播放器，並將播放次數改成學生真正聆聽至少 80% 才算一次。

### 已部署內容

- Migration：`20260822174726_listening_coverage_sessions`
- `music_tracks.duration_seconds`
- `listening_coverage_sessions`
- RLS 已啟用
- `anon`、`authenticated` 無直接讀取權限
- `service_role` 具必要 DML 權限
- `record-play` Edge Function v16
- 無登入請求已驗證回傳 401

### GitHub migration 注意事項

正式 Supabase 部署時追加了明確的：

```sql
revoke all on table public.listening_coverage_sessions from anon, authenticated;
grant select, insert, update, delete on table public.listening_coverage_sessions to service_role;
```

分支中的 migration 原始檔仍需確認是否已同步上述權限。不得直接修改已在正式環境執行的 migration；如需補正，建立新的 additive migration。

### 預期規則

- 真正播放經過的不重複區段才列入覆蓋率。
- 直接拖曳到結尾不能算完成。
- 重複播放同一小段不能冒充完整聆聽。
- 暫停時停止累計。
- 覆蓋率達 80% 才送出有效完成。
- 同一工作階段只增加一次。
- 後端必須驗證資料合理性。
- 管理員與老師播放不計入學生次數。
- noInteraction 防掛機功能必須保留。

### 尚未完成的驗收

- 真實學生 Token 的 start／complete 完整流程
- 80% 前不得增加次數
- 80% 後只增加一次
- Seek、重播小段、加速播放不可作弊
- teacher/admin 播放不累計
- 進度 event 能即時更新 Playlist 與作業

## 12. 下一個優先任務：P0 Unit Test

### 現有測試基準

- 分支：`feature/listening-coverage`
- 目前只有 2 份測試檔、共 5 個案例。
- `FreeTrialSignup.test.jsx` 有一個 `/` 與實際 `/login` 不一致的舊預期，先確認後修正。
- `musicAdminService` 已呼叫 `book_status`、`delete_book_tracks`、`archive_book`、`restore_book`、`delete_book`，但目前 `music-admin` Function 沒有對應 action；先建立 contract test，測試應先失敗以證明問題存在。

### P0 實作順序

1. `authService`、`AuthContext`、Login
2. `ProtectedRoute`、`RoleHomeRedirect`
3. `edgeFunctionClient` 與所有 service action/body contract
4. Redux actions 與 `musicReducer`
5. MusicPlayer 純函式：coverage merge、covered seconds、time、clamp
6. MusicPlayer component：session、80%、Seek、加速、冪等、noInteraction
7. membership／trial／activation code／effective access
8. assignment mission pack 完成規則
9. AI 額度、選擇題、90 分通過、教材庫
10. Supabase RLS／GRANT／RPC／migration integration tests

### 第一批完成標準

- 不改功能，只建立可重複執行的測試基礎。
- `npm test -- --watchAll=false` 成功。
- `npm run build` 成功。
- 2026-08-23：新增會員加購顯示／防重複付款與 Checkout Session 欄位 contract 測試；2 個測試檔、2 個案例皆通過，Production build 成功。
- P0 核心規則有正常、邊界、未授權與失敗路徑。
- 不為了讓測試通過而降低 Firebase、Supabase 或角色權限。

### P1 後續順序

1. Conversation 9 關、語音 timeout 與 Demo 不寫入
2. 智慧複習、連續答對 3 次與排程
3. 等級、升級考試與排行榜
4. Dashboard、週報與家長 Email
5. 英文班帳號與 E1／E3／E5／E7 規則
6. 音檔上傳、R2 搬移與 rollback
7. Navbar、Guided Tour、TTS component tests
8. Playwright responsive、Stripe、Storage 與完整 Production E2E

## 13. 已知注意事項

- Netlify 正式部署只追蹤 `main`。
- Pull Request 若不是以 `main` 為 base，可能不會產生預期的 Deploy Preview。
- Firebase API Key 有 HTTP referrer 限制。
- Netlify Preview 網域可能因未加入 Firebase 允許清單而無法登入。
- 不要為測試方便將 Firebase API Key 改為完全不限制。
- Windows 顯示 LF 將改成 CRLF 通常不是程式錯誤。
- Browserslist 過期提示目前不是 build 失敗。
- Node deprecation warning 目前不是 build 失敗。
- 不得直接修改已執行的 migration。
- 不得覆蓋使用者未提交的本機修改。
- AI 教材加購方案已填入 Stripe 測試 Price，沙盒付款與 Webhook 已驗收；目前已公開給有效在校英文班學生測試。
- AI 教材學生額度以台灣時間每月 1 日重新計算；老師與管理員維持獨立額度。
- 帳號邀請／客服 migration 與 `academy-student-manager`、`membership-manager`、`support-manager` 已部署；兩張新表均啟用 RLS，且 `anon`／`authenticated` 無直接讀取權限。
- 本輪環境沒有安裝 `react-scripts`，因此登入競態的 2 個新增測試尚未在本機執行；PR #18 Deploy Preview 與 Netlify Production build 均已成功。
- AI Premium UI 的 3 個會員中心測試已加入；本機環境缺少 `react-scripts`，未直接執行測試。PR #21 Deploy Preview 與 Netlify Production build 均成功，正式部署 commit 為 `43e5982`。
- 2026-08-25 PR #29：帳號管理改採停用後預設隱藏與篩選恢復，新增 Role／Class／Plan／開通狀態／帳號狀態／是否啟用篩選；已建立帳號不再顯示永久刪除。Sandbox Test 刪除嘗試安全失敗且資料未變更，遠端嚴格刪除政策已恢復。13 份測試檔共 34 個案例與 Production build 均成功；PR 尚未合併 `main` 或部署正式 Netlify。

## 14. 下一個 Codex 對話建議提示詞

```text
請先閱讀根目錄 AGENTS.md 與 docs/PROJECT_STATUS.md。

使用「極度節省流量模式」接手 Alan English：

1. 不得重新掃描或閱讀整個專案。
2. PROJECT_STATUS.md 已提供的內容視為可信基準，不要為確認而重讀相同檔案。
3. 每次只處理一個 P0 測試群組。
4. 先用 rg 定位符號，再只讀命中的直接相關區段；禁止無目的讀完整大檔。
5. 已讀過的檔案在同一任務內不得重複讀取，除非修改後驗證差異。
6. 優先使用 git diff、git status、rg 與精準行段，不輸出大量 build log。
7. 不要讀取 mp3、圖片、SCSS、map、zip 或 node_modules，除非測試明確需要。
8. 不要同時重構功能與建立測試；測試先忠實記錄現有規則。
9. 發現現有 bug 時先建立可重現的 failing test，回報後再修正。
10. 每完成一批，只回報修改檔案、測試數、通過結果、發現問題與下一批。

本次從 P0 第一批開始：
- authService
- AuthContext
- ProtectedRoute
- RoleHomeRedirect
- edgeFunctionClient
- Redux actions／musicReducer

最低必要讀取範圍：
- docs/PROJECT_STATUS.md
- AGENTS.md
- package.json 的 scripts/dependencies 區段
- 本批測試直接對應的原始檔
- 現有 2 份測試檔只各讀一次

在修改 GitHub、部署 Function、執行 migration、Push 或合併前仍須取得使用者明確同意。
```

## 15. 極度節省流量工作協定

桌面版 Codex 必須長期遵守：

- 一個任務只讀一組相關檔案，不做全專案 review。
- 若 `PROJECT_STATUS.md` 已寫出狀態，不再重新查證歷史完成項目。
- 建立簡短的已讀檔案清單，避免同一輪重複讀取。
- 大檔先 `rg -n` 找函式，再用 `sed` 讀必要行段。
- 測試失敗只讀第一個相關錯誤，不重跑多次相同指令。
- Build 成功只記錄成功，不貼完整輸出。
- 不自動更新依賴、Browserslist 或 lockfile。
- 不讀未使用的 legacy 頁面，除非目前 Router 或 import chain 真的引用。
- 工作完成後只更新本文件發生變化的段落，不重寫整份文件。

## 16. 每次任務完成後如何更新本文件

只更新以下內容：

- 最後更新日期
- 正式基準 commit
- 本次完成功能
- 測試結果
- 已知問題
- 下一個優先任務
- 尚未部署內容

不要把完整對話、完整程式碼或大量終端機輸出貼進本文件。
