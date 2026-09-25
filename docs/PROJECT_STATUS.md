# Alan English 專案狀態

最後更新：2026-09-25

本次原始 PDF 視覺建稿 PR #240（2026-09-25，衝突已解；尚未部署）：

- 以目前 `main` 的人工逐頁建稿、純文字問答、圖片核對與學生音檔限制為基準，保留管理員從已核准來源的私人原始 PDF 分析並建立未發布草稿的入口。OCR 逐頁選頁、封存舊來源及純文字發布流程繼續可用；學生目錄維持現行頁碼顯示。
- 不新增 migration、不自動核准、發布或修改正式題庫。與正式地圖 `main` 再次整合後，相關 React 與服務測試 6 suites／90 tests、完整口說契約 37/37、學生輸出契約 9/9、Edge Function 語法與 Production build 通過；真實私人 PDF、AI 回覆、R2 裁圖及登入後管理員流程仍須在隔離環境驗收，正式 Function 與前端尚未部署。

本次口說大挑戰可插關的前端地圖（2026-09-25，已正式部署）：

- `codex/speaking-adventure-map` 的同一本 Workbook 改成由上往下單一路線：依目前已發布關卡清單生成節點與彎曲道路，座標以書本及關卡 ID 固定，中間插關會推移後續節點，末端追加會延長地圖；地景由草原、高地漸入火山，沒有角色人物。這只處理前端排列，不改正式題庫排序、分類解鎖或舊進度資料。
- 手機進入 Workbook 地圖及小關卡會收起主 Header／底部導覽，保留返回操作；回到全部教材時恢復。學生的一般口說題移除上一題／下一題，完成後顯示「繼續挑戰」；老師／管理員預覽一般口說、A–Z／拼讀及圖片題時保留逐題切換，老師唯讀。
- 相關檔案：`src/utils/speakingAdventureMap.js`、`src/components/Pages/TextbookSpeakingChallenge.jsx`、`WorkbookOneFoundationChallenge.jsx`、`WorkbookOnePictureChallenge.jsx`、`css/SpeakingAdventureRoute.scss`、`assets/speaking-map/` 及對應測試。無 migration、Edge Function 或正式資料操作。與 `main` 合併時保留學生非 A–Z 語音限制及老師／管理員試聽，相關 React 測試 4 suites／61 tests、學生輸出契約 9/9、完整口說契約 37/37 與 Production build 通過；編譯 CSS 靜態樣張在 320／390／430／1280px 無水平溢位。
- PR #277 已合併至 `main` `0681db5`；由此乾淨 commit 建置後以 Wrangler 發布 Cloudflare Worker 版本 `d7bb5208-84d4-4295-8ba0-02c39b856646`。`alanenglish.com.tw` 與 `app.alanenglish.com.tw` 的口說路由均回應 200 並載入 `main.a82a47fb.js`，主網域線上 JS SHA-256 與已測試的本機 build 一致。尚未以登入學生、老師、管理員實測真實錄音、返回導覽及 iPhone safe area；`S-19`、`S-20` 素材待更新。

本次口說大挑戰語音提示暫停（2026-09-25，正式部署完成）：

- 學生端除 A–Z 導聽外，非 A–Z 題目的答案範例與看圖補句整句播放入口先隱藏；一般題目音檔網址與看圖補句音檔網址不再對學生簽發。已保存的私有 R2 音檔不刪除，工作人員預覽仍可試聽。
- 未實作購買、持有或消耗提示道具；未來須由後端驗證並在使用道具後才短效簽發音檔網址，不可只靠前端顯示控制。
- PR #283 已合併至 `main` `2398a7d`。正式 `speaking-challenge` v40 ACTIVE，OPTIONS 200、未登入 POST 401；Cloudflare Worker 版本 `678e2f70-8a46-4856-bd0a-91ac1abd2ccc` 已發布，正式兩網域與 Workers 網址均回應 200 並載入 `main.55f8bc8f.js`。學生題目輸出契約 9/9、React 57/57（含 A–Z）、Edge 語法、Production build、`git diff --check` 通過。完整口說契約仍有 1 項既有手機播放器 CSS selector 斷言失敗，與本次語音限制無關。尚未做登入學生、老師及管理員的線上端到端驗收；`S-20` 教學素材待更新。

本次 Workbook 2 P1–P10 OCR 與七題問答（2026-09-25，程式已正式部署／OCR 待管理員核對）：

- 管理員指定的 Workbook 2 來源 section 63 已由封存恢復為待核對，對應 OCR 批次 117 改回 `review_required`，原逐字稿及文件 39 均保留；沒有核准、建稿或發布。需管理員再次核對並核准。
- 本機修正 P4／P6／P8／P10 的「先列七個問句，答案庫另排且可能倒序」版型：AI 用中文物品線索一對一配對原答案；配對缺漏、重複或引用非答案庫句子時整頁拒絕建稿，避免只剩 1 題。相同英文問句但答案不同不再誤去重；學生題面顯示中文線索。
- P4 原 OCR `It a bag.` 疑似缺字，新草稿會暫改 `It's a bag.` 並顯示原句與修正提醒，仍由管理員逐題核對。這類 OCR 文字問答在內容核准後可生成與試聽示範語音，發布時須七題音檔齊全；其他純文字問答維持免音檔規則。無 migration；`A-12` 教學素材待更新。
- PR #281 已由隔離分支合併至 `main` `4475c9a`，未包含未驗收的口說地圖變更。`speaking-content-manager` v55、`speaking-challenge` v39、`speaking-tts-manager` v35 均 ACTIVE；Cloudflare Worker 版本 `ee41ef83-000d-469c-bd9d-160e4425554d` 已發布。正式首頁及管理路由 HTTP 200 且回傳新版 JS，三函式無登入 POST 均為 401。
- OCR／學生輸出與口說契約測試 55/55、管理／學生 React 測試 47/47、Edge 語法、Production build、`git diff --check` 通過。GitHub 舊 Netlify deploy-preview 狀態失敗，未作為 Cloudflare 發布依據。仍待管理員核准 OCR 後實測 AI 實際配對、音檔與發布；未自動建稿或發布。`release:deploy-preflight` 腳本目前禁止 `main`，與本文件及 AGENTS.md 的正式部署必須由最新 `main` 執行規範相衝突，待另案修正。

本次純文字問答免音檔與 Workbook 1 P42（2026-09-25，本機實作中）：

- 「無圖片文字問答」在逐頁建稿時不再呼叫 TTS；待發布草稿可直接按「發布純文字關卡」，後端不要求音檔，學生題面也不簽發或播放既有答案音檔。標準完整句與看圖補句仍維持原本必要語音規則。
- TTS Function 會拒絕對 `text_qa` 產生、重試或預覽語音，避免舊畫面或直接 API 誤產生付費音檔；不需 migration，不修改既有音檔或其他題型。
- 尚待完成測試、PR／正式部署，以及透過正式管理頁建立並發布 Workbook 1 P42 的 9 題數字加減法純文字關卡。

本次逐頁無圖片文字問答（2026-09-25，正式部署完成）：

- 「建立新關卡」新增無圖片文字問答；同頁可加入多道文字問答，輸入學生可見問句、完整示範回答及其他可接受完整說法，不要求圖片。為沿用既有 `text_qa` 學生作答與評分規則，文字問答須獨立成一關，不與看圖或朗讀題混用。
- `speaking-content-manager` 將全文字問答頁標示為 `text_qa` 並保留單頁來源、題序與私有草稿；`speaking-tts-manager` 支援該草稿的示範語音。沒有 migration、沒有修改已發布題庫或學生資料；P42 尚未建立遠端草稿。管理頁 React 6/6、學生題面契約 7/7、發音流程契約 7/7、兩支 Function 語法、Production build 與 `git diff --check` 均通過。PR #278 已合併至 `main` commit `c4c7dee`；正式 `speaking-content-manager` v53、`speaking-tts-manager` v32 均為 ACTIVE。Cloudflare Workers 正式版本 `7d7cfa8d-832a-40d7-8a51-4129f6500107` 已發布，`alanenglish.com.tw`、`app.alanenglish.com.tw` 與 Workers 網址均回應 200 並載入 `main.64e53846.js`；正式 bundle SHA-256 與本機已驗證 build 完全一致。尚未做管理員登入後的草稿建立端到端測試。
本次 Workbook 1 新版學生版 OCR 核對防錯（2026-09-24，正式部署完成）：

- localhost 確認 Workbook 1 已有 119 頁、12/12 批辨識結果，但 0/12 批核准；P21–P30 舊 OCR 把頁碼當普通文字、缺少 `[[PAGE P頁碼]]`，且看圖補句只留下殘缺文字，不能可靠配對圖片或自動出題。本批未核准、刪除或覆蓋任何既有來源／題庫。
- 整本 OCR 卡片新增原始 PDF 檔名；多頁核對若完全沒有有效頁碼標記，畫面會警告並停用核准。後端也以該批原始頁碼範圍拒絕零個有效標記。後續新辨識保留題號、答案空格及 `[[IMAGE_REQUIRED: 題號或位置]]` 待人工配圖提示；若整批頁碼標記缺漏、重複或錯序則標為失敗供重試，不再顯示假性完成。含圖片標記的頁面不再走純文字 AI 草稿，須由管理員使用逐頁圖片草稿建立器選題型並配圖。
- 管理頁 React 23/23、新頁碼檢查 2/2、Production build 通過；新增 OCR 契約 1/1，完整口說契約 35/36，仍只失敗於既有手機播放器 CSS selector 斷言。使用者同意直接部署後，正式 `speaking-content-manager` v52 已為 ACTIVE；OPTIONS 200、未登入 POST 401，未進行 migration。Supabase 目前方案拒絕建立隔離分支（Branching 需 Pro），故採使用者授權的正式環境逐批驗證。使用者在 Chrome 手動選取新版學生 PDF 後，localhost 安全上傳並辨識整本：新文件 ID 43、119 頁、12/12 批均為 `review_required`、0 批核准，頁碼標記逐批為 10 × 11 加 9，共 119 個。P22／P23／P24 分別保留 9／9／8 個看圖補句題與待配圖標記；P21 只有一組看圖問答句型及總體圖片提示，9 張圖仍須人工逐題配對，不能視為已產生 9 題。舊文件 ID 8 仍保留 119 頁與原 12 批待核對 OCR，未刪除來源或草稿。最後管理頁跳至登入頁，未完成登入後視覺複驗；後端資料已唯讀核對。教師版僅供教學意圖核對；仍須人工核對文字、圖片與答案，不自動核准、建稿或發布。
- PR #275 已合併至 `main` commit `033fac5`；Cloudflare production build `cce32c13-8192-42bd-8ade-d8969f302220` 顯示 100% 正式流量。`alanenglish.com.tw` 與 `app.alanenglish.com.tw` 管理頁均回應 200 並載入新版 `main.c22be080.js`。Netlify 舊預覽站檢查顯示 skipped/error，不影響 Cloudflare 正式部署；未登入後台仍無法執行登入後操作驗收。

本次 Workbook 3 P15／P17／P20 題數與管理頁導覽分色（2026-09-24，正式部署完成）：

- 已逐頁核對教師版 PDF 與核准逐字稿：P15 應建立 7 題、P17 只建立第 41／42 題共 2 題、P20 因第 49 題原文截斷而安全建立前 6 題。
- P15 原先只有 5 題，是後端第二層驗證只接受以 `?` 結尾的提示，錯誤排除第 30 題完整問候句 `Nice to meet you!`，以及第 33 題「句中已有問號、後接提示敘述」的完整對話。現在兩者可保留；一般敘述與 `...` 未完成片語仍不會成為題目，所以 P17 不會誤增為 7 題。
- 「關卡製作流程」改為暖橘色系，下一列「教材來源分類」維持品牌藍色系；localhost 桌面／窄版畫面已確認兩層導覽可清楚區分。
- 不需 migration；尚未修改、刪除、重新建立、核准或發布任何正式草稿。OCR 規則 8/8、管理頁與 service 26/26、Edge Function 語法、Production build 與 `git diff --check` 通過；完整口說契約 34/35，唯一失敗仍為既有手機播放器 CSS selector 斷言，與本批無關。
- PR #273 已合併至 `main` commit `36d8463`。正式 `speaking-content-manager` v51 為 ACTIVE，OPTIONS 回應 200、未登入 POST 正確回應 401。Cloudflare production build `e35958db-3842-41d3-9e76-dde03a792448` 成功；正式管理頁回應 200 並載入 `main.eae15e72.js`／`main.2c86d9c7.css`。本批沒有代替管理員重建草稿，P15／P17／P20 的實際新草稿題數仍由管理員登入後重新產生並核對。

本次指定頁碼重新產生 AI 草稿（2026-09-24，正式部署完成）：

- 「已核准教材頁面」的多頁來源新增逐頁勾選器，可只選 P15、P17、P20 等指定頁面建立或重新產生，不再被迫整批重跑；未勾選頁面完全不變。
- 頁面會標示「尚未建立」、「已有 N 題草稿，可重建」或「已發布，不直接覆蓋」。已發布頁面停用選取，必須從正式關卡建立新版草稿，避免誤蓋學生版本。
- 重建未發布草稿時，後端先完整建立新題目，再刪除舊草稿；生成或舊稿刪除失敗時會保留舊草稿並清理新半成品。已有學生進度或評分紀錄的草稿仍拒絕重建，核准 OCR 來源不會被刪除。
- 不需 migration，不修改任何現有題庫或 OCR 資料。管理頁與 service targeted 26/26、Edge Function 語法、新增重建契約、Production build 與 `git diff --check` 均通過；完整口說契約 34/35，唯一失敗為既有手機播放器 CSS selector 斷言，與本批無關。已在 localhost 實際確認 Workbook 3 的 P11／P15／P17／P20 選頁介面、頁面狀態與選取數按鈕正常，測試後已清除選取且未送出建稿。
- PR #271 已合併至 `main` commit `4378097`。正式 `speaking-content-manager` v50 為 ACTIVE，OPTIONS 回應 200、未登入 POST 正確回應 401。Cloudflare production build `dbb278f1-de9a-4651-8325-891b8330cd40` 成功，正式管理頁回應 200 並載入 `main.eae15e72.js`；正式 bundle SHA-256 與本機已驗證 build 完全一致。本次沒有建立、刪除、核准或發布任何教材草稿。

本次教材來源四分頁、OCR 批次整理與舊來源封存（2026-09-24，正式部署完成）：

- 「1 教材來源」改為四個小分頁：「整本教材辨識」、「核對 OCR 批次」、「單一範圍或貼入文字」、「已核准教材頁面」，一次只顯示目前工作區，縮短管理頁長度；桌面四欄、手機兩欄。
- 「核對 OCR 批次」依教材名稱收合，每本書先顯示一個可展開群組，再展開個別十頁批次，避免 Workbook 1、2、3 混在同一長清單。
- 同一 `book_id` 有多次整本 OCR 時，以 `created_at／updated_at／id` 判斷最新工作；整本進度與待核對清單只顯示最新文件，舊文件及其重複待核對項目只從畫面安全隱藏。舊私人來源、已核准逐字稿、既有草稿與學生資料都不刪除，已核准來源仍可重新建立草稿。
- 「已核准教材頁面」同樣依教材名稱收合；沒有任何未封存題庫的來源可按「封存舊來源」。後端會再次檢查 `speaking_question_sets`，仍有草稿或正式關卡時拒絕封存；最後一份可見 section 封存時一併封存 document，但不刪 R2 原檔、學生紀錄或歷史關卡。
- 不需 migration；`speaking-content-manager` 新增 `archive_source_section`，已隨正式 Function v50 部署並為 ACTIVE。正式管理頁已顯示四分頁、依書本收合與安全封存按鈕。
- React 管理頁與 service targeted 測試 25/25、完整 Edge Function 語法檢查、Production build 與 `git diff --check` 通過；口說契約新增來源封存保護並通過，本套件其餘 33/34 通過，唯一失敗為既有手機播放器 CSS selector 斷言，與本批管理頁／來源封存無關。
- 本批已隨 PR #271、`main` commit `4378097`、正式 `speaking-content-manager` v50 與 Cloudflare production build `dbb278f1-de9a-4651-8325-891b8330cd40` 完成發布。未登入 POST 正確回應 401「請先登入 Alan English」；本次沒有執行 migration，也沒有代替管理員封存任何來源。

本次 Workbook 3 重新 OCR 的 R2 CORS 阻擋修正（2026-09-24，本機完成；Cloudflare CORS 已套用並完成實際 OCR）：

- 已在 localhost 實際重試 144.1MB Workbook 3 PDF；瀏覽器於本機切到第 4/11 批後，在第一個私人 R2 `PUT` 前被阻擋並自動清理暫存工作，因此沒有開始 OCR、沒有產生 AI 費用，也沒有覆蓋既有 Workbook 3 OCR／核准內容。
- 已唯讀確認實際 `alanenglish-audio` bucket 維持私人、Public Development URL 關閉；既有 CORS Policy 只允許正式站、Firebase 舊站與固定測試站，缺少 `http://localhost:3000`，這是 localhost 上傳 `Failed to fetch` 的直接原因。
- 已在使用者確認後更新 Cloudflare CORS：新增 `https://dev.alanenglish.com.tw` 與 `http://localhost:3000`，並保留正式站、Firebase 舊站及固定 Netlify 測試站；方法仍只有 `GET／HEAD／PUT`，標頭只有 `Content-Type／Range`，未啟用公開 bucket 或萬用字元。
- 本機 CORS 範本同步保留全部既有來源；錯誤訊息現在會顯示目前 origin。不需 migration 或 Supabase Function 部署。已從 localhost 成功上傳同一份 144.1MB、106 頁 PDF，並完成 11/11 批重新 OCR；P1–P10 到 P101–P106 全部進入待人工核准，沒有失敗批次。舊 Workbook3 OCR 與原本 2 批已核准內容仍完整保留；前端尚未推送或部署。

本次 Workbook 3 分組式問答配對修正（2026-09-24，必要 Supabase Function 已部署；前端未發布）：

- 已確認 P11／P15／P17 的核准逐字稿採用「先連續列出所有編號題目，再依相同順序列出所有答案」；舊解析器只支援題目後立刻接答案，導致前面題目沒有答案、整頁答案全部掛到最後一題，因此三頁都只建立 1 題且答案錯配。
- 編號式文字問答現在同時支援逐題交錯與整批分組兩種版型。分組版會依編號順序一對一配對答案，略過 P15 的 `Greetings` 章節標題；完整社交問候與句中已有問號的對話可成為題目，P17 的一般敘述／未完成片語及 P20 第 49 題 `in a rest...` 這種被截斷的疑問句則會安全排除。
- 目前核對結果為 P11／P15 各 7 題、P17 為 2 題、P20 為 6 題。兄弟／姊妹題可接受來源中的 `they／them` 複數回答，但仍拒絕與題目明確相反的 he／she、his／her 回答。不需 migration；不修改、刪除、核准或發布既有草稿與 OCR 來源。
- OCR 解析回歸測試 7/7、文字問答整合契約 1/1、Edge Function 語法與 Production build 均通過；完整既有口說契約 32/33，唯一失敗仍是既有手機操作列 CSS selector 斷言，與本批 OCR 配對無關。依使用者授權只部署必要的 `speaking-content-manager` v48，狀態為 ACTIVE；localhost OPTIONS 回應 200、未登入 POST 正確回應 401。前端未推送、未發布，程式修正保留於本機分支 `codex/fix-grouped-ocr-question-answers`。

本次學生設定、排行榜、通知導頁與新預設頭像（2026-09-24，正式部署完成）：

- 「我的設定」主要頭貼調整為桌面 `200 × 200px`、手機 `150 × 150px`；AI Premium 改為姓名旁可換行的小型狀態徽章，不再獨立占用一張大卡片。
- 排行榜的「我的學習角色」、統計與排行列在窄螢幕會重新分行；姓名、原名與班級文字可安全換行，避免 320px 手機寬度互相擠壓或溢出。
- 通知頁與桌面 Navbar 的通知項目會依後端 `target_path` 或安全類型對照直接前往相關學生頁；好友邀請／接受通知指向「好友與戰績」，方案與付款失敗通知指向「方案與功能」。只接受既定學生站內路徑，外部網址或未知值不會被拿來導頁。
- 保留原有 5 個動物頭像，新增 20 個人物、職業與幻想形象，服裝包含探險、科學、藝術、足球、太空、音樂、廚師、園藝、舞蹈、發明、騎士、飛行與航海等，不再全部使用帽 T。前端、`gamification` 與 `student-social` 白名單同步為 25 個；新圖片皆為本機打包資產。女生太空人頭像已重新製作，頭部、髮髻與所有頭髮都完整位於透明面罩內。
- 不需 migration，未修改正式學生資料。相關 React 測試 32/32、頭像／RWD 契約 4/4、學生社交契約 7/7、Edge syntax、Production build 與 `git diff --check` 均已通過；路由也已逐一核對現有 `App.jsx` 學生頁。
- PR #269 已合併至 `main` commit `8caa808`。正式 `gamification` v17、`notification-manager` v12、`stripe-webhook` v28、`student-social` v17 均為 ACTIVE；登入型端點 OPTIONS 回應 200、未登入 POST 正確回應 401，Stripe webhook 無簽章 POST 正確回應 400。Cloudflare production build `93c58f79-09ee-4a9b-bc1b-b9aa9e546c8b` 成功，正式設定頁回應 200 並載入 `main.0eaf3871.js`／`main.23946778.css`；production bundle 已確認包含新增頭像、通知導頁及新版設定／排行榜樣式。尚未使用正式學生帳號進行登入後互動驗收，避免變更學生頭像或通知已讀狀態。

本次 OCR 核准逐字稿選頁建稿與來源保留（2026-09-24，正式部署完成）：

- 多頁 OCR 批次不再要求原始範圍內每一頁都保留 `[[PAGE P頁碼]]`。管理員核對時可將不需要關卡的整頁標記與內容刪除；核准後，前端與 `speaking-content-manager` 都只接受逐字稿中實際保留且位於該批範圍內的頁碼，依保留順序逐頁建立草稿。
- 已核准來源卡會顯示保留頁碼、實際要建立的頁數及完整核准逐字稿。待核對來源仍保留可編輯 OCR 文字；AI 草稿與 `speaking_source_sections.source_text` 分離，刪除未發布草稿只刪題庫，後端明確回傳 `source_preserved: true`，之後可用同一份來源重新建立。
- 單頁來源維持可直接建立本頁草稿；多頁來源至少保留一個有效頁碼標記即可。不需 migration，不修改、刪除、核准或發布任何既有 OCR 來源與題庫資料。管理頁 targeted 19/19、新增來源保留契約 1/1、Edge Function 語法、Production build 與 `git diff --check` 均通過；完整既有口說契約 32/33，唯一失敗仍是既有手機操作列 CSS selector 斷言，與本批 OCR 選頁無關。
- PR #267 已合併至 `main` commit `9afec32`。正式 `speaking-content-manager` v47 為 ACTIVE，OPTIONS 回應 200、未登入 POST 正確回應 401。Cloudflare production build `300c1ec4-c035-4f3f-97e7-a46cab8382df` 成功，正式管理頁回應 200 並載入 `main.a6a88e55.js`／`main.69d89026.css`；production bundle 已確認包含保留頁碼、依逐字稿建稿、查看核准逐字稿及刪除草稿保留 OCR 的新版介面。未代替管理員建立、刪除、核准或發布任何題庫。

本次手機暱稱讀取與 7 天改名倒數修正（2026-09-23，正式部署完成）：

- `dev.alanenglish.com.tw` 原本不在 `student-social` Edge Function 的允許來源清單；手機從開發站讀取暱稱時會在 CORS 階段被瀏覽器攔截，iPhone Chrome／WebKit 因而顯示原始 `Load failed`，而 localhost 或正式站不會重現。已將開發網域加入明確允許清單，並將網路層錯誤改為可理解的中文重試提示。
- `nickname_settings` 現在回傳由伺服器依真實更名紀錄計算的 `nickname_change_available_at`。第一次設定暱稱不啟動冷卻；只有 `previous_nickname` 非空的實際改名才開始 7 天。冷卻中會停用輸入欄與按鈕，顯示台灣時間解鎖日期及天／時／分／秒即時倒數，時間到自動解鎖；後端 429 仍是最終限制並同步回傳解鎖時間。
- 不需 migration，不修改任何學生暱稱或歷史資料。`StudentSettings` 12/12、學生社交契約 7/7、`student-social` TypeScript 語法、Production build 與 `git diff --check` 皆通過。PR #265 已合併至 `main` commit `d998798`；正式 `student-social` v16 為 ACTIVE，dev 網域 OPTIONS 回應 200 並回傳正確允許來源，未登入 POST 正確回應 401。Cloudflare production build `5d7831ea-098f-4a63-9436-66e74da30665` 成功，正式設定頁回應 200 並載入 `main.afac771e.js`。尚未使用學生帳號觸發真實改名，避免變更正式帳號或啟動 7 天冷卻。

本次待發布草稿可變答案語音驗證修正（2026-09-23，正式部署完成；登入發布待驗收）：

- 唯讀核對正式 Workbook 3 新草稿：#77 P5、#78 P7、#79 P9 均已正確建立 7 題；#77 已人工核准，7 題示範語音也全部為 `ready`。草稿仍無法發布的根因是發布檢查拿含 `[你的名字]` 等欄位的答案模板，與 TTS 實際保存的自然範例文字（例如 `My name is Amy.`）逐字比較，因而誤判語音不完整。
- 發布驗證改為使用與 TTS 生成相同的 `spokenExampleText` 規則比較，不會重複產生已存在的語音；固定答案仍維持精確比對。待發布草稿新增「先產生並試聽示範語音」，人工核准後即可在發布前逐題試聽；若個別題目失敗，提示會顯示第一個實際錯誤原因。
- 不需 migration，不修改、核准或發布任何現有草稿。TTS 規則、管理頁 18/18、Edge syntax、Production build 與 `git diff --check` 皆通過；完整口說契約 31/32，唯一失敗仍是既有手機導覽 CSS selector 斷言，與本批無關。PR #263 已合併至 `main` commit `e40a561`；正式 `speaking-content-manager` v46 為 ACTIVE，OPTIONS 回應 200、未登入 POST 正確回應 401。Cloudflare production build `f6a54ec6-47d6-42e3-841d-2a1f045497cc` 成功，正式管理頁回應 200 並載入 `main.0cc61aab.js`，source map 已確認包含新版試聽操作與錯誤提示。未以管理員登入執行發布，#77 仍應由管理員逐題試聽後自行發布，#78／#79 須先完成人工核准。

