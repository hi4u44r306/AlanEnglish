# Alan English 專案狀態

最後更新：2026-09-03

本次進行中（2026-09-03，尚未部署）：

- 會員權限單純化與混合作業 V2 第一階段：分支 `codex/academy-all-access-assignment-v2`，基準 `origin/main`／`54f99e1`。已建立 additive migration，準備將有效在校英文班方案改為包含全部正式聽力、AI 教材、發音練習、會話、複習及所屬班級作業；教材包附贈 90 天改為可使用全部正式聽力，但不包含 AI、發音及作業。發音權限改用獨立 `pronunciation` feature，並保留舊 AI 方案欄位相容。AI 個人生成額度規劃為每日 5 次／每月 150 次。AI 加購目標改為 NT$299，但本批不先修改價格，必須等新的 Stripe Price 與全站顯示、條款同批切換，避免顯示 299、實收 499。
- 混合作業資料底座與教師端第二階段：舊作業保持 `schema_version = 1`；新增 `multi_activity_v2`、活動項目、教師核准頁面文字、共用 AI 題目快照、發音提示句、學生逐項進度及發音分數紀錄。原始錄音不保存，新表開啟 RLS 且只由驗證 Firebase Token 的 Edge Function 經 `service_role` 存取。`assignment-manager` 已新增頁面來源草稿／發布、V2 唯讀預覽與建立不可變快照 action；每次會重新檢查教師班級、目前班級教材、題組擁有權及已發布頁面文字。教師頁可切換純聽力或混合作業、選取既有 AI 題組與發音提示句。學生 V2 作答、逐項進度、結果報表及完成獎勵尚未接上；因此尚未套用正式 migration、部署或推送，且不得為真實學生啟用 `assignment_v2`。
- AE Points 新資格規則：所有有效學生仍可累積 XP；只有有效在校英文班學生可新增 AE Points 及使用獎品商城。既有合法點數與兌換紀錄保留。資料庫發獎 RPC 會把非在校生的新點數與升等點數歸零，`gamification` 也會拒絕非在校生讀取／兌換商城；前端同步隱藏入口並顯示資格說明，尚未部署。
- 本機驗證：新會員／作業 V2 契約 13/13、作業服務測試 3/3、教材商務契約 37/37、聽力獎勵契約 14/14、12 支 Edge Function 語法與 Production build 均成功；第三階段第一批新增學生端 V2 題組讀取／伺服器快照評分／灰度、班級與活動歸屬驗證，尚待作業專用聽力、發音評分與整份獎勵。部署前必須先盤點仍在扣款中的英文班在校生 AI 加購訂閱，逐筆決定取消／到期不續／退款，避免功能改為學費內含後仍重複收費；不得由 migration 靜默取消 Stripe 訂閱。
- 自主熟練 V3 與大型背景暫停確認已由 PR #96 合併至 `main` commit `54f99e1` 並部署正式站；`record-play` v28 為 ACTIVE。有效聆聽仍需 80% 不重複覆蓋；自主同音檔累計 10 次發 10 XP／1 AE Point，每人每檔終身一次、每日最多 3 檔。總聽力照常累計，但同一 session 只分配給一份尚需該音檔的有效作業，否則才計自主。切換分頁即暫停並顯示大型確認。本機 PGlite 9/9、契約 14/14、全前端 39 suites／119 tests、Edge Function 語法、Production build 與正式發布檢查均成功；仍待真實 iPhone 鎖屏／safe area 長時間驗收。

本次進行中（2026-09-02）：

