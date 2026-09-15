# Workbook 1 基礎口說闖關規格

最後更新：2026-09-13
狀態：A–Z、P14～P17、P21／P22 學生端框架與管理員人工匯入流程已完成本機驗證；P14～P17 已連結正式核准來源，尚未部署、尚未建立正式題庫

## 1. 本階段範圍

本規格只處理 Workbook 1 的四組基礎口說活動：

1. A–Z 大小寫辨識與發音。
2. P14～P17 看單字逐字母拼讀。
3. P21 看圖說出完整問句與回答。
4. P22 看圖完成整句，並可逐字點聽已顯示文字。

沿用既有 `/student/speaking-challenges`、Firebase Authentication、後端 effective access、`pronunciation` entitlement、私人 R2 短效網址與 Azure 發音評分。不變更付款、會員、作業、老師或管理員權限。

## 2. 已確認的現有狀態

- Git 基準：`origin/main` commit `02f0b442`。
- 開發分支：`codex/workbook1-speaking-challenges`。
- 既有 Speaking 視覺提示、換題同步與台灣國旗修正已從乾淨 integration branch 套入；沒有帶入 Academy 或其他產品歷史。
- Supabase 已存在 `speaking_question_visual_aids` migration，`speaking_questions.visual_aid` 欄位可保存安全的結構化提示；學生仍只能透過驗證 Firebase Token 與 entitlement 的 Edge Function 取得題目。
- 正式 `book_page_spiral_review_content` 已有 Workbook 1 P14～P17 的 `published` 人工核對內容；建立拼讀草稿時後端會逐字、逐順序比對最新發布版本，不相符即拒絕建立。
- 沿用既有草稿與發布前也會重新比對正式來源、題序及完整字母答案；舊 13 題 P17、遭編輯的草稿或來源升版後的舊草稿都必須封存後重建。來源鎖定題庫不開放通用題目編輯器，active template 另有唯一索引避免並行重複建立。
- `book_page_spiral_review_content` 的建表與正式來源 migration 目前仍在未合併的 PR #120；此 dependency 進入 `main` 前，本功能 PR 必須維持 Draft，不可只因正式環境已存在資料表就略過版本庫依賴。
- 正式資料另有 Workbook 1 的 P21～P30 OCR section，但原 PDF／OCR 文件仍是 `draft`、OCR 狀態是 `review_required`；P21／P22 的圖片內容與空格答案不能由 OCR 還原。
- 目前已發布的 Workbook 1 題庫沒有涵蓋 A–Z、P14～P17、P21 或 P22。本批不能把 OCR 草稿直接當成正式答案發布。

## 3. 共用學生流程

所有新關卡採相同四段結構：

```text
教學／說明 → 單題挑戰 → 即時回饋 → 下一題或重新開始
```

- 一次只顯示一題，不同時顯示長題目清單。
- 主要按鈕至少 44px，支援鍵盤 focus、螢幕閱讀器與約 412px 手機。
- 手機只保留一層頁面捲動，底部操作列必須避開 Navbar 與 iPhone safe area。
- 題序使用 Fisher–Yates 洗牌；每輪先建立完整題目陣列，確保不漏題，也不以每題獨立亂數造成重複。
- 重新開始會產生新題序；重新整理或離開頁面後不承諾保留尚未完成的本輪順序。
- 原始錄音只在瀏覽器暫存與回聽，不保存到資料庫或 Storage。

## 4. A–Z 大小寫關

### 4.1 教學模式

- 使用 26 個由管理員預先核准並產生的字母示範音檔，依 A 到 Z 播放。
- 學生可以暫停、重播目前字母或重新播放整段。
- 學生端只能讀取既有私人 R2 音檔的短效網址，不能觸發 Google TTS 產生費用。
- 26 個音檔全部為 `ready` 前，題庫只能維持草稿，不可發布半套教學。

### 4.2 挑戰模式

- 每輪 26 題，每個英文字母恰好出現一次；每次開始時隨機決定顯示大寫或小寫。
- 畫面先顯示字母並倒數 3 秒，倒數後播放該字母的標準發音，再開放學生錄音。
- 學生未說對字母，畫面顯示溫和的重試訊息，本輪題號回到 1，並重新洗牌。
- 失敗後提供「重新聽 A–Z」與「直接再玩一次」兩個選項。
- 題庫 metadata：

