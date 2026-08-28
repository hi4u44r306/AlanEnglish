# Alan English 專案狀態

最後更新：2026-08-27

正式網站：<https://alanenglish.com.tw>

GitHub：<https://github.com/hi4u44r306/AlanEnglish>

正式部署分支：`main`

> 本文件只記錄目前開發狀態。永久架構、安全與工作規則請閱讀根目錄 `AGENTS.md`。
> 目前產品、角色、權限與跨功能邏輯請閱讀根目錄 `PROJECT_LOGIC.md`。

## 1. 專案目前階段

### 新增待規劃需求（2026-08-28）：AI 發音教練

本項目目前為產品規劃，尚未開始語音服務串接、會員價格變更或正式部署。目標是讓學生朗讀指定英文句子後，取得逐字／音素發音評分，並以綠色、黃色、紅色與底線顯示需要練習的字詞。

1. **第一階段 MVP 範圍**
   - 先支援「指定句子朗讀」，不先做自由對話發音評分。
   - 學生使用瀏覽器麥克風錄音，送出後顯示逐字分數、整句分數、自己的錄音回放與重新錄音按鈕。
   - 初期提供綠色（表現良好）、黃色（可以再練習）、紅色（建議重新聽示範）三段式結果，不直接把所有結果判定為絕對正確／錯誤。
   - 第一版先準備 10～20 個短句，使用真實學生測試男／女聲、台灣口音、快慢語速、吵雜環境與 iPhone Safari。

2. **語音評估服務方向**
   - 優先評估具備 Pronunciation Assessment 的專門語音服務，例如 Azure Speech；需要取得單字／音素分數、完整度、流暢度及錯誤類型，不使用一般文字型 LLM 直接判斷發音。
   - 評分門檻、模型版本與錯誤提示必須可調整並記錄，避免因兒童聲音、麥克風或背景噪音造成過度武斷的錯誤標記。

3. **AI 發音教練方案**
   - 規劃售價為每月 NT$299，包含 AI 發音評分與 AI 教材功能。
   - 對外採「合理使用政策」，不承諾無限制提交；初步上限為每月 30～60 分鐘音訊，或 300～600 次短句評分，先到者為準。
   - 每段錄音最多 30 秒，並限制短時間重複提交；會員頁需顯示每日／每月已使用量、剩餘量與到期日。
   - 只有有效 AI 權限可呼叫評分；Edge Function 必須重新驗證 Firebase Token、學生身分、會員權限與使用量，前端不得自行增加額度。

4. **成本試算基準**
   - 以語音服務按音訊秒數計費；規劃估算先用約 US$1.32／音訊小時作為參考，正式價格需以實際服務區域、計價層級與商家報價為準。
   - 每天 20 次、每次 10 秒約 1.7 小時／月；每天 50 次約 4.2 小時／月；每天 100 次約 8.3 小時／月。需將語音服務、Edge Function、暫存、頻寬、付款手續費與客服成本一併納入毛利試算。
   - 原始錄音預設只供即時分析，分析完成後刪除；長期只保存必要的分數、錯誤單字、使用量與模型版本，以控制成本與個資風險。

5. **資料與兒童隱私**
   - 上線前需確認家長同意、服務條款、第三方語音服務資料處理、錄音保存期限、學生刪除權限，以及老師／管理員是否可聽取原始錄音。
   - 預設不永久保存原始錄音；後台以結果與分數為主，不公開學生語音檔。

6. **最低驗收與後續擴充**
   - 驗收錄音權限、拒絕麥克風、錄音格式、網路中斷、重複提交、評分逾時、Safari 相容性、額度扣除與會員到期鎖定。
   - MVP 穩定後，再評估音素提示、重音／流暢度、自由對話、老師查看班級報告與額度加購；未完成真實學生樣本校準前，不直接擴大到全站無限使用。

