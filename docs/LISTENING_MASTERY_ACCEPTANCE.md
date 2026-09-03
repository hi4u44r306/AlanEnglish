# 聽力自主熟練 V3 驗收與發布

日期：2026-09-03。狀態：本機實作，尚未部署；基準 `4c97cb2`。

## 規則驗收

| 情境 | 總次數 | 作業進度 | 自主進度／獎勵 |
| --- | --- | --- | --- |
| 無待完成作業，該檔自主第 1～9 次 | 每次 +1 | 不變 | 自主 +1，不發獎 |
| 自主第 10 次，今日未領滿 3 檔 | +1 | 不變 | 10 XP／1 AE Point，一檔終身一次 |
| 已領過同檔自主獎勵，再聽 | +1 | 無作業時不變 | 不重複發獎 |
| 今日已領 3 檔，第四檔到 10 次 | +1 | 不變 | 保留 10/10 待領，隔天再有效聽一次 |
| 有相符未達標作業，從教材頁進入 | +1 | 只推進最早截止的一份 +1 | 不增加自主次數 |
| 作業要求該檔 3 次，完成第 3 次 | +1 | 達標 | 整份所有音檔完成才發 30 XP／5 點 |
| 該檔出現在兩份作業 | +1 | 第一份該檔達標後才推進第二份 | 同一次不重複計作業或自主 |
| 該檔所有作業要求達標，其他檔尚未完成 | +1 | 不變 | 此檔後續聆聽可計自主 |
| 自主獎勵已領，後來老師發布新作業 | +1 | 新作業正常累計 | 可另領整份新作業獎勵，不重領自主 |
| 發布前就開始、發布後才結束的 session | +1 | 不回填新作業 | 依其他有效作業或自主分配 |
| 同一 session 重送／跨帳號冒用 | 不增加 | 不增加 | 拒絕結算 |
| 未達 80%、過快或加速播放 | 不增加 | 不增加 | 不發獎 |

一般會員、離校生不可被分配新班級作業；老師與管理員不寫學生次數。所有有效聆聽仍必須通過後端授權、80% 區段驗證及 elapsed time 檢查。R2 私有音檔、Range、Firebase 驗證不改動。

## 播放器驗收

1. 正常播放到中段，離開分頁再返回：立即暫停，顯示大型「播放已暫停」，不自動續播。
2. 確認按鈕初始有焦點；Tab 不逃出視窗，Escape 不略過確認；點確認才從原位置繼續。
3. 原本已手動暫停再離開分頁：不出現提示，也不自動播放。
4. 提示顯示期間換檔、鍵盤／外部播放事件：不能繞過確認。網路失敗保留提示並能重試。
5. 注意力確認仍優先；逾時後從頭建立新 session，不以離開分頁清除防掛機狀態。
6. 檢查 `412、682、768、810、900、1024px`：書名與進度、播放／前後首、展開播放器、提示按鈕不溢出；真實 iPhone safe area 需另外實機驗收。

## 本機 SQL 回歸

`scripts/listening-mastery-sql.test.mjs` 會建立全新記憶體 PostgreSQL fixture，執行真實 V2 helper 與本批 V3 migration。不使用任何正式憑證、資料或 `.env`，不要求付費 Supabase branch。

先在獨立暫存目錄安裝 `@electric-sql/pglite@0.3.14`，將 `PGLITE_MODULE` 設為該套件 `dist/index.js` 的完整路徑，再執行：

```powershell
node --test scripts/listening-mastery-sql.test.mjs
npm run test:listening-rewards-contracts
npm test -- --watchAll=false --runInBand
npm run test:edge-syntax
npm run build
git diff --check
```

PGlite 驗證真實 PL/pgSQL、唯一鍵、原子回滾及權限 catalog，但不是 Supabase 多連線壓測；發布前／後仍需檢查正式環境的 session 競爭與 API 整合。

## 發布順序與影響（待授權）

1. 套用單一 additive migration `20260903003717_listening_mastery_reward_allocation.sql`：新增兩張有 RLS 的表、session 的政策版本欄位及三個 service-role-only 函式。不回填、不刪除或追回歷史獎勵，不改旗標。
2. 部署 `record-play`，再發布前端。不得在 migration 之前部署新版後端。只為既有 `listening_rewards_v2` 灰度帳號的新 session 採 V3；部署前已開始的 V2 session 仍用 V2 完成。
3. 正式灰度帳號按上表驗收；其他帳號不擅自切換獎勵制度。正式驗收的真實播放會產生紀錄／點數，需列入該批授權。
4. 風險：新規則會改變灰度帳號發獎頻率與分配方式，且每位學生每日 3 點只限制自主，不限制作業、升等、遊戲等其他來源。
5. 回復：前端可回退，資料與 V3 後端結算保留。若結算異常，先暫停受影響帳號新 session（API 明確回傳暫停服務），不要在 V3 失敗後自動 fallback 到 V2，也不要靠關閉 `listening_rewards_v2` 旗標回退，否則會重新進入舊 trigger 計獎。以後續 additive 修正處理，不刪表、不清點數、不重跑舊 migration。
