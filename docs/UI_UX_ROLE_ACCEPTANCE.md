# Alan English UI／UX 導覽與角色驗收表

最後更新日期：2026-08-31

本文件搭配 `tests/e2e/` 的 Playwright 測試使用。自動測試負責攔截路由、重新導向、404、瀏覽器執行期錯誤及基本角色入口問題；真實學生、家長與工作人員的操作理解仍需依本表進行人工驗收。

## 1. 執行方式

首次安裝 Playwright Chromium：

```powershell
npx playwright install chromium
```

執行本機桌面版與 412px 等級手機版測試：

```powershell
npm run test:e2e
```

測試 Deploy Preview 或正式網址：

```powershell
$env:E2E_BASE_URL="https://example.netlify.app"
npm run test:e2e
Remove-Item Env:E2E_BASE_URL
```

公開頁與未登入路由測試不需要帳號。角色測試只有在提供對應環境變數時才執行：

```powershell
$env:E2E_STUDENT_IDENTIFIER="測試學生帳號"
$env:E2E_STUDENT_PASSWORD="測試密碼"
$env:E2E_TEACHER_IDENTIFIER="測試老師帳號"
$env:E2E_TEACHER_PASSWORD="測試密碼"
$env:E2E_ADMIN_IDENTIFIER="測試管理員帳號"
$env:E2E_ADMIN_PASSWORD="測試密碼"
npm run test:e2e
$testExitCode = $LASTEXITCODE
Remove-Item Env:E2E_STUDENT_IDENTIFIER, Env:E2E_STUDENT_PASSWORD
Remove-Item Env:E2E_TEACHER_IDENTIFIER, Env:E2E_TEACHER_PASSWORD
Remove-Item Env:E2E_ADMIN_IDENTIFIER, Env:E2E_ADMIN_PASSWORD
exit $testExitCode
```

帳密只能放在目前 Shell 的環境變數，不得寫入測試檔、`.env`、報告、Console 或 Git。測試結束後應移除這些環境變數。角色帳號必須是既有專用測試帳號；這套測試不會建立、修改或刪除學生資料。

三種學生方案的作業與教材權限測試使用共用測試密碼，但帳號分開注入：

```powershell
$env:E2E_BASE_URL="https://alanenglish.com.tw"
$env:E2E_BASIC_IDENTIFIER="一般會員測試帳號"
$env:E2E_ACADEMY_IDENTIFIER="在校生測試帳號"
$env:E2E_ALUMNI_IDENTIFIER="離校生測試帳號"
$env:E2E_EXPIRED_ALUMNI_IDENTIFIER="離校且方案已到期測試帳號"
$env:E2E_PLAN_PASSWORD="共用測試密碼"
# 僅在已建立可見測試作業時啟用，強制至少回傳一份在校生班級作業
$env:E2E_REQUIRE_ACADEMY_ASSIGNMENT="true"
npm run test:e2e:entitlements
$testExitCode = $LASTEXITCODE
Remove-Item Env:E2E_BASE_URL, Env:E2E_BASIC_IDENTIFIER
Remove-Item Env:E2E_ACADEMY_IDENTIFIER, Env:E2E_ALUMNI_IDENTIFIER
Remove-Item Env:E2E_EXPIRED_ALUMNI_IDENTIFIER
Remove-Item Env:E2E_PLAN_PASSWORD, Env:E2E_REQUIRE_ACADEMY_ASSIGNMENT
Remove-Item -Recurse -Force test-results -ErrorAction SilentlyContinue
exit $testExitCode
```

此組測試會直接驗證 Edge Function 回應：未授權作業不能只靠前端隱藏；直接輸入未取得教材的網址也必須回傳 `book_entitlement_required`。離校且方案已到期的帳號會另外驗證受保護學習頁導回會員中心、沒有今日作業入口、摘要顯示實際到期日而非「無期限」，且目前可用功能為 0／6。平時未建立可見測試作業時，仍會驗證在校生可安全呼叫作業服務，且所有回傳作業都符合目前班級；臨時 fixture 存在時設定 `E2E_REQUIRE_ACADEMY_ASSIGNMENT=true`，可額外強制至少回傳一份作業。有帳密的測試預設關閉 trace、截圖、影片及 HTML 報告，測試結束仍應清除 `test-results`。

