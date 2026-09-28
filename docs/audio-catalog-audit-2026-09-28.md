# 教材音檔與正式資料庫比對報告

比對日期：2026-09-28

## 比對來源

- 本機來源：`D:\彬的檔案\React.js\Alan_English_Music_File`
- 正式資料庫：Supabase `books`、`music_tracks`
- 正式儲存欄位：R2 物件路徑、檔名、啟用狀態與 `storage_size_bytes`

本次只進行唯讀查詢，沒有上傳、覆蓋、刪除音檔，也沒有修改資料庫。

## 已確認一致

下列 14 套教材的「檔案數、總位元組數、每個檔案大小的集合」與正式資料庫完全相同：

| 教材 | 音檔數 | 總位元組 |
| --- | ---: | ---: |
| Workbook 2 | 66 | 196,431,624 |
| Workbook 3 | 51 | 135,136,800 |
| Workbook 4 | 50 | 200,236,608 |
| Workbook 5 | 35 | 135,762,048 |
| Reading Table 1 | 20 | 20,022,776 |
| Reading Table 2 | 20 | 23,135,736 |
| Reading Table 3 | 20 | 26,412,201 |
| ReadingLamp 1 | 20 | 17,807,590 |
| ReadingLamp 2 | 20 | 19,104,099 |
| ReadingLamp 3 | 20 | 20,882,937 |
| Steam Reading 1 | 48 | 31,062,853 |
| Super Easy Reading 1 | 48 | 34,143,960 |
| Super Easy Reading 2 | 49 | 36,600,090 |
| Super Easy Reading 3 | 49 | 41,490,835 |

Workbook 1 的正式資料庫有 45 檔、195,492,324 位元組；這 45 個正式檔案的檔名與大小都能在本機 `習作本1` 找到完全相同的檔案。本機另外有 24 個未列入正式教材的零散對話／字母檔，例如 `P11.mp3`、`P21.mp3`、`B.mp3` 與短句切片。

## 本機有檔案、正式資料庫沒有音軌

| 本機資料夾 | 本機檔案數 | 對應正式教材狀態 |
| --- | ---: | --- |
| `SP_Book1_SB_MP3` | 89 | `Listening 1` 已建立，但目前 0 音軌；名稱對應仍需人工確認 |
| `SP_Book2_SB_MP3` | 95 | `Listening 2` 已建立，但目前 0 音軌；名稱對應仍需人工確認 |
| `SP_Book3_SB_MP3` | 95 | `Listening 3` 已建立，但目前 0 音軌；名稱對應仍需人工確認 |
| `Short Articles for Reading Comprehension 1` | 20 | 正式資料庫沒有同名教材 |
| `steamreadingelementary2` | 48 | 正式資料庫沒有 Steam Reading 2 |
| `steamreadingelementary3` | 48 | 正式資料庫沒有 Steam Reading 3 |

正式資料庫另有 `Workbook 6`、`Listening 4`、`Listening 5`、`Listening 6`，目前都沒有音軌；本次在上述本機來源資料夾內也沒有找到對應音檔。

## 判讀限制

正式 `music_tracks` 目前沒有保存 SHA-256 等內容雜湊，因此本次能確認的是檔名／數量／位元組大小一致。14 套教材的每檔大小集合完全相同，Workbook 1 的 45 個正式檔更同時符合檔名與大小，沒有發現已上線檔案大小不同的證據；但若要宣稱每一個位元都完全相同，仍需由管理員短效下載 R2 原檔後計算內容雜湊。

正式執行任何補上、替換或下架前，需先人工確認六個未掛載資料夾實際對應的教材與排序，並保留既有 R2 檔案作為回復來源。

## 後續來源澄清

使用者後續確認 `D:\彬的檔案\AlanEnglish 檔案\Workbook 1 MP4`～`Workbook 5 MP4` 才是 Workbook 最新音訊來源。上述本機 MP3 稽核仍可作為現行正式資料庫的參考鏡像，但不能再代表最新版內容。204 支影片的音軌轉換、逐字稿及新舊差異見 `docs/workbook-video-audio-comparison-2026-09-28.md`；目前仍未上傳或替換正式音檔。