- 有效聆聽覆蓋率與平板播放器可靠性修正（正式站已部署並驗收）：PR #94 已合併至 `main` commit `9235bbd`，`record-play` v27 為 ACTIVE，Netlify production deploy `6a982ebe0793960007d2ca19` 已為 `ready`。正式畫面原本播放至 `1:40 / 1:41` 卻只有約 64%，原因是前端舊版會把單次超過 3 秒的延遲播放事件整段丟棄，且第一首音檔若 metadata 尚未就緒便不會補建伺服器 session。新版改以音檔前進量對照單調實際時間、在 `canplay`／後續播放事件重試 session、頁面隱藏即暫停；未達 80% 只保存不可發獎診斷，不增加次數、XP、AE Points 或作業進度。播放器自訂樣式改在第三方樣式之後載入，`900px`（含）以下統一使用緊湊排列。正式 P6 實播後資料庫保存 `99.87%`、`eligible_for_count=true`、`count_recorded=true`，畫面正確顯示 `+5 XP` 並自動切換下一首；`412、682、768、810、900、1024px` 均無水平溢位或遮住今日作業，Sidebar 背景鎖定且 z-index 高於播放器，展開播放器可正常操作，Console 無 error／warning。聽力獎勵契約 14/14、coverage 單元 4/4、全前端 37 suites／106 tests、11 支 Edge Function 語法、Production build 與 `git diff --check` 均成功；iPhone safe area 由 CSS `env(safe-area-inset-bottom)` 與契約測試確認，本次 Windows 瀏覽器無法模擬實際瀏海 inset 值。
- 聽力 XP／AE Points、純聽力作業與升等經濟規則（正式站灰度已部署）：PR #92 已合併至 `main` commit `e21ca5f`，Netlify production deploy `6a9818d3a209c400081d7b15` 已為 `ready`，正式首頁與 bundle `main.05a54eba.js` 均回應 200。正式 additive migration `listening_rewards_and_level_up` 已成功套用，`record-play` v26 與 `assignment-manager` v25 均為 ACTIVE；新資料表與 V2 RPC 已確認存在，`anon`／`authenticated` 不可直接執行結算 RPC。本批不使用付費 Supabase branch，目前只為 E3 在校測試帳號 `aeplanacademy` 啟用 `listening_rewards_v2`，其他學生缺少旗標時保持舊流程。新規則把一般總聽力與作業進度建立在同一筆 80% 有效 Session，但作業只累計發布後至截止前的次數；新作業僅允許純聽力，每檔 1～10 次、預設 3 次，整份完成一次性發 30 XP／5 AE Points，舊 AI 作業只保留教師歷史報表。聽力獎勵契約 11/11、商務契約 37/37、全前端 36 suites／102 tests、11 支 Edge Function 語法、Production build、`git diff --check` 與 PR 8 項檢查均成功。尚待使用 `aeplanacademy` 完成真實 80% 播放、防掛機、作業 3 次及獎勵防重的正式帳號驗收。
- 手機 Sidebar 教材辨識度修正（正式站已部署）：PR #90 已合併至 `main` commit `9fbf7fc8`，Netlify production deploy `6a976c3b02e11b00073c9596` 已為 `ready`。深藍色 Sidebar 內的教材書名改為白色高對比文字，並以 Sidebar 專屬選取／滑過樣式覆蓋桌面 Dropdown 的灰字與白底規則；移除每一本教材前方的藍色書本圖片，保留分類標題圖示及鎖定狀態圖示。桌面「我的教材」Dropdown 維持原有書本圖片與淺色選單視覺，不改動教材權限、路由或後端判定。Navbar 6/6、全前端 34 suites／99 tests、Production build 與 `git diff --check` 均成功；正式登入畫面確認 22 本教材全部為白字、藍色書本圖片 0 個，作用中教材為深色半透明底＋白字，Console 無 error／warning。
- Navbar「我的教材」分層選單（正式站已部署）：PR #88 已合併至 `main` commit `c32b4bc1`，Netlify production deploy `6a9768755a15470008a5c8a1` 已為 `ready`。學生桌面版不再一次列出全部書名，改為先顯示教材分類與各分類本數，展開分類後才顯示可用教材；目前所在教材分類及書名會標示作用中。手機 Sidebar 的「我的教材」同步改為可收合分類，避免基本會員可聽全部正式教材後選單過長。維持只顯示後端判定已解鎖教材，不改動教材權限或直接網址的後端驗證。Navbar 6/6、全前端 34 suites／99 tests、Production build 與 `git diff --check` 均成功；正式路由回應 200，production bundle 已確認包含新版分類選單，登入後真實帳號畫面仍待使用者驗收。

