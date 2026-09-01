# Alan English — Codex 開發規範

本文件是 Alan English 專案的永久開發規則。

Codex 開始任何任務前必須先閱讀本文件，但不要因此掃描整個專案。
目前產品、角色、權限與跨功能邏輯應記錄在根目錄：

```text
PROJECT_LOGIC.md
```

會持續變動的開發進度、已完成項目及下一步，應記錄在：

```text
docs/PROJECT_STATUS.md
```

如果該檔案不存在，先告知使用者，不要自行猜測目前進度。

## 1. 專案定位

Alan English 是專為國小學生設計的英文學習平台。

核心功能包括：

- 分級英文教材
- 教材聽力音檔
- AI 選擇題教材
- 情境式英文會話
- 學習進度與複習
- 英文班班級作業
- 教材購買與開通
- 會員與訂閱權限
- 老師及管理員後台

正式網站：<https://alanenglish.com.tw>

GitHub Repository：<https://github.com/hi4u44r306/AlanEnglish>

## 2. 技術架構

前端主要使用：

- React
- Redux
- React Router
- SCSS
- react-h5-audio-player
- Firebase Authentication

後端主要使用：

- Supabase PostgreSQL
- Supabase Edge Functions
- Cloudflare R2
- Firebase Authentication

部署服務：

- GitHub
- Netlify

正式部署分支：`main`

## 3. 永久架構規則

### 3.1 身分驗證

- Firebase Authentication 必須保留。
- 不得擅自改成 Supabase Auth。
- Firebase 負責 Email／密碼登入及登入狀態。
- Firebase UID 必須對應 Supabase `students` 資料。
- Firebase session persistence 必須保留。
- 使用者除非主動登出或 session 失效，重新開啟網站後應保持登入。

### 3.2 Supabase

- Supabase 負責資料庫、權限、學習紀錄及 Edge Functions。
- 前端只能使用公開的 Supabase Anon Key。
- `SUPABASE_SERVICE_ROLE_KEY` 只能存在 Supabase Edge Function Secret。
- Service Role Key 不得出現在 React 程式、Git、Console、錯誤訊息或文件。
- Edge Function 必須驗證 Firebase ID Token。
- 不得直接信任前端傳入的 `role`、`student_id`、`learner_type` 或班級。
- Edge Function 必須重新從資料庫確認使用者身分與權限。
- 前端隱藏功能不等於安全，後端也必須拒絕未授權請求。

### 3.3 Cloudflare R2

- R2 音檔維持私有。
- 音檔使用短效預簽網址播放。
- 不得公開 R2 Access Key 或 Secret Key。
- 必須保留 HTTP Range Request。
- 不得破壞音檔時間軸、續播及分段載入。
- R2 CORS 必須允許正式網域。
- 在確認 R2 音檔與資料完整前，不得刪除任何備份來源。

## 4. 使用者角色與學生類型

系統角色固定為：

- `student`
- `teacher`
- `admin`

不得重新使用 `class === "Teacher"` 的舊判斷。

學生類型固定為：

- `academy_student`：英文班學生
- `textbook_customer`：網路教材購買者
- `trial_user`：七天試用者

英文班班級固定為：

- E1
- E3
- E5
- E7

不得自行新增 E2、E4、E6、E8 作為年度升班結果。

學生每年可能升級、維持原班或降級。分班必須由老師或管理員決定，不可以只依年份自動變更。

## 5. 會員與教材權限

會員權限必須採取疊加式權限，不同來源不能互相覆蓋。

可能同時存在的權限包括：

- 英文班在學權限
- 自行購買教材權限
- 七天試用權限
- 一般會員訂閱
- 離校學生訂閱
- 管理員手動贈送
- 開通碼兌換權限

必須遵守：

- 兌換開通碼不得覆蓋原本英文班資料。
- 英文班學生購買的教材不能因退班而消失。
- 學生退班後保留帳號與歷史學習紀錄。
- 權限到期後鎖定內容，但保留進度。
- 不得因會員到期刪除學習紀錄。
- 不得只用 `class = null` 判斷網購者。
- 教材權限必須由後端判斷。

## 6. 商業方案規則

### 七天試用者

- 免費試用七天。
- 目前不需要信用卡。
- 七天內最多生成七次 AI 教材，每日最多兩次。
- 使用獨立的引導式試用內容。
- 不假設試用者擁有實體教材。
- 不得看到英文班作業。

### 網路教材購買者

- 購買教材後永久保留教材擁有權，另取得自兌換日起 90 天網站使用權；90 天不自動續費。
- 權限從兌換日開始計算。
- 只能看到自己購買或取得權限的教材。
- 90 天後可選擇每月 NT$299 延續已擁有教材的網站功能；基本會員不含新教材且不解鎖下一級。
- 不得收到英文班作業。

