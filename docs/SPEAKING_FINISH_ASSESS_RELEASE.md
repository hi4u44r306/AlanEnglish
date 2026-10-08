# 一般口說完成並評分發布清單

日期：2026-10-08。階段 6，基準 main 7fb83bf，分支 codex/speaking-finish-assess。狀態：本機已實作，隔離測試通過，待該批正式發布授權，尚未部署。

可審核 checkpoint：9182762，[草稿 PR #486](https://github.com/hi4u44r306/AlanEnglish/pull/486)。尚未合併 main，沒有觸發正式站部署。

## 使用者操作與邊界

- 句子、問答及逐字母拼字：開始錄音 → 完成並評分；保留先停止並回聽 → 手動送評。
- 結果可展開回聽同一 WAV；純回聽與 A–Z 自動錄音元件不變。
- 只有明確主要操作才接續送評；錄音上限／來源結束不自動送評。最後 dataavailable 在 stop 前完成，待 WAV 轉換後沿用評分服務。[MediaRecorder stop 文件](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/stop_event)
- 同步鎖防停止／送評連按；新停用原因、題目／回合／帳號／模式切換及離開取消尚未送出動作。送出的伺服器請求不宣稱可以取消。
- 技術問題保留音檔，只有手動重試才再次送評；後端額度阻擋、回合錯誤、保存等待與外層重試儲存維持。
- 不改服務、Firebase、教材權限、每日輪數、Azure 次數／用量、評分門檻、通關或獎勵；沒有 Function、migration、Secret 或正式資料變更。

## 隔離驗證

- Jest 使用 MediaRecorder／辨識／API 替身，未呼叫正式評分服務：錄音器、A–Z、PracticeSteps、服務參數及 WAV 五套案例先 86 項通過；補齊音效初始化異常回復及舊錄音延遲片段隔離後，最終錄音器 39 項通過，其餘四套 49 項及學習步驟 6 項，合計 94 案例。
- StudentNavbar 等前五階段無本批變更，不重跑無關全套。兩個應用檔 ESLint、SCSS 編譯、diff check 通過；補齊延遲片段隔離後的最終 production build、SEO 頁面及 Cloudflare 資產準備全部成功。
- 真實帳號、桌面／412px／iPhone 麥克風、音訊音量、保存及獎勵待驗。既有 Browser Use 保存權限無法驗證，未以其他自動化繞過。
- 15:57:45 台灣時間本機編譯的 247.4fab0ef3.chunk.js、247.c9139daf.chunk.css 包含主要操作／兩種回聽入口與鍵盤焦點標記。證據 output/speaking-finish-assess-local-build.json，只證明本機資產，未部署正式站。

## 正式操作閘門及回復

- 本批改變錄音完成觸發送評的時機，涉及核心錄音／評分事件及同步防重送。依 AGENTS §16.1 High Risk 與 §13.2，正式合併／部署前取得此批明確同意；先完成本機驗證與可審核 PR。
- 正式授權後合併最新 main，等待唯一 Cloudflare production build，核對主要操作／回聽／重試資產及關卡 SPA 路由，更新三份文件；HTTP 不代替真實錄音及進度驗收。
- 上線後請依上述兩種流程各測一次一般題，再測快速連按、服務失敗手動重試、到期／額度提示及 A–Z 原流程。請使用獲授權測試帳號；不要為了驗收大量上傳或修改學生資料。
- 如出現重複送評、權限或保存問題立即停止新功能，revert 此前端 PR 由 main 重新發布。沒有資料庫／Function 回復；已發生的原服務用量不會因前端回復自動歸零。

## 教學文件

手冊 v3.75 已同步並標記尚未部署；素材 SPEAKING-FINISH-ASSESS-01-D/M、SPEAKING-REPLAY-02-D/M 截圖／影片及真實裝置驗收待完成。