本次進行中（2026-09-01）：
- 商品、價格與聽力權限單純化（正式站已部署）：PR #86 已合併至 `main` commit `c7f44d77`，Netlify production deploy `6a96eee37100d00009d91247` 已為 `ready`。NT$299 基本自主學習會員及英文班在校方案改為可使用全部已啟用的正式聽力教材，仍不包含 AI 或跨班作業；教材包附贈 90 天／開通碼等限制型權限才逐本檢查 entitlement。AI 新訂閱統一為 `ai_materials_addon_monthly` NT$499，「AI Premium」維持稱號，重複的一般會員 AI 代碼與兩個舊月費方案改為停用歷史資料。教材包改為單一售價、每次購買固定附贈 90 天，且必須各有一本課本、Workbook、聽力本及一組 Stripe 測試 Product／Price 才能上架；既有只有兩本的 Level 1 測試商品已安全退回草稿，不刪除既有訂單或權限。後台新增課本欄位並依教材分類篩選。正式 additive migration `simplify_products_and_listening_access` 已套用；`content-access` v21、`record-play` v25、`commerce-manager` v11、`billing-manager` v26、`membership-manager` v33 均為 ACTIVE，OPTIONS 健康檢查回應 200。商務契約 37/37、商城契約 13/13、全前端 34 suites／99 tests、Edge Function 語法、Production build 與 `git diff --check` 均成功；正式首頁、教材、商城及會員路由回應 200。正式 Stripe live 商品／Price 仍未建立，網站明示目前為測試付款。
- 當天誤選教材移除介面（正式站已部署）：PR #84 已合併至 `main` commit `e19887e8`，Netlify production deploy `6a96c8293f85f60008d0339c` 已為 ready。班級教材後端原本已能以修正後完整清單移除今天版本的誤選教材；本批補上獨立的「修正後保留的教材」清單與每本「移除」按鈕，預覽會明確說明學生不再透過目前班級版本取得移除教材。自行購買、管理員贈送、開通碼及真正歷史教材的獨立 entitlement 不受影響。正式 E3 已驗收顯示 Workbook 4、Listening 4 的逐本移除按鈕，未點擊移除、預覽或二次確認，E3 資料未因驗收改動。取代誤選教材的元件案例與教材管理頁共 4/4、全前端 34 suites／99 tests、Production build 及 `git diff --check` 均成功。
- 當天教材版本修正（正式站已部署）：PR #82 已合併至 `main` commit `2efcd21e`，additive migration `correct_current_class_materials` 已套用，`commerce-manager` v10 為 ACTIVE，Netlify production deploy `6a96c25547f5b3000760339f` 已為 ready。正式 E3 已由管理員於 2026-09-01 建立第 2 版「2026 秋季」，目前教材仍為 Workbook 3、Super Easy Reading 3；本批新增「修正目前版本」模式，只允許管理員修正台北日期今天建立且目前生效的同一設定，可在同一天重複修正，每次須用最新 `updated_at` 重新預覽與二次確認；同一交易替換教材清單、更新學期名稱並寫入 `corrected` 前後快照，不建立重疊版本、不修改永久 entitlement、不刪除學習紀錄或作業快照。正式站第一次修正預覽以新增 Listening 3 驗證，正確顯示 1 位在校生與 0 份既有有效作業；未按下二次確認，資料庫 `corrected` 稽核筆數仍為 0，E3 正式教材未被修改。當天連續修正兩次的元件測試 1/1、教材管理頁 3/3、商務契約 35/35、全前端 34 suites／98 tests、Edge Function 語法、Production build 與 `git diff --check` 均成功。
- 新學期教材換版精靈（正式站已部署）：PR #80 已合併至 `main` commit `a05d964`。正式 `commerce-manager` 日誌確認原「教材商務服務無法使用」來自 `academy_enrollments` 對 `students` 有多個外鍵時使用模糊 embed，載入查詢已改用明確 `academy_enrollments_student_id_fkey`。管理員頁改為三步驟精靈，換版只允許在台北日期的生效當天執行；預覽會分列全部歷史教材永久保留、下學期教材、相較上一版增減項目、受影響學生與既有作業。正式 additive migration `term_material_rollover_entitlements` 已成功套用，新增的兩個 RPC 為 `security invoker`，`anon`／`authenticated` 均不可執行且只有 `service_role` 可執行；同一交易會盤點截至前一天的全部歷史教材版本、作業快照及有效播放證據，按 enrollment 建立可重複執行的永久 `academy_history` entitlement，再結束舊版、建立新版與 audit。`commerce-manager` v9 為 ACTIVE，OPTIONS 與公開方案 POST 均回應 200；Netlify production deploy `6a96764e8a43f10008bbea78` 已為 ready。正式 E3 唯讀預覽顯示 2 本歷史教材、3 位歷史學生、6 筆預計保留權限、1 位目前在校生及 0 份有效作業，頁面 Console 無 error／warning；依本批授權未按「二次確認並建立版本」，資料庫再次確認今日新增教材版本、換版 entitlement 與換版 audit 均為 0。商務契約 32/32、全前端 34 suites／97 tests、Edge Function 語法、Production build 與 `git diff --check` 均成功。
- 正式站優先發布規則：專案擁有者確認往後一般低至中風險修改在完成本機測試、Production build 與 diff 檢查後，直接 Push 功能分支、建立 PR、合併 `main`、部署相關非破壞性 Edge Function 與 Netlify production，再於正式網址驗收；固定測試站不再是每次發布的必要步驟。資料庫 migration／正式回填、登入與核心權限、付款／Webhook、破壞性操作、大範圍架構或套件改動仍列為重大改動，原則上先走隔離驗證並取得該批明確授權；若專案擁有者針對特定重大改動明確要求直接正式站測試，則依該批授權執行，但不得省略影響說明、回復方案及發布後驗收。本次離校教材永久保留已獲明確授權直接套用正式 Supabase、部署 `commerce-manager`、合併並發布正式 Netlify，不經固定測試站。
- 離校生歷史教材永久保留（正式站已部署）：PR #78 已合併至 `main` commit `59acc294`。Additive migration `preserve_departed_academy_materials` 已以正式版本 `20260901032833` 套用；盤點整合每段 enrollment 期間重疊的班級教材版本、班級作業教材及伺服器播放進度，離校 RPC 會在同一交易內建立永久 `academy_history` `student_book_entitlements`、以排定生效日結束 enrollment，並記錄保留教材清單。正式回填實際建立 4 筆永久 entitlement，影響 2 位既有離校生、共 2 本不同教材；永久欄位 4/4 正確，重複來源 0 筆，超出 enrollment 結束日的盤點資料 0 筆。管理員離校預覽會列出永久保留教材，學生設定頁會獨立顯示來源。NT$299「基本自主學習會員」只恢復已擁有教材的聽力、會話與複習功能，不要求重買實體書、不贈送新教材；正式方案再次確認 `assignments=false`、`requires_book_entitlement=true`，作業仍只允許有效在校 enrollment。`commerce-manager` v8 已部署為 ACTIVE，OPTIONS 與公開方案 POST 均回應 200；Netlify production deploy `6a96474608ff4ffb646d3849` 已發布，正式首頁、學生設定及離校管理路由均回應 200，正式 bundle `main.1dbd8689.js` 與本機建置一致且包含 `academy_history`。商務契約 28/28、學生設定 7/7、所有 Edge Function 語法、Production build 與 `git diff --check` 均成功；固定測試站依新發布規則未部署。
- 已完成測試範圍確認：專案擁有者確認登入與 Session、`authService`／`AuthContext`／Login、`ProtectedRoute`／角色首頁導向、一般會員／在校生／離校生的教材與作業權限回歸，以及 MusicPlayer 80% 聆聽、防 Seek／重播小段／加速作弊、單一 session 冪等與 teacher／admin 不累計等項目均已完成。後續規劃不得再把這四組當成尚未開始的下一項工作；本條為既有完成狀態註記，並非本輪重新執行全部測試。
- 學生首頁作業誤警告修正：正式 Edge Function 日誌確認離校＋AI 方案帳號的首頁 6 項資料中，只有 `assignment-manager` 依權限規則回傳預期的 403，其餘聽力、複習、AI、會話與教材目錄皆為 200。前端改以 `effective_access.features.assignments` 判斷是否載入作業；離校生、一般會員與試用會員直接使用空作業結果，不再把「沒有作業權限」誤顯示成資料更新異常，在校生若作業服務真的失敗仍會保留警告。相關 3 個 test suites／9 個案例、Production build 與 `git diff --check` 均成功。PR #76 已合併至正式 `main` commit `c566a6e`，Netlify production deploy `6a9636a75aa88400082aef23` 已發布且為 `ready`；正式離校＋AI 方案帳號已驗收首頁不再顯示誤警告，仍顯示無新作業、AI Premium 與自主學習內容，Console 無 error／warning。
- 舊會員方案文字與邏輯稽核：分支 `codex/fix-departed-ai-addon` 已推送並建立 PR #75。「全方位月訂閱」與「聽力月訂閱」確認來自早期 `all_access_monthly`／`listening_monthly` 方案及 `allcover`／`listeningonly` 學生欄位，舊會員紀錄只保留歷史相容，不再出現在現行方案卡、管理員可選方案、開通碼、手動授權或新帳號預設值。學生會員中心、首頁與帳號管理改以有效 grant 判定目前方案；只有舊紀錄而沒有現行有效權限時顯示「歷史會員權限（待轉換）」，避免把舊名稱誤認為仍可購買的商品。三支未被現行前端使用的舊建帳／更新 API 已部署為 `410 Gone`，引導使用目前的 `academy-student-manager`／`membership-manager` 流程。AI 商品、付款與帳務名稱統一為「AI 教材與發音練習」NT$499／月；`AI Premium` 則保留為有效 AI 加購會員的高級稱號，不是另一個方案或價格。稱號已加入學生首頁帳號卡、Navbar／手機選單、會員中心、我的設定及 AI 教材額度卡，未加購者不顯示。學生設定頁會把相同方案代碼的多筆歷史授權整理為一筆：有效方案優先，否則顯示結束日期最新的一筆；原始 grant 歷史資料不刪除。現行程式碼全域掃描只剩歷史方案辨識清單，以及與方案無關的 `student_listening_monthly` 聆聽統計表名稱；舊 migrations 與過往狀態紀錄保留原文作為稽核歷史。7 組相關前端測試共 35/35、14 支 Edge Function／共用模組語法檢查、Production build 及 `git diff --check` 均成功。`membership-manager` v32、`billing-manager` v25、`create-user` v18、`create-student` v18、`update-user` v17 均已部署為 ACTIVE，OPTIONS 回應 200，三支舊 API 的 POST 回應 410。固定測試站 deploy `6a963106ce55f0052cd49578` 已發布；具 AI 權限的既有在校沙盒帳號已在線上驗收首頁、設定頁、會員頁與手機選單的 AI Premium 稱號，商品名稱仍為「AI 教材與發音練習」，桌面與 412×915 無水平溢位且 Console 無 error／warning。PR #75 已合併至正式 `main` commit `bcc5c9a`，Netlify production deploy `6a9632a4d114460b95a71322` 已發布並完成正式站驗收。