本次 Workbook 3 原檔編號題數與可變答案修正（2026-09-23，正式部署完成；登入重跑待驗收）：

- 正式草稿 #74／#75／#76 與工作 #54～#56 已唯讀核對：新版固定配對正常執行且無 AI 錯誤，但 P5／P7／P9 只建立 3／4／1 題。核准原文實際各有 7 個編號題組；少題根因是前版把含姓名、年齡、拼字等底線的回答整題排除，錯把「不得猜答案」實作成「刪除題目」。
- 編號式文字問答改為一個原檔編號固定建立一題，因此 P5／P7／P9 預期皆為 7 題。底線轉成具名稱的可變口說欄位，例如 `My name is [你的名字].`、`He is [爸爸的年齡] years old.`；評分固定教材句型，但接受學生實際姓名、年齡與逐字拼名，不用 AI 猜內容。
- 同一頁重新建立新版時不再拿該頁舊草稿做跨關卡去重，避免新版只剩舊版缺少的題目；其他頁與已發布關卡仍維持去重。現有 #74～#76 保持未發布且不自動修改、刪除、核准或發布。
- 不需 migration；涉及 `speaking-content-manager`、`pronunciation-coach`、`speaking-tts-manager` 與管理頁。OCR 原檔實例規則 6/6、可變答案與示範語音、管理頁 18/18、Edge Function 語法、Production build 與 `git diff --check` 皆通過；完整口說契約 31/32，唯一失敗仍是既有手機導覽 CSS selector 斷言，與本批無關。
- PR #261 已合併至 `main` commit `742fe3e`。正式 `speaking-content-manager` v45、`pronunciation-coach` v23、`speaking-challenge` v37、`speaking-tts-manager` v31 均為 ACTIVE；四個 OPTIONS 回應 200，管理 Function 未登入 POST 正確回應 401。Cloudflare production build `dfa180a2-99f4-4739-bd26-8d35ea9f841a` 成功，正式管理頁回應 200 並載入 `main.be370014.js`，source map 已確認包含原檔編號題數及可變口說欄位新版介面。既有 #74～#76 仍保持未發布且未被修改；P5／P7／P9 的新 7 題草稿 ID 與逐題內容，待管理員登入後重新建立再唯讀核對。

本次 Workbook 3 P5／P7／P9 編號式文字問答深層修正（2026-09-23，正式部署完成；登入重跑待驗收）：

- 管理員於正式 v43 重新按兩輪後，遠端生成工作 #48～#53 顯示 P5／P9 已不再卡在 AI 格式驗證，卻以 `question_insert_failed` 結束；根因是 `text_qa` 候選寫入 `visual_aid: null`，但資料庫欄位要求非空 JSON 物件。P7 另有一輪仍為 `invalid_output`，因 AI 會改寫或合併同一編號內的問句、追問與回答，無法逐字通過核准來源檢查。失敗時後端已刪除剛建立的空題庫，未留下 0 題半成品草稿。
- 本機改為辨認核准 OCR 中「編號問句＋同題號回答」的純文字頁，直接依同一編號內的完整來源句建立 `text_qa`，不再呼叫 AI 猜問答配對，因此速度更快且不會產生教材外內容。含 `_____` 的姓名、年齡或個人資料答案整組安全略過，不拿後方無關完整句代替；候選 `visual_aid` 固定使用空 JSON 物件。
- 已核對本機預期草稿：P5 為 3 題（喜歡名字、暱稱、是否改名）；P7 為 4 題，其中 `Are you a boy/girl?` 保持單一題並接受完整 boy／girl 回答二選一，另有 fool、with me、love them；P9 為 1 題，兄弟姊妹問題接受獨生子女或同時有 brother and sister。`brother and sister` 是正確並列內容，不再誤判為 `He…her…` 類型的代名詞混搭。
- OCR／性別／Workbook 3 實例規則 6/6、管理頁 18/18、Edge Function 語法、Production build、release deploy preflight 與 `git diff --check` 通過；完整口說契約 31/32，唯一失敗仍是既有手機導覽 CSS selector 斷言，與本批無關。PR #259 已合併至 `main` commit `287ba25`；正式 `speaking-content-manager` 為 ACTIVE v44，OPTIONS 回應 200、未登入 POST 回應 401。Cloudflare production build `386236e2-413b-4f84-a783-05252bb085d4` 成功，正式管理頁回應 200 並載入 `main.8f352662.js`，bundle 已確認包含 `reviewed_numbered_text_qa`。Windows 瀏覽器操作核心重設後仍因缺少 kernel 資產無法啟動，因此未繞過管理員登入；P5／P7／P9 的實際新草稿 ID、題數與逐題內容仍待登入後重跑再唯讀核對，本批沒有自動核准或發布題庫。

本次 Workbook 3 P5／P7／P9 逐頁候選 `invalid_output` 修正（2026-09-23，正式部署完成；登入重跑待驗收）：

- 唯讀查核正式資料確認，P5、P7、P9 最近三次生成工作皆已完成 AI 呼叫並取得 14／17／18 個候選及 token 用量，但後端只要其中一題格式、來源句或性別規則不合格，就以 `invalid_output` 拒絕整頁，因此沒有建立單頁草稿；不是上傳、登入、額度或資料庫寫入失敗。
- 逐頁候選改為由同頁已核准文字決定題型：同時有完整問句與回答時固定使用「文字問答（無圖片）」。每題仍須通過來源原句、問答方向與性別一致檢查，但單一不完整候選只會被安全略過，不再讓其他有效題目一起失敗；進度結果會顯示建立題數與略過題數。
- 性別判定新增 father／dad／grandfather／brother 與 mother／mom／grandmother／sister 等家庭稱謂；有明確家庭性別的問句只接受相符完整答案，無性別線索時才可保留教材中成對且文法骨架一致的男性／女性答案。仍不猜測姓名、聲音或圖片，也不會自動核准或發布。
- 不需 migration，不修改或覆蓋既有草稿、已發布題庫及學生紀錄。OCR／性別規則 5/5、口說答案判定、管理頁 18/18、Edge Function 語法、Production build 與 `git diff --check` 已通過；完整口說契約 31/32，唯一失敗仍是既有手機導覽 CSS selector 斷言，與本批逐頁候選無關。
- PR #257 已合併至 `main` commit `3de995d`；Cloudflare production 已載入 `main.09bb3388.js` 並回應 200，正式 `speaking-content-manager` 為 ACTIVE v43，OPTIONS 回應 200、未登入 POST 回應 401。Windows 瀏覽器自動操作元件因本機缺少執行資產而無法使用既有登入狀態，因此未繞過管理員驗證；P5／P7／P9 的實際重新建立、草稿 ID 與題數仍待管理員重按一次後唯讀核對，不影響已完成的程式與部署驗證。

本次 Workbook 3 無圖片文字問答與性別答案規則（2026-09-23，正式部署完成）：

- OCR 逐頁產題新增 `text_qa`「文字問答（無圖片）」方向：同頁含完整問句與設計師回答句時，學生題面顯示問句並要求說出一個完整回答，不再把紅色答案文字拆成逐句朗讀題。新 OCR 會把清楚可見的紅字另存為 `[[RED_ANSWER: ...]]` 核對提示，但產題仍只能選用核准的完整英文句，不能把 `his/her` 等片段直接當答案。管理頁會標示題型，並分開顯示示範回答與「其他可接受的完整答案」。
- 性別判定只使用題目文字，不依姓名、聲音或不存在的圖片猜測。明確 `he／his／him` 只接受男性一致答案，明確 `she／her／hers` 只接受女性一致答案；沒有性別線索且教材提供 `he/she`、`his/her` 時，OCR 候選會展開並保留兩個完整、文法位置正確且性別一致的答案，學生答其中一種即可。
- `pronunciation-coach` 對 `text_qa` 使用示範回答加人工核對替代答案做精確比對；未在核准清單中的相反性別或 `He…her…`／`She…his…` 混搭不算答對。逐頁候選仍需人工核准，修改後會撤銷核准；已核准草稿才可產生示範語音及發布。
- 不需 migration，未修改既有草稿、已發布題庫或學生紀錄。OCR／性別規則 5/5、口說答案判定、管理頁與學生口說 React 45/45、Edge Function 語法、Production build 與 `git diff --check` 皆通過；完整口說契約 31/32，唯一失敗是既有手機導覽 CSS selector 斷言，與本批文字問答無關。
- PR #255 已合併至 `main` commit `e894e6c`；Cloudflare production build `5864dcb1-fce8-4350-8fc7-455147f37cd3` 成功，正式站載入 `main.0057c64b.js` 並回應 200。正式 `speaking-content-manager` v42、`pronunciation-coach` v22、`speaking-challenge` v36、`speaking-tts-manager` v30 均為 ACTIVE；四個 OPTIONS 回應 200，未登入 `speaking-content-manager` POST 回應 401。
- 既有 Workbook 3 草稿不會自動改寫；要套用新題型必須由管理員刪除舊的未發布草稿後重新建立，再逐題核對。新 OCR 才會產生紅字提示；既有核准 OCR 若保留 `he/she`、`his/her`，仍會由安全展開規則產生兩個一致的完整答案。

本次 OCR 逐頁建立草稿進度顯示（2026-09-23，正式部署完成）：

- 「依每頁建立候選草稿」執行期間會在來源卡即時顯示目前頁碼、已完成頁數／總頁數、百分比進度條，以及每頁的等待、處理中、AI 草稿、待人工補題或失敗狀態；按鈕也同步顯示例如 `逐頁建立 3/10`，不再只有無法判斷進度的「逐頁建立中」。
- 十頁仍採逐頁循序建立：每頁各自完成 Firebase 管理員驗證、OCR 頁面擷取、AI 出題、跨題庫重複句比對與草稿寫入。未改成平行請求，避免同一來源 section 的唯一版本號再次競爭碰撞；未修改資料庫、Function、既有草稿或學生資料。
- 驗證：管理頁 targeted 17/17、Production build 與 `git diff --check` 通過。PR #253 已合併至 `main` commit `21752cb`，Cloudflare production build `a2a3db3d-c694-435f-9262-0a116185843e` 成功；本批不需重新部署 Supabase Function。

本次 Workbook 3 逐頁草稿只建立 P1 修正（2026-09-23，正式部署完成）：

- 唯讀查核遠端 Workbook 3 P1～P10 生成工作後確認：P1 成功；P2、P5、P7、P8、P9 已由 AI 找到 1／14／13／1／18 題，但 `speaking_question_sets_unique_version (source_section_id, version)` 要求同一十頁來源的版本號不可重複，而舊邏輯卻讓每個新頁面都使用第 1 版，因此全數以 `question_set_insert_failed` 失敗。P4 的 10 題皆與既有題庫重複；P3、P6、P10 僅有填空或中文詞彙，沒有可安全直接朗讀的完整英文句。
- `speaking-content-manager` 現在以整個來源 section 的最新版本計算下一個唯一版本號，但 `previous_set_id` 仍只連到同一頁的上一版。正常頁建立 AI 題目；無完整句或全部重複的頁面仍建立 0 題「待人工補題」單頁草稿，保留原因與重複來源，且至少人工新增一題前不得核准或發布。
- 管理頁在已核准來源卡下永久顯示 P1～P10 每頁結果；0 題頁面的批次核准勾選停用並改顯示「打開補題」。未修改 schema、migration、RLS、既有題庫、發布狀態或學生資料。
- 驗證：管理頁 targeted 17/17、逐頁 OCR／版本號契約 3/3、Edge Function TypeScript 語法、Production build 與 `git diff --check` 均通過。完整口說契約另有一項既有手機導覽 CSS selector 斷言失敗，與本批逐頁建立修正無關。
- PR #251 已合併至 `main` commit `42529a2`；Cloudflare production build `fb5dad1c-5666-4caf-a157-3d62e4e140a4` 成功。正式 `speaking-content-manager` 為 ACTIVE v41，未登入 POST 實測回應 401。未代替管理員重新產生、核准或發布 Workbook 3 草稿。

本次 OCR 候選草稿單頁卡片修正（2026-09-23，正式部署完成）：

- 修正「依每頁建立候選草稿」已正確產生 `source_page_label = P1` 等單頁題庫，但「製作中草稿」仍用原始十頁 OCR section 顯示 `P1–P10（舊版跨頁）` 的誤導問題。逐頁 OCR／AI 候選現在依題庫的單一來源頁拆成獨立卡片，例如 P1、P2 各自是一個關卡；只有真正仍以跨頁來源建立的舊題庫才保留「舊版跨頁」。
- 此修正只改管理頁的列表投影與顯示，不修改既有題庫、來源 section、Supabase Function、schema、RLS、學生進度或發布狀態。管理頁 targeted 17/17、Production build 與 `git diff --check` 通過；localhost 已以現有 Workbook 3 草稿驗收，外層顯示「P1 · 所有格／P1 單頁關卡」，內層顯示「P1 口說練習」，不再誤標 `P1–P10（舊版跨頁）`。未替管理員核准或發布草稿。

本次整本 OCR 核對入口修正（2026-09-23，正式部署完成）：

- 「1 教材來源」新增「待核對 OCR 批次」，會直接列出尚未建立題庫的 `draft` 教材來源；管理員可逐批展開、校正 Unit／主題／頁碼與 OCR 文字、保留 `[[PAGE P頁碼]]` 標記並核准，不再因題庫尚未存在而被「製作中草稿」列表排除。
- 核准後沿用既有 `review_ocr_source` 流程移至「已核准教材頁面」；單頁可建立本頁 AI 草稿，含完整頁碼標記的十頁批次可按「依每頁建立候選草稿」。未修改資料庫、RLS、Edge Function、既有 OCR 文字、題庫或學生資料。
- 頂部「教材來源」待核對數量改以實際待核對來源加辨識失敗批次計算，避免同一 OCR 批次同時被 section 與 chunk 重複計數。管理頁 targeted 16/16、Production build 與 `git diff --check` 通過；localhost 管理員頁實際顯示 23 批真正 OCR 來源，其中 Workbook 3 的 P1–P106 共 11 批皆可展開，P1–P10 文字確認含 `[[PAGE P1]]` 至 `[[PAGE P10]]`，未勾核對聲明前核准按鈕維持停用。人工貼入的 Workbook 1 P26～P27 不會混入 OCR 清單。

本次學生口說小關卡頁碼優先顯示（2026-09-22，正式部署完成）：

- 學生 Workbook 關卡卡片不再在最前面顯示「課本／主題」與把頁碼縮成標題後方小標籤；有來源頁碼的關卡現在將 `P.4`、`P.14`、`P.100` 放在最左側第一個醒目區塊，主題／題型與程度維持為次要文字。
- 舊跨頁資料不被改寫；卡片會顯示實際來源範圍，例如 `P.18～20`、`P.35～36、60、99～100`。頁碼區改為可隨內容加寬，三位數頁碼不會被裁切；沒有來源頁碼的既有入門關則保留其分類標記。
- 驗證：學生關卡 React targeted 23/23、Production build 與 `git diff --check` 通過。PR #247 已合併至 `main` commit `17f7688`；Cloudflare production 版本 `d5e3e8d9` 已切換為 100%。以登入管理員的正式網址重新載入 Workbook 3 關卡列表，實際顯示 `P.4` 在卡片最左側，右側為「看圖補句」與「身體部位・國小中年級」。

本次主題小關卡不顯示頁碼（2026-09-22，正式部署完成）：

- 上一版把所有帶有 `source_pages` 的關卡都套用頁碼優先，連「主題練習」也顯示 `P.頁數`，不符合已確認的分類規則。現在只有「課本練習」使用頁碼前綴；「主題練習」在卡片最左側固定顯示「主題」，並保留名稱、主題／題型與程度作為其餘資訊。
- 驗證：學生關卡 React targeted 23/23、Production build 與 `git diff --check` 通過。PR #249 已合併至 `main` commit `c2523b9`，Cloudflare Workers build 已通過；正式網址 `/student/speaking-challenges/book/book-1?release=c2523b9` 回應 HTTP 200。此項僅改變學生卡片顯示，不改寫既有題庫、來源頁碼或學生進度。

本次 Workbook 3 P4 學生關卡圖片部署修復（2026-09-22，正式部署完成）：

- 正式資料唯讀核對確認題庫 ID `37` 的 10 題均有 `picture_gap_sentence` interaction、圖片連結、ready 私人 R2 物件及替代文字；圖片未遺失，也不需重新上傳或重新建立草稿。
- 前次判斷「只需重部署」不完整：v34 已包含 mixed 題面的輸出邏輯，但共用的關卡類型白名單把 metadata 的 `mixed` 轉為空字串，使學生 API 根本不查每題 interaction／私人圖片；同一漏判也讓這批題目的發音評分誤走一般句流程。
- 已將「關卡是 mixed」與「單題實際題型」分開處理：讀取時依每題已核准 interaction 取回短效私人圖片與補句音檔；評分與完成時也以該單題類型比對答案。題庫、R2 圖片、學生進度與資料庫均未修改。
- PR #245 已合併至 `main` commit `10f561c`；正式 `speaking-challenge` 為 ACTIVE v35、`pronunciation-coach` 為 ACTIVE v21。兩者 OPTIONS 均為 200、未登入 POST 均為 401。登入管理員的 P4 預覽頁重新整理後，第一題已實際顯示「一隻眼睛」私人圖片與「聽整句（每個挖空停 2 秒）」按鈕。

本次逐頁混合題型發布第二階段修復（2026-09-22，正式部署完成）：

- Workbook 3 P4 題庫 ID `37` 已完成內容審核，10 題與私人圖片皆完整。前一版 Function 雖已能處理 mixed 題組，管理頁發布按鈕仍把整組送到一般完整句語音；後端篩除 10 題看圖補句後又把「0 題完成」誤回報成功，直到真正發布時才因缺少 `question_prompt` 音檔被拒絕。
- 管理頁現在依每題 interaction 決定語音工作：混合題組會分別準備一般完整句與看圖補句停頓語音；沒有一般完整句時不再誤呼叫一般語音。後端若收到零題的一般語音工作會明確回傳錯誤，不再假成功。
- 看圖補句題面中的中文括號提示只供學生閱讀；送交英文 TTS 前只移除含中文／注音的括號片段，保留純英文括號，避免中文提示被誤念。
- 驗證：管理頁 targeted 15/15、語音契約 8/8、全部 Edge Function 語法、Production build 與 `git diff --check` 均通過。完整口說契約 29/30；唯一失敗仍是既有手機播放器 CSS selector 斷言，與本批發布／TTS 修正無關。PR #242 已合併至 `main` commit `49706f6`，Cloudflare production build `e280c243-42ca-4ce4-b48e-55aa9b6bb1cf` 成功，正式 `speaking-tts-manager` 為 ACTIVE v29；正式管理頁回應 200、Function OPTIONS 200、未登入 POST 401。本批不需重新 OCR、重新審核或變更資料庫，也未代替管理員產生付費 TTS 或發布 P4。

本次原始 PDF 視覺逐頁口說草稿（2026-09-22，本機完成、尚未部署）：

- 分支 `feature/page-visual-speaking-authoring` 將整本教材的主要出題流程改為「一個學生版頁碼＝一個口說關卡」。管理員可直接針對既有私人 R2 原始 PDF 的十頁批次執行視覺分析；AI 依每頁實際編號、句型、問答與圖片判斷 1～30 題，不再受固定 3 題、5 題或只讀 OCR 文字限制。Workbook 3 P4 的驗收案例預期為 10 題。
- AI 可在同一頁混合建立完整句朗讀、看圖完整問答與看圖補完整句，並回傳每張教材圖片在原始頁面的標準化裁切範圍。每頁個別建立未發布草稿；其中一頁失敗不會中止或回復同批其他已完成頁面，也不會自動核准、發布或建立學生紀錄。
- 瀏覽器使用短效私人原始 PDF 網址，以 PDF.js 高倍率渲染來源頁；高／中信心圖片會自動裁切、移除過量近白留白、保留安全邊界並輸出最長邊 2400px、品質 0.94 的 JPG。低信心範圍不會猜測上傳，會留給管理員使用原始 PDF 重新框選。原始 PDF、裁切圖及學生圖片仍維持私人 R2。
- 新版混合草稿可修改名稱、主題與逐題內容，新增、刪除、上下排序、替換或重新裁切圖片。任何修改都撤銷內容核准；重新分析會建立新版本，不覆寫人工調整。人工核准時若 AI 偵測題數與目前草稿題數不同，確認視窗會明確列出差異，核准後以管理員確認的實際題數為準。
- 原分支曾試做學生口說目錄的頁碼標題；2026-09-25 與 `main` 整合時以現行學生目錄為準，這批只處理管理員視覺建稿入口。口說地圖另由 PR #277 處理。
- 成本控制：只有管理員主動執行視覺分析時才呼叫既有正式 OpenAI 設定；同一十頁批次一次分析並保存結果，學生瀏覽、重新整理與草稿編輯不會再次呼叫。每次模型與 token 用量會寫入生成 metadata，供既有成本中心追蹤；本機測試未執行付費呼叫。
- 驗證：管理員、學生目錄與服務 targeted 3 suites／42 tests、教材口說契約 30/30、完整 Edge Function 語法與口說音訊契約、Production build 及 `git diff --check` 均通過。既有 React Router v7 future flag 與 Node module-type／deprecation 訊息屬警告，沒有編譯或測試失敗。
- 本批不新增 migration、不修改 RLS、Secret、既有正式題庫或學生進度；需部署 `speaking-content-manager`、`speaking-tts-manager` 與 Cloudflare 前端後才會生效。登入後的真實私人 PDF、視覺模型回覆、R2 Range／CORS 與自動裁圖仍待正式部署前後各抽驗一次。

本次單頁 AI 草稿 30 題資料庫限制修正（2026-09-22，正式資料庫與 Function 已部署）：

- 正式 `speaking-content-manager` 記錄顯示，建立 AI 草稿在 2026-09-22 08:57:43 寫入生成工作時被 PostgreSQL `23514` 拒絕；原因是 Function 已允許單頁自動判斷 1～30 題，但 `speaking_generation_jobs_count_check` 仍限制 1～20。
- 新增 additive migration，將工作題數限制調整為 1～30；既有生成工作、草稿、正式題庫與學生紀錄不做更新或刪除。Function 同時把同類型 schema 未同步錯誤轉成可讀提示。
- 回復方式：先回復 Function；資料庫限制可維持較寬的 1～30 而不影響舊流程。若一定要縮回 1～20，必須先確認沒有 `requested_count > 20` 的工作紀錄，再用新的 migration 調整，不能直接刪除正式紀錄。
- Migration `20260922012056_allow_30_speaking_generation_questions.sql` 已精準套用並登記正式 history；查回 constraint 為 `requested_count >= 1 and <= 30` 且已驗證。正式 `speaking-content-manager` 已部署，未登入 POST 正確回應 401。
- 驗證：隔離 PGlite migration 2/2、全部 Edge Function 語法、Production build 與 `git diff --check` 通過。完整口說契約 29/30；唯一失敗為既有手機播放器 CSS selector 斷言，與本批資料庫／Function 修改無關。尚未使用管理員按鈕建立付費 AI 草稿，因此登入後生成結果留待管理員實機重試。
- PR #238 已合併至 `main` commit `103a464`；Cloudflare production build `c4632679-9afa-47ad-9d4d-a787c7bbcac6` 成功，正式首頁與 `/admin/speaking-content` 均回應 HTTP 200。

本次單頁 AI 草稿自動判斷題數（2026-09-22，正式部署完成）：

- 「建立本頁 AI 草稿」不再要求管理員預先選 3、5、8、10 或 12 題；AI 會先依單一已核准教材頁辨識實際的編號、完整句型與明確問答組，排除頁碼、標題、格線、作業指令與重複文字後建立 1～30 題草稿。
- 新草稿標記為 `ai_page_auto` 並保存偵測題數，只停留在「製作中草稿」。管理員須逐題對照原教材並核准後，才會進入待發布；修改任何題目會撤銷核准。一般題庫仍至少 3 題，只有單頁人工或單頁 AI 自動草稿可依頁面內容至少 1 題發布。
- 不新增 migration、RLS、Secret 或正式題庫資料；只調整管理頁與既有 `speaking-content-manager` 的生成、核准及發布驗證。
- 驗證：管理頁 14/14、自動題數契約 1/1、完整 Edge Function 語法、Production build 與 `git diff --check` 通過。PR #236 已合併至 `main` commit `409b827`；正式 `speaking-content-manager` 已部署，未登入 POST 回應 401。Cloudflare production build `a076f300-1ee5-4677-bf7f-2c9dd7340c73` 成功，正式首頁與管理頁均回應 HTTP 200。未自動建立、核准或發布任何題庫草稿。

本次口說題庫逐頁四區工作流（2026-09-22，正式部署完成）：

