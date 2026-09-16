# QA Report

最後更新：2026-09-16
測試目標：`https://alanenglish.com.tw`
測試工具：Playwright 1.62.1、Chromium、axe-core 4.10.2
測試分支：`feature/full-site-qa-e2e`

## 測試摘要

- 自動化案例：107
- 通過：90
- 失敗：2
- 跳過：15（缺少 Student／Teacher／Admin 與 entitlement 專用 E2E 測試帳密）
- 視窗尺寸：375×667、390×844、430×932、768×1024、1024×768、1440×900
- 正式付款：未執行；正式站目前顯示教材包暫未開放販售。
- 資料異動：未建立帳號、未送出表單、未發布內容、未修改任何正式資料。

## 補充驗證：已登入學生流程（2026-09-16）

- 以專案擁有者提供的在校學生測試帳號執行 19 項 targeted Playwright 案例：9 通過、0 失敗、10 跳過。
- 已確認：登入、重新整理後 Firebase session 保留、登出、登出後受保護頁面導回登入、學生角色導向、Admin 路由拒絕後回學生排行榜、「更多」選單中的複習與我的作業入口、作業／學生資料／教材目錄 Edge Function 讀取，以及進入口說大挑戰列表不要求麥克風、不錄音也不寫入進度。
- 沒有觀察到上述流程的瀏覽器 runtime error。
- 限制：此帳號目錄內沒有未授權教材，無法用它驗證直接輸入未持有教材網址時的 403 邊界；Teacher、Admin、一般會員及離校生情境仍缺專用帳號，故相對應 10 項案例保持跳過。

## 補充驗證：管理員與會員權限（2026-09-16）

- 使用專案擁有者提供的管理員、一般會員與離校會員測試帳號，追加 7 項 targeted Playwright 案例：6 通過、0 失敗、1 跳過。
- 已確認：管理員登入與重整 session、管理員可由「音檔」選單進入教材連結管理、管理員可直接開啟授權頁面；一般會員與離校會員沒有「我的作業」入口，且後端拒絕讀取新作業；在校生仍只讀取其目前班級的作業。
- 一開始的管理員導覽失敗是舊測試假設「新增連結」直接顯示；實際產品把它放在「音檔」選單，更新測試後 3 項管理員案例皆通過，非產品問題。
- 限制：尚缺 Teacher 帳號，以及「方案已到期的離校會員」專用 fixture，後者的 1 項到期日情境維持跳過。

## Navigation Map

### 未登入

首頁 `/`
→ 登入 `/login`
→ 忘記密碼 `/forgot-password`
→ 免費試用 `/freetrial`
→ 教材音檔 `/links`
→ 教材目錄 `/materials`
→ 教材商城 `/shop`
→ 商城登入／註冊／驗證／忘記密碼
→ 聯絡客服 `/support`

### Student

排行榜／首頁
→ 我的教材
→ 今日作業（僅符合資格的在校生）
→ 智慧複習／每週報告
→ 口說大挑戰／發音教練／AI 教材
→ 獎品商城
→ 我的設定／通知／會員／帳號安全

### Teacher

管理首頁
→ 每週學習報告／班級排行榜
→ 作業管理
→ 帳號管理／建立學生
→ 班級教材設定
→ 音檔管理
→ 口說大挑戰預覽

### Admin

管理首頁
→ 帳號／CSV 匯入／班級教材
→ 作業／報告／排行榜
→ 音檔與連結管理
→ 教材 AI 口說題庫
→ 獎品、會員、商品包、商城訂單
→ 在校／離校、客服、API 成本、等級、教材導覽

## Critical

目前沒有確認到 Critical 產品問題。

## High

目前沒有確認到 High 產品問題。

> 驗證限制：登入成功、登出、登入狀態保留、角色導向、跨角色拒絕、學生播放進度、排行榜、作業、Profile、Admin 編輯等 15 項案例因本次環境未提供專用 E2E 帳號而跳過。這是 release coverage gap，不代表功能已通過或失敗。

## Medium

### QA-001

頁面：`/login`
Viewport：390×844
角色：未登入
問題：登入頁有 8 個文字或連結未達 WCAG 2 AA 對比度要求。
重現步驟：以 390×844 開啟 `/login`，執行 axe-core。
預期行為：一般文字至少達 4.5:1。
實際行為：包含 `WELCOME BACK`、登入說明、忘記密碼、啟用／復原／註冊／客服連結與版權文字；實測約 2.37:1～4.25:1。
Console error：無。
Screenshot：`test-results/accessibility-基本-Accessibi-39486-有-serious-或-critical-axe-違規-desktop-chromium/test-failed-1.png`
Trace：同一失敗案例資料夾內 `trace.zip`。
Video：同一失敗案例資料夾內 `video.webm`。
建議修正：加深灰藍與橘色文字，並以實際字級重新驗證 4.5:1。