本次進行中（2026-08-31）：

- 學生設定方案狀態修正：`codex/fix-departed-ai-addon` 已納入 PR #75 並部署固定測試站。離校生會從最近一次 enrollment 顯示實際離校日；「基本會員與 AI 方案」不再混入歷史 `academy_internal` 在學權限，已到期／撤銷方案也不再誤顯示續訂日。AI 加購名稱與權限提示統一為「AI 教材與發音練習」，明確包含 AI 教材生成及發音練習。學生首頁帳號卡也改以有效 grant 判斷主方案，不再被舊 `membership.plan` 誤標為舊版方案。正式站已建立一組離校＋基本會員＋AI 教材與發音練習沙盒帳號，驗證會員中心、AI 教材、發音練習及無新作業權限皆正確；正式站設定頁與首頁仍待 PR #75 合併並部署後複驗。會員中心、學生設定及方案標籤共 18/18 測試、Production build 與 `git diff --check` 均通過。
- 離校已到期會員摘要：PR #73 已合併至正式 `main` commit `30d8829c`。會員頁在有效 grant 已結束後改用會員紀錄的 `current_period_end`、`access_ends_at` 或 `trial_ends_at` 顯示實際結束日；已到期且歷史資料沒有日期時顯示「已結束」，不再誤顯示「無期限」。既有 Playwright 導覽與三種學生權限測試已整合，並新增離校且方案已到期的專用驗收情境；好友、戰績、PK 與合作賽則只加入 P2 未來規劃，尚未開始實作。會員中心 9/9、Navbar 5/5 通過；Playwright 桌面／手機共 8 個權限案例可正確載入，Production build 與 `git diff --check` 成功。固定測試站 deploy `6a952b89db316a425c46ba12` 已發布；Netlify production deploy `6a958e6548ca4d5e9ec873b5` 已發布且為 live，正式首頁、會員路由及新版 `main.57d27a85.js` 均回應 200。尚待以離校到期學生登入完成正式畫面驗收。
- 付費試用會員身分同步：分支 `codex/fix-trial-member-identity` 已推送並建立 PR #72；additive migration `promote_paid_trial_members` 已套用正式 Supabase。當 `trial_user` 的 `basic_membership_monthly` 真正啟用／已有付款紀錄，或教材訂單確認為 `paid`，資料庫會自動轉為 `textbook_customer`；更新條件只鎖定 `trial_user`，不覆蓋 `academy_student`、在校／離校紀錄或教材權限。正式回填影響 1 位，套用後 `aeplanbasic` 的資料庫與 effective access 都是 `textbook_customer`，待校正數量為 0；兩個 trigger 均啟用，函式採 `security invoker` 且 `anon`／`authenticated` 無執行權限。固定測試站會員頁重新整理後已驗收「一般會員／基本自主學習會員／使用中」，Workbook 1 與 Listening 1 仍可見。商務契約 23/23、`git diff --check` 與 Production build 已成功；Supabase Advisor 沒有本次 trigger／函式相關提示。PR #72 已合併至正式 `main` commit `306687a`。
- 一般會員教材入口與會員頁排版：PR #70 已合併至正式 `main` commit `6a4f9c8`。Navbar 依 `content-access` 回傳結果，只把已解鎖教材加入學生桌面「我的教材」下拉選單及手機 Sidebar；原「教材與功能」入口改名為「方案與功能」。`MembershipCenter` 頂端縮成會員身分、目前方案、使用狀態、到期日／剩餘天數摘要；會員身分分為一般會員、英文班在校生、英文班離校生及七天試用會員，避免三種有效帳號都只顯示「使用中」。已開通功能改為緊湊清單，尚未開通功能集中提示，英文班作業明確標示為在校生專屬；NT$299 基本會員及 NT$499「AI 教材與發音練習」緊接功能清單。永久基礎教材權限不會誤用短期 AI 加購的到期日。相關 2 個 test suites／13 個案例、`git diff --check` 與 production build 已成功；固定測試站 deploy `6a94d846e75f979ceaf03a86` 已驗收。真實離校會員摘要正確同時顯示「英文班離校生」、「基本自主學習會員」及「已取消，期限前可使用」；1600×900 與 412×915 無水平溢位，Console 無 error。PR #71 已合併至正式 `main` commit `2632a9b`，Netlify production deploy `6a94dacf2dd21d00082857d1` 已發布且為 `ready`，正式 bundle 已確認包含會員身分、離校生、我的教材與 AI 教材／發音方案文字；正式站發布閘門已解除。

