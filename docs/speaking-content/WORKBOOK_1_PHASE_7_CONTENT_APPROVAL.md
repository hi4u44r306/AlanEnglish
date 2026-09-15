# Workbook 1 Phase 7 人工內容核准清單

最後更新：2026-09-15

狀態：已完成學生版 P99、P101～P106、P108 與教師版 P90～P96、P98 的人工核對；尚待管理員確認自然問句、教材角色、圖片權利與最終用語。這份文件不是資料庫 manifest；尚未建立草稿、上傳圖片、生成 TTS、執行 migration 或發布。

## 1. 來源對照

| 學生版 | 教師版 | 建議內容 | 核對結果 |
| --- | --- | --- | --- |
| P99 | P90 | Who are you／姓名 | 題面一致，但多個選項文法或語意不自然；不直接轉為主線題 |
| P101 | P91 | 職業或地點問句 | 題面一致；`What are you?` 建議改為自然的 `What do you do?`，需核准 adapted 版本 |
| P102 | P92 | 職業、地點或身分問句 | 題面一致；八題可分流為 What／Where／Who |
| P103 | P93 | Vocabulary Practice | 只有中文與抄寫格，不獨立建立口說關卡 |
| P104 | P94 | Who／What／his／her | 題面一致，但含錯句、`fool`、外貌與肥胖描述；不直接轉為主線題 |
| P105 | P95 | Who／Where 與人物代名詞 | 題面一致；下半部七題可整理為固定角色問句 |
| P106 | P96 | How／How old／疑問詞 | 題面一致；只取答案能唯一決定問句的項目 |
| P108 | P98 | 年齡問答 | 七組問答一致；改寫題學生版與教師版題數／角色不同，不作本批權威答案 |

## 2. 統一互動：看到回答，說出正確問句

P101、P102、P105、P106 候選使用 `answer_to_question`：畫面顯示一個教材角色的回答與必要人物卡，學生說出完整問題。後端依每題核准的疑問詞、主詞、Be 動詞與核心補語判定；不能只說 `Who`、`Where` 或 `How`。

教材原文的 `What are you?` 若表示職業，正式 adapted 版本建議使用較自然的 `What do you do?`。若管理員決定保留原句，必須在版本中清楚標示教材原文與現代自然說法，不能在同一已發布版本內靜默替換。

## 3. 候選關卡 A：工作還是地點？（配合第 101 頁）

| 題號 | 顯示回答 | 主要問題 | 可接受問題 |
| --- | --- | --- | --- |
| A-01 | `I am a doctor.` | `What do you do?` | `What are you?` |
| A-02 | `I am at home.` | `Where are you?` | 無 |
| A-03 | `I am in my room.` | `Where are you?` | 無 |
| A-04 | `I am a nurse.` | `What do you do?` | `What are you?` |
| A-05 | `I am in the school.` | `Where are you?` | 無 |
| A-06 | `I'm in English class.` | `Where are you?` | 無 |
| A-07 | `I am a student.` | `What do you do?` | `What are you?` |
| A-08 | `I am in Taipei.` | `Where are you?` | 無 |

回答均屬教材角色，不要求學生回報真實職業、學校或所在地。

## 4. 候選關卡 B：工作、地點還是身分？（配合第 102 頁）

| 題號 | 顯示回答 | 主要問題 | 可接受問題 |
| --- | --- | --- | --- |
| B-01 | `I am on the train.` | `Where are you?` | 無 |
| B-02 | `I am his mom.` | `Who are you?` | `Who are you to him?` |
| B-03 | `I am a worker.` | `What do you do?` | `What are you?` |
| B-04 | `I am in the house.` | `Where are you?` | 無 |
| B-05 | `I am at his place.` | `Where are you?` | 無 |
| B-06 | `I'm your neighbor.` | `Who are you?` | 無 |
| B-07 | `I am a driver.` | `What do you do?` | `What are you?` |
| B-08 | `I'm his son, Peter.` | `Who are you?` | 無 |

B-02／B-08 只使用虛構人物關係，不詢問或保存學生真實家庭資料。

## 5. 候選關卡 C：Who 還是 Where？（配合第 105 頁）

| 題號 | 顯示回答 | 主要問題 | 可接受問題 |
| --- | --- | --- | --- |
| C-01 | `You are in Hualien.` | `Where am I?` | 無 |
| C-02 | `He is in the room.` | `Where is he?` | 無 |
| C-03 | `Mary. M-A-R-Y.` | `Who is she?` | `What is her name?`；`What's her name?` |
| C-04 | `In the library.` | `Where are they?` | 無 |
| C-05 | `Kevin, Willy, and Helen.` | `Who are they, Kelly?` | `Kelly, who are they?` |
| C-06 | `I'm in Japan.` | `Where are you, Kelly?` | `Kelly, where are you?` |
| C-07 | `She's Jenny.` | `Who is that girl, Kelly?` | `Kelly, who is that girl?` |