### 英文班在校學生

- 在校期間免費使用網站。
- 可以使用班級教材及班級作業。
- 英文班月費目前為 NT$2,800。
- 學生班級為 E1、E3、E5、E7。

### 英文班離校學生

- 保留原有學習紀錄。
- 不再收到新的班級作業。
- 可用每月 NT$299 繼續自主學習。
- 自行購買的教材權限不能消失。

### AI 教材與發音練習

- 現行名稱固定為「AI 教材與發音練習」，月費 NT$499。
- 在校生可直接加購；一般會員與離校生須同時具有 NT$299 基本會員，合計 NT$798／月。
- 舊版全功能或聽力月方案只供歷史資料相容，不得再顯示為現行商品、產生啟用碼或贈送給新帳號。

如果使用者之後更改定價，應同步更新：公開首頁、方案比較、商品資料、Stripe 商品或價格、會員方案、FAQ 與會員條款。不要只修改前端顯示文字。

## 7. 作業權限規則

作業只屬於有效在學的英文班學生。

基本條件：

```text
learner_type = academy_student
enrollment_status = active
student_class = assignment_target_class
```

必須遵守：

- 發布作業必須選擇 E1、E3、E5 或 E7。
- 不允許空白班級代表全部學生。
- 網購者不能讀取作業。
- 七天試用者不能讀取作業。
- 網購者與試用者 Navbar 不顯示作業入口。
- 學生轉班後只看到新班級作業。
- 老師只能處理被授權的班級。
- 管理員可以查看全部班級。
- Edge Function 必須再次驗證作業權限。

## 8. 聽力播放與完成規則

學生真正聆聽音檔至少 80% 才能算一次有效聆聽。

不得使用以下不安全方式：

- 只依 `ended` 事件增加次數。
- 只依目前時間除以音檔長度計算。
- 直接相信前端傳來的完成百分比。
- 拖曳到結尾就算完成。
- 重複播放同一小段就算完整聆聽。

正確方向：

- 記錄學生真正播放經過的不重複音檔區段。
- 拖曳只改變播放位置，不增加真正聆聽覆蓋率。
- 暫停時停止累計。
- 覆蓋率達到 80% 後才送出有效完成。
- 同一播放工作階段不得重複增加次數。
- 後端必須驗證播放時間、音檔長度與工作階段。
- 管理員與老師播放不計入學生學習次數。
- 只有 `role === "student"` 才寫入正式播放統計。
- 既有 noInteraction 防自動掛機機制必須保留。

播放器不得自由拖曳到畫面外，並且：

- 不遮住 Navbar。
- 不遮住手機 Sidebar。
- 不遮住今日作業或發布作業按鈕。
- 支援 iPhone safe area。
- 作業頁可使用固定位置的迷你播放器。
- Sidebar 的 z-index 必須高於播放器。

## 9. 字幕與逐字稿規則

字幕不是永久顯示。

建議學習流程：

1. 第一次播放不顯示字幕。
2. 第二次可以顯示英文字幕。
3. 需要時顯示中文提示。
4. 最後可以查看完整逐字稿。
5. 再關閉字幕重新練習。

音檔可能具有：

- `transcript_en`
- `transcript_zh`
- `subtitle_cues`
- `subtitle_status`

沒有字幕資料時，不得顯示無作用的字幕按鈕。

## 10. UI 與 RWD 規則

Alan English 的主要視覺：

- 深藍
- 品牌藍
- 黃色
- 白色
- 淺灰藍背景

設計原則：

- 適合國小學生，但不能過度幼稚。
- 家長看到時要有專業感。
- 使用清楚的資訊層級。
- 使用圓角卡片與柔和陰影。
- 手機版優先。
- 避免手機標題過大。
- 避免文字擠在同一行。
- 互動按鈕觸控範圍至少約 44px。
- 桌面版 Navbar 維持在畫面頂部。
- 手機版使用漢堡選單與側邊 Sidebar。
- Sidebar 開啟時鎖定背景捲動。
- Sidebar 可以透過 X、遮罩或返回操作關閉。
- 公開首頁與登入後頁面的 Sidebar 必須保持一致風格。
- Navbar、Sidebar、MusicPlayer 和浮動按鈕不得重疊。
- 必須考慮 iPhone safe area。
- 重要功能需要基本鍵盤與螢幕閱讀器支援。

不要只修桌面版而忽略手機版。

## 11. 程式碼閱讀規則

Codex 不得每次重新掃描整個專案。

開始任務時：