本次進行中（2026-08-30）：

- 正式站功能升級與 AI 定價：PR #67 已於 2026-08-30 合併至正式 `main` commit `763404f`，完成固定測試站已驗收的商城導覽、跨站入口、會員權限總覽、發音教練、付款取消與相關安全修正，並保留正式站透明高對比 favicon。AI 方案已統一為「AI 教材與發音練習」NT$499／月；在校生可直接加購，一般會員與離校生仍需搭配 NT$299 基本會員，合計 NT$798／月。Additive migrations 與必要 Edge Functions 已先行部署；Netlify production 已載入本次 build 的 `main.046432c2.js` 與 `main.d1e4a911.css`，正式首頁、`/shop`、`/materials` 與 NT$499 方案文字已完成線上驗收。
- 正式站發布閘門：`AGENTS.md` 已新增永久規則，測試站完成驗收後，正式站同步與線上驗收成為唯一優先任務；正式站尚未更新前不得直接開始新產品功能，只能修正發布阻擋問題。本批整合已完成 GitHub push、PR #67、`main` 合併、Netlify production 與公開頁面驗收，發布閘門已解除。
- Firebase Auth-only 清理：PR #69 已於 2026-08-30 合併至正式 `main` commit `29ca1a25`。Firebase 控制台維持 Spark 免費方案與 Email／密碼 Authentication；前端只初始化 `initializeApp`＋`getAuth`，正式路由與導覽已移除 Firebase 清理後台，教材連結只使用 Supabase，不再匯入 RTDB，未被正式 App 引用的 RTDB／Firestore／Firebase Storage 舊元件也已移除；Firebase ID Token 驗證、Supabase 資料與 Cloudflare R2 音檔流程保持不變。30 個 test suites／79 個案例、`link-manager` 語法檢查與 production build 均成功，主要 JavaScript gzip 由約 456.92 kB 降為 370.04 kB。固定測試站 deploy `6a944334c6d91a9f3937a64a` 已發布並完成首頁、商城、教材與登入狀態巡覽；正式 `link-manager` v9 已部署為 `ACTIVE`，OPTIONS 健康檢查回應 200；Netlify production deploy `6a9448c6638a360008338f33` 已發布並載入 `main.d167ed12.js`。遠端 `legacy-cleanup` Function 尚未刪除，若要移除仍須另行明確同意。

本次進行中（2026-08-29）：