地名與姓名只屬固定教材角色。拼字回答可作提示資料，但學生本關主要任務是說問句。

## 6. 候選關卡 D：選對疑問詞（配合第 106 頁）

只選答案能唯一支持教材問題的八題；`We're fine.` 對應單複數 `you` 的語境不清，`Who are you? — His father, Allen.` 文法不自然，均排除。

| 題號 | 顯示回答 | 主要問題 | 可接受問題 |
| --- | --- | --- | --- |
| D-01 | `Great.` | `How are you?` | 無 |
| D-02 | `Nine.` | `How old are you?` | 無 |
| D-03 | `Good.` | `How is he?` | 無 |
| D-04 | `Ten.` | `How old is she?` | 無 |
| D-05 | `Seven and eight.` | `How old are they?` | 無 |
| D-06 | `Jim and Larry.` | `What are your names?` | 無 |
| D-07 | `Sleeping.` | `What is she doing?` | `What's she doing?` |
| D-08 | `She is doing well.` | `How is she doing?` | `How's she doing?` |

## 7. 候選關卡 E：教材角色幾歲？（配合第 108 頁）

建議 interaction：`fictional_age_qa`。每題明示「請扮演教材角色」，不要求學生說自己的真實年齡；年齡只存在題目 manifest，不寫入學生帳號。

| 題號 | 問句 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| E-01 | `How old are you?` | `I am thirteen years old.` | `I'm thirteen years old.`；`I am 13 years old.` |
| E-02 | `How old is he?` | `He is twelve years old.` | `He's twelve years old.`；數字正規化後等價 |
| E-03 | `How old is she?` | `She is eleven years old.` | `She's eleven years old.`；數字正規化後等價 |
| E-04 | `How old are they?` | `They are nine years old.` | `They're nine years old.`；數字正規化後等價 |
| E-05 | `How old are you?` | `We are eight years old.` | `We're eight years old.`；數字正規化後等價 |
| E-06 | `How old is she?` | `She is three years old.` | `She's three years old.`；數字正規化後等價 |
| E-07 | `How old is the baby?` | `He is one year old.` | `The baby is one year old.`；數字正規化後等價 |

P108 下半部的年齡形容詞改寫在學生版有五題、教師版只有四題，而且最後角色是 cat／monkey 不一致；本批不把它們列為權威答案。

## 8. 明確排除或延後

- P99：選項包含 `Nobody`、`I am a Kevin`、`God`、`Go away` 等錯誤或不合任務的回答；自己的姓名欄也不適合固定答案自動評分。
- P103：純 Vocabulary Practice，不獨立建立口說關卡。
- P104：含 `He is a fool`、外貌／肥胖描述及多個不自然人物稱呼；若日後重寫，必須建立 adapted 版本並經兒童內容核准。
- P105 上半部：多個正誤句沒有足夠人物脈絡，不作自動判定。
- P106 未列項目：回答與問句主詞或語境不夠唯一，不由 AI 猜測。

## 9. 兒童容錯、隱私與後端判定

- `What's`／`What is`、`Who's`／`Who is`、`Where's`／`Where is`、`How's`／`How is` 先正規化。
- 問句必須包含正確疑問詞、主詞及必要助動詞／Be 動詞；只說一個疑問詞不能通關。
- `What do you do?` 與教材 `What are you?` 只能依版本核准清單接受，不做無限制語意放寬。
- 年齡中的英文數字與阿拉伯數字正規化後比較；`one year`／複數 `years` 仍需正確。
- 不收集或保存學生真實姓名、年齡、家庭關係、學校、所在地或職業作為公開答案。
- 前端不取得完整 accepted responses；後端從已發布版本取得答案並重新驗證 entitlement、題組狀態與順序。
- staff 預覽不寫進度、不發獎；學生維持循序解鎖。
- 圖片與示範音檔保持私人；示範音檔依文字與設定雜湊只生成一次，學生不能觸發付費 TTS。
- 原始學生錄音不保存，只保留必要評分與辨識結果。

## 10. 管理員核准欄位

| 關卡 | 內容核准人／時間 | 圖片權利 | 自然問句／答案複核 | 環境 E2E | 發布狀態 |
| --- | --- | --- | --- | --- | --- |
| A 工作還是地點 | 待填 | 不適用 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| B 工作、地點或身分 | 待填 | 不適用 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| C Who 還是 Where | 待填 | 不適用 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| D 選對疑問詞 | 待填 | 不適用 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| E 教材角色幾歲 | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| P99／P103／P104 | 不適用 | 不適用 | `EXCLUDED_PENDING_REWRITE` | `NOT_RUN` | `NOT_CREATED` |

所有必要欄位核准後，才可設計 Phase 7 的 additive schema／Function allowlist、兒童容錯契約與 idempotent 草稿建立流程；正式 migration、Function 部署及題組發布仍需依重大改動閘門另行授權。