- 管理頁固定分為「教材來源／製作中草稿／待發布／已發布」四區，直接顯示各區數量；新關卡維持一個 Workbook 學生版頁碼對應一個關卡，舊跨頁題庫保留並清楚標示，不做破壞性改寫。
- 草稿依即時內容檢查自動分流；不完整項目以紅色清單逐題說明，完整草稿自動進入待發布。待發布按一次會先完成必要語音，全部成功後才發布，避免語音與正式狀態不同步。
- 一般已發布關卡可建立唯讀正式版的新版本草稿；A–Z 與正式來源鎖定模板維持來源重建規則。已發布版本可安全下架，歷史學生紀錄保留。
- 驗證：管理頁與服務 targeted 17/17 通過；Edge Function 語法與 Production build 通過，本機及正式網址的登入後四區介面驗收通過。Cloudflare production build `009ccb7` 成功，正式 `speaking-content-manager` 已部署，未登入 POST 正確回應 401。

本次整本教材 OCR 結構化輸出修正（2026-09-21，正式 Function 已部署並驗證）：

- 遠端 Workbook 3 的 P61–P70 OCR 衍生批次已確認完整上傳（4.46MB），前八次嘗試都在模型回覆解析階段失敗；這不是 500MB 上傳、R2 讀取或輸出 token 上限問題，P1–P60 的既有待核對文字不受影響。
- `speaking-content-manager` 以 Responses Structured Outputs 固定 OCR 的 `source_text`、`detected_pages`、單元與主題欄位；支援頂層文字、巢狀內容、巢狀文字值及已解析的結構化回覆。整本每十頁 OCR 的輸出上限為 16,000 tokens，保存的 OCR 文字上限為 60,000 字元。歌曲或韻文頁只保留歌曲名稱、教材單字與標題，歌詞正文統一寫為 `[歌曲歌詞略]`，避免要求供應商逐行重製完整歌詞。若供應商沒有產生可用文字，會安全回報 `ocr_output_empty`、`ocr_output_not_json`、`ocr_source_text_missing`、`ocr_response_incomplete`、`ocr_response_content_filtered` 或 `ocr_response_refused`，不再只顯示通用服務錯誤。
- 沒有 migration、RLS、資料修改或自動重試。正式 `speaking-content-manager` 已部署後，Workbook 3 P61–P70 第 10 次單獨重試成功：OCR 使用 9,791 input tokens／3,327 output tokens，已建立待人工核對來源 #44；不會建立或發布學生題目。
- 驗證：新增 OCR 合約通過，完整 Edge Function 語法檢查、Production build 與 `git diff --check` 通過。既有題庫合約測試仍有兩項與本批無關的基準失敗：管理頁舊標題與已移除的手機播放器 CSS 斷言。

本次整本教材 OCR 超大掃描頁保護（2026-09-21，已正式部署）：

- 整本教材仍限制 500MB／500 頁，但可包含高達 200MB 的單一原始掃描頁。瀏覽器會先保留完整原始 PDF，再只為超過 OCR 安全大小的十頁批次建立高品質 JPEG-PDF 衍生檔，避免將 100MB 以上的原始批次送進 Edge Function 後因記憶體而中斷。
- 轉換會逐步降低 OCR 副本的最長邊與 JPEG 品質，並顯示目前頁碼；若全部安全檔嘗試仍失敗，會指出精確頁碼範圍。單一來源與 OCR 衍生批次維持 20MB，原始教材不被降畫質、覆蓋或公開。
- 驗證：分割器與題庫管理 React targeted 2 suites／16 tests、Production build、`git diff --check` 通過；PR #225 的 Cloudflare build 成功，正式管理頁已顯示「單頁原始掃描可達 200MB」。既有題庫合約測試另有兩項基準失敗（管理頁舊標題與手機安全區舊斷言），與本批修改無關。自動化瀏覽器無權將本機 144.2MB PDF 傳入檔案選擇器，因此仍需由管理員人工按一次上傳以完成端對端驗收；未啟動 OCR、未建立草稿或學生內容。

本次管理員口說大挑戰評分示範（2026-09-20，已正式部署）：

- 管理員預覽已發布口說關卡時將可送出自己的錄音並取得 AI 評分；教師仍維持唯讀。管理員評分不會寫入學生進度、學生答題紀錄、XP／AE Points、A–Z 回合或每日 5 輪額度，僅保留既有供應商請求 ledger 以控制重送與成本。
- A–Z 管理員示範會在前端建立暫時的題目順序與本機聆聽完成狀態，不建立學生 A–Z 回合或聆聽紀錄。
- 驗證：管理員／教師角色契約 2/2、口說流程契約 7/7、Workbook 1 基礎答案契約、相關 React 測試 4 suites／52 tests、完整 Edge Function 語法檢查、Production build 與 `git diff --check` 均通過。PR #215 已合併至 `main` commit `51e1444`；`pronunciation-coach` 已重新部署，未登入請求正確回應 401，Cloudflare `main` build 成功，正式 `/student/speaking-challenges` 回應 HTTP 200。登入管理員的真實麥克風／Azure 評分仍待人工抽驗。

本次逐頁 OCR 草稿完整句去重（2026-09-20，已正式部署）：

- 管理員由 OCR 核對文字逐頁建立候選草稿時，`speaking-content-manager` 會先比對同一 Workbook 內所有未封存的草稿與已發布題庫。完整句會忽略大小寫、標點、全半形、空白與彎引號後進行精確比對；已存在的句子不再建立第二次。
- 被略過的題目會寫入新草稿的 `generation_metadata.duplicate_review`，題庫管理會顯示「略過的完整句 → 來源頁碼／題庫名稱 → 草稿或已發布」，讓管理員能判斷是否應人工調整。若整頁候選皆為既有句子，系統不會建立空草稿並明確回傳「全部題目都與既有題庫重複」。
- 不修改任何既有題庫、學生進度、資料庫 schema、migration、RLS 或 Secret。此規則只處理完全相同的句子，不會自動判定同義改寫；同時由兩位管理員建立相同頁面的極少數競態情況仍以既有頁碼草稿保護與人工審核為準。
- 驗證：題庫管理 React targeted 11/11、逐頁去重契約測試 1/1、完整 Edge Function 語法檢查、Production build 及 `git diff --check` 均通過。PR #212 已合併至 `main` commit `4c1dbd7`；`speaking-content-manager` 已重新部署，未登入請求正確回應 401，Cloudflare production build `ace89a04` 成功，正式 `/admin/speaking-content` 回應 HTTP 200。登入管理員建立候選草稿的實際去重結果仍待人工抽驗。
- 遠端草稿抽驗：管理員於 2026-09-20 建立既有人工核對來源的 Workbook 1 P26～P27「完整句與縮寫」草稿，題庫 ID `33`、第 1 版、9 題、狀態 `draft`。未核准、未發布、未建立學生紀錄；這筆固定來源草稿不會觸發 OCR 逐頁去重。Workbook 1 現有 OCR 批次仍為 0/12 批人工核准，必須先逐頁核對來源，才可安全驗收去重候選流程。

本次學生頭貼 Local Storage 切頁快取（2026-09-20，已正式部署）：

- 學生自己的 Navbar、我的設定與排行榜本人頭貼改為共用讀取 hook：元件掛載時同步讀取目前 Firebase UID 對應的 Local Storage 快取，再於背景接受遠端更新；不再因 React 換頁重新先顯示讀取動畫。
- 頭貼快取完成或更換頭貼後會發出同頁更新事件，已開啟的頁面會立刻由遠端短效網址切換為本機 Data URL；重新整理與切換學生頁也優先使用該預覽。快取縮圖最多 192px／360KB，原始大圖不會寫入 Local Storage；換帳號、登出與來源圖片改變時仍維持既有隔離及失效保護。
- 驗證：頭貼快取、快取 hook、頭貼顯示與設定頁 targeted 4 suites／17 tests、Production build 及 `git diff --check` 均通過。PR #211 已合併至 `main` commit `e15b3bc`，Cloudflare build `9258b7b5` 成功；正式根網域與 `/student/settings` 均回應 HTTP 200。登入學生的實際切頁快取體驗仍待人工驗收。

本次 OCR 逐頁候選口說草稿（2026-09-20，已正式部署）：

- 整本教材的每 10 頁 OCR 現在要求在核對文字中保留 `[[PAGE P頁碼]]` 標記。管理員核准整段文字後，可在題庫管理一次為該段每一頁建立個別「完整句朗讀」候選草稿；每頁最多 6 題、各自有來源頁碼與重複建立保護，一頁失敗不會回復已完成頁面。
- AI 只能以該頁核對文字的既有單字與句型出題，不會臆測圖片、補充教材外新單字或自動上傳圖片。若可明確看出需要圖片，草稿僅顯示裁切建議；管理員仍須使用本機 PDF 高解析裁切器自行框選、確認並上傳私人圖片。
- 候選草稿建立後必須逐題對照原頁，再按「已逐題對照原頁，核准內容」才可發布；題目修改會撤銷該草稿核准，但不會把已核對的整段 OCR 來源退回草稿。未新增 migration、RLS、Secret 或正式資料異動。
- 驗證：題庫管理／服務 targeted 2 suites、15 tests、完整 Edge Function 語法檢查與 Production build 通過。PR #210 已合併至 `main` commit `fe054f6`，其後 `cd8e32f` 修正 Function 的缺失括號並重新部署；Cloudflare 最新 `main` build 成功，正式根網域與 `/admin/speaking-content` 均回應 HTTP 200，未登入 Function POST 正確回應 401。未建立遠端草稿，登入後的管理員建立／學生練習流程仍待人工抽驗。

本次 PDF 高解析圖片裁切工具（2026-09-20，已正式部署）：

- 逐頁口說草稿的每一個看圖題新增「從 PDF 高解析擷取圖片」。管理員在瀏覽器本機選擇學生版或教師版 PDF、指定 PDF 實際頁次，再於高倍率渲染頁面拖曳框選單一圖片；輸出為最長邊 2400px、JPEG 品質 0.94 的 JPG，直接回填既有私人題目圖片欄位。未按「使用這張裁切圖片」前，PDF 與畫面渲染都不會上傳；建立草稿後仍走既有私人 R2、替代文字與發布前核對流程。
- 不採用「自動猜哪一張圖片」：同一頁常同時有插圖、題目文字與答案標記，沒有管理員指定目標時自動裁切會把錯誤素材帶入學生題目。此版讓管理員只需框選，不必先用外部截圖工具，仍能確保不包含相鄰圖片或大量白邊。
- 已加入固定版 `pdfjs-dist@3.11.174`，僅供管理員端 PDF 繪製與本機裁切；未改動 React、既有相依套件、資料庫、RLS、Secret 或正式資料。實際唯讀檢查：Workbook 1 學生版 119 頁、Workbook 3 教師版 106 頁，均為未加密 A4 PDF；Workbook 3 PDF 第 4 頁於 220 DPI 渲染可正常辨識多張獨立圖片。驗證：管理員表單 targeted 4/4、Production build 與 Cloudflare 最新 `main` build 成功；未建立遠端草稿，登入後實際裁切與私人上傳流程仍待人工抽驗。

本次逐頁混合題型口說草稿（2026-09-20，已正式部署）：

- 「從頭建立自訂口說草稿」改為「逐頁建立口說草稿」：一個學生版頁碼只建立一個小關卡，第一個已發布小關卡仍會自動出現在該 Workbook 的學生口說大挑戰中；同頁可以混合完整句朗讀、看圖完整問答、看圖補完整句。
- 建立前會以欄位紅框與摘要列出問題，並以第二次確認視窗顯示教材、單一頁碼、關卡、主題與逐題題型／內容／圖片大綱。建立動作只建立 `draft`，不會自動發布、建立學生紀錄或讓學生看到。
- 新版草稿的私有圖片仍逐題核對教材、來源頁與題型後才上傳至 R2；發布時完整句須有示範語音，看圖題須有私人圖片與替代文字，補句另須有每個挖空停兩秒的整句音檔。學生端僅在發布後取得短效圖片網址，且新版混合關卡按每題渲染原有練習流程。
- 驗證：管理員表單 targeted 3/3、學生口說既有 targeted 22/22、完整 Edge Function 語法及既有語音契約均通過，Production build 與 `git diff --check` 均成功。前端已由 Cloudflare 隨 `main` 發布，`speaking-content-manager` 已重新部署；未建立遠端草稿、未執行 migration，登入後的完整建立／發布流程仍待人工抽驗。

本次自訂口說草稿錯誤提示與建立前確認（2026-09-19，已正式部署）：

- 「建立未發布草稿」不再因資料不完整而無說明地停用；按下後會列出教材、頁碼、名稱、主題與逐題內容的確切問題，並在錯誤欄位及題目卡片顯示紅框。前端驗證已對齊 `speaking-content-manager` 的頁數、題數、問句、完整答案、可接受說法、圖片格式／大小及看圖補句規則。
- 看圖補句若輸入相鄰挖空，例如 `It is ____ ____.`，會明確提示連續答案（如 `my nose`）應合併成一個挖空，避免只看到無法建立卻不知道原因。
- 資料全部正確後先開啟第二次確認，顯示教材、頁碼、關卡、主題、活動類型、程度、題數及逐題草稿大綱；只有再按「確認建立未發布草稿」才呼叫後端。仍只建立未發布草稿，不會自動核准或讓學生看到。
- 驗證：表單 targeted 5/5、完整前端 75 suites／301 tests、Production build 與 `git diff --check` 均通過；390×844 與桌面版實際本機畫面確認錯誤紅框、可捲動草稿大綱、固定確認按鈕與關閉按鈕均未溢出。本批不修改 Supabase Function、migration、RLS、Secret 或正式資料。PR #208 已合併至 `main` commit `21f6d98`；Cloudflare production build `dac34c43` 五個階段皆成功，正式根網域 `/admin/speaking-content` 已登入驗收，空白送出會顯示 12 項確切錯誤與對應紅框，且沒有建立草稿。

本次 Workbook 3 首關自動目錄與全形挖空修正（2026-09-19，已正式部署）：

- 學生端的 Workbook 大關卡原本就是依已發布的 `speaking_question_sets` 動態分組，不需要先建立獨立的大關卡資料。管理員頁新增說明：任何已啟用 Workbook 的第一個小關卡正式發布後，學生端會自動出現對應教材卡；未發布草稿仍保持管理員可見、學生不可見。
- 修正中文輸入法輸入全形底線時「建立未發布草稿」持續停用的問題。前端與 `speaking-content-manager` 現在都接受半形 `_`、全形 `＿` 及相容底線字元，並在驗證與保存前統一為 `____`；仍維持 1～8 個挖空及完整句答案核對。
- 學生目錄、後端目錄與逐關解鎖共用相同穩定排序：先依來源起始頁、再依結束頁、最後依題庫 ID。相同起始頁時，單頁關卡會排在跨頁關卡前；未新增 migration、RLS、Secret 或正式資料異動。
- 驗證：管理員草稿／學生目錄 React targeted 2 suites／25 tests、foundation answer 契約與 progression 6 tests、完整前端 75 suites／299 tests、全部 Edge Function 語法、Production build 與本批 `git diff --check` 均通過。PR #206 已合併至 `main` commit `3223b2c`；`pronunciation-coach` v19、`speaking-challenge` v33、`speaking-content-manager` v28、`speaking-tts-manager` v27 及 `student-social` v14 均為 ACTIVE。五個未登入驗收請求皆回應 401。Cloudflare `main` build 成功，正式根網域、口說路由與 `app` 子網域皆回應 HTTP 200。

本次暱稱單一入口、口說練習名稱與頭貼即時快取（2026-09-19，已正式部署）：

- 公開暱稱只能在「帳號／我的設定」建立或修改；好友頁只保留戰績與在線狀態的公開範圍。`student-social` 的 `update_profile` 改為從資料庫取得現有暱稱，不再接受前端暱稱，避免繞過 `update_nickname` 的 7 天限制。
- 學生導覽的「開口說」已統一改為「口說練習」。頭貼快取改為依 Firebase UID 隔離的版本化記錄；學生上傳後把小尺寸圖片預覽轉成 Data URL 存入 Local Storage，重整後先顯示本機圖片，原始圖與私有路徑仍由後端管理；登出或切換帳號不會沿用前一位學生的頭貼。
- 現有 Supabase Functions 變更全數保留，未修改 migration、RLS、Secret 或 `verify_jwt=false` 的 Firebase 自訂驗證架構。完整變更已先合併至最新 `main`，再同步部署 `pronunciation-coach`、`speaking-challenge`、`speaking-content-manager`、`speaking-tts-manager` 與 `student-social`；Cloudflare 連動部署對應前端，避免共用模組、前端與後端契約不同步。
- 驗證：相關 React／快取 targeted 5 suites／36 tests、完整前端 75 suites／299 tests、社交契約 6／6、全部 Edge Function 語法檢查、Production build 與 `git diff --check` 均通過。PR #206 已合併至 `main` commit `3223b2c`，五個 Function 均為 ACTIVE 且匿名請求皆回應 401；正式網域回應 HTTP 200。

本次看圖補句多挖空與直接題面輸入（2026-09-19，已正式部署）：

- 「從頭建立自訂口說草稿」與圖片題庫編輯器改由管理員直接輸入學生實際看到的句型，以 `____` 標示 1～8 個挖空，並另填補好後的完整答案；後端會逐段確認固定文字順序，且每個挖空至少對應一個答案單字。
- 學生端原有句型 tokenizer 可同時顯示多個挖空，提示文字已改為每個挖空都要補上；停頓整句語音改為多段合成，每個挖空各插入精準 2 秒靜音，音檔版本升至 `picture-gap-leda-v4`。既有單一挖空題相容，單一 `The ____` 弱讀候選流程不變。
- 不新增 migration、RLS 或正式資料異動。答案契約、語音 8 項測試、管理員／學生 React targeted tests 11 項、完整前端 75 suites／299 tests、完整 Edge Function 語法及 Production build 均通過。PR #206 已合併；`speaking-content-manager` v28、`speaking-tts-manager` v27、其他相依 Speaking Functions 與 Cloudflare 前端均已正式部署。

本次封鎖保留好友關係（2026-09-19，後端已部署）：

- `student-social` 的封鎖動作不再刪除已接受的 `student_friendships` 紀錄，因此封鎖期間原有好友資料與戰績可保留；解除封鎖後，雙方直接回到一般好友狀態。只有「刪除好友」會移除已接受的好友關係。尚未接受的好友邀請會在封鎖時取消，避免封鎖期間仍可回覆邀請。好友名單中的已封鎖好友會以紅色「已封鎖」按鈕標示，且不可重複封鎖。
- 新增共用頭貼載入元件：Navbar、我的設定、排行榜以及好友搜尋／邀請／好友／封鎖與頭貼放大預覽，在圖片尚未成功載入前都顯示轉動動畫；載入失敗則停止動畫並回退既有名字首字或失敗提示。
- 社交契約 6/6、所有 Edge Function 語法與 Production build 均通過。已依既有授權例外從目前功能分支部署正式 `student-social`，未登入 overview 請求回應 401；未部署 Netlify。本批不含 migration、RLS 或既有學生資料異動；登入後雙帳號行為驗收仍待執行。

本次學生暱稱每週一次修改限制（2026-09-18，後端已部署；前端尚未部署）：

- `student-social` 會依伺服器端暱稱歷史的最近一次實際更名時間，拒絕 7 天內再次更換的要求，並以台北時間回傳下次可修改時間；初次設定與重送未改變的同一暱稱不消耗或觸發冷卻。
- 我的設定頁同步顯示「每 7 天只能修改一次」說明，並在送出新暱稱後顯示確認彈窗，只有按下確認才會寫入。React 設定頁／好友頁／暱稱驗證測試 25 項、社交契約測試 6 項、Edge Function 語法檢查及 Production build 均已通過。經專案擁有者明確同意的例外流程，已從目前功能分支部署正式 `student-social`；未登入 POST 驗證回應 401。未部署 Netlify，因此確認彈窗與前端說明仍只存在本機 build；本批沒有 migration、RLS 或既有學生資料異動。

本次好友搜尋公開上傳頭像（2026-09-18，後端已部署；前端說明尚未部署）：

- 經專案擁有者明確決定，`student-social` 的精確暱稱／好友碼搜尋現在也會為自行上傳的頭像產生 15 分鐘短效網址，不再要求雙方先成為好友；好友名單、封鎖、搜尋頻率限制與其他資料隱私規則不變。
- 好友頁文字與學生手冊已改為反映此公開範圍。社交契約 6/6、Edge Function 語法與 Production build 均通過；經已授權的功能分支例外流程，正式 `student-social` 已部署，未登入搜尋請求回應 401。尚未部署 Netlify，因此好友頁的新說明文字尚未出現在正式站；本批沒有 migration、RLS 或既有學生資料異動。

本次好友邀請、封鎖頭貼與取消邀請（2026-09-19，後端已部署；前端尚未部署）：

- 後端 overview 會為 pending 來／去邀請及已封鎖的對象產生上傳頭像短效網址；好友頁頭貼改為完整縮放，若圖片載入失敗會退回顯示暱稱首字，不會卡在破損圖片狀態。搜尋結果的頭貼另有專用 class，明確覆蓋搜尋按鈕通用內距為 `padding: 0`；已封鎖區塊新增可旋轉的展開箭頭，頭貼也可點擊放大。
- 已送出的好友邀請新增「取消邀請」；後端只允許原邀請者刪除仍為 pending 的指定邀請，並寫入 audit。取消邀請與封鎖頭貼 targeted React tests、社交契約 6/6、Edge Function 語法與 Production build 均通過；正式 `student-social` 已部署，未登入 overview 請求回應 401。尚未部署 Netlify，因此取消按鈕、圖片完整縮放、封鎖展開箭頭與載入失敗回退尚未出現在正式站；登入後雙帳號驗收待執行。本批沒有 migration、RLS 或既有學生資料異動。

本次學生頭像重新整理壞圖修正（2026-09-18，尚未部署）：

- 修正登入刷新時將私有 `user_image` 路徑寫入 Local Storage、再被 Navbar 與設定頁當作可直接顯示網址的問題。快取現在只接受短效簽名網址、Netlify 圖片網址或系統預設頭像路徑；私人 `avatars/...` 路徑會被略過。
- MainNavbar、我的設定與排行榜取得遊戲化摘要後會更新顯示 URL 快取。快取單元測試與 Navbar／設定／排行榜回歸測試 27/27、Production build 與 `git diff --check` 均通過。本批未改資料庫、R2、Edge Function 或正式資料，尚未 commit、Push 或部署。

本次學生暱稱不雅用語過濾擴充（2026-09-18，尚未部署）：

- 前端與 `student-social` Edge Function 同步加入台語常見辱罵、性器官指涉與諧音／空白變形的暱稱阻擋；保留既有長度、可用字元、禁用英文詞、重複暱稱與後端原子寫入規則。
- 新增前端驗證案例與 Edge Function contract assertions；前端相關 React tests 25/25、社交安全契約 6/6、全部 Edge Function 語法檢查、Production build 與 `git diff --check` 均通過。本批不新增 migration、不改 RLS、不寫入既有學生資料，且不部署 Function。

本次學生頭像 Local Storage 快取（2026-09-18，尚未部署）：

- 頭像上傳或選擇預設角色成功後，會同步更新 `ae-userimage` 與 `ae-profile-cache-v2`；學生 Navbar、我的設定及排行榜的「本人」照片會優先讀取這份瀏覽器快取，並由 React 個人資料 state 立即重繪，不必重新整理。
- 排行榜中其他學生與好友照片仍只使用各自 API 回傳資料，不會讀取目前使用者的快取。登出流程維持清除頭像與個人資料快取。
- 驗證：StudentSettings／LearningLeaderboard React tests 11/11、Production build 與 `git diff --check` 均通過；本批沒有 migration、Edge Function 或權限調整，尚未 commit、Push 或部署。

本次本機開發產物清理（2026-09-18）：

- `.gitignore` 新增 `/.codex-temp/`、`/build-p26/` 與 `/output/`，避免 Word／PDF 視覺驗收、舊版 Production build 及口說教材輸出再次出現在 VS Code Source Control。
- 已刪除未追蹤的 `.codex-temp` 11,368 個檔案（約 3.52 GB）及 `build-p26` 73 個檔案（約 27.7 MB）；`output` 的 62 個教材檔案完整保留在本機，只從 Git 變更清單排除。
- 驗證：Production build 與 `git diff --check` 通過；清理前後皆無已追蹤程式碼變更。

本次聽力播放動畫與看圖補句手機版面（2026-09-18，已正式部署）：

- 教材聽力 MusicCard 的播放中狀態改為置中的白色四條音樂等化器動畫，尺寸配合桌面 62px／手機 50px 播放按鈕；偏好減少動態效果時改顯示靜態等化器，不影響既有播放、暫停或有效聆聽判定。
- P22～P24 及日後同型的看圖補句關卡，在 700px 以下將句型固定為 20px，移除每個單字的淡藍色背景與多餘內距；A–Z、P14～P17 及其他口說題型不變。
- 驗證：targeted 2 suites／8 tests、完整前端 72 suites／279 tests、Production build、`git diff --check` 與 390×844 靜態視覺檢查均通過；手機句型計算值為 20px、單字背景透明、50px 播放鍵內的等化器為 26×24px，且無水平溢位。PR #203 已合併至 `main` commit `06e8bbc`；Netlify production deploy `6aad19383a7df1e5862c6715` 已 live，正式網域與唯一部署網址的首頁、口說路由及教材路由皆回應 HTTP 200，正式 CSS 已確認包含等化器、20px 手機句型及透明單字背景。未使用學生帳密，登入後真實音檔播放與 P22～P24 實機畫面仍待學生裝置快速驗收。

本次 CSV 登入卡 Word／PDF 匯出修正（2026-09-18，已正式部署）：

