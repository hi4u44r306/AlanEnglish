# Workbook 1～5 核准音檔正式發布

發布日期：2026-09-29
範圍：12 支無特效修正版與 Workbook 2 P4 口誤修正版，共 13 支

## 正式結果

- 13 支檔案共 53,299,653 bytes；本機 SHA-256 與核准 manifest 13/13 相符。
- 使用版本化私人 R2 key 上傳，不覆蓋既有正式物件；上傳後全部讀回，大小與 SHA-256 13/13 相符。
- 正式資料庫以單一交易切換 10 筆既有 track，新增 Workbook 1 P26、P84、P99 三筆主音軌。
- Workbook 2 P8、Workbook 4 P9 的 Question／Answer 分拆音軌沒有修改。
- 舊 R2 物件沒有刪除，回復時可把 10 筆舊 track 路徑寫回並刪除本批新增的三筆 track；新物件也先保留，不作破壞性清理。

## Track 對應

| 教材頁 | Track ID | 動作 | 舊 R2 路徑 | 新 R2 路徑 |
| --- | ---: | --- | --- | --- |
| Workbook 1 P26 | 992 | 新增 | — | `Workbook_1/releases/2026-09-29/Workbook_1_P26_7fdddab849aa.mp3` |
| Workbook 1 P48 | 25 | 切換 | `Workbook_1/Workbook_1_P48.mp3` | `Workbook_1/releases/2026-09-29/Workbook_1_P48_5910e563ec72.mp3` |
| Workbook 1 P84 | 993 | 新增 | — | `Workbook_1/releases/2026-09-29/Workbook_1_P84_557e6fc8fb24.mp3` |
| Workbook 1 P99 | 994 | 新增 | — | `Workbook_1/releases/2026-09-29/Workbook_1_P99_8bbb8441b6bf.mp3` |
| Workbook 1 P104 | 4 | 切換 | `Workbook_1/Workbook_1_P104.mp3` | `Workbook_1/releases/2026-09-29/Workbook_1_P104_1338e271c2ff.mp3` |
| Workbook 1 P105 | 5 | 切換 | `Workbook_1/Workbook_1_P105.mp3` | `Workbook_1/releases/2026-09-29/Workbook_1_P105_77b8679938fc.mp3` |
| Workbook 1 P106 | 6 | 切換 | `Workbook_1/Workbook_1_P106.mp3` | `Workbook_1/releases/2026-09-29/Workbook_1_P106_160e26558b01.mp3` |
| Workbook 1 P114 | 11 | 切換 | `Workbook_1/Workbook_1_P114.mp3` | `Workbook_1/releases/2026-09-29/Workbook_1_P114_94d74e247632.mp3` |
| Workbook 2 P4 | 48 | 切換 | `Workbook_2/Workbook_2_P4.mp3` | `Workbook_2/releases/2026-09-29/Workbook_2_P4_a749b8ca48bd.mp3` |
| Workbook 2 P8 | 52 | 切換主音軌 | `Workbook_2/Workbook_2_P8.mp3` | `Workbook_2/releases/2026-09-29/Workbook_2_P8_847c0dc8761b.mp3` |
| Workbook 2 P10 | 112 | 切換 | `Workbook_2/Workbook_2_P10.mp3` | `Workbook_2/releases/2026-09-29/Workbook_2_P10_ff76fafbb920.mp3` |
| Workbook 4 P9 | 203 | 切換主音軌 | `Workbook_4/Workbook_4_P9.mp3` | `Workbook_4/releases/2026-09-29/Workbook_4_P9_13aaed2915d4.mp3` |
| Workbook 5 P27 | 215 | 切換 | `Workbook_5/Workbook_5_P27.mp3` | `Workbook_5/releases/2026-09-29/Workbook_5_P27_b8fc797c799f.mp3` |

## 驗證與回復

- 第一次資料庫 dry run 因 `duration_seconds` 欄位保存兩位小數、候選 manifest 保存三位小數而觸發守門並完整 rollback，沒有留下資料修改。
- 改為依資料庫精度四捨五入後，第二次 dry run 13/13 通過；正式交易完成後再查詢 13 筆 track，路徑、R2 provider、大小、ETag、時長與 enabled 均正確。
- Migration：`20260929170000_publish_reviewed_workbook_audio.sql`。
- 回復資料保留原 track ID、舊路徑、舊大小與 ETag；舊 R2 物件未刪除。

## 範圍限制

本次核准只涵蓋上述 13 支音檔。其餘 175 支候選沒有發現需要移除的確認特效聲，但新舊朗讀內容與編排不一定相同，仍須逐頁內容核准後才能正式切換。