7. **國小生關卡與教學設計**
   - 主題需貼近國小生生活，優先規劃：日常問候、學校生活、點餐、購物、問路、家庭與朋友、健康求助、兒童旅行情境；住宿等成人情境暫不列為第一版重點。
   - 每個主題分為 4～6 個情境任務；每個情境再分為「跟讀練習 → 引導對話 → 完整角色扮演」三階段，避免只做零散單字或背誦句子。
   - 每關控制在約 5～8 分鐘、5～8 個關鍵單字與 3～5 個核心句型，搭配圖片、人物角色、故事目標、聽示範、慢速播放、提示與重新錄音。
   - E1 以單字／短句和 2～3 回合對話為主；E3 練習固定句型變化與 4～6 回合對話；E5 加入變化問題、原因與簡單問題解決；E7 進行較長角色扮演、表達意見與對話應變。不得只用年級文字自動改變班級權限。
   - 每個情境同時涵蓋單字、功能句型、發音、聽力理解、流暢度與對話應變；需教導 `Can you say that again?`、`Please speak slowly.` 等求助句。
   - 第一版先製作 3 個主題：日常問候、學校生活、點餐；每個主題 4 個情境，共 12 個情境，再依測試結果擴充問路與購物。
   - AI 回饋採鼓勵式語氣，顯示綠色（表現良好）、黃色（可以再練習）、紅色（建議重新聽示範），每次只指出 1～3 個最需要改善的地方，不以一次失敗永久鎖定關卡。
   - 每關通過需同時考量發音、完成度、流暢度與理解回應；完成後標記「尚未開始／學習中／需要再練習／已掌握」，並安排後續間隔複習。

### 2026-08-27 狀態整理

已完成並部署：

- SEO 公開頁面基礎（PR #58）：`/`、`/links`、`/shop`、`/materials` 已有獨立 metadata 與 sitemap；`/home`、`/showcase` 301 導向 `/`；私人路由使用 `noindex,nofollow`。
- SEO 正式 Netlify deploy：`6a9043561e2aa9f6b1060258`，狀態 `ready`。

仍未完成或需要驗收：

- CSV 學生建立、登入卡、QR 啟用、登入與復原碼的完整沙盒流程。
- Email 驗證／重設信的實際收件、垃圾郵件與 SPF／DKIM／DMARC 驗證。
- MusicPlayer 真實學生 80% 聆聽、Seek／重播／加速防作弊、角色計次、手機視覺、字幕與逐字稿驗收。
- 七天試用的獨立引導式教材內容。
- 手機版 Sidebar 與登入後 Sidebar 的視覺及互動統一。
- P0 Unit Test：`FreeTrialSignup` 路由預期、`musicAdminService` action contract，以及核心 auth／route／Edge Function contract 測試。
- `listening_coverage_sessions` migration 原始檔與正式權限設定的一致性確認。

文件維護提醒：本檔案部分歷史段落仍保留舊版基準與過往待辦描述；後續應以本節最新摘要及各 PR／部署紀錄為準，逐步清理重複或過時內容。

### 新增待規劃需求（2026-08-28）：商城統一帳號與自動開通

本項目目前為產品規劃，尚未修改正式程式、資料庫或部署環境。目標是讓網路教材商城與聽力平台使用同一組 Firebase 帳號，降低雙帳號造成的訂單／教材對應錯誤。

1. **統一身分與購買資格**
   - Firebase Authentication 作為商城與學習平台唯一登入來源；Supabase 僅保存學生、訂單、付款與教材權限資料。
   - 使用者必須完成 Email 驗證後才能建立教材 Checkout；驗證完成後應保留購物車與原本的導回位置。
   - Supabase `students.firebase_uid`／`student_id` 作為主要關聯，不以 Email 作為教材歸屬鍵；Email 僅作為登入、收據與通知資料。
   - 家長 Email 維持獨立聯絡欄位，不可用家長 Email 開通教材，也不可與學生登入帳號混用。

2. **付款與教材自動開通**
   - 建立 Checkout 前由後端驗證 Firebase ID Token、Email 驗證狀態、學生身分、商品包與正式價格；前端不得自行指定價格或教材。
   - `store_orders` 直接關聯 `student_id`／Firebase UID，保存商品、價格與寄送資料快照。
   - 只有 Stripe Webhook 驗證付款成功後，才能依商品包內容建立 Workbook、聽力本與網站教材權限；Webhook 必須具備冪等與重試安全。
   - 購買的實體教材擁有權永久保留；網站使用權依商品規則提供 90 天，後續由 NT$299 基本會員延續既有教材的網站功能。
   - 重複購買同一教材包不得產生重複擁有權；需先確認 90 天權限採延長目前到期日或重新起算的規則。

