# Workbook 1 Phase 8 人工內容核准清單

最後更新：2026-09-15

狀態：已完成學生版 P111～P114、P117～P119 與教師版 P101～P104、P107～P109 的人工核對；尚待管理員確認圖片遠近、單複數、圖片權利與最終挑戰抽題規則。這份文件不是資料庫 manifest；尚未建立草稿、上傳圖片、生成 TTS、執行 migration 或發布。

## 1. 來源對照

| 學生版 | 教師版 | 建議內容 | 核對結果 |
| --- | --- | --- | --- |
| P111 | P101 | This／That／These／Those | 圖與題面一致；八題可整理為完整句或完整問答 |
| P112 | P102 | 指示詞延伸與 it／they | 題面一致；後四題答案明確，前六題遠近需管理員逐圖確認 |
| P113 | P103 | Vocabulary Practice | 純抄寫，不獨立建立口說關卡 |
| P114 | P104 | 指示詞搭配可數／不可數名詞 | 題面一致但圖片沒有可稽核的遠近標記；暫不建立自動判定題 |
| P117 | P107 | Review 1 | 紙本選擇題，含外貌／肥胖描述及多個錯誤干擾句；不直接匯入 |
| P118 | P108 | Review 2 | 紙本選擇題，含不自然選項與家庭角色假設；不直接匯入 |
| P119 | P109 | Review 3 | 紙本選擇題，含外貌、housewife 與家庭角色假設；不直接匯入 |

## 2. 候選關卡 A：近的、遠的、單數、複數（配合第 111 頁）

建議 interaction：`demonstrative_picture_sentence` 與 `demonstrative_picture_qa`。畫面保留原頁指向方向，學生說完整句或完整問答；只說物件名稱不能通關。

| 題號 | 圖片／任務 | 主要答案 | 可接受答案 | alt_zh |
| --- | --- | --- | --- | --- |
| A-01 | 近處一條皮帶 | `This is a belt.` | 無 | 女孩指向近處的一條皮帶 |
| A-02 | 近處多顆鳳梨 | `These are pineapples.` | 無 | 女孩指向近處的多顆鳳梨 |
| A-03 | 請打開遠處窗戶 | `Please open that window.` | `Open that window, please.` | 女孩指向遠處的一扇窗戶 |
| A-04 | 遠處一輛腳踏車 | `That is a bicycle.` | `That's a bicycle.`；`That is a bike.` | 女孩指向遠處的一輛腳踏車 |
| A-05 | 近處一顆檸檬問答 | `What is this? It's a lemon.` | `What is this? It is a lemon.` | 一顆近處的檸檬 |
| A-06 | 遠處一顆西瓜問答 | `What is that? It's a watermelon.` | `What is that? It is a watermelon.` | 一顆遠處的西瓜 |
| A-07 | 近處多顆桃子問答 | `What are these? They are peaches.` | `What are these? They're peaches.` | 多顆近處的桃子 |
| A-08 | 遠處多顆梨子問答 | `What are those? They are pears.` | `What are those? They're pears.` | 多顆遠處的梨子 |

## 3. 候選關卡 B：指示詞快問快答（配合第 112 頁）

前六題的候選答案依圖像大小與版面位置整理，正式建立前必須由管理員確認每張圖代表近處或遠處；確認後應保存每題的 `distance: near|far`，而不是只把答案硬編碼在前端。

| 題號 | 圖片／問句 | 候選主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| B-01 | 單顆檸檬 | `This is a lemon.` | 無 |
| B-02 | 多顆檸檬 | `These are lemons.` | 無 |
| B-03 | 單艘小船 | `That is a boat.` | `That's a boat.` |
| B-04 | 多艘小船 | `Those are boats.` | 無 |
| B-05 | 單輛卡車 | `This is a truck.` | 無 |
| B-06 | 多輛卡車 | `Those are trucks.` | 無 |
| B-07 | `What is that?`／一顆糖果 | `It is a candy.` | `It's a candy.`；`It is candy.` |
| B-08 | `What is this?`／一塊餅乾 | `It is a cookie.` | `It's a cookie.` |
| B-09 | `What are those?`／多種糖果 | `They are sweets.` | `They're sweets.`；`They are candies.` |
| B-10 | `What are these?`／多塊餅乾 | `They are cookies.` | `They're cookies.` |