1. 先讀本文件。
2. 查看 `PROJECT_LOGIC.md`。
3. 查看 `docs/PROJECT_STATUS.md`。
4. 查看 `git status --short`。
5. 使用 `rg` 或 `rg --files` 找到相關檔案。
6. 只開啟與目前任務直接相關的檔案。
7. 先列出預計修改範圍。
8. 再開始實作。

預設不要讀取：

```text
node_modules/
build/
.git/
coverage/
```

除非任務直接相關，否則不要：

- 重讀全部舊 migrations。
- 打開所有 Edge Functions。
- 掃描所有圖片及音檔。
- 讀取整個 Git 歷史。
- 重新分析已完成的無關功能。
- 執行全專案格式化。

大型檔案應先使用 `rg`、`sed` 或局部檢視，只讀取相關區段。

## 12. 本機修改規則

如果使用者明確要求實作或修正本機程式碼，可以在目前授權範圍內修改。

修改時：

- 優先使用小範圍修改。
- 優先使用 `apply_patch`。
- 不要重寫整個大型檔案，除非確實必要。
- 保留既有程式風格。
- 不修改與目前任務無關的程式。
- 不刪除看似無關但用途尚未確認的程式。
- 不擅自升級套件。
- 不擅自修改 lockfile。
- 不把一次性修正腳本提交到 Git，除非專案需要保留。
- 保留使用者尚未提交的變更。

如果工作目錄不乾淨：

- 先查看變更。
- 不得覆蓋或丟棄使用者的修改。
- 如果會與目前任務衝突，停止並詢問使用者。

## 13. Git 與 GitHub 規則

開始開發前確認：

```bash
git branch --show-current
git status --short
```

開發原則：

- 不直接在 `main` 修改。
- 每個功能使用獨立分支。
- 分支名稱應清楚，例如 `feature/listening-coverage`、`feature/guided-trial` 或 `fix/mobile-player-overlap`。

下列測試環境操作已取得專案擁有者的持續授權，可以在完成相應測試後直接執行，不需每次再次詢問：

- 在明確的功能／測試分支建立 commit 並 Push 到 GitHub。
- 將已通過測試的功能部署至固定測試站 `alanenglish-student-test.netlify.app`。
- 測試站操作不得合併或直接修改 `main`，不得影響正式網域或正式付款資料。

在執行以下正式或高影響外部操作前，仍必須取得使用者明確同意：

- 建立 Pull Request
- 修改 Pull Request
- 合併 Pull Request
- 直接 Push 到 `main`
- 刪除遠端分支
- 部署 Netlify 正式站或將正式網域指向新部署
- 修改 Firebase 設定
- 修改 Cloudflare 設定
- 執行遠端 Supabase migration
- 部署 Supabase Edge Function

禁止使用：

```bash
git reset --hard
git checkout -- .
git clean -fd
```

除非使用者明確要求並理解資料可能遺失。不得為了方便直接覆蓋使用者變更。

## 14. Supabase Migration 規則

資料庫修改必須建立新的 additive migration。

必須遵守：

- 不直接修改已經在遠端執行的 migration。
- 建立資料表時考慮主鍵、外鍵、索引、RLS 及時間欄位。
- 外鍵欄位應評估是否需要索引。
- Migration 儘量具有安全檢查。
- 不在未確認歷史前執行大量 `db push`。
- 不使用 `supabase db reset` 處理正式資料庫。
- `migration repair` 只能在 SQL 已實際執行、但 migration history 缺少時使用。
- 執行遠端 SQL 前先提供影響範圍、風險及回復方式。
- 正式資料不得因 migration 被清除或重新建立。

## 15. Secret 與個資規則

不得讀取、輸出、複製、提交或記錄：

- `.env`
- Firebase Server API Key
- Firebase Service Account
- Supabase Service Role Key
- Cloudflare R2 Access Key
- Cloudflare R2 Secret Key
- Stripe Secret Key
- Stripe Webhook Secret
- 學生明文密碼
- 家長個資
- 未經遮蔽的學生資料

若搜尋結果包含 Secret，禁止在回覆中顯示。

建立學生臨時密碼時：

- 只在必要時顯示一次。
- 不在 Console 長期記錄。
- 不寫入 Git。
- 不永久保存明文密碼。

## 16. 測試與驗收規則

修改完成後至少執行：

```bash
git status --short
git diff --check
npm run build
```

如果專案具有相關測試，也要執行與修改範圍相符的測試。

需要依任務檢查：