- 正式站 Word 下載在修正 `WidthType.DXA` 後仍出現 `Cannot read properties of undefined (reading 'CENTER')`；原因是 `docx` 的其他瀏覽器列舉物件同樣可能缺失。本批將 Word 產生器所需的對齊、框線、列高、分節、表格配置與垂直對齊改用 DOCX 規格固定值，並用測試同時模擬全部列舉缺失。
- CSV 建立成功區新增「下載 PDF 登入卡」，在瀏覽器本機以 A4 每頁 8 格產生 PDF；每格維持左側學生姓名、帳號、臨時密碼與兩組復原碼，右側 QR Code。既有 Word 下載與系統列印入口保留，啟用連結不送往第三方。
- PR #201 已合併至 `main` commit `6cba0bb`；targeted 3 suites／6 tests、完整前端 71 suites／277 tests、Production build、`git diff --check` 及兩個 Netlify 預覽皆通過。9 位虛構學生的 DOCX／PDF 各 2 頁已逐頁檢查，無文字或 QR Code 裁切；Netlify production deploy `6aad093c286132b7c43e3f50` 已 live，首頁、CSV 匯入路由與唯一部署網址皆回應 HTTP 200，正式 bundle 已確認包含 Word／PDF 按鈕、PDF MIME 與 Word 列舉相容性修正。為保留使用者當前一次性明文資料，本次未重新整理其既有頁面，也未建立或重發正式帳號做下載點擊驗收。

本次 CSV Word 登入卡下載 hotfix（2026-09-18，已正式部署）：

- 正式站點擊「下載 Word 登入卡」時出現 `Cannot read properties of undefined (reading 'DXA')`；原因是瀏覽器 bundle 執行時未取得 `docx` 的 `WidthType` 列舉，但 Word 產生器直接讀取 `WidthType.DXA`。
- Word 寬度型別改用 DOCX 規格的固定值 `dxa`，不再依賴瀏覽器可能缺少的列舉匯出；版面、學生資訊、QR Code 與下載檔名不變。新增模擬 `WidthType` 缺失的回歸測試。
- PR #199 已合併至 `main` commit `086119a`；targeted 2/2、Production build、`git diff --check` 及兩個 Netlify 預覽皆通過。Netlify production deploy `6aacfc40df360c0bc5678e01` 已 live。正式頁面重新載入後，原批次的一次性明文資料依既有安全設計清除，因此未建立或重發正式帳號來補做下載點擊驗收。

本次 CSV Word 登入卡與簡化一次性登入資訊（2026-09-18，已正式部署）：

- 分支 `feature/simplified-student-login-cards`。CSV 建立成功後新增 A4 Word 登入卡下載，每頁 8 格；每格左側集中學生中英文姓名、帳號、一次性臨時密碼與兩組復原碼，右側放大瀏覽器本機產生的 QR Code，並盡量填滿完整格子，既有 CSV 結果下載與列印入口保留。
- 臨時密碼由 12 位混合字元改為較短但仍不可預測的 8 位大寫英數分組格式；兩組復原碼改為不同的 6 位數。舊版長復原碼仍可使用，不採用帳號加固定字串。
- 恢復 Repository 遺漏、但正式 migration history 已確認於 2026-09-09 套用的 `20260909090000_secure_academy_recovery_codes.sql`：失敗嘗試以學生帳號記錄，每小時最多 5 次；復原碼以 5 分鐘 reservation 原子保留／消耗，資料表與 RPC 僅允許 service role。本批不需新增或執行正式 migration。使用者確認後，PR #197 已合併至 `main` commit `bc8c9ad`，`academy-student-manager` 已正式發布。
- 驗證：9 位虛構學生左右版 Word 範例由 Microsoft Word 匯出為 2 頁 A4 PDF，已逐頁並以第 2 頁 300 DPI 重查，確認左側資訊、右側大型 QR、第 1 頁 8 格及第 2 頁空白格線均無裁切或重疊；DOCX targeted 2/2、相關 targeted 3 suites／8 tests、完整前端 70 suites／274 tests、安全契約、全部 Edge Function 語法、PGlite migration 3/3、Production build 與 `git diff --check` 均通過。Build 僅有既有 Browserslist 與 Node deprecation 警告。Netlify production deploy `6aacf1a6391b972b52fd6f93` 已 ready；首頁與 `/admin/accounts/import` 的 GET 皆回應 HTTP 200。未使用真實學生資料建立帳號或測試復原碼。

本次教材聽力遊戲化介面與口說大挑戰每日五輪限制（2026-09-18，已正式部署）：

- 教材聽力頁改為「聽力冒險」彩色頁首，顯示完成音檔數與累計播放次數；MusicCard 使用輪替配色、任務編號、播放狀態與既有有效聆聽次數。這次只調整介面，不新增聽力次數解鎖口說關卡，也不更動 80% 有效聆聽與作業計次規則。
- 口說大挑戰改為每位學生每日（Asia/Taipei）最多 5 輪。進入關卡、查看題目或第一次正式送出錄音前離開不計次；同一輪的重錄、答錯重試與後續題目共用同一個 session，只在第一次有效錄音送出時由後端原子保留一次額度。
- 所有口說大挑戰錄音前後端都限制最長 12 秒，錄音中顯示剩餘秒數；教材／關卡列表的規則卡會持續顯示每日上限與今日剩餘次數，展開後說明送出才計次、同輪重錄不重複扣次及錄音上限。
- 新增 additive migration `20260918063338_speaking_challenge_daily_sessions.sql`：server-only 紀錄表啟用 RLS，撤銷 `public`／`anon`／`authenticated` 權限；`reserve_speaking_challenge_session_v1` 使用 student/date advisory lock、UUID 冪等鍵與 service-role-only 執行權，避免併發超額或同輪重複扣次。正式 migration 已套用並確認新表 0 筆、RLS 開啟、學生端無表或 RPC 權限；若需回退，可先回復前端與 Edge Function，新增紀錄表保留不用，不需刪除正式資料。
- 驗證：PGlite migration 3/3、口說安全契約與全部 Edge Function 語法、React targeted 6 suites／61 tests、完整前端 69 suites／272 tests、Production build 與 `git diff --check` 均通過；1280px 與 390px 靜態渲染未見橫向溢位或卡片重疊。PR #195 已合併至 `main` commit `d5394ca`；正式 `pronunciation-coach` v18、`speaking-challenge` v32 均為 ACTIVE，OPTIONS 200、未登入 POST 401。Netlify production deploy `6aacdac69745060008183354` 已 ready，首頁、口說列表與教材路由均 HTTP 200，正式 bundle／source map 已確認包含聽力冒險介面、每日五輪、同輪規則、12 秒限制及錄音倒數。未使用學生帳密，登入後實際錄音與今日剩餘次數仍待學生帳號快速驗收。

本次學生暱稱編輯入口可見性修正（2026-09-18，已正式部署）：

- 原本暱稱編輯卡排在學習榮譽、方案與教材權限後方，桌面首屏看不到，容易誤認為沒有功能。現在將「公開暱稱」輸入框與「儲存暱稱」按鈕直接放入最上方學生基本資料卡；下方卡片只保留本人可見的暱稱更改紀錄。
- 從後端載入既有公開暱稱後，上方學生顯示名稱會使用同一暱稱；成功儲存後輸入框、顯示名稱與歷史紀錄會一起更新。沒有暱稱或讀取失敗時，編輯入口仍會顯示並提供提示。
- 驗證：`StudentSettings` 10/10、完整前端 69 suites／272 tests、Production build 與 `git diff --check` 均通過。Build 僅有既有 `FiSquare` 未使用、Browserslist 與 Node deprecation 警告。PR #193 已合併至 `main` commit `3d1159f`；Netlify production deploy `6aacb2feb24ada0008894861` 已 ready，正式設定頁與唯一部署網址均回應 HTTP 200，正式 bundle 已確認包含最上方基本資料卡內的暱稱表單、歷史卡與既有後端 action。

本次學生暱稱編輯與變更紀錄（2026-09-18，已正式部署）：

- 學生「我的設定」新增公開暱稱編輯與自己的變更紀錄；2～20 字格式、不當內容攔截及全站唯一規則沿用好友系統。從「我的設定」或「好友與戰績」修改，都會在暱稱實際變更時留下舊值、新值、來源與時間；初次建立記為「首次設定」，既有暱稱不製造回填紀錄。
- 管理員「帳號管理」可按單一學生的「暱稱紀錄」查看目前暱稱及最近 100 筆歷史；教師與其他學生不能查看。歷史表啟用 RLS，撤銷 `public`／`anon`／`authenticated` 直連權限，只由 Firebase Token 驗證後的 Edge Function 依本人或管理員角色讀取。
- 新增 additive migration `20260918023325_student_nickname_history.sql`，以 server-only RPC 在同一交易更新社交資料與寫入歷史，並以 transaction advisory lock 避免同一學生併發更新產生不一致。正式資料庫已套用並登記此版本；已驗證資料表啟用 RLS、`anon`／`authenticated` 無讀取及 RPC 執行權，且沒有替既有暱稱偽造歷史紀錄。
- 驗證：隔離 PGlite migration 行為／權限 2/2、社交安全契約 6/6、React targeted 3 suites／19 tests、完整前端 69 suites／272 tests、全部 Edge Function 語法、Production build 與 `git diff --check` 均通過。Build 僅有既有 `FiSquare` 未使用、Browserslist 與 Node deprecation 警告。PR #191 已合併至 `main` commit `d296b1e`；正式 `student-social` v8、`membership-manager` v43 均為 ACTIVE，新增 action 的未登入請求正確回應 401。Netlify production deploy `6aacaa1ca454c983448fd489` 已 live，首頁、學生設定、管理員帳號頁與唯一部署網址皆回應 HTTP 200，正式 bundle 已確認包含學生設定與管理員暱稱歷史 action。未使用學生或管理員帳密更動正式資料，登入後實際修改及畫面仍待帳號快速驗收。

本次每週成長報告口說大挑戰整合（2026-09-18，已正式部署）：

- `weekly-report` 新增教材口說大挑戰的首次完成題數、本週首次通關數、累積通關數及實際發放 XP／AE Points；統計沿用伺服器保存的 `completed_at` 與遊戲化 ledger，不信任前端回報，也不因重複練習重複計算。
- 學生週報把口說大挑戰列為獨立第六種學習活動；每日圖改為六色堆疊長條，成果卡新增最近關卡題數進度與「繼續挑戰」入口，情境口說維持獨立顯示。
- 本批不需要 migration，不修改既有口說關卡、完成紀錄、獎勵政策或教材權限。口說統計契約 3/3、週報 React 回歸 1/1、全前端 69 suites／270 tests、全部 Edge Function 語法、Production build 與 `git diff --check` 均通過；build 只有既有未使用圖示、Browserslist 與 Node deprecation 警告。PR #189 已合併至 `main` commit `d7ca532`；正式 `weekly-report` v22 為 ACTIVE，Netlify production deploy `6aac9d97c6abea7185e64a7e` 已為 ready。正式受保護路由可正確導向登入頁；因沒有在本次操作中使用學生帳密登入，登入後桌面／390px 實機畫面仍待學生帳號快速驗收，主要渲染與 RWD 規則由 React 測試及 390px CSS 規則覆蓋。

本次公開首頁桌面登入按鈕修正（2026-09-18，已正式部署）：

- 已確認桌面版「登入」連結本身可被游標命中，但事件被手機 Offcanvas 的延後導頁流程攔截；桌面沒有側欄退場事件，因此只取得焦點而不切換網址。
- 導頁攔截現在只在手機側欄實際開啟時啟用；桌面登入改回 React Router 直接導頁，手機仍保留先收合側欄再切換的動畫。
- 元件回歸測試 3/3、公開頁桌面／手機 Playwright 10/10、Production build 與 `git diff --check` 均通過；build 只有既有未使用 import、React Router future flag、Browserslist 與 Node deprecation 警告。
- PR #187 已合併至 `main` commit `384ffca`；Netlify production deploy `6aac9670597bd4848dcf4683` 已 live。正式站實機確認桌面頂端登入、412px 手機快速登入及手機側欄登入都可進入 `/login`。

本次排行榜班級／綜合競賽與原名顯示（2026-09-18，已正式部署）：

- 學生排行榜新增「我的班級」與「綜合排行」切換，並保留本週、本月與總排行期間。學生的班級範圍由後端依登入者目前班級決定，不能用前端參數查看其他指定班級；綜合排行納入所有使用中且未封存的學生。
- 排行列有公開暱稱時以暱稱為主並補上帳號原名，沒有暱稱時直接顯示原名；維持既有頭像、班級、等級與 XP，未新增 Email、生日、家長資料、登入帳號或精確活動時間。
- 正式資料唯讀統計目前共有 9 個使用中學生帳號，其中 3 個有班級；低於既有排行榜 100 人上限。本批不需要 migration，尚未修改正式資料或部署 Edge Function。
- React 頁面與服務測試 3/3、後端範圍安全測試 3/3、全部 Edge Function 語法、Production build 與 `git diff --check` 均通過；build 只有既有未使用 import、React Router future flag、Browserslist、Node deprecation 與 TypeScript module-type 警告。
- PR #185 已合併至 `main` commit `3e4091d`；正式 `gamification` v16 為 ACTIVE，OPTIONS 200、未登入 POST 401。Netlify production deploy `6aac11f96dad8e5ae65fdda5` 已 live，正式排行榜路由回應 HTTP 200 並載入 `main.ff72e907.js`／`main.f5a426ef.css`。未使用學生帳密進行登入後實機驗收，互動與授權分支由 6 項自動測試覆蓋。

本次看圖補句「句尾挖空」語音修正（2026-09-17，已正式部署）：

- 已以正式資料唯讀查核 Workbook 1 P28「顏色」草稿：5 題句型均以 `____.` 結尾，對應語音資產全數失敗，後端錯誤為「語音文字不可為空白」。直接原因是句尾句號會先從 TTS 文字移除，空格右側因此成為空字串，舊流程仍嘗試呼叫第二段語音。
- 新版允許看圖補句在空格右側只有標點；後端只合成空格前文字，再附加精準 2 秒靜音，不把答案或句號送交 Google TTS。語音資產版本提升為 `picture-gap-leda-v3`，不覆寫或刪除既有私人音檔；管理頁若仍失敗會顯示後端實際原因。
- 語音契約 6/6、管理頁回歸 2/2、`speaking-tts-manager` 語法、Production build 與 `git diff --check` 均通過；build 只有既有未使用 import、Browserslist 與 Node deprecation 警告。PR #183 已合併至 `main` commit `65492bd`；正式 `speaking-tts-manager` v26 為 ACTIVE，OPTIONS 200、未登入 POST 401。Netlify production deploy `6aac062f84764d64770739f3` 已 live，正式管理頁回應 HTTP 200 並載入 `main.99c82c92.js`。本批不含 migration、RLS、題庫文字、圖片、發布狀態或學生進度異動；P28 草稿仍由管理員按「更新停頓整句女聲」後才會產生新版私人音檔。

本次教材 AI 口說題庫緊湊化與語音重試保護（2026-09-17，已正式部署）：

- 已確認管理員完成題目後仍看到「部分語音尚未完成；未完成內容已安全回復」的直接原因：自訂建立器把語音服務的 `processing`／部分失敗與題目或圖片建立失敗視為同一種錯誤，因而刪除剛完成的草稿。現在題目與必要圖片已保存後，語音未完成會保留草稿並自動帶回題庫管理；管理員可展開草稿使用既有語音按鈕重試，發布前的音檔完整性檢查不變。草稿或圖片本身建立失敗時仍維持安全回復。
- `/admin/speaking-content` 改為緊湊版：縮小頁首、工作區按鈕、卡片、篩選、表單與題庫列間距，移除重複的三步驟流程卡及目前題庫摘要。所有草稿與已發布題庫預設收合；點題庫列可展開，再點同一列可收合，並保留鍵盤焦點、`aria-expanded` 與 44px 主要觸控範圍。
- React 相關測試 2 suites／12 tests、Production build 與 `git diff --check` 已通過；build 僅有既有 `FiSquare` 未使用、Browserslist 與 Node deprecation 警告。同步修正早已過期的 P26～P27 第六個「建立草稿」按鈕測試斷言。PR #181 已合併至 `main` commit `eddecbd`；Netlify production deploy `6aac00e744b0c519c38b2c28` 已 live，正式管理頁回應 HTTP 200 並載入 `main.d99409cf.js`／`main.476ed333.css`。本批沒有 migration、RLS、Edge Function、題庫資料、私人圖片或學生進度異動；登入後桌面／手機自動視覺驗收因本機 Computer Use 核心缺少路徑而無法執行，互動行為由 React 測試覆蓋，仍建議管理員實機快速確認密度。

本次口說 TTS 句尾句號處理（2026-09-17，已正式部署）：

- 自訂口說題目可保留完整英文句號供畫面顯示與答案核對；送交 Google TTS 前會移除句尾英文句點、全形句點與省略號，避免語音把標點當成可朗讀文字。
- 看圖補句標準整句、`The` 弱讀候選與一般示範音檔皆提升語音版本，新產生時不會沿用修正前的私人 WAV 快取；既有音檔不刪除。
- `speaking-picture-audio` 5/5、全部 Edge Function 語法與語音合約、Production build、`git diff --check` 及 Netlify PR 預覽檢查均通過；PR #179 已合併至 `main` commit `fd54d17`，正式 `speaking-tts-manager` v25 為 ACTIVE，OPTIONS 200、未登入 POST 401。本批不含 migration、RLS、題庫內容或學生進度異動。

本次 Workbook 1「顏色與生活物品」主題關卡下架（2026-09-17，正式資料已安全封存）：

- 依專案擁有者要求，將 Workbook 1 題庫 ID `4`、第 1 版「03 顏色與生活物品」由 `published` 改為 `archived`；未刪除題庫、題目或學生紀錄，方便日後規劃新關卡。
- 正式資料查核確認原本 6 題與 6 筆學生題目進度仍完整保留；正式站管理員唯讀預覽已確認 Workbook 1 由 13 關降為 12 關，「主題練習」由 3 關降為 2 關，清單中不再出現「顏色與生活物品」。
- 本批沒有程式碼、migration、RLS、Edge Function 或 Netlify 部署變更。如需回復，可在確認內容後將同一題庫 ID `4` 狀態改回 `published`。

本次口說大挑戰 Workbook 第一層獎勵提示（2026-09-17，正式站已部署）：

- `/student/speaking-challenges` 的 Workbook 1／Workbook 2 彩色冒險卡新增「每關首次通關 30 XP／最多 3 AE Points」提示；「最多」表示只有符合既有在校生點數資格者會取得 AE Points，XP 與實際發獎條件不變。
- 獎勵數字由既有 `speaking-challenge` catalog 的唯讀 `reward_policy` 回傳，前端不自行決定或發放獎勵；本批不含 migration、RLS、題庫、學生進度或正式資料異動。
- `TextbookSpeakingChallenge.test.jsx` 22/22、口說題庫契約 26/26、全部 Edge Function 語法、Production build 與 `git diff --check` 均通過；build 只有既有 `FiSquare` 未使用、Browserslist 與 Node deprecation 警告。PR #176 已合併至 `main` commit `8263a41`；正式 `speaking-challenge` v31 為 ACTIVE，OPTIONS 200、未登入 POST 401。Netlify production deploy `6aabdfd18da2e678a12d9a26` 已 live，正式網域與唯一部署網址皆回應 200 並載入 `main.beded9a4.js`／`main.fa92e409.css`。正式站管理員唯讀預覽已確認 Workbook 1 與 Workbook 2 卡片均顯示「每關首次通關 30 XP／最多 3 AE Points」。本批沒有 migration、RLS、題庫、學生進度或正式資料異動。

本次口說大挑戰 Workbook 第一層冒險卡片（2026-09-17，正式站已部署）：

- 只重新設計 `/student/speaking-challenges` 的 Workbook 選擇層：新增彩色冒險主視覺、四組循環教材配色、卡通書本角色、關卡數、完成進度條與「開始冒險／繼續冒險／再次挑戰」狀態。整張卡片仍可點擊，鍵盤焦點與螢幕閱讀器教材／進度描述均保留。
- 桌面版採兩欄大卡片，手機／平板改為單欄橫式卡片並縮小插圖與文字；標題與按鈕設有尺寸上限。Workbook 內關卡列表、A–Z、P14～P24 題目、錄音、資料讀取、權限與題庫內容均未修改。
- 390×844 正式站驗收發現管理員專用「發布作業」浮動捷徑會壓到第二張 Workbook 卡片；手機第一層已隱藏該捷徑，管理員仍可從漢堡選單進入發布作業，桌面版與 Workbook 關卡列表不受影響。hotfix PR #174 已合併，正式手機畫面重新驗收後兩張卡片、進度及行動按鈕均完整可見且無重疊。
- `TextbookSpeakingChallenge.test.jsx` 22/22、最新 `main` Production build 與 `git diff --check` 均通過；新增教材配色、可存取名稱、進度值、行動文字與路由回歸測試。PR #172 與 hotfix PR #174 已合併，最新功能 `main` commit `e3b7fa2`；Netlify production deploy `6aabd1be4ca4af2df0337273` 已 live。正式站管理員唯讀預覽已確認兩本教材使用不同配色、桌面與 390×844 手機版無重疊，且卡片可進入原 Workbook 1 的 13 關列表；build 只有既有 `FiSquare` 未使用、Browserslist 與 Node deprecation 警告。本批沒有 Supabase、Edge Function、Firebase、權限或正式資料異動。

本次口說圖片固定 4:3 顯示與上傳預覽（2026-09-17，正式站已部署）：

- 口說大挑戰的一般輔助圖與 P21～P24 私人題圖統一使用 4:3 顯示框；學生桌面版上限 400×300 CSS px，手機版上限 320×240，窄於 360px 的裝置會保留左右 20px 並等比例縮小。圖片使用 `object-fit: contain`，不裁切、不拉伸，也不會因原始圖片過高擠壓句型與錄音按鈕。
- 管理員的已上傳圖片、學生畫面預覽及選檔後預覽使用同一套 4:3 規則；從頭建立、P21～P24 建立器與逐題草稿編輯器在儲存前即可看到實際顯示範圍。看圖補句文字仍依螢幕縮放，但桌面上限由 38px 收斂為 34px。
- A–Z 字母與 P14～P17 拼字關卡使用獨立版型，本批沒有修改其圖片、字體或互動；沒有資料庫、Edge Function、Firebase、權限、題庫內容或私人圖片異動。
- React 相關測試 6 suites／38 tests、Production build 與 `git diff --check` 均通過；build 只有既有 `FiSquare` 未使用、Browserslist 與 Node deprecation 警告。既有 `SpeakingContentAdmin.test.jsx` 仍有主線已知的「建立草稿」按鈕數量斷言（預期 5、目前介面 6），與本批圖片程式無關。
- PR #169 與圖片完整顯示 hotfix PR #170 已合併；最新功能 `main` commit `e1116d7`。Netlify production deploy `6aaba475c1c865783b64ce2b` 已 live，首頁與 P24 路由皆回應 HTTP 200 並載入 `main.fa92e409.css`。正式站實測桌面圖片內容框約 398×299（外框含邊線為 400×300）、412px 級手機約 317×238；圖片元素與 4:3 框尺寸一致且使用 `object-fit: contain`，下方整句、句型與錄音區未被擠壓。本批沒有 Supabase 或正式資料變更。

本次看圖補句整句播放與移除逐字點選（2026-09-17，正式站已部署）：

- 唯讀核對正式資料後，受影響的已發布關卡為 Workbook 1 P22（題庫 17，第 2 版，9 題）、P23（題庫 23，第 1 版，9 題）及 P24（題庫 24，第 1 版，8 題）；目前沒有其他已發布 `picture_gap_sentence` 題庫。日後由自訂建立器新增的同題型也套用相同規則。
- 正式資料的停頓整句音檔實際已全部 ready（P22 9/9、P23 9/9、P24 8/8）。無法播放的原因是正式 `speaking-challenge` v29 仍為舊版輸出，只回傳逐字音檔，沒有回傳 `sentence_audio_url`，前端因此將「聽整句」停用。
- 學生端改為只顯示不可點選的句型文字與「聽整句（空格停 2 秒）」；後端只簽發整句音檔短效網址，新草稿只產生並要求整句音檔。既有逐字音檔與資料表保留，不執行刪除或 migration。
- React 相關測試 4 suites／15 tests、後端與題庫契約 36 tests、全部 Edge Function 語法、Production build 及 `git diff --check` 均通過；build 僅有既有未使用 import、Browserslist 與 Node deprecation 警告。
- PR #167 已合併至 `main` commit `6a5261e`；正式 `speaking-challenge` v30、`speaking-tts-manager` v24、`speaking-content-manager` v27 均為 ACTIVE，OPTIONS 200、未登入 POST 401。Netlify production deploy `6aab8fd5725ffda191dfe4e0` 已 live；首頁、P24 路由與唯一部署網址皆回應 HTTP 200，正式站載入 `main.d3c38a3e.js`。本批未重產音檔、未修改題庫資料，也沒有 migration。

本次自訂口說草稿移除重複總確認（2026-09-17，正式站已部署）：

- 「從頭建立自訂口說草稿」移除最下方的「我已確認教材、頁碼、所有句子、答案與圖片正確」勾選框；教材、題組名稱、主題及各題必填內容完成並符合格式後，即可直接按「建立未發布草稿」。
- 頁碼範圍、完整句、唯一挖空答案、問句格式、圖片類型／大小與替代文字等實質驗證均保留；前端仍送出既有的內部確認標記以符合後端契約，因此本批不修改資料庫、RLS、Edge Function 或正式資料。草稿仍不會自動發布，既有逐題核准與發布條件不變。
- 新增 React 回歸測試 1/1、口說題庫契約 26/26、Production build 與 `git diff --check` 均通過；build 僅有既有未使用 import、Browserslist 與 Node deprecation 警告。PR #165 已合併至 `main` commit `662828d`；Netlify production deploy `6aab8b29b3a76fa8d17da600` 已 live，正式首頁、管理頁與唯一部署網址均回應 HTTP 200，正式站載入 `main.fa5bd6bd.js`。

本次 P22～P24 `The` 弱讀候選試聽與管理員單題套用（2026-09-17，正式站已部署）：

