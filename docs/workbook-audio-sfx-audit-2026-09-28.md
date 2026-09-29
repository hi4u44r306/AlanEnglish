# Workbook 1～5 單頁音檔特效聲稽核

更新日期：2026-09-29
狀態：本機候選完成，尚未上傳 R2 或修改正式資料

## 範圍

- 輸入：`Workbook 1-5 單頁MP3草稿 (2026-09-28)` 的 187 支單頁候選。
- 目標：找出從影片轉檔時一併保留的提示音、撞擊聲、音樂、嗶聲、爆炸聲、喇叭聲等非教學語音，建立不覆蓋來源的無特效候選。
- Workbook 2 P4 繼續使用已人工確認的 `Workbook_2_P4_Q5_cat_fixed.mp3`，本批沒有重做或覆蓋該檔。

## 檢查方法

1. 以語音活動、短時能量、頻譜突變及左右聲道差異掃描完整 187 支音檔。
2. 將 731 個候選片段交由 AudioSet AST 分類：600 個判定為語音誤報、29 個為不可聽或編碼雜訊、21 個為高可信度立體聲特效、81 個進一步複核。
3. 對模糊片段執行 Whisper 文字與上下文辨識，避免把 `she` 的子音、`purple` 的尾音或短單字誤當作嘶聲、動物聲或音樂。
4. 最終保留 629 個語音／無需處理片段；原本 61 個模糊片段逐一補做上下文複核後，59 個確認為教材單字或子音、1 個確認為停頓中的短提示音、1 個確認為音樂與朗讀重疊。

非語音區段以靜音及 40ms 淡入淡出處理。Workbook 4 P9 的音樂與 `They go hiking and swimming.` 重疊，因此改用中央語音頻譜分離，只處理 29.14～31.86 秒；其餘 59 個可辨識為教材語音的片段維持原音。

## 修正結果

| 教材頁面 | 移除片段數 |
| --- | ---: |
| Workbook 1 P26 | 1 |
| Workbook 1 P48 | 1 |
| Workbook 1 P84 | 4 |
| Workbook 1 P99 | 8 |
| Workbook 1 P104 | 9 |
| Workbook 1 P105 | 9 |
| Workbook 1 P106 | 2 |
| Workbook 1 P114 | 2 |
| Workbook 2 P8 | 3 |
| Workbook 2 P10 | 2 |
| Workbook 4 P9 | 1（中央語音分離） |
| Workbook 5 P27 | 1 |
| **合計** | **43** |

12 支修正版均維持 48kHz、雙聲道、192kbps 與原本時間軸。來源檔未被覆寫。

## 驗證

- 11/11 支靜音型修正版、42/42 個目標片段通過衰減驗證；最低衰減 25.22dB。
- Workbook 4 P9 重疊處理後，AudioSet 音樂分數由 0.719927 降至 0.131896，語音分數由 0.652442 升至 0.663210；修正前後皆完整辨識 `They go hiking and swimming.`。
- 最大時長偏差 0 秒。
- 靜音型修正版未修改區段的最低波形相關係數 0.99995594；P9 未處理區段為 0.99994564。
- 新 manifest 共 187 列、缺檔 0，`sfx_removed_event_count` 合計 43。

## 本機產物

```text
D:\彬的檔案\AlanEnglish 檔案\Workbook 1-5 音效稽核 (2026-09-28)
D:\彬的檔案\AlanEnglish 檔案\Workbook 1-5 無特效MP3候選 (2026-09-28)
```

主要檔案：

- `audio-sfx-events.csv`：初步訊號候選。
- `audio-sfx-events-classified.csv`：AudioSet 分類與分數。
- `audio-sfx-removal-plan.csv`：逐片段保留、人工複核或移除決策。
- `audio-sfx-manual-review-whisper.csv`：模糊片段的語音與上下文辨識。
- `page-audio-sfx-clean-manifest.csv`：187 頁後續核准應使用的完整候選清單。
- `audio-sfx-edit-log.csv`：42 個靜音處理區段。
- `audio-sfx-overlap-repair-log.csv`：Workbook 4 P9 重疊音樂的中央語音分離紀錄。
- `audio-sfx-verification.csv` 與 `audio-sfx-verification-summary.json`：衰減、時長與未修改區段驗證。
- `audio-sfx-overlap-verification.json`：P9 音樂／語音分類、逐字與未修改區段驗證。

## 正式上線前

目前沒有上傳 R2、修改資料庫、替換正式 track ID 或刪除舊檔。正式批次替換前，仍需抽聽 12 支修正版，特別確認 Workbook 4 P9 的中央語音分離聽感；確認後依 manifest 雜湊上傳新物件，保留舊物件供回復。
