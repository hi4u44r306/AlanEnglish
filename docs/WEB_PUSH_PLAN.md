# Alan English Web Push 規劃

日期：2026-09-26。狀態：正式 migration、Secret、三支 Function 與 Cloudflare 前端已部署；iOS／Android 實機推播待驗收。

## 2026-09-26 實作進度與發布條件

- `codex/web-push-ios-android` 已加入獨立 Service Worker、通知頁裝置開關、登出解除訂閱、Firebase 驗證的 `web-push-manager`、訂閱與發送佇列 migration。新班級作業發布完成後會產生站內通知；既有教材附贈使用權到期提醒也會入推播佇列。社交、獎勵、付款失敗及訂閱扣款不推播。
- 正式入口建議使用 `https://alanenglish.com.tw` 加入主畫面；`app.alanenglish.com.tw` 是不同來源，若從該站安裝，會有獨立的瀏覽器訂閱。兩者不會共用通知權限。VAPID 公私鑰必須為同一組，`WEB_PUSH_VAPID_PUBLIC_KEY`、`WEB_PUSH_VAPID_PRIVATE_KEY`、`WEB_PUSH_VAPID_SUBJECT` 與 `WEB_PUSH_ENABLED=true` 只設定於 Edge Function Secret；不得寫入 Git。Public key 由已驗證的 Function 回傳。
- 現有家長排程每小時第 5 分鐘執行一次，`notification-manager` 的 `run_due` 會呼叫 `web-push-manager` 處理最多 20 筆。晚上 21:00～08:00（台北時間）不發送，每裝置每天最多三則；佇列可能要等到下一次排程，通知不保證即時。新作業若超過 20 位訂閱者，後續批次會逐小時處理。
- 2026-09-26 使用者指定這批改在正式站測試。先完成本機 migration、權限、加密封包、相關測試與 Production build；再從已測試的最新 `main` 套用正式 migration、設定 VAPID Secret、部署三支 Function 與 Cloudflare 前端。先以測試帳號主動訂閱，確認實機通知後再邀請其他學生開啟。
- 回復方式：設 `WEB_PUSH_ENABLED=false` 立即停止新訂閱與發送，再回復前端及三個 Function 版本；保留訂閱與佇列表供稽核，不刪除站內通知。既有家長 Email 排程不依賴推播成功。
- 2026-09-26：嘗試建立 Supabase 開發分支時被目前方案拒絕（需 Pro），沒有建立分支或產生該分支費用。暫存 PGlite 已完成 migration 與權限的本機隔離驗證。依使用者本批指示，正式 migration 版本 `20260926071713_student_web_push`、VAPID Secret、三支 Function 與 Cloudflare Worker `e2769ea1-1ab6-48b2-839d-2bf950cf7c4f` 已發布；兩個正式網域 HTTP 200，未登入 Function 401／403，推播表 RLS 拒絕匿名與一般認證角色直接讀取。當時 0 筆訂閱與待送工作；未收到實機通知前不得宣稱推播已完成驗收。

## 現況與目標

- 學生已有 `student_notifications` 站內收件匣、未讀數、已讀操作及安全導頁；`notification_events` 為部分商務提醒保留去重事件，家長 Email 有獨立佇列。
- `public/manifest.json` 已採 `display: standalone` 並有穩定 `id`；Service Worker 與訂閱／發送佇列已上線，仍須由使用者在各裝置主動同意通知權限。
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

- 先在本機隔離資料庫驗證 migration、RLS 與事件去重；正式站上檢查 Firebase 身分綁定、跨帳號共用裝置登出、Function 403、失效 endpoint 與重試。使用者已針對本批指定直接在正式站測試；正式操作前仍須完成本機測試、影響及回復方式檢查。
- Android Chrome、iOS 16.4+ Safari 加入主畫面，皆實測授權、背景／鎖定狀態收件、點擊安全導頁、拒絕後指引、解除訂閱、重新登入與多裝置。實機測試包含 iPhone safe area 與 412px／平板寬度。
- 首批以測試帳號及測試事件驗證，不直接對正式學生群發；確認發送頻率與內容後，再分階段開啟正式通知類型。

官方技術依據：[Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)、[WebKit iOS 主畫面 Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)、[Google Web Push 訂閱流程](https://web.dev/articles/push-notifications-subscribing-a-user)、[Android Chrome Web App](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en-PH)、[Supabase Function Secret](https://supabase.com/docs/guides/functions/secrets)、[Supabase Function 排程](https://supabase.com/docs/guides/functions/schedule-functions)。