## 2. 自動測試涵蓋範圍

| 編號 | 範圍 | 自動驗收結果 |
| --- | --- | --- |
| NAV-A01 | `/`、`/home`、登入、忘記密碼、客服、免費試用 | 頁面可開啟、有預期標題、沒有 404 |
| NAV-A02 | 公開頁面產生的站內連結 | 逐一開啟且不進入 404 |
| NAV-A03 | `/links`、`/showcase`、`/solve` 等舊網址 | 導向目前正式網址 |
| NAV-A04 | 學生、老師、管理員受保護路由 | 未登入一律回到 `/login` |
| NAV-A05 | 未知網址 | 顯示正式 404 頁面 |
| ROLE-A01 | 學生登入 | 學生入口存在，老師／管理入口不存在 |
| ROLE-A02 | 老師登入 | 老師入口存在，管理員專用入口不存在 |
| ROLE-A03 | 管理員登入 | 管理員入口存在，可進入管理員頁面 |
| ROLE-A04 | 直接輸入未授權網址 | 回到自己的角色首頁，不顯示未授權內容 |
| ENT-A01 | 一般會員／離校生作業 | 不顯示今日作業入口，後端不回傳新作業 |
| ENT-A02 | 在校生作業 | Edge Function 成功回傳，且每份作業都符合目前班級 |
| ENT-A03 | 離校歷史 | 狀態為離校，且 `enrollment_history` 仍有歷史紀錄 |
| ENT-A04 | 教材目錄 | 所有可開啟教材都具有有效 entitlement |
| ENT-A05 | 直接輸入未授權教材網址 | Edge Function 回傳 403，不提供教材與音檔資料 |
| ENT-A06 | 離校且方案已到期 | 學習頁導回會員中心，顯示實際到期日、已到期及 0／6，不顯示無期限 |
| RWD-A01 | 桌面 Chromium | 使用 1600×900 驗證桌面 Navbar |
| RWD-A02 | 手機 Chromium | 使用 Pixel 5 裝置設定驗證手機寬度 |

Playwright 的手機模式不是 iPhone Safari 實機，因此 safe area、鍵盤彈出、音檔背景播放及 Safari 行為仍須人工驗收。

## 3. 角色驗收表

狀態欄建議填寫：`通過`、`失敗`、`受阻`、`不適用`。失敗時記錄網址、角色、裝置、操作步驟、截圖與 Console 錯誤。

### 3.1 未登入訪客

| 編號 | 操作 | 預期結果 | 桌面 | 412px | iPhone Safari | 備註 |
| --- | --- | --- | --- | --- | --- | --- |
| VIS-01 | 從教材音檔頁前往首頁 | 到達 `/home`，沒有空白頁或 404 |  |  |  |  |
| VIS-02 | 從首頁前往登入與免費試用 | 入口名稱清楚，目標頁正確 |  |  |  |  |
| VIS-03 | 開啟受保護的學生網址 | 回到 `/login` |  |  |  |  |
| VIS-04 | 使用忘記密碼與客服入口 | 不需要登入即可看到表單 |  |  |  |  |
| VIS-05 | 使用瀏覽器上一頁／下一頁 | URL、頁面內容與捲動狀態合理 |  |  |  |  |

### 3.2 英文班在校學生

| 編號 | 操作 | 預期結果 | 桌面 | 412px | iPhone Safari | 備註 |
| --- | --- | --- | --- | --- | --- | --- |
| STD-01 | 登入後找到今天作業 | 僅有效在校生看到自己班級作業 |  |  |  |  |
| STD-02 | 開啟智慧複習與每週報告 | 頁面可用且只顯示自己的資料 |  |  |  |  |
| STD-03 | 開啟全部功能 Sidebar | 可用 X、遮罩與返回關閉，背景不可捲動 |  |  |  |  |
| STD-04 | 播放教材音檔 | Navbar、Sidebar、播放器及作業按鈕不重疊 |  |  |  |  |
| STD-05 | 直接輸入管理員網址 | 回到學生首頁且看不到管理資料 |  |  |  |  |
| STD-06 | 重新整理與重新開啟網站 | 有效 Firebase Session 保持登入 |  |  |  |  |