3. **退款、付款異常與訂單生命週期**
   - 需定義付款失敗、Webhook 延遲、全額退款、部分退款、爭議款與已出貨後退款時的教材權限處理方式。
   - 訂單付款、教材開通、出貨狀態與退款狀態分開記錄；歷史訂單與付款紀錄不可因帳號停用或刪除而消失。
   - 後台需能查詢購買者、商品包、教材權限、網站使用權到期日、付款事件與出貨時間軸，並保留操作稽核紀錄。

4. **既有商城帳號移轉**
   - 現有 Supabase Auth 商城帳號與訂單不得直接刪除；先完成新 Firebase 帳號驗證，再依安全流程移轉至對應 `student_id`。
   - Email 相同不能單獨視為已完成合併；必須經 Firebase Email 驗證或重新登入確認，並處理未驗證、不同 Email 與一人多帳號情況。
   - 移轉完成並驗收新訂單流程後，才停用舊商城登入入口。

5. **開通碼定位**
   - 線上商城付款不再要求開通碼，改由付款 Webhook 自動開通。
   - 開通碼保留給實體課程、贈送教材、管理員補發、客服補償與離線銷售；既有一次性、防重複兌換與稽核規則仍需保留。

6. **第一階段範圍與驗收**
   - 第一階段先不支援訪客購買、代購或轉贈，購買者帳號即為教材使用者。
   - 需驗收：已存在 Firebase 學生購買、英文班在校生購買、離校生購買、Email 未驗證阻擋、付款成功自動開通、重複 Webhook、退款與舊商城帳號移轉預覽。
   - 目前另有「付款後依 Email 自動認領訂單」的本機草稿設計；若採用本統一帳號方案，應改為建立訂單時直接綁定 `student_id`，不可將 Email 認領方案部署到正式環境。

### 新增待規劃需求（2026-08-27）

1. **商城商品與開通碼自動解鎖**
   - 付款完成後必須以商品包／商品項目建立可追溯的購買紀錄，不能只依前端傳入的商品名稱判斷。
   - 使用者註冊或登入商城帳號後輸入開通碼，後端需驗證開通碼、購買商品、使用者與兌換狀態，成功後自動寫入對應教材擁有權與網站權限。
   - 開通碼必須一次性、防重複兌換，並保留商品快照、兌換時間與操作紀錄；不得讓使用者自行指定要解鎖的教材。

2. **家長 Email 欄位規則**
   - 家長 Email 一旦完成驗證並被付費方案或重要通知使用，預設不可由學生自行修改。
   - 若需要更換，應改由管理員核准或透過重新驗證流程處理，並保留變更紀錄；不可只在前端設為 disabled 而缺少後端限制。

3. **英文等級與教材包綁定**
   - 每個英文等級必須對應可購買的教材包、網站教材權限、音檔與下一級推薦。
   - 等級、教材包與教材擁有權需由後端關聯判斷；購買教材包後才解鎖對應內容，不得只依 URL 或前端等級文字放行。

4. **Sidebar 當前頁反白與自動置中**
   - 所有 Sidebar 導覽項目都要依目前 pathname 顯示 active／反白狀態，不只 AI 教材方案頁。
   - Sidebar 開啟或路由切換時，應嘗試將目前項目捲動到可視區中央；若項目接近頂端或底端而無法置中，保持可見即可。
   - 需驗收學生、老師、管理員、教材分類與底部客服等路由，以及手機版捲動、鍵盤焦點與背景鎖定。

5. **客服案件 Email 通知**
   - 新客服案件建立後，寄通知至所有有效管理員 Email。
   - 客服案件狀態、指派人或重要回覆變更時，也要通知所有有效管理員，並以事件／案件狀態避免重複寄送。
   - 寄信需由後端或既有通知佇列處理，不能信任前端指定收件人；需保留寄送成功、失敗與重試紀錄，且不可洩漏其他客戶個資。

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