```json
{
  "interaction_type": "alphabet_round",
  "shuffle": true,
  "countdown_seconds": 3,
  "reset_on_failure": true,
  "intro_audio_mode": "alphabet_sequence"
}
```

### 4.3 判定原則

- 後端依已發布 `question_id` 取得預期字母，不接受前端傳入答案。
- 除發音分數外，必須比對 Azure 辨識結果與字母名稱；不得沿用一般固定句目前「一律 answer match」的行為。
- 允許常見辨識等價形式，例如 `B/bee`、`C/see/sea`、`I/eye`、`R/are`、`U/you`、`Y/why`，但只能映射到該題唯一字母。
- 大小寫只影響畫面辨識，不把 `A` 與 `a` 當成不同發音答案。

## 5. P14～P17 拼字關

四頁分成四個短關卡，避免國小生一次完成 46 題；每一頁內題序獨立洗牌。

| 頁面 | 題數 | 正式資料已發布並人工核對的單字 |
| --- | ---: | --- |
| P14 | 10 | apple, juice, world, orange, purple, dance, plane, black, queen, friends |
| P15 | 12 | thanks, welcome, nice, great, teacher, chair, elephant, paper, bottle, computer, sunny, weather |
| P16 | 12 | Taiwan, Chinese, McDonald's, America, Kentucky, Starbucks, Costco, Tasty, Family, Gogoro, Microsoft, Domino's |
| P17 | 12 | one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve |

顯示與判定規則：

- 畫面顯示正常英文單字，不顯示拆好的答案。
- 學生要逐字母唸出完整序列，例如 `apple → A-P-P-L-E`。
- 後端以題庫中的完整字母序列比對辨識結果；漏字、換序或多字都不能完成。
- 大小寫不影響發音判定；撇號不作為要朗讀的字母，`McDonald's` 的答案序列為字母本身。
- metadata 使用 `interaction_type: "letter_spelling"` 與 `shuffle: true`。
- P16 含品牌及專有名詞；正式來源已完成人工核對，草稿仍須保留該版本的拼字、撇號與大小寫。若正式來源日後更新，後端會拒絕沿用不一致的內建清單。

## 6. P21 圖片問答

OCR 只保留以下句型與 9 個空白題位：

```text
What is that?
It is a ____.
Is it Mary's?
Yes, it's hers. / No, it's not.
```

圖片物件、每題名詞及所有權答案沒有被 OCR 保存。因此每題正式建立前必須補齊：

- 裁切後的核准圖片。
- 圖片物件英文單字與冠詞。
- 完整 question。
- 完整 answer。
- 所有權問句的正確肯定／否定回答。
- 可接受說法及繁體中文替代文字。

學生畫面只呈現圖片，不先顯示問句或回答；一次錄音必須同時包含完整問句與完整回答。後端使用完整句序列判定，不可只檢查名詞關鍵字。

## 7. P22 看圖完成句子

OCR 保留 9 個句型位置，但遺失圖片中的主詞：

1. `The ____ is in the tree.`
2. `The ____ is on the floor.`
3. `The ____ is in the desert.`
4. `The ____ is in the pond.`
5. `The ____ is in the forest.`
6. `The ____ is in the river.`
7. `The ____ is on the prairie.`
8. `The ____ is in the race.`
9. `The ____ is in my mouth.`

使用者已描述第一題圖片為蘋果；其餘八題仍須由實際頁面或教師版核對。任何未確認主詞都不得建立成已發布題目。

- 畫面顯示核准圖片與挖空句型。
- 學生必須說出完整句子，不能只說空格單字。
- 已顯示文字切成可操作的單字按鈕；點擊時只播放該字，不播放空格答案或整句。
- 單字音檔由管理員預先產生並放在私人 R2，學生端不直接呼叫付費 TTS。
- 後端依完整 `model_answer` 使用 scripted assessment，保留 omission／insertion 判定。

## 8. 圖片資產安全契約

P21／P22 不使用任意遠端 URL，也不把私人 R2 object key 直接傳給前端。已建立尚未套用的 additive migration，使用獨立視覺資產、題目圖片連結、伺服器端完整答案與逐字音檔連結紀錄；所有表啟用 RLS，撤銷 `public`、`anon` 與 `authenticated` 直接存取，只授權 `service_role`。