- 商城導覽易用性：重整桌面與手機版商城 Header，商城核心操作優先顯示，聽力平台與公開網站移至次要／其他服務區；手機版改為品牌、購物車與分組選單，補上目前路由反白、明確功能說明、背景捲動鎖定、遮罩與 Escape 關閉。相關 4 份測試共 9 個案例、`git diff --check` 與 Production build 已成功；桌面 1280px 與手機 412px 本機實測無水平溢位，固定 Header 維持 `y=0`。功能 commit `7a98a5e` 已推送至 `codex/test-integration-20260828`，固定測試站 deploy `6a923a68a7bc0ba8e777da80` 已發布並再次確認 412px Header、分組選單與背景鎖定正常；尚未合併 `main` 或部署正式站。
- 測試環境授權規則：功能／測試分支完成相應驗證後可直接 commit、Push 並部署固定測試站 `alanenglish-student-test.netlify.app`，不需逐次詢問；直接修改／合併 `main`、正式站部署與正式資料操作仍須另行確認。
- 導覽列固定偏好：所有具有主要 Navbar／Header 的頁面都應固定在螢幕頂部，內容保留正確頂部空間且不遮住 iPhone safe area。已確認公開首頁 `ShowcaseNavbar` 與登入後平台 `app-header` 使用 `fixed`；商城全路由及 `/materials` 共用的 `commerce-site-header` 原本使用會受根節點 overflow 影響的 `sticky`，本次改為固定定位，並補齊桌面與 412px 手機版內容位移。相關 5 份測試共 11 個案例、`git diff --check` 與 Production build 已成功；本機 412×600 實測 Header 在頁面捲動 193px 後仍維持 `y=0`，內容起點 78px 高於 Header 底部 62px，且沒有水平溢位。功能 commit `3f218b7` 已推送至 `codex/test-integration-20260828`，固定測試站 deploy `6a9233c604c392adbcd6af59` 已發布；尚未合併 `main` 或部署正式站。
- 跨站導覽：商城 Header 在手機版保留網站首頁並新增學習平台入口；公開首頁導覽及登入後桌面／手機選單新增實體教材商城入口，讓公開網站、學習平台與商城可以雙向往返。已由 commit `59f3986` 部署測試站（Netlify deploy `6a917f42b66a63870fe478de`），412px 手機版無水平溢位且導覽按鈕均可見；尚未合併 `main`。
- Sidebar：補齊學生主要功能路由的目前頁面反白，開啟手機 Sidebar 時自動將目前路由捲動至接近中段；教材分類也會依目前教材路由標示 active。
- 公開首頁手機 Sidebar：修正固定 Navbar 層級高於 Offcanvas，導致 Sidebar 品牌與關閉區被蓋住，並讓頂端關閉按鈕固定靠右；待重新建置、推送及部署測試站。
- 商城 Stripe 回跳：修正固定測試站建立 Checkout 後仍被 `PUBLIC_SITE_URL` 導回正式站，造成跨網域商城 Session 不存在並誤顯示「付款不屬於目前帳號」。`store-commerce` 改為讀取瀏覽器 `Origin`，且只允許正式站與固定測試站兩個來源；付款成功與取消都回到原始商城網域，未知來源會被拒絕。Stripe 沙盒實際訂單已由 Webhook 正確標為 `paid`／`preparing`；修正 commit `7e87458` 已推送至 `codex/test-integration-20260828`，`store-commerce` v6 已部署並為 ACTIVE。固定測試站的付款成功與取消回跳已由專案擁有者實測通過。
- 商城取消付款：Stripe 取消回跳會帶入訂單編號並由登入中的商城帳號呼叫後端；後端核對訂單所有權與 Stripe metadata、拒絕已完成付款、使仍開啟的 Checkout Session 失效、釋放保留庫存，再將付款狀態記為獨立的 `cancelled` 且不出貨。歷史訂單與管理後台會以紅色顯示「已取消付款」，既有等待付款訂單也提供明確的取消按鈕。Additive migration `20260828145308_store_order_customer_cancelled_status.sql` 已套用並確認兩個 constraint 含 `cancelled`；功能 commit `ab409d0` 已推送至 `codex/test-integration-20260828`，`store-commerce` v7 已部署並為 ACTIVE，固定測試站 deploy `6a91a531770623642d74759a` 已發布。商城契約 13/13、Edge Function 語法、`git diff --check`、Production build、測試站 `/shop/orders` HTTP 200 與 Edge Function OPTIONS 200 均通過；仍待由登入中的商城帳號點擊既有等待付款訂單的取消按鈕，驗收紅色狀態與庫存釋放結果。
- 商城教材自動開通：新增付款商城訂單以已驗證 email 對應新建立的 Firebase 學生帳號，將已付款商品包的 Workbook／聽力本／網站教材寫入教材權限，並建立 90 天網站使用權；商城登入與聽力平台登入仍維持分離。正式套用 migration、部署 Edge Function 與付款端到端驗收尚未完成。

正式網站：<https://alanenglish.com.tw>

GitHub：<https://github.com/hi4u44r306/AlanEnglish>

正式部署分支：`main`

本批開發基準 commit：`54f99e1`（開始本階段實作時的 `origin/main`）

> 本文件只記錄目前開發狀態。永久架構、安全與工作規則請閱讀根目錄 `AGENTS.md`。
> 目前產品、角色、權限與跨功能邏輯請閱讀根目錄 `PROJECT_LOGIC.md`。

## 1. 專案目前階段

### 高對比 Alan English Favicon（2026-08-29）

- PR #63 已合併至 `main` merge commit `5f14988`，Netlify production 已發布。
- 保留原始 AE 流線造型，改為深品牌藍背景、白色 A、黃色 E，並輸出 16px／32px PNG、含 16px／32px／48px 的 ICO、180px Apple Touch Icon 及 192px／512px Web App 圖示。
- `public/ae-icon.jpeg` 保持不變；若正式站效果不理想，可撤回 PR #63 的獨立 favicon 變更完整回復。
- `git diff --check`、Production build（含 4 個公開路由 SEO HTML）與本機瀏覽器引用驗證成功；正式 `favicon-32x32.png` 回應 HTTP 200，SHA-256 與本機新版完全一致，正式頁面載入新版 32px／16px／ICO／Apple Touch Icon，Console 0 errors。
- 白邊修正 PR #65 已合併至 `main` merge commit `7dbe705` 並由 Netlify production 發布：外圍白色畫布改為真正透明，保留白色 A 與原有 AE 圖示；已重新輸出 PNG、ICO、Apple Touch Icon 與 Web App 圖示。`git diff --check` 與 Production build（含 4 個公開路由 SEO HTML）成功；正式 `favicon-32x32.png` 回應 HTTP 200、SHA-256 與本機透明版一致，四個角的 alpha 均為 0。

### UI／UX Playwright 導覽測試（2026-08-28）

- 分支：`codex/playwright-navigation-tests`，尚未 push、建立 PR 或部署。
- 新增 Playwright 桌面 1600×900 與手機 412×915 Chromium 測試，涵蓋公開頁面、公開頁站內連結、舊路由重新導向、正式 404，以及未登入時 34 個受保護路由必須回到登入頁。
- 新增學生、老師與管理員登入後的入口顯示、允許路由及直接輸入未授權網址測試；帳密只接受 Shell 環境變數，沒有專用測試帳密時安全略過，不建立或修改遠端學生資料。
- 新增 `docs/UI_UX_ROLE_ACCEPTANCE.md`，提供訪客、英文班學生、試用者、教材購買者、離校生、老師及管理員的桌面／412px／iPhone Safari 驗收表。
- 驗證結果：Playwright 公開／未登入測試 30 個通過；2026-08-28 再以既有的一般會員、在校生、離校生三個專用測試帳號對正式網站執行學生角色導覽，桌面與 412px 共 18 個案例全部通過。`MainNavbar.test.jsx` 3 個案例通過；Production build 成功。
- 本機 `127.0.0.1` 登入會被既有 Firebase API Key referrer 限制正確拒絕；角色登入測試需設定 `E2E_BASE_URL` 指向允許的 Deploy Preview 或正式網域，不放寬 Firebase 限制。
- 帳密測試會停用 trace、影片、截圖與 HTML 報告，送出登入後立即清空密碼欄，避免失敗快照保存明文；測試結束保留真正的 Playwright exit code再清除環境變數。
- 尚待驗證：老師／管理員專用帳號的 10 個角色案例，以及 iPhone Safari 實機 safe area、鍵盤與音檔行為。