- PR #21：AI 加購付款按鈕載入狀態、AI Premium 啟用卡、每月續訂日與 Navbar／手機 Sidebar 徽章；已合併並部署正式 Netlify。
- `membership-manager` v19：只回傳 AI 加購的續訂日期與週期結束取消狀態，不回傳 Stripe 識別碼或任何金鑰；已部署且為 ACTIVE。
- PR #23：在校生會員名稱與 iPhone 日期欄位寬度修正；已合併至 `main` 並完成 Netlify 正式部署。
- `membership-manager` v20：修正無期限英文班權限被顯示為剩餘 0 天；已部署且為 ACTIVE。

進行中：

- `codex/mobile-header-actions`：學生手機版 Header 將通知與漢堡按鈕整合為右側操作群組，修正通知貼近 Logo、漢堡單獨靠右的不自然間距；`MainNavbar` 測試、`git diff --check` 與 Production build 已通過，分支已推送 GitHub，固定學生測試站 deploy `6a8ef77517662da3aeca86a2` 已發布，實際 CSS／JS 均包含新版群組。登入 Session 已回到登入頁，因此尚待使用者登入後進行手機實機視覺驗收；尚未合併 `main` 或部署正式站。
- `codex/membership-ai-pricing`（功能 commit `e08445a`，合併 commit `f2f2298`）：新定價與資格規則已合併並推送至 `main`。基本自主學習會員為 NT$299／月；一般會員 AI 加購為 NT$129／月，合計 NT$428；英文班在校生與離校生 AI 優惠為 NT$99／月，離校生需搭配基本會員，合計 NT$398。已建立 additive migration `20260826132237_membership_ai_pricing.sql`，同步調整公開首頁、會員中心、AI 入口、付款資格、Webhook 白名單與額度辨識。19 份前端測試共 52 個案例、8 個純後端資格／Stripe 金額測試、8 支 Edge Function TypeScript 語法解析、`git diff --check` 與 Production build 均成功。固定測試站 deploy `6a8ef18c17f4000b6f8d792b` 與正式站 deploy `6a8ef46b16d40b000858d10e` 均已成功；尚未建立 Stripe NT$299／NT$129 Price、套用遠端 migration 或部署 Edge Functions，因此新版付款流程仍未正式啟用。
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

### 已確認待實作：會員續用、班級教材與教材商品包

以下項目目前只完成產品規則確認，尚未開始程式碼、migration、Stripe 商品、Edge Function 或正式部署：

1. **教材擁有權與網站使用權分離**
   - 購買教材後永久保留「曾購買哪些教材」與學習紀錄；附贈的網站使用權自兌換日起算 90 天，且不自動續費。
   - `basic_membership_monthly`（NT$299／月）只延續學生已購教材的聽力、進度、情境會話與智慧複習，不會自動解鎖下一級或未購買教材。
   - 班級教材、自行購買教材、管理員贈送教材採疊加式權限，任何一種來源都不得覆蓋或刪除其他來源。
2. **在校生／離校生與訂閱生命週期**
   - 學生設定頁依狀態顯示在校班級、入學／離校日期、已購教材、基本會員、AI 方案、續訂日、取消狀態與家長 Email；離校後仍可登入並保留 XP、AE Points、教材及歷史紀錄。
   - 後台新增預定離校流程，由管理員設定生效日並在確認前顯示受影響的班級教材、作業、基本會員與 AI 到期日；離校不得等同停用帳號。
   - 班級權限於離校生效日結束；已付款 AI 必須使用至自己的 `current_period_end`，不得因在學狀態改變而立即失效或仍扣款卻不可使用。
   - 教材 90 天、預定離校與方案到期前建立站內通知及家長 Email 提醒；付費方案缺少可收信家長 Email 時不得進入 Checkout。
   - 教材與七天試用不自動扣款；NT$299、NT$99、NT$129 月費方案只在家長明確授權後自動續訂，並可由 Stripe Customer Portal 設為本期結束取消或在到期前恢復。
