# Alan English Web Push 規劃

日期：2026-09-25。狀態：規劃完成，尚未實作或部署。

## 現況與目標

- 學生已有 `student_notifications` 站內收件匣、未讀數、已讀操作及安全導頁；`notification_events` 為部分商務提醒保留去重事件，家長 Email 有獨立佇列。
- `public/manifest.json` 已採 `display: standalone`，但尚無 Web Push 授權、訂閱、Service Worker 或發送佇列。
- 目標是讓使用者明確同意後，iOS 主畫面 Web App 與 Android Chrome Web App 在網站未開啟時，也能收到同一筆站內通知的系統提醒。站內收件匣仍是完整且可追溯的訊息來源。

## 使用者流程

1. 學生登入後，在「通知」頁看到「手機推播」設定；先說明會收到的類型與鎖定畫面可能顯示的內容。不能在首頁載入時直接彈出系統授權。
2. iOS 16.4+ 先引導使用 Safari「分享 → 加入主畫面」，再從主畫面圖示開啟並按「開啟推播」。Android Chrome 可從瀏覽器選單安裝 Web App；支援時也可由瀏覽器頁面訂閱。
3. 按鈕手勢中要求通知權限並建立 Push API 訂閱；成功後顯示目前裝置「已開啟」。權限拒絕、瀏覽器不支援或尚未加入 iOS 主畫面時，提供相應說明及系統設定指引。
4. 使用者可在通知頁關閉目前裝置推播；登出時解除此裝置與學生帳號的連結。站內通知與家長 Email 不受影響。其他裝置各自設定。
5. 點系統通知後，只能開啟同網域且已列入白名單的學生頁。若登入失效，先進登入流程，再導向該頁；不得把通知中的網址直接當作任意跳轉目標。

## 實作切分

### 第一階段：前端與裝置

- 為 manifest 加穩定的 `id`，確認正式入口網域與圖示；主站與 `app.` 子網域的訂閱屬於不同 origin，實作前選定單一主畫面入口。
- 增加只處理 `push`、`notificationclick` 的 Service Worker。先不攔截 `fetch` 或快取登入內容，避免改變教材權限與 R2 音檔載入。每筆 push 都顯示使用者可見通知。
- 通知設定頁偵測 `serviceWorker`、`PushManager`、`Notification` 與 `display-mode: standalone`。使用者按鈕觸發授權；以 VAPID 公鑰呼叫 `pushManager.subscribe()`。權限與訂閱狀態不能只靠本機布林值推測。
- 系統通知標題、內文及圖示以簡短、低敏感度內容為主；付款、學生個資與詳細作業內容留在登入後站內頁面。不要利用 Web Push 當靜默同步通道。

### 第二階段：後端與資料

- 建立 additive migration：裝置訂閱表儲存 `student_id`、endpoint、加密金鑰、瀏覽器／裝置標籤、建立與更新時間、停用時間；推播工作表以 `(student_notification_id, subscription_id)` 唯一鍵防重複，記錄排程、嘗試次數、狀態與最後錯誤類別。公開 schema 啟用 RLS，`anon`／`authenticated` 不直接存取；由驗證 Firebase ID Token 的 Edge Function 查出學生身分與權限。
- 在新增 `student_notifications` 時可靠地建立待送工作，沿用既有站內事件去重。沒有裝置訂閱時仍保留站內通知，不補發舊訊息。先盤點各通知生產者與事件類型，再決定資料庫 trigger 或同一個受控寫入流程，避免漏送社交或作業通知。
- VAPID 私鑰只放後端 Secret；公鑰可公開。發送服務從工作佇列讀取，使用標準 Web Push 加密格式送至訂閱 endpoint；可沿用既有排程入口，或由 Supabase Cron 定期呼叫受保護的發送 Function。對 404／410 停用失效訂閱；429／5xx 有限次退避重試；記錄 HTTP 類別與時間，不記錄金鑰或完整 endpoint。
- 訂閱、解除訂閱與發送函式各自限制呼叫者、來源與頻率；伺服器必須把訂閱綁到已驗證的 Firebase UID 對應學生，絕不接受前端自稱的 `student_id`。推播僅是提醒，點擊後仍由原有後端重新檢查教材、班級、作業與會員權限。

### 第三階段：通知策略

- 首批只開啟可行動且低頻的訊息，例如新班級作業與到期提醒。既有付款失敗、訂閱資訊繼續由家長 Email 承載，手機鎖定畫面只顯示「有一則帳號通知」之類的摘要。
- 預設不發社交、XP 或一般獎勵推播；待驗證兒童使用情境、頻率與家長期待後再決定。需要類型開關、夜間安靜時段與每日上限，避免打擾上課與睡眠。
- 站內已讀狀態由既有收件匣控制；系統推播成功不代表已讀，也不保證使用者已看見。推播失敗不阻止站內通知與家長 Email。

## 驗收與發布閘門

- 先在隔離測試環境驗證 migration、Firebase 身分綁定、跨帳號共用裝置登出、RLS／Function 403、重複事件、失效 endpoint 與重試。這批涉及正式資料與通知權限，執行正式 migration／Secret／Function 前需另行取得該批授權。
- Android Chrome、iOS 16.4+ Safari 加入主畫面，皆實測授權、背景／鎖定狀態收件、點擊安全導頁、拒絕後指引、解除訂閱、重新登入與多裝置。實機測試包含 iPhone safe area 與 412px／平板寬度。
- 首批以測試帳號及測試事件驗證，不直接對正式學生群發；確認發送頻率與內容後，再分階段開啟正式通知類型。

官方技術依據：[Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)、[WebKit iOS 主畫面 Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)、[Google Web Push 訂閱流程](https://web.dev/articles/push-notifications-subscribing-a-user)、[Android Chrome Web App](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en-PH)、[Supabase Function Secret](https://supabase.com/docs/guides/functions/secrets)、[Supabase Function 排程](https://supabase.com/docs/guides/functions/schedule-functions)。