### 3.3 試用者／教材購買者／離校學生

| 編號 | 身分 | 操作 | 預期結果 | 結果 | 備註 |
| --- | --- | --- | --- | --- | --- |
| ENT-01 | 試用者 | 查看 Sidebar 與 Dashboard | 看不到英文班作業，只看到試用允許內容 |  |  |
| ENT-02 | 試用者 | 直接輸入作業網址 | 前端拒絕，後端也不回傳作業 |  |  |
| ENT-03 | 教材購買者 | 開啟教材列表 | 只看到已購買或已取得授權的教材 |  |  |
| ENT-04 | 教材購買者 | 直接輸入未購買教材網址 | 顯示清楚鎖定或方案引導，不洩漏教材 |  |  |
| ENT-05 | 離校學生 | 查看 Dashboard 與作業 | 保留歷史進度，但沒有新的班級作業 |  |  |
| ENT-06 | 權限到期學生 | 開啟學習頁與會員中心 | 學習內容鎖定，會員中心仍可使用，進度不消失 |  |  |

### 3.4 老師

| 編號 | 操作 | 預期結果 | 桌面 | 412px | 備註 |
| --- | --- | --- | --- | --- | --- |
| TCH-01 | 開啟管理、音檔與作業入口 | 入口名稱清楚且都指向目前正式路由 |  |  |  |
| TCH-02 | 查看學生與報告 | 只能看到授權班級 |  |  |  |
| TCH-03 | 發布作業 | 必須選 E1、E3、E5 或 E7，不可用空白代表全部 |  |  |  |
| TCH-04 | 直接輸入管理員專用網址 | 回到老師首頁，看不到管理員內容 |  |  |  |
| TCH-05 | 試聽教材音檔 | 不增加學生正式聆聽次數 |  |  |  |

### 3.5 管理員

| 編號 | 操作 | 預期結果 | 桌面 | 412px | 備註 |
| --- | --- | --- | --- | --- | --- |
| ADM-01 | 展開管理、音檔及系統選單 | 所有管理入口可見，桌面與手機網址一致 |  |  |  |
| ADM-02 | 開啟音檔管理與新增連結 | 只有一個正式音檔管理入口，新增連結到 `/admin/links` |  |  |  |
| ADM-03 | 編輯連結名稱與網址 | 儲存／取消清楚，拒絕非 HTTP／HTTPS 網址 |  |  |  |
| ADM-04 | 查看學生管理 | 桌面表格及手機卡片都能看到狀態與操作 |  |  |  |
| ADM-05 | 開啟停用帳號 | 清楚標示停用，提供恢復而非一般永久刪除 |  |  |  |

## 4. 每次發布前的 UX 任務驗收

請測試者在沒有提示的情況下完成下列任務：

1. 學生找到今天作業並開始播放第一段音檔。
2. 學生找到自己的每週報告，再回到首頁。
3. 沒有 AI 權限的學生找到 AI 方案說明，但不能進入生成工作區。
4. 老師找到指定班級的學習報告。
5. 管理員找到音檔管理，再進入新增連結。

每個任務記錄：是否完成、耗時、點錯次數、是否需要提示、不理解的文字及操作中斷位置。核心任務建議以至少 90% 無提示完成率為通過標準。

## 5. 發現問題時的最小紀錄

```text
測試編號：
測試網址：
角色／學生類型：
裝置與瀏覽器：
操作步驟：
預期結果：
實際結果：
是否可重現：
Console／Network 狀態：
截圖或 Playwright trace：
```

不要在問題紀錄或截圖中包含密碼、Firebase Token、學生個資或付款資訊。
