# 70 分挑戰流程發布審閱

日期：2026-10-07。基準 main `1982d0af`；分支 `codex/speaking-challenge-70-review`。狀態：本機草稿、正式操作未執行。

## 行為與影響

- 一般錄音評分結果抵達便呼叫保存，不再先等 4 秒；保存失敗不能換題或算通關。
- 正式門檻 70 分，仍確認題意／字母順序；辨識不確定、挑戰看過提示不通關。
- `easy` 是自由練習，只保存評分與本次練習完成；`challenge` 才寫正式進度、首次獎勵與解鎖。
- 地圖、後端關卡解鎖只讀挑戰進度，所有題型提供挑戰入口。舊簡單模式資料及獎勵完整保留，不能當成新的挑戰成績。僅靠舊簡單模式完成的前關，需要補做挑戰，後續關卡可能暫時鎖回。
- 本機句子不再扣 Azure 每日輪數，也不因今日通關停用評分。保留每 10 分鐘送評 60 次的短時間保護。
- Azure 使用 A–Z、逐字母拼字；拼字參考內容拆成字母序列，採真實發音分數並核對順序。A–Z 日字母／整關限制保留；拼字日輪數與原有月音訊預留保留。基本費用併入原有字母基本評分桶，費用頁改稱字母與拼字，估算非帳單。
- 入口顯示再次挑戰／自由練習與挑戰完成數；練習結果明確顯示「練習完成」，不顯示通關或獎勵。

## 正式變更範圍

1. 只執行 `20261007155958_speaking_challenge_only_reassessment.sql`，不執行歷史整批 db push。新增 server-only 本次回合完成表、完成 RPC、A–Z wrapper、Azure 拼字用量 wrapper；在新 migration 替換日輪次 reservation，移除每日已通關阻擋，Azure A–Z 的付費限制仍由自己的字母與 round RPC 管理。
2. 從已測試最新 main 發布 `pronunciation-coach` 與 `speaking-challenge`，維持內部 Firebase 驗證與原有 Secret 名稱，不更改 Firebase／RLS 角色／Secret 設定。
3. 合併前端及文件，同一次 Cloudflare production build 後驗收。
4. 不刪學生紀錄、不自動回填挑戰進度、不追回或重發舊獎勵，不更改題庫／教材資料。

## 驗證與待驗

- 針對元件、服務、判分、真實 handler VM、隔離 PostgreSQL migration、既有 claim／獎勵／月額度組合做測試。詳見 PROJECT_STATUS 的結果。
- 入口預覽由實際 JSX 與既有 SCSS 產生，位於 `output/speaking-70-entry-preview.html`，不含帳號或學生資料；不代表瀏覽器 RWD 實測。
- Azure 測試使用合成供應商回應與 WAV，不連付費服務；沒有足夠證據保證真實兒童聲音每次通過。iPhone、真實 Azure 字母／拼字、登入學生保存與跨裝置仍須人工／正式驗收。

## 回復

- 發布前保留兩個已部署 Function 版本／main 基準；失敗時先停止本批發布，回復前端及兩個 Function。
- 新表與新 RPC 保留，避免刪除新紀錄。若要恢復舊日輪次行為，以另一個 additive migration 恢復先前 `reserve_speaking_challenge_session_v1` 函式內容，不執行資料清除。
- 舊獎勵 source key 仍負責冪等，不用修改餘額。恢復舊地圖讀取規則可恢復先前簡單模式解鎖外觀。

依 AGENTS.md 第 13、14、16 節，本批正式 migration、學習進度／獎勵操作須在隔離驗證後取得針對此批的明確同意。
