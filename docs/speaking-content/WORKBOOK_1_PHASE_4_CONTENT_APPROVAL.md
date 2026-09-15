# Workbook 1 Phase 4 人工內容核准清單

最後更新：2026-09-15

狀態：已完成學生版 P51、P53、P55、P57、P59、P64、P66、P78 與教師版對應頁面的人工核對；尚待管理員確認人物分類、圖片權利、P78 箭線答案與最終用詞。這份文件不是資料庫 manifest；尚未建立草稿、上傳圖片、生成 TTS、執行 migration 或發布。

## 1. 來源對照

| 學生版 | 教師版 | 建議內容 | 核對結果 |
| --- | --- | --- | --- |
| P51 | P46 | `I am` 人物句 | 題面一致；`great` 與未明示姓名題排除 |
| P53 | P48 | `You are` 人物句 | 題面一致；`great`、`nice` 等主觀判斷排除 |
| P55 | P50 | `This is` 物品修正 | 七張圖片可客觀辨識；`couch`／`sofa` 需同義容錯 |
| P57 | P52 | `That is` 物品／動物修正 | 七張圖片可客觀辨識 |
| P59 | P54 | `It is` 物品／動物修正 | 七張圖片可客觀辨識 |
| P64 | P58 | 身體部位正誤 | 題面一致；按摩情境及捲線圖片不清，排除 |
| P66 | P60 | 身體部位與日常名詞 | 題面一致；身體部位可併入同一關，物品題不重複收錄 |
| P78 | P71 | My Head | 題面一致但十二條箭線互相交叉，教師版也沒有答案；暫不建立自動判定題 |

## 2. 統一互動：看圖把句子說正確

P51～P66 候選題使用 `picture_sentence_correction`：畫面顯示圖片及教材原句。原句正確時，學生完整讀出原句；原句錯誤時，學生直接說出修正後的完整句。學生只說 `Yes`、`No` 或單一名詞不能完成必過題。

後端只使用本文件核准後的正確句作權威答案，不得把教材刻意放置的錯句存成 reference answer。辨識文字先做大小寫、標點及縮寫正規化，例如 `I'm`／`I am`、`It's`／`It is`、`They're`／`They are` 等價；名詞同義詞只接受清單內項目。

## 3. 候選關卡 A：我是誰？你是誰？（配合第 51、53 頁）

本關目前有六題可進入人工核准；人物年齡／性別分類仍需管理員確認教材意圖。若任一題未核准且總題數少於六題，不以主觀句補足，應暫緩建立草稿。

| 題號 | 來源／圖片 | 教材原句 | 主要答案 | 可接受答案 | alt_zh |
| --- | --- | --- | --- | --- | --- |
| A-01 | P51／男孩 | `I am a boy.` | `I am a boy.` | `I'm a boy.` | 一位卡通男孩 |
| A-02 | P51／成年男性 | `I am a girl.` | `I am a man.` | `I'm a man.` | 一位卡通成年男性 |
| A-03 | P51／成年女性 | `I am a woman.` | `I am a woman.` | `I'm a woman.` | 一位卡通成年女性 |
| A-04 | P53／小孩 | `You are a kid.` | `You are a kid.` | `You're a kid.`；`You are a child.` | 一位卡通小孩 |
| A-05 | P53／成年女性 | `You are a lady.` | `You are a lady.` | `You're a lady.`；`You are a woman.` | 一位卡通成年女性 |
| A-06 | P53／三位學生 | `You are students.` | `You are students.` | `You're students.` | 三位坐在書桌前的學生 |

排除：P51 的 `I am Jack.`／`I am Mary.` 無法只由提供的兩本教材確認人物姓名；`I am great.`、P53 的 `You are great.`／`You are nice.` 是主觀評價；P53 的長者圖片不作年齡或身分必過判定。

## 4. 候選關卡 B：This 近處物品（配合第 55 頁）

| 題號 | 圖片 | 教材原句 | 主要答案 | 可接受答案 | alt_zh |
| --- | --- | --- | --- | --- | --- |
| B-01 | desk | `This is a desk.` | `This is a desk.` | 無 | 一張書桌 |
| B-02 | chair | `This is a chair.` | `This is a chair.` | 無 | 一張椅子 |
| B-03 | pen | `This is a pencil.` | `This is a pen.` | 無 | 一枝原子筆 |
| B-04 | pencil | `This is a pen.` | `This is a pencil.` | 無 | 一枝鉛筆 |
| B-05 | eraser | `This is an eraser.` | `This is an eraser.` | 無 | 一個橡皮擦 |
| B-06 | clock | `This is a car.` | `This is a clock.` | 無 | 一個時鐘 |
| B-07 | couch | `This is a couch.` | `This is a couch.` | `This is a sofa.` | 一張沙發 |

## 5. 候選關卡 C：That 遠處物品（配合第 57 頁）

| 題號 | 圖片 | 教材原句 | 主要答案 | 可接受答案 | alt_zh |
| --- | --- | --- | --- | --- | --- |
| C-01 | mouse | `That is a mouse.` | `That is a mouse.` | `That's a mouse.` | 一隻老鼠 |
| C-02 | banana | `That is a dog.` | `That is a banana.` | `That's a banana.` | 一根香蕉 |
| C-03 | mouse | `That is a ball.` | `That is a mouse.` | `That's a mouse.` | 一隻老鼠 |
| C-04 | apple | `That is an apple.` | `That is an apple.` | `That's an apple.` | 一顆蘋果 |
| C-05 | ball | `That is a banana.` | `That is a ball.` | `That's a ball.` | 一顆球 |
| C-06 | bottle | `That is a bottle.` | `That is a bottle.` | `That's a bottle.` | 一個瓶子 |
| C-07 | horse | `That is a house.` | `That is a horse.` | `That's a horse.` | 一匹馬 |