B-01～B-06 未完成遠近核准前狀態固定為 `BLOCKED_DISTANCE_APPROVAL`；B-07～B-10 可獨立核准，但不得用後四題反推前六題答案。

## 4. P114 暫緩項目

P114 練習 `this/that/these/those` 與 food、money、bread、furniture 等可數／不可數名詞，但頁面只用相同手勢指向各圖，沒有可稽核的近／遠資訊。若直接猜測，`this food`／`that food` 或 `these books`／`those books` 都可能文法正確卻與教材預期不同。

管理員若要納入，必須逐題核准 `distance`、`number`、完整句及圖片標記；圖片重製時要用明顯的近／遠構圖。未完成前不建立自動判定草稿。

## 5. Workbook 1 最終挑戰設計（參考第 117～119 頁）

P117～P119 只作技能覆蓋參考，不直接複製選擇題。正式最終挑戰由後端從學生已取得教材、已核准且已發布的前置口說題中抽取 12 題，建立不可變的 round snapshot：

1. A-Z／字母或拼讀：2 題。
2. 圖片名詞、完整句或指示詞：2 題。
3. Be 動詞、代名詞或冠詞：2 題。
4. 數字、時間或數量：2 題。
5. 日常作息、位置或家庭樹：2 題。
6. Who／Where／What／How 問答：2 題。

如果任一類別沒有已發布且學生可用的前置題，就不開啟最終挑戰，也不得用未核准題、draft 或前端自造答案補滿。每一輪保存題目 ID、published version、順序與實際回傳獎勵，重試不得悄悄換題來規避錯題。

學生必須完成所有設定為主線 prerequisite 的前置關卡後才解鎖；選用暖身與被排除頁不列 prerequisite。老師與管理員可預覽完整抽題規則及所有已發布題，但預覽不寫學生進度、不發獎。

## 6. Review 頁面不直接匯入的原因

- 紙本題以錯誤選項測驗辨識，口說系統若直接朗讀或保存可能把干擾句當標準答案。
- P117 含 `fat boy`、`tall girl` 等外貌題；P119 含 `beautiful woman` 與 `housewife` 家庭／性別假設。
- P118 有多個不自然或不完整選項，例如所有格及否定回答混亂。
- 最終口說能力應重用已通過前置關卡的正確完整答案，不重新引入未核准文案。

## 7. 兒童容錯與後端判定

- `this`／`that` 與 `these`／`those` 的遠近及單複數都是核心答案，不能用一般語意相似度互相放寬。
- `It's`／`It is`、`That's`／`That is`、`They're`／`They are` 先正規化。
- `bike`／`bicycle`、`sweets`／`candies` 等只接受核准清單內同義詞。
- 最終挑戰只引用 published question ID 與版本，不把 accepted responses 或答案下放前端。
- round、完成與獎勵必須後端原子保存且具冪等性；重複送出不重複發獎。
- staff 預覽不寫進度、不發獎；學生維持循序解鎖。
- 圖片與示範音檔保持私人；示範音檔依文字與設定雜湊只生成一次，學生不能觸發付費 TTS。
- 原始學生錄音不保存，只保留必要評分與辨識結果。

## 8. 管理員核准欄位

| 關卡 | 內容核准人／時間 | 圖片權利 | 遠近／單複數複核 | 環境 E2E | 發布狀態 |
| --- | --- | --- | --- | --- | --- |
| A 近遠單複數 | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| B 指示詞快問快答 | 待填 | 待填 | `BLOCKED_DISTANCE_APPROVAL` | `NOT_RUN` | `NOT_CREATED` |
| P114 可數／不可數 | 待填 | 待填 | `BLOCKED_DISTANCE_APPROVAL` | `NOT_RUN` | `NOT_CREATED` |
| Workbook 1 最終挑戰 | 待填 | 引用既有資產 | 待填 | `NOT_RUN` | `NOT_CREATED` |

所有必要欄位核准，且前置主線題組已發布後，才可設計 Phase 8 的 additive schema／Function allowlist、round snapshot、冪等獎勵與草稿建立流程；正式 migration、Function 部署及題組發布仍需依重大改動閘門另行授權。