### QA-002

頁面：`/`
Viewport：390×844
角色：未登入
問題：公開首頁有 8 個文字節點未達 WCAG 2 AA 對比度要求。
重現步驟：以 390×844 開啟首頁，執行 axe-core。
預期行為：一般文字至少達 4.5:1。
實際行為：示範卡片的輔助文字、方案備註與 Footer 等文字約 2.44:1～4.23:1。
Console error：無。
Screenshot：`test-results/accessibility-基本-Accessibility-沒有-serious-或-critical-axe-違規-desktop-chromium/test-failed-1.png`
Trace：同一失敗案例資料夾內 `trace.zip`。
Video：同一失敗案例資料夾內 `video.webm`。
建議修正：統一提高次要文字 token 的深度，避免小字使用低對比灰色。

### QA-003

頁面：`/` 的方案比較表
Viewport：390×844
角色：未登入
問題：方案比較表的可水平捲動容器無法使用鍵盤取得焦點。
重現步驟：以鍵盤 Tab 巡覽首頁，或執行 axe `scrollable-region-focusable`。
預期行為：鍵盤使用者能聚焦並水平捲動比較表。
實際行為：`.showcase-plan-table-wrap` 沒有 focusable content，也不是可聚焦元素。
Console error：無。
Screenshot：與 QA-002 相同。
建議修正：為容器加入合適的 `tabIndex="0"`、可存取名稱與可見 focus 樣式，或讓表格內具有可聚焦控制。

## Low

### QA-004

頁面：`/`
Viewport：375×667 至 1024×768
角色：未登入
問題：手機漢堡按鈕的可存取名稱為英文 `Toggle navigation`，但網站與視覺介面是繁體中文。
重現步驟：使用螢幕閱讀器或檢查 accessibility tree。
預期行為：朗讀「開啟選單」或「開啟導覽選單」。
實際行為：按鈕名稱為 `Toggle navigation`；圖片 alt 雖為「開啟選單」，未成為按鈕最終 accessible name。
Console error：無。
建議修正：在 `Navbar.Toggle` 明確加入中文 `aria-label`。

## Mobile / RWD

- 48 個頁面×尺寸 RWD 案例通過：首頁、登入、忘記密碼、客服、免費試用、教材、商城、教材音檔。
- 六種指定尺寸都未偵測到 document-level 水平溢位或空白頁。
- 375、390、430、768、1024 寬度的手機／平板選單可開啟、捲動至主要入口、以 ESC 關閉，登入入口可點擊。
- 主要手機 CTA 與選單按鈕觸控高度達 44px。
- 尚未驗證登入後 Student／Teacher／Admin 的手機 Navbar 與固定 MusicPlayer 疊層，原因為缺少 E2E 帳密。

## Navigation

- 公開 Navbar 的功能特色、學習方式、會員方案、常見問題、教材商城、登入與免費試用均可見、可點擊且 URL 正確。
- `/showcase`、`/solve` 與舊管理路由的重新導向正常。
- 未登入直接進入受保護路由會回到 `/login`。
- 未知網址會顯示正式 404，不是 blank page。
- 瀏覽器 Back 可由商城返回首頁。
- 既有測試曾使用已過時的首頁文案、hash 與 `/links` redirect 假設；已更新為目前正式站行為，避免假失敗。

## Console / Network

- 公開頁面、Navbar 導覽、新使用者試用入口、商城註冊說明與販售暫停頁均未觀察到 React uncaught exception、console.error、主要 document/script/stylesheet/image/font 4xx/5xx 或非預期 request failure。
- 錯誤帳密測試會產生預期的 Firebase validation/auth 失敗，不列為產品 Network bug。
- 登入後 Edge Function、教材播放、作業與管理頁 Network 尚未驗證。

## UX

- 免費試用入口、Email 驗證說明、商城帳號與學習平台帳號分流說明均可找到。
- 正式商城販售暫停時，結帳路由會清楚顯示暫停狀態且沒有 Stripe 付款按鈕，未誤導使用者付款。
- 目前最明顯的 UX 風險是低對比小字；對低視力使用者與戶外手機情境不友善。
- Mobile hamburger 的英文朗讀名稱會造成中文介面的認知不一致。

## 建議修正順序

1. 修正登入頁與公開首頁的文字對比度（QA-001、QA-002）。
2. 讓方案比較表可用鍵盤聚焦與捲動（QA-003）。
3. 將公開首頁漢堡按鈕 accessible name 改為中文（QA-004）。
4. 建立不含真實個資的 Student／Teacher／Admin／方案 E2E 專用帳號，再執行目前跳過的 15 項角色、權限與完整學習流程。
5. 下一輪補測登入後六種 viewport、MusicPlayer／Navbar／Modal 疊層、播放完成與排行榜更新；Stripe 僅在明確 test mode 下執行。