只有管理員可上傳及核准圖片。學生讀取題庫時，`speaking-challenge` 必須先驗證 Firebase Token、角色、有效 membership、Workbook 1 entitlement 與 `pronunciation` 功能，再回傳短效預簽圖片網址。Migration、圖片上傳與 Edge Function 部署都需要另行核准，本規格階段不執行。

題庫清單、指定題庫與發音評分都必須在讀取完整答案、取得私人 R2 短效網址或呼叫付費 Speech provider 前完成逐本教材 entitlement 檢查。直接輸入其他教材的題庫 ID 也必須回傳 403；老師與管理員只能以既有 demo 模式預覽，不能用學生評分端點寫入進度或產生費用。

每次準備送出 Azure 發音評分前，後端會先透過尚未套用的 server-only request ledger RPC，以每位學生的資料庫 advisory lock 原子保留額度。一般口說每 10 分鐘最多 12 次；Workbook 1 基礎題每 10 分鐘最多 60 次、24 小時最多 160 次。成功、網路／供應商失敗、無法評分及後端保存失敗都會保留稽核狀態並計入限流；資料表不含原始錄音，`public`、`anon`、`authenticated` 均無直接讀寫或執行 RPC 權限。

## 9. 發布閘門

以下條件全部成立前，P21／P22 必須維持草稿：

- 每一題圖片與來源頁人工核對完成。
- 所有名詞、冠詞、問句、回答及可接受說法人工核對完成。
- 圖片使用權及裁切範圍確認完成。
- 私人 R2 圖片、替代文字及短效網址驗證完成。
- React、Edge Function contract、完整判定、亂數不漏題、3 秒倒數及錯誤重置測試通過。
- 桌面與約 412px 手機完成麥克風、圖片、單字點讀、Navbar 與 safe area 實測。

## 10. 實作 checkpoint 與下一步

已完成並通過本機測試：

1. A–Z 與 P14～P17 的 curated draft templates；P14～P17 建立前必須逐字符合 `book_page_spiral_review_content` 最新 `published` 版本，P17 已依正式資料修正為 12 題並移除不屬於該頁的 `thirteen`。
2. 後端 `alphabet_round`／`letter_spelling` 完整答案比對，以及完成紀錄的最近正確評分閘門。
3. 前端完整洗牌、A–Z 大小寫隨機、3 秒提示、答錯回到第一題、重聽與重玩流程。
4. A–Z 草稿可由管理員預先產生音檔，但 26 題未全部 ready 前不能發布；學生端只讀短效私人網址，不產生 TTS 費用。
5. P21／P22 共用學生端看圖關卡已完成：每輪完整洗牌，P21 只顯示短效私人圖片，P22 顯示圖片、挖空句型與至少 44px 的逐字點讀按鈕。
6. `pronunciation-coach` 與完成紀錄均改由伺服器讀取完整問答／句子；P21 只說答案、P22 只說空格單字都不能完成，前端回應不含正確答案或私人 object key。
7. 發布閘門會逐題確認人工核准圖片、完整答案、替代文字；P22 還必須具有每個可見單字的 ready 私人音檔。Migration 尚未套用，Edge Function 尚未部署。
8. 管理員可逐題輸入已核准的問句／句型、完整回答、可接受完整說法與替代文字，再以短效 PUT 網址把 JPG、PNG 或 WebP 直接送入私人 R2；後端會重新驗證大小、Content-Type 與檔案簽章。P22 會在草稿階段預先產生可見單字音檔；任何圖片或語音步驟中斷時，只回復該次未發布草稿，已發布題庫不受影響。
9. P21／P22 的通用題目編輯器已停用，後端也會拒絕通用更新，避免學生顯示文字與伺服器完整答案分離。

下一步須先取得並人工核准 Workbook 1 P21／P22 的實際圖片、每題名詞、冠詞及完整答案，再使用已完成的管理員流程建立草稿並實際預覽。不得以 OCR 空格或推測內容補題，也不得在未取得 migration／Edge Function 部署授權時建立正式圖片資料。

逐題收集與核准請使用 `WORKBOOK_1_P21_P22_CONTENT_APPROVAL.md`。該文件只作人工審查，不是資料庫匯入 manifest，也不得記錄私人 R2 object key 或 signed URL。