- Chrome 桌面版
- 約 412px 寬度手機版
- iPhone Safari safe area
- 固定 Navbar
- Sidebar 開啟與關閉
- 背景捲動鎖定
- MusicPlayer 播放與暫停
- 切換上一首與下一首
- 音檔時間軸
- R2 Range Request
- Firebase 登入狀態
- 學生、老師、管理員權限
- 英文班、網購及試用者權限
- 作業隔離
- 瀏覽器 Console
- Production build

不要把 LF 將轉成 CRLF、Browserslist 資料過期或 Node deprecation warning 直接當成 build 失敗，但仍必須確認沒有真正的編譯錯誤。

### 16.1 測試站完成後的正式站發布閘門

當一批功能已在測試站完成驗收後，必須立即進入正式站升級流程，不得直接開始下一個新功能。

必須遵守：

- 先明確告知使用者「測試站已驗收，但正式站尚未更新」，並將正式站更新列為唯一優先任務。
- 在正式站尚未與已驗收測試版本同步前，拒絕實作新的產品功能；只允許處理會阻擋合併、部署或正式驗收的修正。
- 依序確認測試分支／commit、與最新 `main` 的差異、migration、Edge Function、Secret 名稱狀態、GitHub PR、Netlify production 及正式網址實測。
- Push、建立或修改 PR、合併、migration、Edge Function 與 Netlify 部署仍須依第 13、14 節取得使用者明確同意；尚未取得同意時，必須停在安全 checkpoint 並持續提醒，不得以新功能繞過發布工作。
- 只有在正式站部署成功、線上驗收通過並更新 `docs/PROJECT_STATUS.md` 後，才能開始下一個新功能。
- 若使用者確定不要發布，必須由使用者明確修改或撤回本規則；單純提出下一個功能不視為撤回。

## 17. 完成標準

功能只有在以下條件都完成時才能回報完成：

- 要求的功能已實作。
- 沒有修改無關功能。
- Build 成功。
- 相關測試成功。
- 已檢查 Git diff。
- 沒有提交 Secret。
- 手機版沒有明顯重疊。
- 權限在前端及後端都正確。
- 已說明尚未完成或無法測試的部分。

不要只因為程式碼已寫入就宣稱完成。

## 18. 回覆方式

- 使用繁體中文。
- 先說結論。
- 說明目前正在做什麼。
- 不要反覆重述整個專案。
- 不要貼出與目前任務無關的內容。
- 如果可以直接安全完成，就直接完成。
- 測試分支 Push 與固定測試站部署可依第 13 節直接執行；正式站、正式資料或其他高風險操作仍須先詢問。
- 不要要求使用者重複提供已存在於 Repository 的程式碼。
- 不要讓使用者逐步貼出大量檔案，優先直接讀取 Repository。
- 不確定時先唯讀檢查，再提出證據。

完成後只回報：

1. 修改的檔案
2. 完成的功能
3. 測試結果
4. 尚未完成或無法驗證的部分
5. 下一步建議

## 19. 任務範圍控制

每個對話只處理一個明確成果。

如果任務很大：

1. 先進行唯讀檢查。
2. 列出最小可行階段。
3. 一次完成一個階段。
4. 每階段完成後建立 Git checkpoint。
5. 更新 `docs/PROJECT_STATUS.md`。
6. 再開始下一階段。

不得把 MusicPlayer、CSV 匯入、Stripe 付款、商品頁、AI 教材、資料庫重構與全站 UI 重寫等不相關工作放在同一批修改，除非使用者明確要求合併處理。

## 20. 專案狀態文件

最新進度應記錄於：

```text
docs/PROJECT_STATUS.md
```

該文件應包含：

- 最後更新日期
- 目前分支或基準 commit
- 已完成功能
- 進行中功能
- 已知問題
- 下一個優先任務
- 相關檔案
- 測試狀態
- 尚未部署的修改

每次任務完成後只進行簡短增量更新。

不要在 `AGENTS.md` 記錄每次 commit、每次 PR、暫時性錯誤、單次測試結果或容易改變的開發進度。這些內容應放在 `docs/PROJECT_STATUS.md`，避免 Codex 每次工作都重讀大量過期資訊。

## 21. 網站使用手冊

學生、老師、管理員與家長使用的正式文字母檔為：

```text
docs/網站使用手冊.md
```

新增功能、調整操作流程、頁面名稱、角色權限、方案價格、使用額度或錯誤處理時，必須在同一批修改中同步更新該手冊。更新至少包含：

- 受影響角色的操作步驟。
- 權限、限制、價格或額度說明。
- 圖片／影片素材編號及製作狀態。
- 常見問題或排錯方式。
- 文件日期、版本與版本紀錄。

功能尚未部署時要明確標示「尚未部署」。手冊及教學素材不得包含 Secret、密碼、復原碼、付款資料或未遮蔽的學生個資。