### 三種學生方案 Playwright 權限驗收（2026-08-30）

- 分支：`codex/playwright-entitlement-tests`，基於 `origin/main` commit `9eea338`；尚未 push、建立 PR 或部署。
- 新增一般會員、英文班在校生與英文班離校生的作業、就讀歷史及教材 entitlement 測試，桌面 1600×900 與手機 412×915 共 6 個案例；直接驗證 `assignment-manager`、`commerce-manager`、`content-access` 的回應，不只檢查前端入口是否隱藏。
- 初次正式站結果為 4/6：一般會員與離校生在桌面／手機均無今日作業入口，作業 Edge Function 拒絕回傳新作業；離校生狀態與 `enrollment_history` 仍保留；未授權教材直接輸入網址會回傳 403 `book_entitlement_required`。兩個失敗均因 E3 沒有班級教材設定。
- 經使用者明確同意後，正式 Supabase 建立 E3 班級教材版本 1，自 2026-08-30 生效，教材為 `Workbook_3` 與 `SER_3`，並寫入 class material audit；建立一份 E2E 臨時聽力作業後，以強制至少回傳一份作業的斷言完成驗收（後續整理為 `E2E_REQUIRE_ACADEMY_ASSIGNMENT=true` 開關）。正式站桌面／412px 三種帳號共 6/6 通過後，臨時作業已停用；E3 兩本班級教材設定保留。
- 臨時作業停用後再以最終測試版本執行正式站回歸，桌面／412px 仍為 6/6 通過；此時在校生驗證作業服務成功與班級隔離，教材則驗證 E3 班級教材可開啟。需要再次驗收實際作業顯示時，先建立明確的臨時 fixture 並設定 `E2E_REQUIRE_ACADEMY_ASSIGNMENT=true`。
- 相關 React 測試 6/6 通過；Production build 成功並產生 4 個公開路由 SEO HTML；`git diff --check` 通過。帳密未寫入 Repository，測試後 `test-results` 已清除。

## 已部署：會員續用、班級教材與教材商品包

以下規則已由 PR #50 實作、PR #51 對齊第一版 migration，並由 PR #52 完成授權與商務安全強化；正式 migration、Edge Functions 與 Netlify production 均已部署：

- 教材擁有權與網站使用權分開。購買／兌換教材永久保留教材擁有權與歷史紀錄，另附自兌換日起 90 天網站使用權，且不自動續費。
- 七天試用不需信用卡、不自動續費，只能使用獨立體驗內容，不能查看正式教材或英文班作業。
- 基本會員每月 NT$299，可使用全部正式聽力教材、情境會話與智慧複習，不包含實體教材、英文班作業或 AI Premium；「AI 教材與發音練習」為 NT$499／月獨立加購。
- 教材來源採疊加式 ledger：在校班級、自購、管理員贈送、開通碼與試用互不覆蓋。班級固定 E1、E3、E5、E7。
- 離校不是停用帳號；班級來源與新作業於生效日結束，自購／贈送教材、XP、AE Points、等級、歷史作業與進度保留。已付款月費與 AI 使用至 `current_period_end`。
- 月費支援 Customer Portal、本期結束取消、到期前恢復與付款失敗；Checkout 前必須有有效家長 Email。通知事件、學生收件匣、去重鍵與 Email 佇列已納入實作，寄送沿用既有 Resend adapter，未設定 provider 時保留待送。
- 班級教材設定與教材商品包分開管理。商品包必須各有一本課本、一本 Workbook、一本聽力本、單一售價及 Stripe 測試 Product／Price 才能上架。
- 三本組合教材包目前單一售價為 NT$1,380，不另設會員價；既有缺課本的 Level 1 沙盒商品退回草稿，補齊課本並重新核對內容後才能上架。正式收款仍須另建 Stripe live 商品與 Price。
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

- `codex/pronunciation-coach-mvp`：AI 發音教練第一階段已完成本機原型，新增登入後 `/student/pronunciation` 與桌機／手機導覽入口，先提供「日常問候」4 個國小生朗讀關卡。學生可聽慢速示範、錄製最多 12 秒語音、回聽後送出；瀏覽器會轉為 16 kHz 單聲道 PCM WAV，後端會再次檢查實際 WAV 標頭，只接受固定關卡與正確音檔格式，重新驗證 Firebase 帳號、有效會員及既有 `ai_materials` 權限，再由 Azure Speech Pronunciation Assessment 回傳整體、正確度、流暢度、完整度、自然語調與逐字綠／黃／紅結果。原始錄音不寫入資料庫或 Storage。`AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION` 與 `AZURE_SPEECH_ENDPOINT` 已由專案擁有者保存至 Supabase Secrets，且名稱已完成唯讀確認；程式以區域建立 Azure 官方 Speech-to-Text 端點，不會將金鑰傳到前端。目前尚未部署 `pronunciation-coach`、建立持久用量紀錄或調整 NT$299 方案，因此尚未產生本功能的語音 API 費用，也未完成真實錄音端到端驗收。前端 3 份測試共 5 個案例、Edge Function TypeScript 本機打包、`git diff --check` 與 Production build 均成功；尚未 commit、push、建立 PR 或部署。
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
5. MusicPlayer 80% 聆聽與防作弊測試（2026-09-01 由專案擁有者確認已完成）

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
- AI 教材與發音練習不因購書或基本會員自動取得；一般會員可另加購 NT$499／月
- 三本組合教材包一般售價已決定為 NT$1,380；有效會員教材價仍待確認