- 問題來源已確認：管理頁的「發音提示」只會顯示給學生，不控制 TTS；現行整句語音會把空格前的 `The` 單獨合成，即使固定 IPA `/ðə/`，孤立語境仍可能被聽成偏「搭」。本批不把英文改成錯誤的 `/lə/`，也不直接覆蓋學生音檔。
- P22～P24 以 `The ____` 開頭的題目新增管理員專用「比較 The 弱讀候選」：提供「自然弱讀（連句語境）」與「清楚弱讀（The 稍慢）」兩種私人 WAV，兩者都在同一次 SSML 合成中保留後半句與 2 秒空格。候選預覽只寫入私人 R2 並回傳 15 分鐘短效網址；管理員完整播放後才能按「套用到這一題」，並可隨時「恢復標準分段版」。草稿仍須依原流程核准發布，已發布版本不開放直接改題。
- 語音合約 5/5、新增 React 候選介面測試 1/1、`speaking-tts-manager` 語法、Production build 與 `git diff --check` 通過；build 僅有既有未使用 import、Browserslist 與 Node deprecation 警告。既有 `SpeakingContentAdmin.test.jsx` 為 9/10，唯一失敗是主線已知的「建立草稿」按鈕數量仍預期 5、目前介面為 6，與本批功能無關。
- PR #163 已合併至 `main` commit `58912f4`；`speaking-tts-manager` v23 為 ACTIVE，OPTIONS 200、未登入 POST 401。Netlify production deploy `6aab84fe0d93828935ef7934` 已 live，正式網域與唯一部署網址皆回應 200，並載入 `main.5e91e7ed.js`／`main.3b0b8b98.css`；正式 JS 已確認包含候選預覽、單題套用與標準版回復 action。系統不會自動替任何題目套用；管理員須在草稿逐題試聽並選擇，正式版本則先建立新版草稿、套用並核准發布。回復方式為同一介面的「恢復標準分段版」，既有私人音檔不刪除。本批沒有 migration。

本次登入後常駐 App Shell 與顯示快取（2026-09-17，正式站已部署）：

- 學生、老師與管理員登入後共用同一個常駐 Navbar／App 外框；切換內部 route 時只替換中央內容，lazy chunk 載入期間顯示局部「—」佔位，不再卸載並重建整個 Navbar。首次登入設定頁仍維持獨立全頁流程。
- 手機功能選單選擇登入區內頁面時，React Router 導航與 React Bootstrap Offcanvas 收合會在同一次點擊開始；離開登入區前往商城或客服時仍等退場完成再導航，避免外框切換造成殘影。
- 教材目錄與 XP 摘要採 Firebase UID 隔離的 stale-while-revalidate 顯示快取：新鮮資料立即使用，較舊但仍安全的資料先顯示再背景更新；排行榜與 Navbar 同時要求 XP 摘要時共用同一個進行中請求。登出會只清除該 UID 的 App Shell 顯示快取。快取不作為教材、作業、會員或角色授權依據，後端驗證規則未變。
- 相關 React 測試 6 suites／27 tests 全數通過；完整前端測試 62 suites 通過、1 suite 為既有 `SpeakingContentAdmin.test.jsx` 按鈕數量斷言（預期 5、目前畫面 6）失敗，與本批檔案無關。Production build 已通過，僅有既有未使用 import、Browserslist 與 Node deprecation 警告。PR #161 已合併至 `main` commit `c5f73c7`；Netlify production deploy `6aab79275948e62c9c54ae40` 已 live，正式站載入 `main.f12be562.js`／`main.3c2236e6.css`。412×915 正式站公開選單可正常開啟與關閉，Console 0 errors；登入後流程因未使用帳密，由 27 項自動測試覆蓋。本批沒有 migration、Edge Function、Firebase、會員權限或正式資料異動。

本次通用管理員口說草稿建立器（2026-09-17，正式站已部署）：

- 管理員可在「口說大挑戰製作中心 → 建立新關卡」直接選擇任何已啟用教材與 P1～P9999 的連續頁碼範圍，從零輸入 1～50 題內容；支援一般完整句、看圖完整問答、看圖補完整句三種互動，不再需要每一頁另寫固定範本或重新部署。
- 看圖題由管理員自行上傳 10MB 內 JPG／PNG／WebP 私人圖片並填寫替代文字；一般完整句與挖空句可在草稿階段預先產生私人 R2 語音。挖空題由管理員輸入完整句與唯一答案，系統建立唯一 `____`，只合成空格前後可見文字並嵌入精準 2 秒靜音，答案不會交給 TTS。
- 新草稿永遠維持未發布；少於 3 題、圖片未完成、語音未完成、頁碼越界、句子找不到唯一答案或未通過人工核對時，後端拒絕發布。既有 P21～P24 固定題數與頁碼限制仍保留。本批不新增 migration；已確認正式 migration `20260916140618` 存在。
- 題庫契約 26/26、React service test 4/4、Edge Function 語法／語音契約、Production build 與 `git diff --check` 通過；build 僅有既有未使用 import、Browserslist 與 Node deprecation 警告。PR #156 已合併至 `main` commit `eedb3e8`；`speaking-content-manager`、`speaking-tts-manager` 與正式 Netlify deploy `6aab5df0d744695a82d11142` 已發布。正式後台已確認建構器與三種題型完整載入；兩支 Function OPTIONS 200、未登入 POST 401。

本次 Workbook 1 P26～P27 頁碼式口說草稿（2026-09-17，正式站已部署並建立草稿）：

- 管理員「口說大挑戰製作中心 → 建立新關卡」新增 P26～P27「完整句與縮寫」入口；九題保留完整句與正確縮寫的等價回答，排除教材中容易造成孩子混淆的鴨子與橡皮擦題。
- 後端仍驗證 Firebase 管理員身分與 Workbook 1；建立動作可重複安全沿用同一份草稿。草稿帶有精確 `source_pages: [26, 27]` 與人工核准旗標，必須由管理員逐題對照後再核准，絕不自動發布或顯示給學生。
- 本批沒有 migration；`speaking-content-manager` 已部署至正式 Supabase，正式 Netlify deploy `6aab5683bcbad486ca278852` 已完成。正式站已建立 1 份未發布草稿「完整句與縮寫」，涵蓋 P26～P27、9 題；未上傳圖片、未核准、未發布。題庫契約 25/25、React service test 4/4、Edge Function 語法、Production build 與 `git diff --check` 通過。

本次口說題庫草稿刪除（2026-09-17，正式站已部署）：

- 管理員在「口說大挑戰製作中心 → 題庫管理」展開任何未發布草稿後，都可使用「刪除草稿」；不再只限 P21～P24 圖片題庫。二次確認會列出題庫名稱、版本與題數，並明確提醒不可復原。
- 後端仍重新驗證管理員 Firebase 身分與資料庫角色，並以 `status = 'draft'` 作為刪除條件；若草稿在確認期間已發布或狀態改變，刪除會被拒絕。已發布版本與學生進度不會走刪除流程，P21～P24 正式版本維持既有安全下架規則。
- 本批不含 migration，也不會自動刪除正式資料中的任何草稿；由管理員在頁面逐筆確認後才執行。固定測試站未部署。

本次口說大挑戰製作中心與 P21～P24 安全修訂（2026-09-16，已正式部署）：

- 功能分支 `feature/speaking-authoring-studio`、Worktree `D:\dev\AlanEnglish-worktrees\speaking-authoring-studio`。管理員頁面改為「題庫管理／建立新關卡／教材來源／OCR」三個互斥工作區；題庫可依關鍵字、Workbook 與狀態篩選，桌面版使用清楚的題目導覽＋編輯面板，手機版自動切成單欄，避免全部工具同時展開造成頁面過長。
- P21～P24 已發布題庫新增安全修訂流程：先複製為新版草稿，管理員可修改題組名稱、主題、各題內容與私人圖片，並新增、刪除、排序題目；P21～P23 必須回到 9 題、P24 必須回到 8 題且圖片／語音完整才可發布。草稿可以刪除；已發布版本只能封存，避免破壞學生歷史資料。
- 新增 additive migration `20260916151037_speaking_authoring_revisions.sql` 與 server-only `publish_speaking_question_set_revision_v1`。新版發布時會在單一交易中封存舊版並啟用新版；只有舊版已完整通關的學生會延續完成／解鎖狀態，部分進度、錄音與答題嘗試不複製、不重複發獎。前端不能直接執行該 RPC，仍由驗證管理員 Firebase Token 與資料庫角色的 `speaking-content-manager` 呼叫。
- 本批未部署固定測試站。React targeted tests 13/13、教材口說契約 24/24、Edge Function 語法與語音契約、Production build 及 `git diff --check` 均通過；build 只有既有 `SpeakingPronunciationRecorder.jsx` 未使用 `FiSquare`、Browserslist 與 Node deprecation 警告。PR #153 已合併至 `main` commit `9a8ad45`；正式 migration `20260916151037` 已套用並驗證 `anon`／`authenticated` 無 RPC 執行權，`speaking-content-manager` 已部署且 OPTIONS 200、未登入 POST 401。Netlify production deploy `6aaabb2caffcc310285dc4f4` 已 ready，正式 `https://alanenglish.com.tw/admin/speaking-content` 回應 HTTP 200 並載入 `main.29bab972.js`。

本次口說女聲與整句示範（2026-09-16，本機驗證完成，尚未合併或部署）：

- 口說題庫預設語音統一為 Google Chirp 3 HD `Leda` 女聲，不再依題目交錯男女聲。所有包含獨立單字 `the` 的新語音都以 IPA `/ðə/` 明確指定，避免供應商自行判斷造成音色與重音漂移；既有私人 R2 音檔不刪除，重新產生時以新版本雜湊建立並重新連結。
- P22～P24 保留可見單字逐字點讀，另新增「聽整句（空格停 2 秒）」：後端只把挖空句型的空格前後文字分別交給 TTS，再以 PCM WAV 嵌入精準 2 秒靜音後合成，未把 `answer_text` 或空格答案交給 TTS。學生只取得短效私人網址；整句或逐字任一音檔未完成時，新草稿不能發布。
- 新增 additive migration `20260916140618_speaking_picture_sentence_audio.sql`，只擴充 server-only `speaking_question_audio.purpose` 允許 `question_prompt`；尚未套用。尚未部署 `speaking-tts-manager`、`speaking-content-manager`、`speaking-challenge` 或 Netlify，正式站仍維持現況。
- 驗證：語音／2 秒靜音與學生輸出測試 9 項、口說內容契約 23 項、React targeted tests 15 項、全套 Edge Function 語法、Production build 與 `git diff --check` 均通過；build 只有既有 `SpeakingPronunciationRecorder.jsx` 未使用 `FiSquare`、Browserslist 與 Node deprecation 警告。

本次好友與戰績恢復（2026-09-16，隔離整合完成，尚未部署）：

- 從目前正式站使用的手機導覽基準 `c268e5e` 建立 `feature/restore-friends`，只移植原好友系統的六個功能／修正 commit，沒有合併含其他舊功能的 PR #105，也沒有覆蓋目前兒童首頁、首次登入、生日、家長 Email 驗證、口說、教材或 Navbar 效能修正。學生重新取得 `/student/friends`、完整暱稱／好友碼搜尋、邀請與接受、好友 XP／等級、在線隱私、私人頭貼短效預覽、刪除好友、封鎖、解除封鎖與檢舉；Navbar、首頁、設定及排行榜以公開暱稱優先，教師／管理／客服仍使用真實姓名。
- 安全邊界維持 Firebase Token 驗證的 `student-social` Edge Function；正式 Supabase 已確認 additive migration `20260908053030_student_social_foundation` 存在，社交資料表啟用 RLS 並撤銷 `anon`／`authenticated` 直連權限，正式 `student-social` v6 為 ACTIVE，OPTIONS 200、未登入 POST 401。本分支把暱稱讀取安全地疊加到現有 `membership-manager` 首次登入／家長驗證流程與現有 `gamification`，但尚未部署或更動正式 Functions。好友契約 5／5、Edge Function 語法、React targeted tests 6 suites／30 tests、Production build 與 `git diff --check` 已通過；`feature/restore-friends` 已推送至 GitHub，未建立 PR、未合併 `main`、未部署，仍待隔離站登入驗收。

本次進行中（2026-09-16，尚未合併或部署）：

- 手機導覽首屏效能第一批：學生 Navbar 側欄連結改為先導航、下一個畫面幀才收合側欄，避免 Offcanvas 收合動畫延後路由首屏。新增以 Firebase UID 隔離的短效 App Shell 快取：教材目錄 10 分鐘、XP 摘要 5 分鐘、通知 90 秒；有快取時先同步顯示，再於瀏覽器閒置時背景更新，無快取仍立即讀取。快取只改善畫面速度，不作為授權依據；後端 entitlement 與頁面資料仍照既有規則即時驗證。相關檔案：`MainNavbar.jsx`、`StudentNavbar.jsx`、`appShellCache.js`。`MainNavbar`／快取測試 12/12、Production build 與 `git diff --check` 通過；未改 Supabase、Firebase、Edge Function、會員權限或教材資料。Netlify production deploy `6aaa53bffd125e29e20548d2` 已 ready，正式首頁 HTTP 200 並載入 `main.3a7523b7.js`。

本次公開頁 Accessibility 修正（2026-09-16，已正式部署）：

- 修正公開首頁與登入頁共 16 個 axe `color-contrast` serious 節點：登入頁的歡迎標籤、說明、忘記密碼、啟用／復原／註冊／客服連結與版權文字改用符合 WCAG 2 AA 的色彩；首頁示範畫面、答題回饋、方案註記與頁尾輔助文字同步提高對比。方案比較表改為可由鍵盤取得焦點、以方向鍵水平捲動，並顯示可見 focus ring；公開手機 Navbar Toggle 改用 React Bootstrap 的中文 `label`，不再讀出英文 `Toggle navigation`。新增 4 項 Playwright＋axe 回歸測試，390px 行動版全數通過；沒有修改 Firebase、Supabase、權限、資料、音檔、付款或路由。功能 commit `8cbd750` 已快轉至 `main`；固定測試站 deploy `6aaa2f7ca1ae61ed7cda5c8f` 與正式站 deploy `6aaa2fbb07259d689d85ebc5` 均已 ready，正式 `https://alanenglish.com.tw/`、`/login` 均回應 HTTP 200，並在正式站重跑 4 項 Playwright 回歸測試全數通過。

本次英文班學生首次登入安全設定（2026-09-16，已正式部署）：

- 功能分支 `feature/student-first-login-onboarding`、Worktree `D:\dev\AlanEnglish-worktrees\student-first-login-onboarding`。CSV 建立成功後會為每位學生各自回傳一次性臨時密碼，保留既有 QR 啟用與復原碼；CSV 不再預先寫入未驗證的家長 Email。學生使用臨時密碼登入後，全站學生路由會強制導向三步設定：實際更換 Firebase 密碼、一次性設定生日、以 6 位數驗證碼驗證家長 Email。生日設定後由資料庫阻止再次修改；更換家長 Email 時只有驗證成功才原子替換，失敗或未完成時保留原信箱；付款流程只接受已驗證家長 Email。
- 新增 additive migration `20260916015253_student_onboarding_guardian_email_verification.sql`、server-only 驗證要求表、RLS／權限撤銷、寄送節流、錯誤嘗試限制與 HMAC code hash。現有家長 Email 已相容回填為已驗證，避免既有家庭突然被鎖定；正式資料庫已套用並確認 RLS、前端角色權限撤銷、4 個 RPC 與 migration 紀錄完整。`GUARDIAN_EMAIL_OTP_SECRET` 已使用隨機值寫入正式 Edge Function secrets，未寫入 Repository 或輸出其值。
- 正式 Edge Functions：`academy-student-manager` v30、`membership-manager` v42、`commerce-manager` v17、`billing-manager` v35 均為 ACTIVE；OPTIONS 與明確受保護的未登入 action 已驗收，四支皆回應 401。驗證：首次登入／設定／路由／CSV React targeted tests 5 suites、19 tests 全數通過；安全 contract、全部 Edge Function 語法、Production build 與 `git diff --check` 通過。Build 只有既有 `SpeakingPronunciationRecorder.jsx` 未使用 `FiSquare`、Browserslist 與 Node deprecation 警告。

本次教材 AI 口說題庫管理介面改版（2026-09-16，已正式部署）：

- 管理頁新增「今天要處理什麼？」任務入口，直接顯示待編輯草稿、已發布題庫、快速建立與教材匯入及其即時數量；題庫工作台視覺上提升到範本與 OCR 工具之前，讓管理員進頁面即可辨認正在編輯的題庫。桌面版擴充工作區寬度，手機版將快速入口依寬度切換為雙欄／單欄，三步製作流程壓縮為不佔高度的橫向提示。既有 OCR、人工核對、AI 產生、私人圖片、發布、Firebase／Supabase 權限及後端流程均未修改。固定測試站 deploy `6aa96b2631a6296e8c7baf13` 與正式站 deploy `6aa96c1eb6d6f77cb8e464cf` 均已 ready；正式 `https://alanenglish.com.tw/admin/speaking-content` 回應 HTTP 200 並載入 `main.e977bbed.js`／`main.d211ffcc.css`。

本次口說分類首關固定開放（2026-09-15，已正式發布）：

- 學生的「入門準備」、「課本練習」與「主題練習」改為三條獨立解鎖路徑；每個分類第一關固定可以挑戰，第二關起才要求同分類前面的關卡全部通關。前端列表與 `speaking-challenge` 後端使用同一規則，老師與管理員仍可直接預覽全部已發布關卡；不修改或刪除任何既有完成紀錄。`speaking-challenge` v28 ACTIVE，Netlify production deploy `6aa964cc7544c13e62bf5347` 已發布並載入 `main.c09bcf3a.js`。正式站已登入學生帳號驗收：主題第一關可進入、第二關因第一關既有通關紀錄而開放、第三關維持鎖定；課本區仍依自己的順序鎖定。

本次口說關卡歷史完成紀錄鎖鏈修正（2026-09-15，已正式發布）：

- 修正學生曾完成較後方關卡時，該歷史完成紀錄可能讓再下一關重新開啟的問題。現在同一本 Workbook 的解鎖鏈一旦遇到任何未完成或目前被鎖住的關卡，後續 P21 與主題練習都持續鎖定，不會被較後方舊完成紀錄重新打開；完成紀錄本身保留。前後端 regression tests 與 Production build 通過；`speaking-challenge` v27 ACTIVE，Netlify 正式 deploy `6aa961db0ba0b83a9e98cf49` 已發布。以正式站已登入學生帳號驗收，P15 未完成時 P16～P21 與全部主題練習皆顯示「先完成前一關」。

本次口說列表解鎖前端防護（2026-09-15，已正式發布）：

- 即使舊快取或 API 意外將後續題組標示為可進入，學生列表仍會依同一 Workbook 的實際順序檢查前一關是否完整通關；前一關未完成時，P21 與所有後續關卡一律顯示鎖定。老師與管理員預覽不受此限制。相關列表與 progression 測試、Production build 已通過；production deploy `6aa95f5bfc6de402b798dc78` ready，正式口說列表 HTTP 200 且載入本次 build 資產。

本次 Workbook 口說關卡線性解鎖修正（2026-09-15，已部署）：

- 學生在同一本 Workbook 中必須完成上一個已發布關卡，下一個關卡才會解鎖；課本練習與主題練習不再互相繞過順序。老師／管理員預覽模式維持可直接查看全部關卡。`speaking-challenge` Edge Function 已部署至共用 Supabase，版本 26、狀態 ACTIVE。

本次 Navbar 收合與路由載入改善（2026-09-15，已正式發布）：

- Navbar／學生 Navbar 在選取入口後立即關閉抽屜與下拉選單，避免點擊後殘留遮罩；大型管理、教材與口說頁改為路由層級延遲載入，降低首次下載量。教材、作業、通知、會員與 entitlement 仍由既有 API 即時驗證，未修改 Firebase、Supabase 或後端權限。相關測試與 Production build 通過；production deploy `6aa959647c0144b730fc5303` ready，正式學生頁 HTTP 200 且載入本次 build 資產。

本次學生浮動作業捷徑移除（2026-09-15，已正式發布）：

- 學生端不再於任何頁面渲染浮動「今日作業」捷徑，避免遮住教材、口說與一般頁面內容；學生仍可依既有 assignment entitlement 從 Navbar／更多的「我的作業」入口進入作業。老師與管理員的浮動「發布作業」快捷鈕維持原狀。沒有修改作業資料、班級隔離、Firebase、Supabase 或權限判定；相關元件測試、Production build 與 `git diff --check` 通過。PR #146 已合併至 `main` commit `e98ed5d`，production deploy `6aa94d954575d996f543f9c2` 為 ready，正式學生頁 HTTP 200 且載入本次 build 資產。

本次全站路由回頂修正（2026-09-15，已正式發布）：

- 新增 Router 層級的共用回頂處理。公開首頁、登入、商城、學生、老師與管理員每次切換到不同頁面路徑時，都會以非動畫方式回到頁面頂端；同頁表單、收合區塊、播放器、麥克風互動與資料載入不會觸發捲動。沒有修改 Firebase、Supabase、權限、資料、音檔或個別頁面內容。路由切換測試、Production build 與 `git diff --check` 通過；PR #144 已合併至 `main` commit `9d96f3f`，GitHub main deploy `6aa94afacc52b9000803e54a` 與手動 production deploy `6aa94b1f31a6297bc37bb015` 均為 ready。

本次手機口說大挑戰導覽修正（2026-09-15，已正式發布）：

- 修正手機進入口說大挑戰「全部教材」或單一 Workbook 關卡列表時，外層專注模式錯誤隱藏 Navbar 的問題。現在只有實際進入 `/student/speaking-challenges/:questionSetId` 小關卡時才收起頂端 Logo Header；教材列表與 Workbook 關卡列表會保留手機 Navbar 與既有底部導覽。教材播放器的口說範圍暫停／隱藏規則、學生解鎖、老師／管理員預覽、Firebase、Supabase 與題組資料均未修改。相關 React 測試、Production build 與 `git diff --check` 通過；PR #142 已合併至 `main` commit `5d6afc0`，Netlify production deploy `6aa945ff2d8c4f65f12aa34f` 與固定測試站 deploy `6aa94534263dfdfa7443d08b` 均為 ready。

本次 P21 管理員草稿（2026-09-15，未發布）：

- 管理員已在正式站「教材 AI 口說題庫」建立 Workbook 1「P21 看圖問答」第 1 版草稿，共 9 題，使用人工核對的完整問答與私人圖片。題組仍是草稿，學生端不可見；未產生 TTS、未發布，P22～P24 仍未建立。

本次 Workbook 1 管理員核准流程（2026-09-15，管理工具與後端已正式發布；P21～P24 題組仍未建立）：

- Phase 1 圖片內容核准流程新增 server-only 候選載入：P21～P24 的人工轉錄候選只由驗證管理員身分的 `speaking-content-manager` 回傳，不放入學生前端資料或公開 API；載入不寫資料庫。管理員須為每題補上核准圖片並逐題勾選，任何文字或圖片異動會撤銷該題確認，全部確認後才可建立 draft，仍不會自動發布。PR #140 已合併至 `main` commit `597ae41`；additive migration `20260915054923_workbook1_p23_p24_picture_templates.sql` 已套用，共用 Supabase 的 `speaking-content-manager` v20 與 `speaking-tts-manager` v19 均為 ACTIVE。Netlify 正式 deploy `6aa932fff976f1d91ce05dfd` 與固定測試站 deploy `6aa932768f71a641f8c6c641` 已發布，兩站資源雜湊均與驗證 build 一致。發布後資料庫確認 P21～P24 題組數仍為 0；本批沒有建立草稿、產生 TTS 或發布題組。
- Phase 1 圖片草稿題數防護已補強並正式部署：管理頁依教材來源固定產生 P21／P22／P23 各 9 列、P24 8 列，移除任意增刪題目入口；`speaking-content-manager` 同步以 page allowlist 驗證精確題數，避免只填三題或額外加入非教材題仍建立草稿。管理工具、migration 與相關 Function 已部署；題組建立與發布仍保留為管理員逐頁核准後的手動操作。
- 管理員與老師繼續使用學生端的 Workbook／關卡版型預覽所有已發布題庫；一般題在 staff 唯讀模式可直接使用上一題／下一題瀏覽，不需完成前題，且前端不呼叫學生完成服務、不寫進度、不發放獎勵。管理員「教材 AI 口說題庫」的草稿／已發布／全部篩選、目前編輯標示與單一展開工作台，以及 P21～P24 專用圖片草稿框架、精確題數防護與 server-only 候選載入均已由正式 `main` 發布；P21～P24 仍未建立草稿、產生 TTS 或發布題組。

本次規劃（2026-09-15，Phase 0～8 來源審閱完成；只有 Phase 1 管理工具已部署）：