3. **管理員班級教材設定頁**
   - 新增管理頁，僅管理員可將實際教材資料庫中的教材指派給 E1、E3、E5、E7，例如 E1 可設定 `Workbook_1`、聽力本 1、`Super Easy Reading 1`；不得將教材名稱硬寫在前端。
   - 依教材系列分組顯示可選教材，提供搜尋、已選數量、生效日、影響預覽、二次確認、最後修改者與時間；老師只能讀取設定，不可修改。
   - 新資料表須使用 additive migration、唯一鍵、外鍵索引、RLS 與明確授權；前端不得直接取得管理寫入權，Edge Function 必須重新驗證 Firebase Token 與 admin 角色。
4. **學生教材與音檔限制**
   - 有效在校生可使用所屬班級教材，加上自行購買或管理員贈送的教材；其他教材顯示鎖定，直接輸入路由或偽造教材／音檔 ID 也必須由後端拒絕。
   - 轉班後按新班級設定取得教材；離校後移除班級來源，但保留自行購買、贈送與歷史進度。
5. **老師發布作業限制**
   - 老師先選擇自己被授權的目標班級，教材與音檔選單只顯示該班目前啟用的教材。
   - `assignment-manager` 必須再次驗證教師班級授權、目標班級、教材與音檔對應；空白班級或跨班教材請求一律拒絕。
   - 管理員調整班級教材時不得破壞已發布且尚未到期的作業；既有作業保留發布時的教材快照至到期或停用，新作業使用最新設定。
6. **教材商品包管理**
   - 班級教材設定與網路商品包分開管理。新增管理頁建立「一本 Workbook＋一本聽力本」商品包，並可加掛對應網站教材與音檔。
   - 每個商品包記錄程度、學習目標、前置教材、下一級推薦、一般售價、有效會員教材價、是否附贈 90 天、封面與草稿／上架／停售狀態；價格或內容未完成時不得上架。
   - 未訂閱學生購買標準教材包後取得實體教材、對應教材權限與 90 天網站使用權；已訂閱 NT$299 的學生購買下一級時，初期採較簡單的「會員教材價」，NT$299 照原週期續訂，不再重複贈送或重算三個月。
   - NT$299 不包含新的實體教材；學生沒有下一級教材擁有權時，下一級內容保持鎖定並顯示購買教材包入口。AI 仍為獨立加購，除非未來另行建立明確商品。
7. **程度推薦、試用與逐字稿**
   - 建立包含單字、句型與聽力的簡短程度測驗，提供「較簡單／建議／較有挑戰」三種教材包結果、試閱頁與試聽；結果只做推薦，不強制鎖死，老師／管理員可人工調整。
   - 七天試用使用不依賴實體書的引導式體驗教材，展示聽力、英文字幕、中文提示、逐字稿、AI 練習、情境會話與成果推薦；公開 Showcase 僅提供少量短版示範。
   - 逐字稿依有效教材權限提供：在校生、購買者與會員只能查看已授權教材，試用者只能查看試用內容；建議第一次先聽、第二次開英文字幕，最後才主動查看完整逐字稿。
8. **暫緩年費方案**
   - 先完成月費付款、取消／恢復、離校轉換、付款失敗、提醒信、教材包與權限驗收；累積續訂率、取消原因與客服資料後，再評估是否新增基本會員年費，初期不建立多組年費與 AI 組合。
9. **最低驗收範圍**
   - 驗證 E1／E3／E5／E7 學生只取得班級與個人疊加權限，未授權教材、音檔、路由及偽造請求均被拒絕。
   - 驗證老師只能替授權班級選取該班教材，管理員可設定但老師不可修改，既有作業不因教材設定變更而中斷。
   - 驗證教材購買、90 天到期、NT$299 續用、下一級教材包、離校、AI 已付款期間、取消後恢復與家長提醒的正常／邊界／失敗流程。
   - 完成相關前端測試、Edge Function contract 測試、資料庫 RLS／索引檢查、`git diff --check`、Production build、412px 手機版與各角色實機驗收後，才可進行遠端 migration、Function 與正式部署。

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

- 購買教材後提供三個月線上權限
- 權限從兌換日開始
- 到期後可選擇每月 NT$299 的基本自主學習會員
- AI 教材不因購書或基本會員自動取得；一般會員可另加購 NT$129／月
- 教材最終售價尚未決定

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
