# 學生作業與錄音流程驗收

日期：2026-10-10。範圍為首頁提醒、既有聽力作業顯示與麥克風錯誤恢復；保留登入入口、老師指定音檔篩選、口說地圖、挑戰／自由練習及獎勵差異。正式發布狀態以 PROJECT_STATUS.md 頂部紀錄為準。

## 已完成的本機驗證

| 項目 | 證據與限制 |
| --- | --- |
| 首頁提醒 | 進行中與逾期提醒優先於生日區；逾期名稱／期限／進度／直接連結；完成項目排除；讀取失敗不宣稱沒有作業 |
| 逐首作業條件 | 以 assignment API 的 required_listens、play_count、completed 正規化；不同教師要求、長期滿 10 但本次未完成、URL required 不可信、未取得作業時不猜數字 |
| 更新與重新整理 | 使用實際共用 query／cache 與模擬伺服器資料驗證事件更新、再聽本首、下一首、全部指定音檔完成、重整保留與返回指定作業 |
| 麥克風錯誤 | DOMException 原因分流，主畫面無英文技術錯誤；權限說明、重新 getUserMedia、斷線釋放裝置、丟棄半段錄音、保留同題同輪、返回操作 |
| 錄音流程 | Edge 合成麥克風錄音與 blob 回聽介面；無真實錄音、遠端評分或正式資料寫入 |
| 測試 | 146 項相關 React 測試，局部 lint、Sass 預覽與 diff check；無全套重跑或重複本機正式 build（AGENTS.md 16.1） |
| 畫面 | 1440、412、320px 的 18 組實際元件流程及最後聽力 3 組補驗；無水平溢位、pageerror 或外部請求 |

隔離證據：`output/student-flow-clarity-preview/browser-results.json`、`listening-final-results.json` 與同目錄截圖（output 不提交）。測試資料與合成音源均為示範，不是學生個資。

## 現行計次與逾期邊界

- 音檔長期紀錄來自 getBookPlaybackProgress；本次作業來自 getStudentAssignments 的共享快取。事件不直接幫作業加一次，重新向既有 API 核對。
- `assignment_window` 以指定期間的 assignment_listening_progress 計次。源碼確認逾期不繼續累加這份作業，故提示向老師確認。`legacy_lifetime` 為相容舊作業，明示累計制，不套用禁止計次說明。
- 既有 record-play 真實覆蓋、時間、速度、學習紀錄、權限、評分、獎勵與防掛機保持不變。本次沒有後端、資料庫或正式設定操作。
- 作業中的指定音檔繼續以授權教材清單與該作業指定清單交集呈現；其他教材的指定音檔提示返回作業查看。

## 正式帳號與實體裝置待驗

1. 使用有進行中作業、僅有逾期作業、完全沒有待辦三種學生狀態：確認首頁顯示、數量與直接跳到正確作業；逾期完成後不再提醒。
2. 由老師確認一份仍在有效期間、指定 3 個音檔且每首次數已知的測試作業。原速完整聽完一首，確認本次逐首次數、剩餘次數、整份完成音檔數與作業頁一致；重新整理後再核對。不要為測試修改正式學生歷史紀錄。
3. 對未達 80%、拖到結尾、倍速、重複區段的聆聽，確認既有播放器顯示未計入原因，作業不能因單純 ended 事件達標。完成全份後確認完成提示、返回同一份作業與伺服器紀錄。
4. 在有麥克風的實體電腦與 iPhone Safari 各測一次：未允許 → 允許 → 重試、正常錄音 → 回聽 → 評分、背景切換 → 回來繼續同題；可拔除裝置的電腦另驗中途斷線及接回重試。
5. 裝置失敗時確認未扣通關機會、未記成答錯、已完成題目保留；評分送出後的背景切換不重送。無法恢復時可返回練習／地圖。

正式公開頁及靜態資產成功，只能證明部署與基本路由；不等於上述登入後計次、真實評分、實體裝置與 iPhone 已通過。

技術錯誤分流依 [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) 與 [MediaStreamTrack ended](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/ended_event)；學生介面使用中文原因與下一步。

回復：revert 本批前端 commit 並由 Cloudflare main 重建。無 migration 或學生資料回復需求。