- 已建立持續執行文件 `docs/speaking-content/WORKBOOK_1_SPEAKING_CHALLENGE_PLAN.md`，計畫名稱固定為「workbook1口說大挑戰」。計畫以學生版 119 頁為顯示頁碼、教師版 109 頁為交叉核對來源，分成基準鎖定、P21／P22 圖片基礎、句型／顏色／問候、數字／時間、Be 動詞／身體、生活／家庭、冠詞／位置、人物／疑問詞及最終挑戰九個階段；永久保護既有 A-Z、P14 至 P17、循序解鎖、staff 預覽、私人資產、一次性示範音檔及後端答案權威。下一步只先執行 Phase 0 唯讀基準盤點，再利用本次提供的兩份 PDF 完成 P21／P22 來源、圖片、名詞、完整答案與 accepted responses 核對。未經管理員核准不發布；本批沒有 migration、Edge Function 或 Netlify 操作。
- Phase 0 唯讀基準已完成並保存於 `docs/speaking-content/WORKBOOK_1_PHASE_0_BASELINE.md`：Workbook 1 目前 8 個 published、4 個 draft 題組；正式 curated template key 無重複；A–Z 題組 ID 7 的主音檔維持 `ready`、26 段；P21／P22 題組仍不存在且未發布；既有 A–Z、P14、P15 等進度已依穩定 question set／question ID 記錄。2026-09-15 以全題組範圍重新盤點後，確認共有 12 筆 2026-09-07 的舊 attempt 仍帶私人錄音 object key 且未標記刪除：題組 ID 2 為 5 筆、題組 ID 4「03 顏色與生活物品」為 7 筆；原基準只統計後者，並非問題持續新增。此項仍分類為 P1 歷史資料保留問題；現行 Function 新寫入不再保存錄音，但在確認 R2 物件、回復方式及取得正式資料刪除授權前不自行清理。本批仍未建立題庫、未發布 P21～P24、未執行 migration／Function／Netlify 部署。
- Phase 1 來源轉錄已開始：學生版 P21 已確認 9 個圖片物件，但原頁沒有把各圖片綁定 Mary's 所有權或 Yes／No，候選內容只採可直接核對的 `What is that?`＋`It is a ...`；學生版 P22 與教師版 P19 已交叉確認 9 個 A-I 圖片補句。P23／P24 另有 J-R 與 S-Z 延伸題，後續必須使用各自來源頁與 template key，不能偽裝成 P22。逐題候選問答、完整句與 alt text 已寫入人工核准清單；圖片使用權、最終用詞與管理員核准仍未完成，因此沒有建立草稿、上傳圖片、產生 TTS 或發布。
- Phase 1 P23／P24 來源轉錄及管理框架已完成並正式部署：學生版 P23／教師版 P20 的 J-R 共 9 題、學生版 P24／教師版 P21 的 S-Z 共 8 題，均已記錄挖空句型、候選主詞、完整句、alt text、單複數與需人工確認的圖片用詞。專用流程使用 `workbook_1_p23_picture_gap_v1` 與 `workbook_1_p24_picture_gap_v1`，並擴充 source page／template allowlist 與測試，不會共用 P22 template。Additive migration 與相關 Function 已部署；管理員確認用詞與圖片權利前仍不建立正式草稿、不上傳圖片、不產生 TTS、不發布。
- Phase 2 來源審閱已完成：學生版 P26～P28、P32、P34～P36、P85 已與教師版可對應頁面逐頁核對，整理為「完整句與縮寫、顏色快問快答、客廳裡有什麼、看情境說問候、禮貌回答」五個候選關卡。逐題提示、主要答案、accepted responses、alt text、同義物件、個人回答與排除理由已寫入 `docs/speaking-content/WORKBOOK_1_PHASE_2_CONTENT_APPROVAL.md`；歧義顏色、沒有答案的箭頭圖、過時用語、負面干擾選項及學生／教師版後段不一致都不會被 AI 猜成正式答案。尚待管理員核准，沒有建立草稿、TTS、migration、Function 或部署。
- Phase 3 來源審閱已完成：學生版 P39、P40、P42～P43、P46～P50 已與教師版可對應頁面核對，整理為看圖數量、近／遠複數物品、英文算術、整點時間、數字代碼與動物數量七個候選關卡；逐題完整答案、accepted responses、alt text、數字正規化與隱私排除規則已寫入 `docs/speaking-content/WORKBOOK_1_PHASE_3_CONTENT_APPROVAL.md`。模糊運算符、單複數矛盾、可能是真實格式的電話號碼及索取父母電話題均不列入必過內容；P40／P50 無教師版同版頁，圖片名詞與 P39／P49 數量仍待管理員複核。未建立草稿、TTS、migration、Function 或部署。
- Phase 4 來源審閱已完成：學生版 P51、P53、P55、P57、P59、P64、P66、P78 已與教師版 P46、P48、P50、P52、P54、P58、P60、P71 核對，整理為人物 Be 動詞、This、That、It 與身體部位五個候選關卡；教材錯句只作提示，後端標準答案固定使用修正後的完整句，主觀評價、未明示姓名及圖片不清項目不納入必過題。P78 的十二條箭線在兩版都無答案且互相交叉，管理員逐題核准並重製清楚標記前不建立草稿。完整清單位於 `docs/speaking-content/WORKBOOK_1_PHASE_4_CONTENT_APPROVAL.md`；未建立題庫、TTS、migration、Function 或部署。
- Phase 5 來源審閱已完成：學生版 P60、P70～P71、P73、P75、P79～P80、P87、P90、P100 已與教師版可對應頁面核對，整理為早晨、下午、晚上與虛構家庭樹四個候選關卡。P60／P70／P80／P90 因沒有固定角色配對答案，只列非計分暖身；P79 的舊式稱謂／婚姻分類排除；P100 在去品牌、家庭假設與不自然台詞的改寫核准前暫緩。逐句候選答案、accepted responses、數字／縮寫正規化、隱私與刻板印象護欄已寫入 `docs/speaking-content/WORKBOOK_1_PHASE_5_CONTENT_APPROVAL.md`；未建立題庫、TTS、migration、Function 或部署。
- Phase 6 來源審閱已完成：學生版 P82、P84、P89、P92、P94、P96、P109 已與教師版可對應頁面核對，整理為字母冠詞、名詞冠詞、代名詞 Be 動詞、`in/on/under` 與 `here/there` 五個候選關卡。字母冠詞依實際字母名稱開頭音判定；P84 不自然末題、P89 外貌評價及 P92／P94 的高難度、羞辱性／家庭假設句均排除。逐題答案、accepted responses、位置箭頭複核與兒童容錯護欄已寫入 `docs/speaking-content/WORKBOOK_1_PHASE_6_CONTENT_APPROVAL.md`；未建立題庫、TTS、migration、Function 或部署。
- Phase 7 來源審閱已完成：學生版 P99、P101～P106、P108 已與教師版 P90～P96、P98 核對，整理為工作／地點、工作／地點／身分、Who／Where、疑問詞與教材角色年齡五個候選關卡。`What are you?` 的自然 adapted 版本需管理員核准；P99、P103、P104 的錯誤選項、純抄寫與不適合兒童的羞辱／外貌內容均排除。逐題問答、accepted responses、數字正規化與個資護欄已寫入 `docs/speaking-content/WORKBOOK_1_PHASE_7_CONTENT_APPROVAL.md`；未建立題庫、TTS、migration、Function 或部署。
- Phase 8 來源審閱已完成：學生版 P111～P114、P117～P119 已與教師版 P101～P104、P107～P109 核對。P111 整理八題指示詞候選；P112 前六題與 P114 的遠近資訊不足，管理員逐題核准前不建立；P113 純抄寫排除。P117～P119 只作技能覆蓋參考，最終挑戰改由後端從學生可用、已核准且已發布的前置口說題建立 12 題不可變 round snapshot，不直接匯入外貌／家庭假設或錯誤干擾句。完整規則位於 `docs/speaking-content/WORKBOOK_1_PHASE_8_CONTENT_APPROVAL.md`；至此 Phase 0～8 來源審閱完成，但仍未建立新題庫、TTS、migration、Function 或部署。
本次口說關卡返回層級修正（2026-09-15，正式站發布）：

- 修正小關卡頂端返回箭頭、A–Z／拼讀／圖片題離開、一般題最後完成及通關彈窗硬編碼返回口說根目錄的問題。現在只要題組含教材資料，就會回到該 Workbook 的關卡列表；只有舊資料缺少教材識別時才安全回到全部教材。未修改進度、判分、解鎖、Firebase、Supabase、migration 或 Edge Function。

本次口說關卡列表樣式修正（2026-09-15，正式站發布）：

- Workbook 關卡列表取消滑鼠 hover 的位移、陰影與變色，避免孩子誤以為滑過即代表選取；整體列表外框圓角由 24px 收斂為 5px。鍵盤 `focus-visible` 外框保留，鎖定、完成與可挑戰狀態，以及學生逐關解鎖、老師／管理員預覽權限均未變更。無 Firebase、Supabase、migration 或 Edge Function 變更。

本次播放器專注修正（2026-09-15，正式站發布）：

- 修正第一版仍可點擊 48px 音樂圖示重新播放教材的專注漏洞。學生進入口說大挑戰的教材列表、關卡列表或任何小關卡時，教材音檔會立即暫停，MusicPlayer 與播放入口完整隱藏，也不再為播放器預留底部空間；曲目與目前時間仍保留，離開口說範圍後才恢復播放器。手機版一般頁面的教材摘要與上一首／播放／下一首控制鍵仍採同一垂直對齊基準。無 Firebase、Supabase、R2、migration、Edge Function 或權限邏輯變更。

本次口說列表版面改善（2026-09-15）：

- Workbook 關卡列表移除重複的大型頁首、獨立返回卡與第二個 Workbook 標題，合併為同一列的「全部教材／教材名稱與解鎖提示／完成進度」精簡工具列；手機窄版只保留返回箭頭但維持 44px 觸控範圍。關卡分類與第一張關卡更早進入首屏，完成、可挑戰與鎖定狀態仍沿用既有後端資料及逐關解鎖規則。桌面、平板與手機共用相同資訊層級，沒有修改 Firebase、Supabase、migration、Edge Function 或教材權限。

本次正式發布（2026-09-15，口說大挑戰互動與教材層級）：

- 口說大挑戰改為先選 Workbook、再查看該教材的關卡與主題；教材與單一關卡都有可返回的網址。學生在口說範圍內不再看到會遮住內容的浮動「今日作業」，但 Navbar／更多選單的作業入口與既有權限規則維持不變。非 A–Z 關卡改為先啟用麥克風、再依說話音量顯示錄音光暈與清楚的送出評分動作；A–Z 的既有自動流程沒有變更。所有進入教材或小關卡的路由會回到頁面頂端。關卡頂端與完成結果僅在後端回傳實際獎勵資料時顯示 XP，避免前端誤導學生。PR #133 已合併至 `main` commit `a08db53`，Netlify production deploy `6aa8b4c5c17405000800f42a` 已 ready。無 migration、無 Edge Function、無權限邏輯變更；相關 React 測試 28/28、Production build 與 `git diff --check` 通過。

本次口說列表 UI 調整（2026-09-15）：

- 學生口說大挑戰的「遊戲規則」改為預設收合，只保留一列清楚的查看按鈕；學生需要時點擊才展開「選一關、看題目、開口說」三步驟，再次點擊可收起。控制項提供 `aria-expanded`、鍵盤 focus、展開方向提示及手機至少 44px 的觸控範圍；老師與管理員唯讀預覽仍不重複顯示學生規則。PR #131 已合併；Netlify production deploy `6aa8ad75fddd040009e58e8b` 已 ready，正式站載入 `main.3f972ae0.js`／`main.1b4a1697.css` 並確認摺疊元件結構存在。無 migration、無 Edge Function 變更。

本次正式修正（2026-09-15）：

- 修正 P14～P17 第一題發音已由 `pronunciation-coach` 依兒童容錯判定通過後，`speaking-challenge` 在保存完成進度時又用舊版嚴格轉寫規則重判，造成 409 並讓學生看到「口說大挑戰暫時無法開啟」的問題。完成服務改讀取最近一次由伺服器保存的 `answer_match`，不接受前端傳入正誤值，因此兒童容錯判定與進度保存一致，漏字／多字／換序仍不會通過。PR #129 已合併；`speaking-challenge` v25 為 ACTIVE，OPTIONS 200、未登入 POST 401。無 migration、無前端變更，P21／P22 維持未發布。

本次正式發布（2026-09-15）：

- Workbook 1 P14～P17 看字拼讀的兒童容錯判定：保留字母數量與順序必須完全正確、漏字／多字／換序仍不通過；當 Azure 整句轉寫不可靠時，後端會改核對所有候選中的逐字母對齊結果，以平均清楚度 45、單字母最低 20 作為兒童發音容錯。逐字母已對齊但分數不足或資料不完整時標記為「系統沒有聽清楚」，不算學生答錯、不跳題也不保存完成，並使用練習提示音請學生把字母稍微分開再試。A–Z 關卡、題庫答案、Firebase／教材 entitlement、原始錄音不保存與費用限制均維持不變；無 migration。`pronunciation-coach` v16 已 ACTIVE，OPTIONS 200、未登入 POST 401；Netlify production deploy `6aa8a57ed61b3671e6165931` 已 ready，正式站載入 `main.e78a7fcf.js` 並確認新版判定標記存在。P21／P22 維持未發布。

本次正式發布（2026-09-14，release integration）：

- 正式站 release branch `integration/production-speaking-membership` 同時包含 Workbook 1／A–Z 口說大挑戰與學生會員頁修正：學生端不再顯示「等級晉級」入口，舊 `/student/level` 安全導回排行榜；有效在校英文班學生的「方案與功能」頁保留既有權限與 AI Premium 狀態，但不顯示延續使用、功能加購、付款／訂閱管理、續訂或到期取消按鈕。英文班外的會員與離校生付款流程維持不變。未重新執行 migration、未重新部署 Edge Function，P21／P22 維持未發布。

本次進行中（2026-09-14，固定測試站與正式站已部署，待登入學生驗收）：

- 為避免後續學生導覽部署覆蓋 Workbook 1 口說前端，已從目前 `main` 建立 `integration/workbook1-speaking-recovery`，並整合 `codex/workbook1-speaking-challenges` 的完整前端與測試歷史。衝突只在學生 Navbar 與文件：保留已正式發布的排行榜起點、教材載入穩定化與頂部頭像直達我的設定，同時保留口說詳細關卡隱藏頂端 Logo Header 的專注模式。固定測試站 deploy `6aa7d7d6395dbb8889ddfc18` 與正式站 deploy `6aa7d93973f9c37439632e1c` 均已 ready，首頁與口說大挑戰路由 HTTP 200；共用 Supabase 已登記的 additive migrations 與 ACTIVE Speaking Edge Functions 不會重跑或先行部署；P21／P22 仍保持未發布。

本次進行中（2026-09-14，尚未部署）：

- 分支 `fix/academy-membership-ui`：學生端已移除「等級晉級」導航入口與獨立頁面；舊 `/student/level` 網址安全導回排行榜，鎖定教材不再指向已移除的頁面。有效在校英文班學生的「方案與功能」頁保留已取得權限與 AI Premium 狀態，但不顯示「延續使用與功能加購」、付款／訂閱管理、續訂、到期取消或加購按鈕；英文班外的會員與離校生原有付款、到期與自助訂閱流程維持不變。未修改 Firebase、Supabase、Stripe、membership 後端或權限判定。

本次正式發布（2026-09-14）：

- 學生 Navbar 的「我的教材／教材」入口在 Firebase 登入後或重新整理時固定保留；學生登入起點、Logo 與 Navbar 第一格改為排行榜，並移除重複首頁入口；頂部姓名／頭像直接前往「我的設定」。PR #121 已合併 main，正式站部署與首頁、`/student/dashboard`、`/student/leaderboard`、`/student/settings` HTTP 驗收皆成功。

本次進行中（2026-09-13）：