### 英文班在校學生

- 在校期間免費使用網站
- 英文班月費目前為 NT$2,800
- 可以收到班級作業
- 不包含 AI 教材生成與發音練習；可加購「AI 教材與發音練習」（NT$499／月、AI 教材每日 5 次、每月最多 150 次且不累積）

### 英文班離校學生

- 保留歷史學習紀錄
- 不再收到新作業
- 可用每月 NT$299 的基本會員繼續使用
- 可另加購「AI 教材與發音練習」NT$499／月；基本會員加 AI／發音合計 NT$798／月

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

### 驗收狀態

- 2026-09-01 由專案擁有者確認已完成：真實學生 Token 的 start／complete、80% 前不增加、80% 後單一 session 只增加一次、Seek／重播小段／加速播放不可作弊，以及 teacher／admin 播放不累計。
- 尚待另行確認：進度 event 是否能即時更新 Playlist 與作業。

## 12. P0 Unit Test 狀態

2026-09-01 由專案擁有者確認以下測試已完成，不再列為下一個待辦：

- `authService`、`AuthContext`、Login 與登入 Session。
- `ProtectedRoute`、`RoleHomeRedirect` 與角色隔離。
- 一般會員、在校生、離校生的教材與作業權限回歸。
- MusicPlayer session、80%、Seek、重播小段、加速、冪等、noInteraction 與 teacher／admin 不累計。

其餘 P0 項目仍依實際程式與測試紀錄個別確認，不因本次註記自動視為完成。

### 現有測試基準

- 分支：`feature/listening-coverage`
- 目前只有 2 份測試檔、共 5 個案例。
- `FreeTrialSignup.test.jsx` 有一個 `/` 與實際 `/login` 不一致的舊預期，先確認後修正。
- `musicAdminService` 已呼叫 `book_status`、`delete_book_tracks`、`archive_book`、`restore_book`、`delete_book`，但目前 `music-admin` Function 沒有對應 action；先建立 contract test，測試應先失敗以證明問題存在。

### P0 實作順序

1. `authService`、`AuthContext`、Login（已完成）
2. `ProtectedRoute`、`RoleHomeRedirect`（已完成）
3. `edgeFunctionClient` 與所有 service action/body contract
4. Redux actions 與 `musicReducer`
5. MusicPlayer 純函式：coverage merge、covered seconds、time、clamp
6. MusicPlayer component：session、80%、Seek、加速、冪等、noInteraction（已完成）
7. membership／trial／activation code／effective access（一般會員／在校生／離校生教材與作業權限回歸已完成；其餘項目另行確認）
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

### P2 未來規劃：好友、戰績與社交競賽（尚未開始）

產品方向：讓學生在安全、雙方同意的前提下加入好友，查看彼此的學習戰績；資料與互動基礎穩定後，再評估 PK 賽與合作型比賽。此項目目前只記錄需求，尚未建立資料表、API、Edge Function、頁面或部署。

第一階段「好友與戰績」預計包含：

1. 使用不暴露 Email、生日、家長資料或真實班級的方式搜尋／邀請好友；採好友邀請、接受或拒絕的雙向確認流程，不允許單方面直接追蹤。
2. 提供好友名單、待處理邀請、解除好友、封鎖與檢舉；封鎖後雙方不得查看戰績、傳送邀請或發起比賽。
3. 好友戰績預設只顯示安全的學習摘要，例如頭像、顯示名稱、等級、XP、學習連續天數、已完成任務及未來比賽紀錄；不得顯示 Email、生日、家長聯絡方式、登入時間或其他敏感個資。
4. 戰績只能使用後端已驗證的學習、作業與遊戲結果統計，前端不得自行提交或竄改勝敗、XP、AE Points 或完成數。
5. 提供「誰可以看我的戰績」隱私設定，至少區分只有自己與好友可見；管理員依安全及客服需要保留稽核能力。
6. 好友邀請、搜尋與檢舉需有頻率限制、重複邀請防護、通知去重及管理稽核，並考慮國小學生使用情境與騷擾防護。

第二階段「PK 賽」候選方向：

- 可先評估非同步答題 PK，再決定是否需要即時對戰；題目難度、題數、時間與計分必須公平，斷線、逾時、重複送出與作弊情境需由後端裁定。
- 邀戰只能在好友或明確允許的配對範圍內進行，對方必須接受；必須可以拒絕、封鎖及關閉邀戰通知。
- 勝敗、連勝、對戰次數與排行榜展示方式仍待確認；不得先承諾扣除或押注 AE Points，也不得讓獎勵機制鼓勵付費優勢。

第三階段「合作型比賽」候選方向：

- 好友可組隊完成共同答題、聽力或班級任務，評分以共同目標、每位成員的有效貢獻及完成品質為主。
- 需防止單一成員代打或掛機，並清楚顯示個人貢獻、團隊進度、任務期限與獎勵規則。
- 是否支援跨班、公開隊伍、老師建立活動及家長可見報告仍待產品確認。

開始實作前必須先確認：好友搜尋識別方式、戰績可見欄位、封鎖／檢舉處理流程、PK 採非同步或即時、計分與獎勵規則、合作賽組隊限制，以及未成年使用者的隱私與家長／老師管理邊界。資料層必須採 additive migration、RLS 與 Firebase Token 驗證 Edge Function；不得讓前端直接讀取所有學生資料。此功能排在目前測試站已驗收內容同步正式站之後，正式站尚未更新前不開始功能實作。

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
