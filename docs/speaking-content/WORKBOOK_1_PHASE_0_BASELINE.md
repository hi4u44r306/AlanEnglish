# Workbook 1 口說大挑戰 Phase 0 基準

盤點時間：2026-09-15

資料來源：共用 Supabase 專案 `alan-english`（唯讀查詢）

用途：後續建立、發布或部署前後的防覆蓋比對；本文件不包含學生識別資料、私人 R2 object key 或 Secret。

## 1. 正式教材

- `books.id = 1`
- `code = Workbook_1`
- `name = Workbook 1`
- `enabled = true`
- `content_scope = formal`

## 2. 題組基準

| ID | 穩定 template key | 題組 | 版本 | 狀態 | 題數 | 來源頁 |
| --- | --- | --- | ---: | --- | ---: | --- |
| 7 | `workbook_1_alphabet_round_v1` | 00 A–Z 大小寫挑戰 | 1 | published | 26 | 入門準備 |
| 1 | `workbook_1_name_intro_v1` | 01 我的名字與自我介紹 | 1 | published | 4 | 18、19、20 |
| 3 | `workbook_1_greetings_polite_v1` | 02 打招呼與禮貌對話 | 1 | published | 8 | 35、36、60、70、80、85、90、99、100 |
| 4 | `workbook_1_colors_objects_v1` | 03 顏色與生活物品 | 1 | published | 6 | 28、30、34、84 |
| 5 | `workbook_1_numbers_math_v1` | 04 數字與簡單算術 | 1 | published | 6 | 39、42、43、49 |
| 6 | `workbook_1_time_daily_routine_v1` | 05 時間與我的一天 | 1 | draft | 6 | 46、60、70、75、80、90 |
| 10 | `workbook_1_p14_letter_spelling_v1` | P14 看字拼讀 | 1 | published | 10 | 14 |
| 11 | `workbook_1_p15_letter_spelling_v1` | P15 看字拼讀 | 1 | published | 12 | 15 |
| 12 | `workbook_1_p16_letter_spelling_v1` | P16 看字拼讀 | 1 | published | 12 | 16 |
| 13 | `workbook_1_p17_letter_spelling_v1` | P17 看字拼讀 | 1 | published | 12 | 17 |

另有兩份未發布的通用 AI A–Z 草稿：ID 8（version 2，5 題）及 ID 9（version 3，5 題）。它們沒有 curated template key，不得當成正式 A–Z 題組發布，也不得覆蓋 ID 7。

## 3. 不可倒退的正式進度

正式進度以既有 `question_set_id`／`question_id` 外鍵保存，不以標題判斷。唯讀統計如下：

| 題組 ID | 題組 | 進度列 | 有進度學生數 |
| ---: | --- | ---: | ---: |
| 1 | 01 我的名字與自我介紹 | 4 | 1 |
| 4 | 03 顏色與生活物品 | 6 | 1 |
| 7 | 00 A–Z 大小寫挑戰 | 26 | 1 |
| 10 | P14 看字拼讀 | 10 | 1 |
| 11 | P15 看字拼讀 | 3 | 1 |

後續發布不得刪除或替換上述 published 題組 ID；修訂必須建立新版本並保留舊版本及進度。

## 4. 音檔與圖片基準

- A–Z `alphabet_master`：題組 ID 7、version 1、`ready`、26 段、36,660ms、1,759,740 bytes。
- 現有 curated template key 沒有重複。
- P21／P22 題組目前不存在；因此仍為未發布，不能因前端部署自動出現。
- `speaking_visual_assets`、`speaking_question_visual_assets`、`speaking_question_interactions` 與 `speaking_question_word_audio` 目前沒有 Workbook 1 的已連結內容；P21／P22 必須先完成圖片與答案核准清單才可建立草稿。

## 5. 安全差異：舊原始錄音待清理

目前 `pronunciation-coach` 新寫入只保存分數、辨識文字、逐字結果及答案比對，不會填入錄音欄位；2026-09-15 重新以全題組範圍盤點後，正式資料共有 12 筆較早期 attempt 仍保留私人錄音欄位：題組 ID 2 有 5 筆、題組 ID 4「03 顏色與生活物品」有 7 筆。原基準只統計題組 ID 4，因此不是重新盤點後新增 5 筆：

- `audio_object_key` 與 `audio_saved_at` 有值。
- `audio_deleted_at` 仍為空。
- 題組 ID 2 的產生時間介於 2026-09-07 07:15:49 UTC 至 11:45:27 UTC；題組 ID 4 介於 15:17:03 UTC 至 15:18:46 UTC。

分類：**P1 privacy/data-retention gap（歷史資料）**。在未確認對應私人 R2 物件、回復方式及取得正式資料刪除授權前，不得自行刪除、清空欄位或假稱已完成清理。新關卡可以繼續製作草稿，但正式完成標準必須先關閉此項。

## 6. 每批 preflight／postflight 必比項目

1. 上表所有 published 題組 ID、template key、version、status、題數仍存在。
2. 題組 ID 7 的 A–Z 主音檔仍為 `ready`、26 段，fingerprint 未無預期更換。
3. 既有進度列數不得因內容發布或前端部署減少。
4. 同一 active curated template key 不得出現兩份題組。
5. P21／P22 在管理員逐題核准前不得為 `published`。
6. 新 attempt 不得新增 `audio_object_key`／`audio_saved_at`。

## 7. Phase 0 結論

- 題組、版本、題數、A–Z 主音檔與學生進度已有可比較基準。
- P21／P22 確認未發布。
- Phase 1 可進行「來源核對與草稿準備」，但不得發布。
- 全案目前仍有 1 項 P1 歷史錄音保留問題；需另批明確授權後安全清理並 postflight。