- 口說大挑戰專注模式與手機帳號捷徑：進入任何 `/student/speaking-challenges/:questionSetId` 小關卡後，頂端 Logo Header 與其保留空間直接收起，關卡的返回／名稱／進度列改貼齊頂端；回到口說大挑戰列表才恢復完整導覽。學生手機右上角姓名首字頭像由開啟抽屜改為直接前往「我的資料與頭像設定」，底部「更多」保留原抽屜及所有功能。沒有改動角色、會員、Firebase、Supabase、發音、音檔或任何後端邏輯；相關 Navbar、關卡與 A–Z 元件測試通過，待 Production build、推送與固定測試站視覺驗收。
- Workbook 1「00 A–Z 大小寫挑戰」手機版版面收斂：A–Z 首頁移除重複的大型耳機圖示與標題，改由返回箭頭、關卡名稱與「先聽完／已聽完可挑戰」狀態組成精簡關卡列；字母卡仍為 5 欄大小寫配對，並保留現有的大字、導聽亮起、單一主音檔與開始／重新聽操作。往下捲動時，僅 A–Z 關卡列接替並置頂，學生 Navbar 會暫時收起，避免兩個固定列重疊或佔用太多手機高度；桌面、其他口說關卡、Firebase、Supabase、音檔與自動收音／判分流程不變。新增 UI 契約測試、`WorkbookOneFoundationChallenge` 22／22、Production build 與 `git diff --check` 通過，功能 commit `fdaa04d` 已推送。固定測試站 deploy `6aa791f688403eb94697ca5f` 已 ready，首頁與 `/student/speaking-challenges/7` 回應 HTTP 200；待以已登入學生帳號完成 412px／桌面視覺與真實麥克風驗收。
- Workbook 1 A–Z 學生體驗第二批（固定測試站已部署，正式站未部署）：手機介紹頁改為每列五張大字 `Aa`～`Zz`，大小寫均清楚置中；完整播放目前主音檔後，新增 server-only 導聽完成紀錄，綁定學生、題組版本與 audio fingerprint，後續可直接開始，換主音檔會自動要求重新導聽。A–Z 回合新增一次 server-side retry：第一次辨識錯誤顯示「系統剛剛聽到」與同題提示，維持麥克風串流並於三秒後自動再試；第二次錯誤才安全歸零。additive migration `20260914000000_speaking_alphabet_intro_progress.sql` 已套用並登錄至 shared Supabase，所有新資料表與 RPC 僅授權 service role；`speaking-challenge`、`pronunciation-coach` 已部署，無憑證 CORS preflight 均回應 200。固定測試站 deploy `6aa75d48008e5761ae48d44c` 已載入 `main.4fdbfa47.js`。2026-09-14 hotfix 已部署 `speaking-challenge` v22：導聽紀錄查詢補回主音檔完整性驗證所需的私人物件與大小 metadata，修正已核准的 Leda 主音檔被誤判「未完成或已過期」而無法開始播放；`pronunciation-coach` v15 已在字母題型中把 Azure 轉寫的 `0` 或 `zero` 視為 O，避免孩子正確朗讀 O 卻被誤判。教材口說契約 23/23、Edge syntax、production build 與 `git diff --check` 成功；尚待具 Workbook 1 與發音資格學生在真實裝置完成 E2E 驗收。P21／P22 維持未發布。
- Workbook 1 A–Z 字母卡視覺調整：大小寫字母改為在卡片內水平與垂直置中，桌面字級由 19px 放大為 24px、卡片高度提高為 56px；700px 以下手機版字級由 16px 放大為 19px、卡片高度提高為 46px，維持每列七張且不改播放、評分或權限邏輯。`WorkbookOneFoundationChallenge` 20／20 tests、production build 與 `git diff --check` 通過；固定測試站尚待更新後進行視覺驗收。
- Workbook 1 A–Z Leda 自然女聲已核准並套用學生版本：管理員核准時的 500 錯誤確認為 `speaking-tts-manager` 漏引入 `alphabetAudioSequenceValid`，已補上 import、加入契約回歸與安全診斷後部署 v18。使用者已完成人工試聽並選定 Google Chirp 3 HD Leda；server-only 原子 RPC 已將候選 `1c4138c5-597e-44fb-a63b-8b2f2c1ce8f2` 設為 `active`，同步學生 `alphabet_master` sequence，並保留舊 sequence 快照供回復。資料庫 postflight 確認 Leda 主音檔為 36.660 秒／1,759,740 bytes／26 段且 sequence 為 `ready`；固定測試站學生頁已能顯示 `Aa`～`Zz`、可用的「開始聽 A–Z」與鎖定中的「開始挑戰」，不再出現 26 個標準發音未準備錯誤。相關 helper／題庫契約 29／29、管理 UI／service 13／13、全 React 54 suites／216 tests、Edge syntax、production build 與 `git diff --check` 通過；本批未合併 `main`、未部署 Netlify 正式站，P21／P22 保持未發布。
- Workbook 1 A–Z 女聲品質修正待部署固定測試環境：因既有 26 個 Autonoe 獨立字母音檔在 I、J、K、L、N、R、S、V、Z 出現語調、情緒或音量不一致，改為 Google Neural2-F 在單一請求中連續念完 A–Z，固定 0.82 倍速、音高與音量，並用 26 個 server timepoint 保留分段播放。新音檔先存為私人 R2 候選，不會碰目前學生版本；管理員必須完整播放到結尾並再次確認，後端重新驗證固定模板、版本、voice、26 段 manifest 與 R2 大小後，才原子切換且保存舊 sequence 快照供緊急人工回復。舊的逐字母組裝 API 已停止對外使用，草稿發布與學生讀取同時相容現行 legacy sequence 與經核准的新 candidate。新增 server-only additive migration `20260913180000_speaking_alphabet_audio_candidates.sql`，PGlite 成功驗證原子切換及版本錯誤整筆回滾；相關 helper 5／5、題庫契約 23／23、管理 UI／service 13／13、全 React 54 suites／216 tests、Edge syntax、production build 與 `git diff --check` 通過。尚未套用 migration、部署 Function 或固定測試站，也尚未產生／核准真實候選；P21／P22 保持未發布。
- Workbook 1 A–Z 自動語音挑戰已部署固定測試環境：分支 `codex/workbook1-speaking-challenges` checkpoint `3b771c2` 已推送，介紹頁字母格改為 `Aa`～`Zz`，且只有介紹頁可以播放單一 A–Z 主音檔。正式挑戰移除指定字母提示音、手動開始／停止錄音與送出按鈕；同一輪只取得一次麥克風串流，以瀏覽器本機音量偵測逐題切出短音訊，自動送評並前進，完成、失敗、切到背景或離開時關閉。回到列表前新增「本輪紀錄不會存檔」確定／取消對話框。管理員已完成缺少的女聲來源並重建主音檔；資料庫 postflight 確認題組 `id=7` 的 `alphabet_master` sequence 為 `ready`、26／26 段皆符合 Autonoe 女聲 policy、單一 voice、44.367 秒、2,129,644 bytes。`speaking-tts-manager` v13 與 `speaking-challenge` v18 均為 ACTIVE；後者 OPTIONS 回應 200、無憑證 POST 正確回應 401。全前端 54 suites／216 tests、題庫契約 22／22、Edge Function syntax、production build 與 `git diff --check` 已通過。固定測試站已具備本批前端；尚待具 Workbook 1 與發音資格的學生在真實手機完成單一主音檔播放、持續麥克風、自動切段送評、答錯重來與離開確認 E2E。本批未合併 `main`、未部署 Netlify 正式站；P21／P22 仍保持未發布。
- Workbook 1 單一 A–Z 主音檔已發布至固定測試環境：分支 `codex/workbook1-speaking-challenges` checkpoint `9ead34d` 已推送。共用 Supabase 已套用 server-only additive migration `20260913170000_speaking_alphabet_audio_sequences` 與原子 claim migration `20260913173000_claim_speaking_alphabet_audio_sequence`；管理端將既有 26 個私人 R2 字母 WAV 一次組成 42.327 秒、字母間隔 800ms 的單一主音檔（2,031,724 bytes），並保存 26 段伺服器時間碼，`provider_requests=0`。學生只取得一個短效 signed URL 與可播放區段，不會每次收聽重新生成，也不會收到私人 object key。題組 `id=7`「00 A–Z 大小寫挑戰」已由管理員發布，26 題完整；`speaking-tts-manager` v12、`speaking-content-manager` v17、`speaking-challenge` v17 均為 ACTIVE，OPTIONS 回應 200、無憑證 POST 回應 401。固定測試站 deploy `6aa672b250d7dc23888fdf2d` 已發布本批前端；P21／P22 仍無正式題組並保持未發布。本批未合併 `main`、未部署 Netlify 正式站；尚待具 Workbook 1 與發音資格的學生完成一次真實播放、分段挑戰、錄音與通關 E2E。
- Workbook 1 基礎口說正式後端已部署、題組尚未發布：經使用者明確授權，正式共用 Supabase 已依序套用並登記 `20260912143926_workbook1_speaking_visual_assets`、`20260913013037_speaking_pronunciation_request_ledger`、`20260913023814_speaking_foundation_round_sessions`、`20260913113000_workbook1_foundation_template_uniqueness` 四個 additive migration。Postflight 確認六張新表均啟用 RLS，`anon`／`authenticated` 無表讀取權，六支新 RPC 均為 `security invoker` 且只允許 `service_role`，12 個索引及兩個 constraint 全部有效；新表與 P21／P22 題組仍為零資料。`pronunciation-coach` v13、`speaking-tts-manager` v10、`speaking-content-manager` v15、`speaking-challenge` v16 均為 `ACTIVE` 且維持 Function 內 Firebase ID Token 驗證；四支 Function 的 OPTIONS 均為 200、無憑證 POST 均為 401。沒有建立題庫、呼叫付費語音／發音評分或上傳 R2；P21／P22 明確保持未發布。本批未合併 `main`、未部署 Netlify 正式站；A–Z／P14–P17 仍須另行建立及人工核准發布後，才能在固定測試站進行真實麥克風 E2E。
- Workbook 1 基礎口說闖關：分支 `codex/workbook1-speaking-challenges` 從 `origin/main` commit `02f0b442` 建立，並只套入 Speaking 視覺提示、換題同步與台灣國旗修正 5 個相關 commit。第一個 checkpoint 已完成 A–Z 教學／3 秒辨識關與 P14～P17 四個逐字母拼讀關的管理員 curated draft、完整洗牌、答錯整輪歸零、重聽／重玩及後端精確字母序列比對。第二個 checkpoint 已完成 P21／P22 通用學生端看圖框架、P21 完整問答與 P22 完整句伺服器核對、P22 可見單字點讀，以及尚未套用的私人圖片／互動答案／逐字音檔 additive migration；學生回應不含正確答案或私人 R2 object key，圖片與語音未全部 ready 時後端拒絕發布。第三批新增管理員人工內容清單、逐題私人圖片直傳、檔案簽章驗證、P22 可見單字預先產生語音及中途失敗安全回復；P21／P22 不開放通用題目編輯器，避免顯示句型與後端完整答案不同步。唯讀正式資料核對已確認 P14～P17 的 `book_page_spiral_review_content` 均為 `published` 且已人工核對，共 46 個單字；P17 正式內容只有 one～twelve，因此已移除舊 OCR 草稿多出的 `thirteen`。後端會在建立、沿用與發布時重新比對最新來源版本、題序及答案，來源鎖定題庫不能用通用編輯器修改，並新增未套用的 active template 唯一索引。此來源表的建立 migration 目前已拆至未合併的 PR #120，故 PR #119 在該 schema 進入 `main` 前必須維持 Draft；正式資料雖已有該表，仍不能忽略 Repository migration dependency。學生題庫 catalog、指定題庫與送出發音評分現在都會在讀取答案、簽發私人 R2 網址或呼叫 Azure 前，重新核對該生的逐本教材 entitlement；未授權學生不能取得題目或產生付費請求。另新增尚未套用的 server-only pronunciation request ledger migration，由資料庫以每位學生 advisory lock 原子保留評分額度，將成功、供應商失敗、無法評分與內部失敗全部計入限流，且不保存原始錄音。Repository 及正式來源仍沒有 P21／P22 各題的實際核准圖片、名詞及完整答案，所以尚未建立正式圖片題庫。相關 React 8 suites／31 tests、題庫契約 19／19、教材 entitlement 契約、基礎答案契約與全部 Edge Function 語法已成功；完整 React 回歸與 production build 將在本 checkpoint 提交前重跑。Draft PR #119 的自動 Netlify Deploy Preview 已 ready，但只含前端；Migration 未套用、四支相關 Edge Function 未部署且未產生付費 TTS，因此尚不能作為完整功能測試站驗收。
- Workbook 1 本次安全 checkpoint 驗證：相關 React 12 suites／41 tests、題庫契約 19／19、教材 entitlement 契約、基礎答案契約、全部 Edge Function 語法、production build 與 `git diff --check` 均成功；只有既有 React Router future flag、Node module type、Node deprecation 與 Browserslist 資料提示。未套用 migration、未部署 Edge Function 或測試站。
- Workbook 1 行動版與無障礙補強：一般口說題的固定上一題／下一題列會同時避開學生 Bottom Nav、MusicPlayer 與 iPhone bottom safe area，頁面也預留相同高度，避免最後內容被固定元件遮住。A–Z、P14～P17、P21、P22 與一般題切換時會把焦點移到新題或結果，並用精簡 live status 告知螢幕閱讀器；錄音秒數不再每秒插入 live announcement，手機錄音回聽控制提高到 44px。新增 26 個字母依序播放、中途答錯回第一題、缺音禁止開始、四型 route dispatch、完成服務、焦點與固定倒數讀屏提示測試；目前相關 React 12 suites／50 tests、題庫契約 20／20 均成功。正式來源 migration 已另拆為可獨立審查的 PR #120；PR #119 仍維持 Draft，且本批尚未部署。
- Workbook 1 A–Z 伺服器回合補強：每輪 26 題的順序、目前題號、claim token 與成功／失敗狀態改由 server-only round 保存；同題重複送出會先回 busy，不會重複保留額度或呼叫 Azure。答錯由資料庫將整輪標為失敗，前 25 題不寫一般完成進度，第 26 題正確才在同一交易完成 26 題並沿用既有首度全關獎勵。供應商逾時上限 75 秒，失敗會完成 request ledger 並釋放未使用 claim；付費評分 attempt 與 round 推進改由單一 RPC 交易完成，任一步驟失敗會一起回滾，避免留下無法恢復的孤立 attempt。P21／P22 改採無提示語音評估，送錯後只回傳實際辨識文字，不把完整答案或空格答案交給 Azure 後再洩漏到逐字結果；圖片題自由文字發音提示也不傳到學生端。相關 React 13 suites／68 tests、題庫契約 21／21、回合流程 7／7、PGlite PostgreSQL 8／8、教材 entitlement／基礎答案契約、全部 Edge Function 語法、production build 與 `git diff --check` 均成功；尚未套用 migration、部署 Edge Function 或進行固定測試站真實麥克風驗收，PR #119 仍依賴 PR #120 並維持 Draft。
- Workbook 1 評分重送與測試補強：A–Z atomic assessment 以非空 claim token 唯一索引避免回應遺失後重複建立 attempt；完全相同的重送會回傳既有結果，不同學生、回合、題目、分數、辨識文字、逐字結果或正誤值則 fail closed。付費請求 ledger 完成狀態採最多兩次重試，只在 status 與 error code 都相同時接受既有 terminal 狀態。P14～P17 現以四組獨立硬編碼的 46 個核准單字驗證來源與逐字母答案；P21／P22 測試改為實際串接 `SpeakingPracticeSteps`，並驗證不完整回答不得完成、P22 每個可見 token 的私人音檔對應與播放失敗後可重試。相關 React 14 suites／71 tests、題庫契約 21／21、回合流程 7／7、PGlite PostgreSQL 8／8、教材 entitlement／基礎答案契約、全部 Edge Function 語法及 production build 均成功；migration／Edge Function 尚未部署，PR #119 仍維持 Draft。
- Workbook 1 關卡完整性與錯誤資訊補強：新增 A–Z 答錯後重新聽會再次完整播放 26 個標準音的元件測試；P14～P17 依正式題數 10／12／12／12 題驗證元件洗牌後逐題推進、無遺漏或重複，P21 也驗證多張圖片洗牌後全部只出現一次且最後一題才結束。發音 request ledger 現以隔離 PGlite 實際執行一般題 10 分鐘 12 次、Workbook 1 基礎題 10 分鐘 60 次與 24 小時 160 次上限，並驗證舊紀錄不占額度、未發布或錯題組不建立 reservation。學生 `speaking-challenge` 的 5xx 回應改為固定泛化訊息，不再把 PostgREST／資料庫細節或錯誤代碼送到前端；可處理的 4xx 提示仍保留。相關 speaking React 12 suites／63 tests、完整 React 回歸 53 suites／203 tests、題庫契約 21／21、回合流程 7／7、PGlite 回合 8／8、PGlite ledger 5／5、公開錯誤 3／3、全部 Edge Function 語法、production build 與 `git diff --check` 均成功；migration／Edge Function 尚未部署，PR #119 仍依賴 PR #120 並維持 Draft。
- Workbook 1 學生輸出安全邊界：`speaking-challenge` 現把角色／發音資格檢查與學生題目輸出整理為可執行測試的共用模組，handler 仍會在查詢題庫與簽發私人網址前完成授權。新增測試確認 teacher／admin 示範模式、非法角色、失效方案及缺少發音權限均 fail closed；P21／P22 學生回應不含完整答案、accepted responses 或私人 R2 key，圖片與 P22 可見單字音檔不完整時拒絕輸出，圖片題完成只寫入對應題目的既有完成服務。完整 React 回歸 53 suites／205 tests、題庫契約 21／21、安全邊界 5／5、全部 Edge Function 語法與 production build 均成功。固定 Netlify 測試站 deploy `6aa62f2bd51fa8956846ebf1` 已發布，首頁與 `/student/speaking-challenges` 均回應 200，並載入本次 `main.76c850d3.js`；已登入沙盒在校會員的 412×915 實測無水平溢位，可見按鈕皆至少 44px，底部導覽與「今日作業」相距 14px、沒有重疊。目前 catalog 仍只顯示 Workbook 1 原有 4 個小關卡，證明新的字母／拼讀／P21／P22 尚未因單純前端部署而誤開放；本批未套用 migration、未部署 Edge Function，PR #119 仍依賴 PR #120 並維持 Draft。
- Workbook 1 測試環境 migration 唯讀稽核：共用 Supabase 已登記基礎完成獎勵 `20260907155832`、一般 visual aid `20260910090000` 與 PR #120 的頁面來源 `20260911093000`，且既有 `complete_speaking_challenge_question_v2` 為 `security invoker`。本功能仍缺 `20260912143926_workbook1_speaking_visual_assets.sql`、`20260913013037_speaking_pronunciation_request_ledger.sql`、`20260913023814_speaking_foundation_round_sessions.sql`、`20260913113000_workbook1_foundation_template_uniqueness.sql` 四個 additive migration；部署前 live preflight 已確認六張新表、三個 attempt 欄位、新 RPC 與唯一索引均未部分存在，七組新 active template 沒有重複，且沒有超過 30 秒的長交易或 lock wait。這些條件在真正部署前仍須即時重查；在取得明確授權前不套用，也不部署 `speaking-content-manager`、`speaking-tts-manager`、`speaking-challenge` 或 `pronunciation-coach`。
- Workbook 1 P21／P22 內容核准清單：新增 `docs/speaking-content/WORKBOOK_1_P21_P22_CONTENT_APPROVAL.md`，逐題保留來源、完整問答／句子、accepted responses、學生可見替代文字、圖片權利、資產 readiness 與 E2E 狀態，並明確禁止把 OCR／測試 fixture 當正式內容或把私人 R2 object key、signed URL 寫入文件。P21 九個題位與 P22 九個 OCR 句型均維持「待核准」；第一題 apple 只記錄為使用者描述，仍須以原頁或教師版確認。
- Workbook 1 管理員圖片預覽安全補強：`speaking-content-manager` bootstrap 不再替所有 P21／P22 圖片預先簽發短效網址；管理員展開學生預覽後，必須逐題按鈕載入，後端才以 `question_id` 重新確認題型、題庫狀態與 ready 私人資產，並回傳 15 分鐘圖片網址及替代文字。管理 API 回應統一加入 private no-store 標頭；題庫發布也會比對草稿的 `version` 與 `updated_at`，若核對期間被其他操作更新即回應 409，要求重新整理。跨多張子表的發布仍不是單一資料庫交易，列為後續 P2 強化。固定 Netlify 測試站 frontend-only deploy `6aa647b1f0b721107e3168eb` 已發布，首頁與 `/student/speaking-challenges` 均回應 200 並載入 `main.26d0cecf.js`；本批未部署 Edge Function，因此只能驗證既有前端內容，不能把新圖片預覽或新 Workbook 1 關卡視為完整 E2E。
- Workbook 1 錯誤重試回歸覆蓋：管理頁圖片預覽第一次失敗時不顯示圖片、只顯示泛化提示，並可由同一按鈕重新請求；A–Z 提示音播放失敗後仍鎖住錄音，必須重試並聽完才解鎖；P14～P17 答錯或完成紀錄保存失敗時留在同一單字；P21 保存失敗時也保留原圖；P22 音檔載入錯誤會解鎖單字按鈕並允許重試。三個相關 suites／30 tests 成功。本批只有測試與進度文件，固定測試站應用程式碼不需重新部署。
- 公開首頁折疊版 Navbar 新增常駐「登入」按鈕，使用者在平板與手機寬度不必先打開漢堡選單即可找到登入頁；抽屜內原登入入口仍保留，桌面寬版導覽不變。按鈕維持至少 44px 觸控高度，並補上 hover 與鍵盤 focus 狀態。本批不修改登入流程、Firebase、Supabase、權限、套件或產品資料。

本次正式發布（2026-09-12）：

- 學生兒童友善首頁與導覽第一階段：分支 `codex/student-child-friendly-ui` 基於 `main` commit `bf7a825`。登入後首頁移除「繼續今天的學習」、系統推薦、每日路線與複雜進度，只依現有 active membership／effective access 顯示最多五個大型入口：我的教材、開口說、我的作業、AI 教材與更多功能；首頁不再等待無關的進度統計 API。
- 學生桌面 Navbar 收斂為首頁、我的教材、開口說與更多，通知及帳號留在右側；手機版使用首頁、教材、開口說、更多四格固定底部導覽，通知及頭像留在頂部。發音教練與口說大挑戰統一收進開口說選單，成果、會員、設定、安全與客服依權限收進更多選單；老師與管理員沿用既有 Navbar。
- 412×915 本機實際渲染曾發現底部列受固定 Header 定位影響而出現在頂部，已改用 React portal 放至 `body`，並補上內容、MusicPlayer 與作業捷徑避讓規則。1600×900 與 412×915 的首頁、開口說／更多選單、頁尾可見性、無水平溢位及鍵盤焦點已驗收；iPhone safe area 使用 CSS `env(safe-area-inset-bottom)` 保留空間。
- 固定測試站 Review 發現學生開始播放聽力後，浮動「今日作業」為避開 MusicPlayer 被往上推到內容區；現改為學生播放器顯示期間暫時隱藏該浮動捷徑，作業仍可從首頁卡片與「更多」進入，老師／管理員的「發布作業」不受影響。412px 已登入實測確認播放器、教材內容與底部導覽沒有被捷徑遮擋；測試站 deploy `6aa49a3d940d50bf8b2622e3` 已載入 `main.320b3b35.js`。
- iPhone Chrome 快速捲動收合瀏覽器工具列後，MusicPlayer 與學生底部導覽之間原會露出約 14px 空隙；播放器定位現改為共用底部導覽的 66px 高度與 `max(8px, safe-area)` 下緣公式，普通與迷你播放器都會貼齊導覽列上緣且保留安全區。固定測試站 deploy `6aa4a0f62b404d1a109d9bfb` 已發布；440×956 瀏覽器量測在頁首及快速下滑至 `scrollY=3239` 後都維持 `gap=-2px`（邊框輕微銜接、沒有可見空隙），尚待 iPhone Chrome 實機複驗工具列收合動畫。
- 驗證結果：`User`、`MainNavbar`、`AssignmentShortcut`、`MusicPlayer.visibility` 共 4 suites／20 tests 通過；Production build 與 `git diff --check` 通過。只有既有 React Router future flag／act、Firebase OAuth 測試網域提示、Node deprecation 與 Browserslist 過期警告；未修改 package、Firebase、Supabase、Stripe、migration、Edge Function 或老師／管理員流程。PR #112 已合併至 `main` commit `2030775`；Netlify production deploy `6aa4a567f573770008dad73f` 已為 `ready`，正式首頁路由回應 HTTP 200，並載入包含手機播放器貼齊規則的 `main.047a7c3a.css`。功能分支與固定測試站仍保留供後續複驗。

本次正式發布（2026-09-07）：

- 口說大挑戰、混合作業 V2 與 API 成本控制中心已由 PR #100 合併至 `main` commit `f50d186`。正式 Netlify application deploy `6a9e2e320841ca0008bea010` 已為 `ready`，正式 bundle 為 `main.e25d0f50.js`；首頁、API 成本控制、口說題庫管理、學生口說挑戰及師生作業路由均回應 HTTP 200。正式 Supabase 已套用 additive migration `academy_all_access_assignment_v2`，新增結構與方案功能旗標均已查詢確認；`assignment-manager` v29、`billing-manager` v30、`gamification` v11、`generate-ai-material` v31、`membership-manager` v37、`pronunciation-coach` v10、`speaking-challenge` v7、`speaking-content-manager` v9、`speaking-tts-manager` v7 均為 ACTIVE，七支需登入的服務以未登入請求驗證皆正確回應 401。使用者已在測試站完成四項 AI 示範語音驗收；全前端 47 suites／154 tests、API 成本頁 3/3、Edge Function 語法與契約、production build 及 `git diff --check` 均成功。正式站登入後的麥克風錄音、真實送評與私人 R2 語音播放仍建議再做一次快速抽驗。

先前測試階段紀錄（已由 PR #100 整批正式發布）：

- 口說題庫第三階段：題庫校正與男女聲示範（測試站已部署，正式尚未部署）：checkpoint `5a15dba` 已推送至 `codex/speaking-guided-practice`。示範語音改用 Autonoe 女聲與 Puck 男聲核准池，依 `question_set_id + sort_order` 的奇偶固定交錯；不同題庫的起始性別可不同，但同一題的聲音永遠穩定，不會在學生每次播放時重新隨機或呼叫 TTS。沿用既有 `voice_id`、資產設定雜湊與 `speaking_question_audio`，不需要 migration；管理員手動按「補產生示範語音」後，符合原 Autonoe 設定的題目可直接沿用，需切換男聲的題目才生成 Puck 新資產，舊檔不覆寫。已發布題目的預覽新增女聲／男聲標記及短效私人 R2 試聽。Google Cloud 官方 Chirp 3 HD 清單已核對 Autonoe 為女聲、Puck 為男聲；Edge Function 語法與語音分配契約、題庫契約 13／13、管理頁與服務層 2 suites／9 tests、全前端 46 suites／151 tests、production build 與 `git diff --check` 均成功。`speaking-tts-manager` 已部署至共用測試 Supabase，未登入預覽請求正確回 401；固定測試站 deploy `6a9e21f64d406fd7614665f3` 已為 ready，管理頁回應 200 且載入本次 `main.7e7f123e.js`。本次未自動補產生付費語音，既有題庫仍須由管理員選擇後手動執行。
- Workbook 2 第一個口說大關卡（測試站已部署，正式尚未部署）：checkpoint `7869cf0` 已推送至 `codex/speaking-guided-practice`。已依 120 頁教師版目錄及 P56～P59 實際頁面建立 `docs/speaking-content/WORKBOOK_2_SPEAKING_MAP.md`，先排除描寫格、無圖片脈絡的 `What is this?` 與未確認授權的歌曲。第一個可直接使用的主題選為 P56、P58「我來自哪裡？」，管理員可一鍵建立六題人工精選草稿，練習個人 `I am from [你的國家]`、he／she／they 及 `come from`；不執行 OCR、不呼叫付費出題 AI、不自動發布，並以 `workbook_2_origin_places_v1` 防止重複建立。管理頁與服務層相關 2 suites／8 tests、題庫契約 12／12、全前端 46 suites／150 tests、Edge Function 語法、production build 與 `git diff --check` 均成功。`speaking-content-manager` 已部署至共用測試 Supabase，未登入 POST 正確回 401；固定測試站 deploy `6a9e1cd70e61c484fb0dcbd0` 已發布，管理頁回應 200 且載入本次 `main.26b16b8f.js`。
- 口說直接回答與結構化句型辨識（測試站已部署，正式尚未部署）：commit `e21cb94` 已推送至 `codex/speaking-guided-practice`。學生小關卡已移除個人答案輸入框與「看著念 → 看提示說 → 自己說」三段門檻，預設只顯示問題、直接回答提示與主要錄音操作；中文提示、`My name is _____` 句型、自然範例、TTS 播放與發音提醒只有按「不知道怎麼說？」才展開。前端只送已發布 `question_id` 與 WAV，不再送個人欄位或參考句。後端遇到 `[你的名字]` 等代換欄位時改用 Azure unscripted pronunciation assessment 辨識實際英文，再依伺服器保存的固定句型確認回答；`My name is Amy.`、`My name is Amy Lee.` 可通過，但只說名字或漏掉固定句型不會完成。沒有代換欄位的題目仍使用 scripted assessment，保留遺漏／插入判定。評分結果新增「我聽到」辨識句，維持逐字紅／黃／綠且不顯示數字；句型不符時使用紅色重試提示與重試音效，不會誤播成功音效。沿用既有題庫欄位與評分紀錄表，不需要 migration，也不保存原始錄音。全前端 46 suites／149 tests、Edge Function 語法及契約、production build 與 `git diff --check` 均成功；`pronunciation-coach` v9 為 ACTIVE，OPTIONS 200、未登入 POST 401；固定測試站 deploy `6a9d7c1e78a217165cbd8c52` 已發布，口說路由回應 200 且載入 `main.af8ffbf6.js`。尚待學生以姓名題完成一次真實錄音、句型通過與句型不符的端到端驗收。
- 口說手機單一捲動介面（測試站已部署，正式尚未部署）：commit `af263ee` 已推送至 `codex/speaking-guided-practice`。取消固定 `100svh` 與中央題目卡 `overflow-y: auto`，改為整頁唯一捲動；關卡名稱／進度黏在 Navbar 下方，上一題／下一題固定於底部並保留 safe area。手機版移除最外層完成綠框與陰影，題目改為單一白色資訊面，三階段改為分段控制器，發音提醒收合時固定 44px，降低框中框與雙層滑動的不直覺感。相關 5 suites／12 tests、production build 與 `git diff --check` 均成功；固定測試站 deploy `6a9d489180cd7cc09d79c780` 為 `ready`，口說路由回應 200 且載入 `main.8c20c50a.css`。實際登入 681×919 驗收確認中央題目卡 `overflow-y: visible`、無內層捲動、無水平溢位、可見按鈕皆至少 44px、進度列為 sticky、換題列為 fixed 且浮動「今日作業」不存在；長評分結果與 412×915／iPhone safe area 仍待實機複驗。
- 口說大挑戰手機單屏緊湊版（測試站已部署，正式尚未部署）：commit `b3dd0f1` 與外層捲動修正 `b7650df` 已推送至 `codex/speaking-guided-practice`。在 `760px` 以下把關卡頁改成扣除 66px Navbar 的單一動態視窗工作區，教材標頭縮為返回鍵、單行名稱與進度，題目、三段頁籤、個人答案、示範／提示及錄音器皆降低非必要留白但保留至少 44px 觸控區。一般手機不再整頁上下捲動；極短螢幕或長內容只在題目卡內安全捲動。口說詳細頁隱藏會覆蓋操作區的浮動「今日作業」，返回其他頁即恢復；此頁沒有 MusicPlayer，手機版會移除全站原為播放器保留的 78px 底部空間。相關 5 suites／11 tests、全前端 46 suites／147 tests、追加 2 suites／8 tests、production build 與 `git diff --check` 均成功；固定測試站 deploy `6a9d44d04f3ec48b202c2987` 已發布並載入 `main.ce28586f.js`／`main.28a9b543.css`。實際登入 681×919 驗收確認文件高度等於視窗 919px、無水平溢位、可見按鈕皆至少 44px、底部換題列完整且「今日作業」浮鈕不存在；412×915 與 iPhone safe area 仍待實機複驗。
- 口說大挑戰非數字回饋與音效（測試站已部署，正式尚未部署）：commit `2da6d3a` 已推送至 `codex/speaking-guided-practice`。學生送評後不再看到總分、逐字小分或清楚度／流暢度／完整度／語調數字，只保留綠色「很清楚」、黃色「再練一下」、紅色「慢慢重念」的逐字標記與一項文字建議；三段流程頁籤改顯示「完成」，結束文案改為鼓勵讓更多文字變綠。後端仍保存原始評分，作為顏色門檻、完成紀錄及未來教師報表依據。新增低音量的成功／練習／重試合成提示音，不增加音檔、第三方 API 或費用。瀏覽器無法讀取或修改手機系統音量，因此不強制設為 50%，改在自然示範旁提示用裝置音量鍵調整媒體音量。相關口說元件 3 suites／6 tests、全前端 46 suites／146 tests、production build 與 `git diff --check` 均成功；固定測試站 deploy `6a9cd4398cfa1bf660e0ac84` 已發布且為 `ready`，首頁與口說挑戰路由均回應 200，載入本次 `main.c6e23ac6.js`。尚待用真實手機驗收提示音與 412px 畫面。

本次進行中（2026-09-05，測試環境已部署，正式尚未部署）：