## 6. 候選關卡 D：It 是什麼？（配合第 59 頁）

| 題號 | 圖片 | 教材原句 | 主要答案 | 可接受答案 | alt_zh |
| --- | --- | --- | --- | --- | --- |
| D-01 | fish | `It is a fish.` | `It is a fish.` | `It's a fish.` | 一條魚 |
| D-02 | tree | `It is a tree.` | `It is a tree.` | `It's a tree.` | 一棵樹 |
| D-03 | house | `It is a horse.` | `It is a house.` | `It's a house.` | 一棟房子 |
| D-04 | horse | `It is a house.` | `It is a horse.` | `It's a horse.` | 一匹馬 |
| D-05 | monkey | `It is a duck.` | `It is a monkey.` | `It's a monkey.` | 一隻猴子 |
| D-06 | elephant | `It is an elephant.` | `It is an elephant.` | `It's an elephant.` | 一隻大象 |
| D-07 | duck | `It is a monkey.` | `It is a duck.` | `It's a duck.` | 一隻鴨子 |

## 7. 候選關卡 E：我的身體（配合第 64、66 頁）

| 題號 | 來源／圖片 | 教材原句 | 主要答案 | 可接受答案 | alt_zh |
| --- | --- | --- | --- | --- | --- |
| E-01 | P64／toes | `They are my toes.` | `They are my toes.` | `They're my toes.` | 一雙腳，腳趾被標示 |
| E-02 | P64／nose | `They're my shoulders.` | `It is my nose.` | `It's my nose.` | 一個鼻子 |
| E-03 | P64／mouth | `It's my head.` | `It is my mouth.` | `It's my mouth.` | 一張嘴巴 |
| E-04 | P64／ears | `They're my ears.` | `They are my ears.` | `They're my ears.` | 一雙耳朵 |
| E-05 | P64／knees | `They're my knees.` | `They are my knees.` | `They're my knees.` | 一位扶著膝蓋的小孩 |
| E-06 | P66／hand | `It's a finger.` | `It is a hand.` | `It's a hand.` | 一隻張開的手 |
| E-07 | P66／fingers | `They are my fingers.` | `They are my fingers.` | `They're my fingers.` | 一隻張開的手，顯示多根手指 |
| E-08 | P66／eyes | `They're my eyes.` | `They are my eyes.` | `They're my eyes.` | 一雙眼睛 |
| E-09 | P66／hair | `It's my hair.` | `It is my hair.` | `It's my hair.` | 一位女孩的頭髮 |

排除：P64 第 1 圖是按摩／背部情境，單張圖片無法確定教材預期的 `back` 或 `shoulder`；第 5 圖像捲線或量尺，並非可安全判定的身體部位。P66 的 teapot、water、bottle 不重複塞入身體關卡，可留作後續日常物品題庫。

## 8. P78「My Head」暫緩項目

學生版 P78 與教師版 P71 都只有十二條交叉箭線及空格，沒有答案頁。箭線端點在眼睛、眉毛、耳朵、鼻子、嘴巴、鬍鬚、頭髮、頸部與肩膀附近交錯；目前無法逐題建立可稽核的唯一答案。

管理員若要納入，必須先提供一份逐題核准表：`1～12 -> body part -> 完整句 -> 圖片標記區域`。核准後應重新製作每題獨立裁圖或清楚高亮區域，不直接把整張交叉箭線圖當作自動評分題。未完成前狀態固定為 `BLOCKED_CONTENT_APPROVAL`，不建立草稿。

## 9. 兒童容錯與後端判定

- 必須辨識完整主詞、Be 動詞及核心名詞；只說名詞不能通關。
- `I am`／`I'm`、`you are`／`you're`、`it is`／`it's`、`that is`／`that's`、`they are`／`they're` 先正規化再比較。
- `couch`／`sofa`、`kid`／`child` 等同義詞只在核准清單內接受，不擴張成任意近義詞。
- STT 若只在冠詞 `a`／`an` 或縮寫符號上波動，可進入兒童容錯；核心名詞錯誤不能判為正確。
- 失敗提示只指出一個最重要差異，不播放題目答案；再次作答仍由學生開口。
- 前端不取得完整 accepted responses；後端從已發布版本取得答案並重新驗證 entitlement、題組狀態與順序。
- staff 預覽不寫進度、不發獎；學生維持循序解鎖。
- 圖片與示範音檔保持私人；示範音檔依文字與設定雜湊只生成一次，學生不能觸發付費 TTS。
- 原始學生錄音不保存，只保留必要評分與辨識結果。

## 10. 管理員核准欄位

| 關卡 | 內容核准人／時間 | 圖片權利 | 答案／人物分類複核 | 環境 E2E | 發布狀態 |
| --- | --- | --- | --- | --- | --- |
| A 我是誰？你是誰？ | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| B This 近處物品 | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| C That 遠處物品 | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| D It 是什麼？ | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| E 我的身體 | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| P78 My Head | 待填 | 待填 | `BLOCKED_CONTENT_APPROVAL` | `NOT_RUN` | `NOT_CREATED` |

所有必要欄位核准後，才可設計 Phase 4 的 additive schema／Function allowlist、兒童容錯契約與 idempotent 草稿建立流程；正式 migration、Function 部署及題組發布仍需依重大改動閘門另行授權。
