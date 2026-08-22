# Alan English 專案狀態

最後更新：2026-08-22

正式網站：<https://alanenglish.com.tw>

GitHub：<https://github.com/hi4u44r306/AlanEnglish>

正式部署分支：`main`

> 本文件只記錄目前開發狀態。永久架構、安全與工作規則請閱讀根目錄 `AGENTS.md`。

## 1. 專案目前階段

Alan English 已從舊 React／Firebase 網站修復，進入 Firebase Authentication、Supabase、Cloudflare R2 與 Netlify 的產品化階段。

目前已完成：

- 基本登入與角色分流
- Firebase Auth 與 Supabase 學生資料對應
- 教材及音檔基本播放
- Cloudflare R2 私有音檔搬移
- 學生類型與疊加式會員權限
- 英文班分班週期
- 英文班學生帳號建立
- 公開產品首頁
- 會員方案展示
- 固定 Navbar
- 手機 Sidebar 第一版
- 作業頁固定迷你播放器

目前下一個主要開發方向：

1. MusicPlayer 新版介面
2. 真正聆聽覆蓋率
3. 聽滿 80% 才算一次
4. 防止拖曳時間軸作弊
5. 手機 Sidebar 與播放器重疊修正
6. 七天引導式試用內容

## 2. 目前正式版本

最近完成並合併：

- PR #9：固定 Navbar 與 iPhone 捲動修正
- PR #10：英文班學生帳號建立
- PR #11：公開產品首頁、方案版面、固定播放器與手機 Sidebar

目前已知的正式基準 commit：

```text
6a9c34dd67c5ede0f90b514e4287696f2ed339ca
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
- 每天最多五次 AI 教材
- 不提供英文班作業
- 尚需建立不依賴實體教材的七天引導內容

### 教材購買

- 購買教材後提供三個月線上權限
- 權限從兌換日開始
- 到期後可選擇每月 NT$399
- 教材最終售價尚未決定

### 英文班在校學生

- 在校期間免費使用網站
- 英文班月費目前為 NT$2,800
- 可以收到班級作業

### 英文班離校學生

- 保留歷史學習紀錄
- 不再收到新作業
- 可用每月 NT$299 繼續使用

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

手機版已有漢堡選單，但仍需要與登入後頁面的 Sidebar 進一步統一視覺及互動。

## 10. MusicPlayer 現況

目前播放器：

- 一般頁面固定在底部
- 部分作業頁使用固定迷你播放器
- 已移除容易拖出畫面外的自由拖曳位置記憶
- 作業捷徑會避開播放器
- 進入作業頁後會隱藏重複的浮動作業捷徑

仍需處理：

- 整體視覺不夠精緻
- 手機版空間配置
- Sidebar 開啟時播放器層級
- 真正聆聽百分比
- 80% 有效完成規則
- 時間軸防作弊
- 字幕與逐字稿
- 播放進度更直覺的提示

## 11. 下一個優先任務：MusicPlayer 與 80% 聆聽

### 目標

重新設計播放器，並將播放次數改成學生真正聆聽至少 80% 才算一次。

### 必須先唯讀檢查

Codex 應先定位並檢查：

```text
src/components/fragment/MusicPlayer.jsx
src/components/fragment/Containerfull.jsx
src/components/fragment/MusicCard.jsx
src/components/assets/scss/Containerfull.scss
```

並使用 `rg` 搜尋：

```text
recordTrackPlay
record-play
onEnded
onListen
onSeeked
musicplay
complete
noInteraction
```

只讀取搜尋到的直接相關檔案，不要掃描整個專案。

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

### 完成標準

- 播放器視覺符合首頁設計系統。
- 桌面版與手機版正常。
- Sidebar 不被播放器遮住。
- 拖曳不能作弊。
- 真正聽滿 80% 才增加一次。
- `npm run build` 成功。
- 相關角色與權限測試成功。

## 12. 後續待辦順序

### 2026-08-22 本機測試分支更新

- 分支：`feature/listening-coverage`
- MusicPlayer 已完成桌面橫向播放器與手機迷你／展開模式第一版。
- 手機展開播放器改為保留固定 Header 的下方播放頁，並修正時間軸容器溢出限制。
- 播放器視覺調整持續於本機測試：桌面採用置中淺色控制列；手機展開模式取消頂部圓角並將內容群組置中。
- 桌面控制列已改回 Flex 並移除 `.rhap_stacked` 預設上方間距，避免第三方播放器的堆疊樣式造成錯位。
- 此分支尚未合併 `main`，Supabase migration 與 Edge Function 也尚未部署。
- 驗證：`npm run build`、`git diff --check` 成功；仍需於實機手機瀏覽器確認 Header 高度與安全區。

完成播放器後，依序處理：

1. 七天引導式試用內容
2. 字幕與逐字稿資料結構
3. 作業權限最終隔離驗收
4. CSV 批次匯入英文班學生
5. 商品與教材權限
6. 開通碼綁定商品
7. 我的教材
8. 管理員教材權限後台
9. Stripe 付款及訂閱
10. 訂單 Email 與開通碼寄送
11. 退款、補發與帳號合併
12. 完整 Production 驗收

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

## 14. 下一個 Codex 對話建議提示詞

```text
請先閱讀根目錄 AGENTS.md 與 docs/PROJECT_STATUS.md。

本次只處理 MusicPlayer 與真正聆聽 80% 的規則。
請不要掃描整個專案，也不要修改其他會員、商品、付款或 CSV 功能。

請先唯讀檢查相關檔案，確認目前播放完成與 record-play 的實際流程。
完成後列出：
1. 現有流程
2. 可作弊的位置
3. 需要修改的檔案
4. 前端與後端的最小實作方案
5. 資料庫是否需要新增 migration
6. 測試方式

在我同意之前不要修改檔案、部署 Function、執行 migration、Push 或合併 PR。
```

## 15. 每次任務完成後如何更新本文件

只更新以下內容：

- 最後更新日期
- 正式基準 commit
- 本次完成功能
- 測試結果
- 已知問題
- 下一個優先任務
- 尚未部署內容

不要把完整對話、完整程式碼或大量終端機輸出貼進本文件。