- 口說示範聲線與 Azure 評分格式修正（測試環境已部署，正式尚未部署）：commit `257636e` 已推送。Google Cloud Chirp 3 HD 預設聲線與測試 Supabase Voice Secret 已由 Leda 改為較明亮的 Autonoe，保留國小生使用的 `0.82` 倍速與 LINEAR16 WAV，並以 `elementary-bright-v4` 形成新資產雜湊、不覆寫舊音檔。發音評分確認 Azure 短音訊 REST API 正式格式把 `PronScore`、各細項分數及逐字分數直接放在 `NBest`／`Words`，舊程式卻只讀 SDK 式巢狀 `PronunciationAssessment`，因此把已收到的完整評分誤判成缺資料；新版同時支援扁平與巢狀格式。若服務真的只回傳辨識文字，提示會明確說明不是錄音問題。新增 Azure 兩種格式契約測試；全部 Edge Function 語法與契約、全前端 45 suites／145 tests、production build 及 `git diff --check` 均成功。無 migration；`speaking-tts-manager` v5 與 `pronunciation-coach` v8 均為 ACTIVE，兩者 OPTIONS 200、未登入 POST 401。尚待管理員補產生少量 Autonoe 示範語音，並由學生完成一次真實送評驗收。
- 口說大挑戰單題專注 UI（測試站已部署，正式尚未部署）：commit `29f4875` 已推送至 `codex/speaking-guided-practice`。學生進入題庫後一次只顯示一個小關卡，上方以教材、題數及完成進度取代長頁面題目清單；三段流程收斂為「看著念 → 看提示說 → 自己說」，錄音改成畫面中央的大型主要操作。AI 評分先顯示總分、逐字綠／黃／紅結果與一項練習建議，清楚度、流暢度、完整度與語調移入「查看詳細分析」；前後題按鈕維持 44px 觸控範圍，未完成第三段前不能前往下一題，並補上 760px、480px、safe area 與減少動態偏好。全前端 45 suites／145 tests、production build 與 `git diff --check` 均成功；以 Playwright DOM 版面檢查 1600px、760px、412px 均無水平溢位，最小按鈕 44px，中央錄音按鈕完整在視窗內。固定測試站 deploy `6a9bdca4f058894db9937e94` 已發布，首頁及口說路由均回應 200 且載入 `main.353ab309.js`／`main.082c9212.css`。尚待真實登入帳號完成麥克風、送評、Navbar 與 iPhone safe area 視覺驗收。
- 口說大挑戰引導練習第三階段（測試站已部署，正式尚未部署）：分支 `codex/speaking-guided-practice`／commit `8effebc` 已推送，新增「看著念 → 看提示說 → 不看提示說」三段式流程，須依序送評，只有第三段完成才保存題目完成狀態。完整答案會逐步隱藏為關鍵字與求助提示；含 `[你的名字]` 等代換欄位時，學生先填英文再錄音，前端只送欄位值，`pronunciation-coach` 仍由後端讀取已發布句型、驗證欄位後組成參考句，不接受完整參考文字。此版不新增 migration、不加入自由 AI 對話、不發 XP／AE Points。相關前端 4 suites／8 tests、個人化參考句契約、全部 Edge Function 語法、production build 與 `git diff --check` 均成功；`pronunciation-coach` v6、`speaking-challenge` v5 均為 ACTIVE，固定測試站 deploy `6a9b8558c0e6dacecd6b59df` 已發布，頁面回應 200 且載入 `main.144e3e64.js`，兩個函式的未登入請求均正確回 401。手機版 CSS 已收成單欄並保留 44px 觸控高度，仍待以真實帳號完成 412px 畫面、三次錄音及實際 Azure 個人化送評驗收。
- 口說大挑戰發音評分第二階段（測試站已部署，正式尚未部署）：PR #99／commit `e3bc48f` 已推送，additive migration `20260904161000_speaking_pronunciation_attempts` 已套用共用測試 Supabase，`pronunciation-coach` v5 與固定測試站 deploy `6a9b67cf5bf2ed7f0cdfa90c` 已發布並為 ready，頁面回應 200 且載入本次 `main.3d3158e1.js`。每題可錄音、回聽、轉為 16 kHz 單聲道 PCM WAV，再由 Azure Pronunciation Assessment 顯示整體及逐字結果；後端只接受 `question_id`，自行重新驗證已發布題庫與學生 AI 發音權限。只保存分數、辨識文字與逐字結果，絕不保存原始錄音；每位學生 10 分鐘最多 12 次送評。首次真實送評收到 422，確認 Function 已收到請求；修正版已改為回聽與送評共用同一份 WAV、對偏小麥克風訊號做等比例增益，並依轉檔音量及 Azure `RecognitionStatus` 顯示可判斷的錯誤原因。相關前端 4 suites／8 tests、Edge Function 語法、production build 與 `git diff --check` 均成功；尚待學生重新錄音完成真實端到端評分驗收。
- Google TTS 自然度修正（測試站已部署，正式尚未部署）：朗讀前將 `[你的名字]`、`[你的姓氏]`、`[你的全名]` 等教材代換提示轉為 Amy／Lee 等自然英文例句，清除剩餘中文提示、全形括號與底線；取消強制 24 kHz，改用 Chirp 3 HD 原生輸出取樣率。資產設定加入 `natural-example-v2` 版本且 R2 路徑包含設定雜湊，補產生時會建立並連結新版 MP3，不覆蓋舊檔。`speaking-tts-manager` 已部署，固定測試站 deploy `6a9ad0e3f53e9433fa0e19ca` 回應 200；實際驗收確認語速偏快且 MP3 聽感偏悶，已由上方新版修正取代。
- 管理員 API 成本控制中心整合（測試站已部署，正式尚未部署）：已把原先只存在 `codex/admin-api-cost-dashboard` 的互動式月用量儀表板整合進最新 `codex/speaking-guided-practice`，避免後續口說整包部署再次覆蓋。`/admin/api-usage` 整合 OpenAI AI 教材紀錄、口說 OCR／題庫生成 Token 與 Google Cloud TTS 字元數，顯示總預算進度、月底預估、每日趨勢、成功率及預算／失敗率／單日突增警示；三類自動追蹤資料均採分頁讀取，單月達 50,000 筆安全上限時會以紅色提醒核對供應商帳單。Supabase、Cloudflare R2、Netlify、Firebase Authentication、Resend 與 PAYUNi 維持「外部核對」，未知帳單不誤顯示為零元。本批未新增 migration；checkpoint `bac24d0` 已推送，`generate-ai-material` v30 為 ACTIVE，固定測試站 deploy `6a9e29075056d3b40f6b873d` 已發布，線上成本中心／題庫管理／學生口說路由皆回應 200，bundle `main.e25d0f50.js` 含新版 `COST CONTROL CENTER` 且不含舊版 `OPENAI COST CONTROL`，未登入成本 API 回應 401。前端 47 suites／154 tests、API 成本頁 3/3、Edge Function 語法、Production build 與 `git diff --check` 均成功。
- Google Cloud 自然示範語音（測試環境已部署，正式尚未部署）：additive migration `20260904072331_speaking_question_audio_assets` 已套用共用測試 Supabase，兩張新表已確認啟用 RLS；`speaking-tts-manager` 與更新後的 `speaking-challenge` 已部署且預檢回應 200、未登入請求正確回 401。Google Cloud Service Account 與 `en-US-Chirp3-HD-Leda` Secret 已由管理員設定；固定測試站 deploy `6a9ab6f468dee1a58047c110` 已發布。系統依示範回答、Chirp 3 HD Voice ID 與輸出設定計算 SHA-256，相同內容沿用，否則以 Service Account OAuth 呼叫 Google Cloud Text-to-Speech、驗證回傳檔案並存入私人 R2。發布題庫後會自動產生語音，已發布題庫可補產生；學生端只播放 15 分鐘短效 R2 URL。尚未由已登入管理員實際生成第一批語音，因此 Google OAuth、TTS 回傳與 R2 寫入的完整鏈路仍待少量題目驗收。
- 學生 Navbar 第二次收斂（待重新部署測試站）：在校方案 `academy_internal` 現在可直接補足發音資格，避免既有在校帳號因 `features.pronunciation` 尚未同步而看不到「口說大挑戰」。學生主要列暫時隱藏「英文對話」，並把「方案與功能」移至桌面帳號選單及手機「其他」區；頁面與既有對話資料均未刪除。
- 教材口說大挑戰第一階段（測試站已部署，正式尚未部署）：已建立學生專用路由 `/student/speaking-challenges`，每本教材的已發布題庫成為可進入的小關卡；只有有效且包含 `pronunciation` 的學生能透過新的 Firebase Token 驗證 Edge Function 讀取內容。學生可從桌面及手機導覽進入，查看中文提示、示範回答、瀏覽器朗讀與發音重點，並以「我已開口練習」保存自己的完成紀錄；此階段不保存錄音、不呼叫評分服務、不發 XP／AE Points。新增 additive migration 的進度表已套用共用 Supabase，RLS 已啟用並撤銷前端直接存取；`speaking-challenge` 已部署，固定測試站 deploy `6a9a69e41d38b3fe87999032` 已發布。下一階段才把題目接入錄音、AI 示範與逐字評分。
- 發布流程可靠性修正：專案不再依賴電腦上可能過期的全域 CLI。`package.json` 新增 `release:preflight`（checkpoint 前）及 `release:deploy-preflight`（部署前）檢查功能分支、未提交檔案、遠端 upstream、ahead／behind 與 Firebase Token 驗證設定；測試站的 `deploy:speaking-test` 固定使用 Supabase CLI `2.116.0` 與 Netlify CLI `27.4.3`。發布檢查會在 Git worktree 中自動讀取該工作樹的 Git metadata，不需要修改全域 `safe.directory`，避免誤把已推送分支判成沒有 upstream。本機 OCR 暫存目錄 `/tmp/` 已忽略，不會被誤加入 commit。每次發布順序為：完成修改 → `npm run release:preflight` → commit／push → `npm run release:deploy-preflight` → 執行對應部署命令；若工具或 Git 狀態不符合，會先停止並指出原因。
- Workbook 1 代表小關卡第二階段：管理員頁新增 P18～P20「我的名字與自我介紹」人工範例，可一鍵建立四題可編輯草稿，不執行 OCR 或付費 AI；後端只允許管理員、只接受啟用中的 `Workbook_1`，並依 `workbook_1_name_intro_v1` 防止重複建立。題庫新增學生視角內容預覽，顯示問題、求助提示、示範句與發音重點，仍沿用逐題儲存及二次確認發布。`speaking-content-manager` 已部署至共用 Supabase，固定測試站 deploy `6a9a5d43979279aa3dc61679` 已為 ready；`/admin/speaking-content` 回應 200，無登入函式請求回應 401。學生錄音、AI 朗讀與逐字發音評分尚未接上，正式 `main` 與正式站未變更。
- Workbook 1 口說內容盤點第一階段：已依真實 119 頁學生版 PDF 建立逐頁分類表 `docs/speaking-content/WORKBOOK_1_SPEAKING_MAP.md`，區分可直接轉換、需教師確認、純書寫略過與歌曲限制；底線及空白框統一視為回答欄位，不再當成 OCR 題目文字。另完成第 18～20 頁「我的名字與自我介紹」代表小關卡草案，包含 AI 提問、提示朗讀、錄音回放及評分建議。此批只有內容規劃文件，尚未匯入題庫、執行 AI 生成或部署；圖片答案與學生版缺少的標準答案仍須以教師版或人工核對。
- 整本教材 R2 直傳 CORS 修正：2026-09-04 12:10～12:11 Edge Function 日誌顯示兩次 `create_book_upload` 均回 201，隨後均由 `discard_document_upload` 回 200，且沒有 `confirm_book_upload`；前端同時顯示 `Failed to fetch`，確認資料庫限制、Firebase Token 與 Supabase 建立工作正常，失敗點為測試站瀏覽器對 R2 的預簽 `PUT`。現有 R2 CORS 範本缺少 `https://alanenglish-student-test.netlify.app`，已補入並把瀏覽器網路錯誤改為明確 CORS／PUT 提示；失敗工作仍會自動清理，不執行 OCR、不產生 AI 費用。修正 commit `dbd9026` 已推送 PR #97；固定測試站 deploy `6a9a48941d9aab5a586a8b51` 已發布。尚待更新 Cloudflare R2 Bucket 的實際 CORS Policy並用原 53.9MB PDF 重試。
- 整本教材 20MB constraint hotfix：真實 53.9MB／約 115 頁 PDF 在 2026-09-04 10:49～10:50 兩次建立工作時，Postgres 日誌確認被舊 `speaking_source_documents_byte_size_check`（20MB）拒絕；檔案未進入 R2、未執行 OCR、未產生 AI 費用。新增 additive migration `20260904030633_allow_whole_book_document_size`，只讓具有 `chunk_count` 的整本分批文件原檔使用 100MB 上限，單一 Unit／圖片仍為 20MB、每個十頁批次仍為 20MB。遠端已驗證 53.9MB 單一來源判定拒絕、整本來源判定允許，migration history 正確；`speaking-content-manager` v3 為 ACTIVE，已知 constraint 錯誤會改回明確 400 訊息，無憑證請求仍回應 401。修正 commit `193aa7d` 已推送 PR #97，固定測試站 deploy `6a9a3822461ba9f4f84f6406` 已發布，管理頁回應 200 且 bundle 與本機 build 一致。題庫契約 10/10、相關前端 6/6、全部 Edge Function 語法、Production build 與 `git diff --check` 成功；尚待管理員以原 53.9MB PDF 重新上傳，驗證實際 R2 直傳與批次工作建立。
- 整本教材分批 OCR 第一階段：分支 `codex/textbook-speaking-generator`、PR #97、checkpoint `aa56ca7` 已推送。管理員可選擇 100MB／500 頁以內的完整 PDF；瀏覽器使用固定版 `pdf-lib` 在本機每 10 頁切成一批，原檔與批次檔再以短效預簽網址直傳私人 R2，避免整本檔案進入 Edge Function 記憶體。新增 additive migration `20260904021540_speaking_whole_book_ocr_batches` 保存頁碼、批次狀態、重試次數、錯誤碼、模型與 token；migration 已套用共用 Supabase，並驗證新表、RLS、3 個文件欄位、5 個索引及 migration history。每批可獨立 OCR、保留進度、失敗或超過十分鐘的處理可重試，管理員須逐批核准，全部批次核准後整本才完成。`pdf-lib` 已改為操作時才載入的獨立 chunk，避免增加一般學生頁主 bundle；整本分割／服務／管理頁 6/6、題庫契約 9/9、全前端 42 suites／134 tests、Edge Function 語法、Production build 與 `git diff --check` 均成功。`speaking-content-manager` v2 已部署並為 ACTIVE，無憑證請求回應 401；固定測試站 deploy `6a9a305ebdf0e0adecb64f8e` 已發布，`/admin/speaking-content` 回應 200 且 bundle 與本機 build 一致。尚未用真實 115 頁教材執行付費 OCR 或完成人工核准；學生口說關卡、錄音及作業引用仍未完成，正式 `main` 與正式 Netlify 亦未變更。
- 教材 AI 口說題庫第二階段已部署供測試：三筆 additive migration 已套用共用 Supabase，`speaking-content-manager` v2 為 ACTIVE，固定測試站與 PR #97 可開啟；支援 20MB 內 PDF／JPG／PNG／WebP 私人 R2 直傳與單次 OCR，也支援整本 PDF 分批處理、人工核准與題庫草稿。題庫 contract 9/9、整本分割／服務／管理頁測試 6/6、Edge Function 語法與 production build 已通過。單次 OCR 流程保留給單一 Unit／圖片，完整課本改由每 10 頁一批的流程處理。

本次進行中（2026-09-03，尚未部署）：

- 教材 AI 口說題庫第一階段：分支 `codex/textbook-speaking-generator`，承接混合作業 V2 本機 checkpoint。新增 additive migration，保存私人教材來源 metadata、人工核准文字、版本化題庫、口說題目與具 request key 的生成工作；全部新表啟用 RLS，撤銷 `anon`／`authenticated` 直接存取，只允許後端 service role。新增 `speaking-content-manager`，第一版只允許管理員使用核准文字呼叫 AI，結果固定先存草稿；管理員工作台可選教材、Unit、頁碼、程度，貼入核准文字，產生 3～12 題，逐題修改並二次確認發布。題庫 contract 5/5、相關前端 9/9、混合作業 V2 contract 13/13、Edge Function 語法與 production build 已通過；同時修正前一 checkpoint 的學生 V2 作答結果作用域與物件括號錯誤。第一版未套用 migration、未部署 Edge Function／前端。
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
6. 未來規劃：2D 虛擬角色與外觀寶物商店，使用 AE Points 購買純外觀道具；目前僅記錄構想，尚未建立資料表、扣點流程或前端介面。
7. 未來規劃：Workbook 1 口說 Boss 合作關卡。初步方向為依教材前／後半本拆分 Boss，Boss 顯示已人工核對的教材單字，學生須在 5 秒內朗讀；優先評估 2～4 人非即時好友組隊、共同削減高血量 Boss，避免先引入即時連線與聊天室。
8. 上述遊戲功能開始前，需先確認教材頁碼與單字題庫、AE Points 原子扣點與庫存帳本、隊伍／戰鬥資料模型、未成年安全規則、語音 API 額度與成本，再另立功能分支及 additive migration；未授權前不部署或修改正式資料。

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

### P2 好友、戰績與社交競賽（第一階段本機完成，尚未部署）

2026-09-08 已在分支 `codex/p2-friends-profile`（基準 commit `401a78b`）完成第一階段本機實作：新增 additive migration、`student-social` Edge Function、好友與戰績頁、前端服務、路由及 Navbar 入口。尚未建立 checkpoint、Push、套用遠端 migration、部署 Edge Function 或部署 Netlify。

第一階段採用的安全規則：

1. 只允許有效方案的學生使用；Edge Function 驗證 Firebase ID Token，並重新查詢學生角色、帳號狀態及有效方案。
2. 學生先建立 2～20 字暱稱，系統另產生不可推測的 `AE-XXXXXXXX` 好友碼；搜尋只接受完整暱稱或完整好友碼，不提供模糊列舉。
3. 好友邀請需由對方接受；支援拒絕、刪除好友、封鎖、解除封鎖及檢舉。封鎖會立即移除既有好友關係。
4. 對好友只顯示暱稱、粗略在線狀態、等級與總 XP；不顯示 Email、班級、生日、家長資料或精確登入時間。戰績與在線狀態皆可改為不公開。
5. 在線狀態由登入後全站 Navbar 每 60 秒更新，對外只顯示「在線／最近在線／離線／未公開」。
6. 搜尋每 15 分鐘最多 30 次、好友邀請每小時最多 5 次、檢舉每日最多 3 次；敏感操作寫入後端稽核表。

本機驗證：好友服務與頁面測試、Navbar 測試、社交安全契約 4/4、Edge Function 語法檢查及 Production build 均通過；完整前端為 53 suites／178 tests 通過。尚未以兩個真實學生帳號驗證邀請、在線狀態、封鎖與跨帳號隱私。

最新本機修正：搜尋結果新增直接「封鎖」入口，避免學生必須先成為好友才可保護自己；已補上 UI 測試，尚未推送或部署。

下一步：驗證搜尋結果封鎖後，再由使用者決定是否 Push、部署測試站，最後才評估建立 PR、合併 `main` 與部署正式網站。檢舉與隱私切換可在取得獨立雲端資料異動授權後補做。PK 賽與合作型比賽仍留在第二、三階段，不在本次範圍。

第一階段「好友與戰績」已包含：

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

第一階段已固定完整暱稱／好友碼搜尋、安全戰績欄位、雙向邀請、封鎖、檢舉、頻率限制、additive migration、RLS 與 Firebase Token 驗證 Edge Function；前端不能直接讀取所有學生資料。PK 採非同步或即時、計分與獎勵、合作賽組隊限制，以及老師／家長介入方式，留待第二階段開始前確認。

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

## 本次完成（2026-09-16，手機側欄退場方向修正，已部署）

- 修正手機右側功能選單在按關閉或選擇頁面後，退場途中短暫切換為底部抽屜、造成畫面向下縮的問題。側欄現在會維持原本的右側定位直到退場動畫完成，再清除目前選單內容；教材與開口說的底部選擇面板仍維持原有方向。新增 Navbar 回歸測試，確認右側選單關閉期間的 `placement` 不會改變。相關 React 16/16、Production build、release deploy preflight 與 `git diff --check` 已通過；Netlify 正式 deploy `6aaa88486aa71b776fd8408b` 已就緒，正式網域與唯一部署網址皆回傳 `main.c14ed986.js`。本批沒有 migration 或 Edge Function 變更。

## 本次完成（2026-09-16，手機導覽與智慧複習暖載入，已部署）

- 依手機實機錄影確認，Navbar 收合與路由切換約在 0.1～0.2 秒內完成；主要等待來自智慧複習頁的個人化資料請求。手機抽屜現在會先開始收合再切換頁面，開啟「更多」時會預先下載智慧複習頁面程式碼並暖載入學生複習摘要；45 秒記憶體快取會共用同一請求，答題後立即失效，未把個人資料寫死到前端。React 15/15、Production build、release preflight 與 `git diff --check` 通過；功能 commit `2ea23b7` 已推送 `feature/mobile-navigation-performance`。Netlify 正式 deploy `6aaa5a4672094a3fd0c664e2` 已就緒，正式網域與唯一部署網址皆回傳 `main.935090f4.js`。本批沒有 migration 或 Edge Function 變更。

## 本次完成（2026-09-16，學生手機導覽低延遲改版，已部署）

- 手機／平板頂欄改為 Logo、通知與右側功能選單，底欄改為排行榜、教材、開口說與學生頭像；頭像直達我的設定。電腦版保留排行榜、我的教材、開口說及學習功能，右側頭像直達設定並保留登出。修正觸控 click 未提供 `button` 時可能退回瀏覽器整頁載入、導致 AuthProvider 重建及「正在確認登入狀態」畫面的問題；新增站內路由回歸測試。相關 React 16/16、Production build 與 `git diff --check` 通過；正式站 deploy `6aaa625d783a0e66d4618c27` 與固定測試站 deploy `6aaa618b466ab155d35b20d4` 已就緒，兩站皆提供 `main.aad38ac0.js`／`main.aa3bd326.css`。沒有 migration 或 Edge Function 變更；登入後手機實機手感仍待使用者驗收。
## 本次完成（2026-09-14，學生口說固定順序闖關，已部署）

- 學生口說大挑戰固定順序與角色預覽：學生列表改依教材關卡編號排序，完成前一關才會開啟下一關；前端鎖定卡與 `speaking-challenge` 後端網址保護一致，不能透過直接網址跳關。老師／管理員可從 Navbar 的「口說大挑戰預覽」唯讀開啟全部已發布關卡，不會寫入進度或獎勵。手機版口說列表與詳細頁收起 Logo Header，縮小頂部留白；A–Z 介紹頁在超過手機寬度時也採 5 欄大卡片，字級提高至 34–48px，手機版既有 5 欄與尺寸不變。學生專用 Navbar 在 `1100px`（包含 iPad Pro 13 的 `1032px` CSS viewport）以下改用精簡頂欄與底部四入口，避免完整桌面選單截斷帳號控制項；寬螢幕仍維持完整桌面導覽。功能 commit `62ec3c8` 已推送 `feature/speaking-challenge-progression`，stacked PR #127 已更新；Production build 與 `git diff --check` 均成功。共用 Supabase `speaking-challenge` 已部署；正式站 deploy `6aa81e7089018100ccffaa7f` 已就緒，正式 CSS 確認含新版 `max-width:1100px` 規則。本批沒有 migration，固定測試站沒有再次部署。

## 本次完成（2026-09-15，Workbook 1 口說列表分區，已部署）

- 學生口說列表改在每本教材內分為「入門準備」、「課本練習」及「主題練習」；隱藏 `P14`、`02` 等內部題庫前綴，名稱旁以精確 `source_pages` 顯示「配合第幾頁」。A–Z 保持第一關；課本練習按實際頁碼排序並逐關解鎖；三個跨頁主題在完成入門後可自由開啟，不會阻擋課本頁序。管理員題庫原始名稱與來源資料不變，沒有 migration 或資料更新。React 17/17、progression contract 5/5、Edge Function syntax／Speaking contracts、Production build 與 `git diff --check` 已通過；共用 Supabase `speaking-challenge` v24 為 ACTIVE，Netlify 正式 deploy `6aa826c655d8dd39a2b60728` 已發布，正式站 JS／CSS hash 與本次 build 一致。固定測試站未重新部署，P21／P22 仍未發布。

## 本次完成（2026-09-15，口說大挑戰遊戲規則，已部署）

- 學生口說大挑戰列表上方新增兒童易讀的三步驟遊戲規則：「選一關、看題目、開口說」，並說明通關打勾、下一關解鎖與主題練習自由選擇。規則只顯示於學生列表，老師／管理員唯讀預覽不重複顯示；沒有修改判分、麥克風、Firebase、membership、entitlement、migration 或 Edge Function。相關 React 18/18、Production build 與 `git diff --check` 已通過；Netlify 正式 deploy `6aa892f3697a3b5b9ae0521e` 已發布，正式站 JS／CSS hash 與本次 build 一致，線上 JS 已確認包含遊戲規則標記。

## 進行中（2026-09-15，口說大挑戰互動與教材層級）

- 將口說大挑戰改為教材第一層、關卡第二層，並以獨立教材網址支援返回操作；學生所有口說頁隱藏浮動「今日作業」，Navbar 的作業入口維持。非 A–Z 題目改為明確啟用麥克風後立即收音、聲音偵測光暈及送出評分；A–Z 自動收音流程不變。關卡資訊列和通關畫面會只使用伺服器回傳的實際獎勵資料，不在前端自行發放 XP。尚未完成測試、build、push 或部署。

## 歷史進行中（2026-09-14，Navbar 角色入口稽核完成，尚未部署）

- 學生／老師／管理員 Navbar 角色稽核：學生桌面版補上右上角明確「登出」按鈕，保留頭像直達「我的設定」；學生手機版仍在「更多」抽屜提供登出。老師與管理員的桌面帳號選單及手機選單原本都已有登出，本次不改其權限或入口。待相關 React 測試、production build 與 diff check 通過後再推送分支。

## 歷史進行中（2026-09-09，測試站已部署，正式尚未部署）

- 公開教材停售與方案文案統一：公開教材包、平台月費與 AI 加購都已在前端關閉新的購物車／結帳入口；首頁、教材頁與商城改為明確說明「教材包暫未販售」、「公開付款暫停」。公開規劃改為平台 NT$299／月、AI 教材與發音練習加購 NT$299／月；英文班內部方案與費用不公開在網站。未來實體教材恢復販售時，預定以同一個已驗證 Email 領取 90 天網站使用權，但本批不啟用銷售或領取流程。測試 Supabase 已套用並登記 `20260909100000_pause_public_sales_and_update_membership_pricing.sql`，只更新四個方案設定、不變更既有教材包或訂單；`billing-manager` 與 `store-commerce` 已部署停售防護，三種新付款入口的無身分請求皆正確回傳 503。固定測試站公開路由驗收通過；尚待提交、推送、合併與正式部署。

## 本次完成（2026-09-17，手機 Offcanvas 順暢收合，已部署）

- 公開、學生、老師與管理員手機側欄的站內連結改為先關閉 Offcanvas，等 React Bootstrap `onExited` 確認退出動畫完成後才執行 SPA 導覽；避免路由先切換、側欄卡住或直接消失。全站 BrowserRouter 啟用 `v7_startTransition`，lazy 頁面載入期間保留目前 Navbar 與已顯示內容，不再以全頁「頁面載入中」取代整個 App Shell。新增學生 lazy route、學生側欄與管理端側欄的導覽時序測試；相關 React 17/17、Production build 與 `git diff --check` 通過。412×915 本機登入學生流程已確認點擊後先留在原網址、退出完成才進入新網址，且沒有顯示全頁載入 fallback；瀏覽器驗收環境啟用 reduced motion，因此實際 300ms 動畫視覺仍須在一般手機設定下複驗。PR #159 已合併至正式 `main` commit `2ad1caf`；Netlify production deploy `6aab6eb1ea89a7cb2b8be06d` 已 live，正式網域回應 200 並載入 `main.63e4809e.js`。正式站 412×915 管理員流程確認側欄退出前網址維持原頁、退出後進入報告頁、Navbar 全程存在且沒有全頁 fallback；Console 沒有本次正式站錯誤。本批沒有 migration、Edge Function、權限或資料異動。
