# Workbook 1 Phase 3 人工內容核准清單

最後更新：2026-09-15

狀態：已完成學生版 P39～P50 指定頁面與教師版可對應頁面的人工核對；尚待管理員確認圖片權利、物件名稱、題目難度與最終答案。這份文件不是資料庫 manifest；尚未建立草稿、上傳圖片、生成 TTS、執行 migration 或發布。

## 1. 來源對照

| 學生版 | 教師版 | 建議內容 | 核對結果 |
| --- | --- | --- | --- |
| P39 | P36、P40 | 看圖數量 | 圖片一致；數量由原圖人工計數，仍須管理員複核 |
| P40 | 未找到同版頁 | 近處複數物品 | 只以學生版為來源；單一 sandwich 圖不適合複數題，排除 |
| P42 | P38 | 英文算術 1 | 算式一致；`and` 不是明確運算符，排除 |
| P43 | P39 | 英文算術 2 | 算式一致；`and` 題排除，一題重複加法不納入以維持 12 題 |
| P46 | P42 | 整點時間 | 十二個時鐘一致，皆為整點 |
| P47 | P43 | 聽數字寫號碼 | 七組數字一致；轉為非聯絡用途的練習代碼口說 |
| P48 | P44 | 看號碼寫英文 | 教材列出可能是真實格式的號碼；不直接做學生必過題，不詢問家長電話 |
| P49 | P45 | 看圖數動物 | 圖片一致；動物數量由原圖人工計數，仍須管理員複核 |
| P50 | 未找到同版頁 | 遠處複數物品 | 只以學生版為來源；九組圖片需管理員確認名詞 |

## 2. 候選關卡 A：看圖數一數（配合第 39 頁）

建議 interaction：`picture_count_sentence`。畫面只顯示一組裁切圖片與 `How many ... are there?`；學生說完整句。數字單獨說對可作練習提示，但不能直接完成必過題。

| 題號 | 圖片 | 主要答案 | 可接受答案 | alt_zh |
| --- | --- | --- | --- | --- |
| A-01 | 16 顆足球 | `There are sixteen soccer balls.` | `There are sixteen footballs.`；`Sixteen soccer balls.` | 十六顆足球排成四列 |
| A-02 | 9 隻蝴蝶 | `There are nine butterflies.` | `Nine butterflies.` | 九隻藍色蝴蝶 |
| A-03 | 10 顆蘋果 | `There are ten apples.` | `Ten apples.` | 十顆紅蘋果 |
| A-04 | 12 根香蕉 | `There are twelve bananas.` | `Twelve bananas.` | 十二根香蕉 |
| A-05 | 16 隻狗 | `There are sixteen dogs.` | `Sixteen dogs.` | 十六隻卡通小狗 |
| A-06 | 12 個橡皮擦 | `There are twelve erasers.` | `Twelve erasers.` | 十二個橡皮擦 |
| A-07 | 9 隻牛 | `There are nine cows.` | `Nine cows.` | 九隻卡通乳牛 |
| A-08 | 9 輛腳踏車 | `There are nine bicycles.` | `There are nine bikes.`；`Nine bicycles.` | 九輛腳踏車 |
| A-09 | 9 枝鉛筆 | `There are nine pencils.` | `Nine pencils.` | 九枝鉛筆 |
| A-10 | 12 隻老鼠 | `There are twelve mice.` | `Twelve mice.` | 十二隻卡通老鼠 |
| A-11 | 6 輛汽車 | `There are six cars.` | `Six cars.` | 六輛紅色汽車 |
| A-12 | 12 隻動物 | `There are twelve animals.` | `Twelve animals.` | 十二個生肖動物圖案 |

## 3. 候選關卡 B：這些是什麼？（配合第 40 頁）

建議 interaction：`plural_picture_qa`。固定問句 `What are these?`，學生說完整回答；`What are they?` 視為同義問句，但不要求學生朗讀問句。

| 題號 | 圖片 | 主要答案 | 可接受答案 | alt_zh |
| --- | --- | --- | --- | --- |
| B-01 | oranges | `They are oranges.` | `These are oranges.` | 柳橙與切開的柳橙 |
| B-02 | phones | `They are phones.` | `They are telephones.`；`These are phones.` | 三種電話圖示 |
| B-03 | balls | `They are balls.` | `These are balls.` | 六種球 |
| B-04 | shoes | `They are shoes.` | `These are shoes.` | 一雙棕色鞋子 |
| B-05 | flowers | `They are flowers.` | `These are flowers.` | 一束粉紅色花朵 |
| B-06 | toys | `They are toys.` | `These are toys.` | 裝著玩具的箱子 |
| B-07 | rabbits | `They are rabbits.` | `These are rabbits.`；`They are bunnies.` | 兩隻兔子 |
| B-08 | gifts | `They are gifts.` | `These are gifts.`；`They are presents.` | 三個粉紅色禮物盒 |

排除：學生版的 sandwich 只有一個物件，卻位於複數回答版面。管理員未確認是否應改圖或改成單數前，不列入必過題。

## 4. 候選關卡 C：英文算一算（配合第 42～43 頁）

建議 interaction：`spoken_equation`。畫面顯示英文算式，學生說完整算式與答案。`equals`、`is` 可互換；Speech-to-Text 將數字轉成阿拉伯數字時須先正規化再判定。

| 題號 | 顯示算式 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| C-01 | `seven minus two` | `Seven minus two equals five.` | `Seven minus two is five.` |
| C-02 | `seven plus four` | `Seven plus four equals eleven.` | `Seven plus four is eleven.` |
| C-03 | `five plus three` | `Five plus three equals eight.` | `Five plus three is eight.` |
| C-04 | `twelve minus five` | `Twelve minus five equals seven.` | `Twelve minus five is seven.` |
| C-05 | `two plus two` | `Two plus two equals four.` | `Two plus two is four.` |
| C-06 | `ten minus nine` | `Ten minus nine equals one.` | `Ten minus nine is one.` |
| C-07 | `four plus three minus two` | `Four plus three minus two equals five.` | `Four plus three minus two is five.` |
| C-08 | `thirteen minus five plus three` | `Thirteen minus five plus three equals eleven.` | `Thirteen minus five plus three is eleven.` |
| C-09 | `thirteen minus seven` | `Thirteen minus seven equals six.` | `Thirteen minus seven is six.` |
| C-10 | `nine minus eight` | `Nine minus eight equals one.` | `Nine minus eight is one.` |
| C-11 | `eight minus three` | `Eight minus three equals five.` | `Eight minus three is five.` |
| C-12 | `six plus three` | `Six plus three equals nine.` | `Six plus three is nine.` |

排除：P42 的 `1 and 2`、P43 的 `four and eight`／`two and two` 沒有明確運算符；P43 的 `three plus three` 只是為控制題數排除，不代表教材答案錯誤。

## 5. 候選關卡 D：現在幾點？（配合第 46 頁）

建議 interaction：`clock_picture_qa`。固定問句 `What time is it?`；只使用原頁明確的整點，不延伸半點或分鐘。

| 題號 | 時鐘 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| D-01 | 8:00 | `It's eight o'clock.` | `It is eight o'clock.`；`Eight o'clock.` |
| D-02 | 5:00 | `It's five o'clock.` | `It is five o'clock.`；`Five o'clock.` |
| D-03 | 2:00 | `It's two o'clock.` | `It is two o'clock.`；`Two o'clock.` |
| D-04 | 3:00 | `It's three o'clock.` | `It is three o'clock.`；`Three o'clock.` |
| D-05 | 6:00 | `It's six o'clock.` | `It is six o'clock.`；`Six o'clock.` |
| D-06 | 11:00 | `It's eleven o'clock.` | `It is eleven o'clock.`；`Eleven o'clock.` |
| D-07 | 7:00 | `It's seven o'clock.` | `It is seven o'clock.`；`Seven o'clock.` |
| D-08 | 9:00 | `It's nine o'clock.` | `It is nine o'clock.`；`Nine o'clock.` |
| D-09 | 10:00 | `It's ten o'clock.` | `It is ten o'clock.`；`Ten o'clock.` |
| D-10 | 1:00 | `It's one o'clock.` | `It is one o'clock.`；`One o'clock.` |
| D-11 | 4:00 | `It's four o'clock.` | `It is four o'clock.`；`Four o'clock.` |
| D-12 | 12:00 | `It's twelve o'clock.` | `It is twelve o'clock.`；`Twelve o'clock.` |

## 6. 候選關卡 E：數字代碼朗讀（配合第 47～48 頁）

建議 interaction：`digit_sequence_reading`。為避免收集或誤用個資，畫面稱為「練習代碼」，不稱為學生／家長電話，也不提供撥號連結。以下只採 P47 已印出的練習序列；P48 第 8 題「父母手機號碼」永久排除。

| 題號 | 顯示代碼 | 主要答案分組 | 可接受正規化 |
| --- | --- | --- | --- |
| E-01 | `321-9568` | `three two one, nine five six eight` | 忽略逗號與連字號 |
| E-02 | `705-4386` | `seven oh five, four three eight six` | `oh`／`zero` 等價 |
| E-03 | `0919-435-413` | `oh nine one nine, four three five, four one three` | `oh`／`zero` 等價 |
| E-04 | `020-6294-0780` | `oh two oh, six two nine four, oh seven eight oh` | `oh`／`zero` 等價 |
| E-05 | `029-7018-0376` | `oh two nine, seven oh one eight, oh three seven six` | `oh`／`zero` 等價 |
| E-06 | `718-650-3211` | `seven one eight, six five oh, three two, one one` | `double one` 與 `one one` 等價 |
| E-07 | `619-852-7754` | `six one nine, eight five two, double seven, five four` | `double seven` 與 `seven seven` 等價 |

後端評分應比較數字序列，不把 `oh` 誤判成字母 O，也不因 `double`／`treble` 展開方式不同而判錯。任何作答內容都不得保存成個人電話欄位。

## 7. 候選關卡 F：誰有幾隻動物？（配合第 49 頁）

建議 interaction：`picture_count_sentence`。學生說完整主詞、動詞、數量與動物名詞；單複數錯誤可提示重試，但不得把正確數量誤判為完全錯誤。

| 題號 | 問句 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| F-01 | `How many dogs does the man have?` | `He has three dogs.` | `The man has three dogs.` |
| F-02 | `How many cats does the woman have?` | `She has five cats.` | `The woman has five cats.` |
| F-03 | `How many frogs does the man have?` | `He has nine frogs.` | `The man has nine frogs.` |
| F-04 | `How many fish does the man have?` | `He has twelve fish.` | `The man has twelve fish.` |
| F-05 | `How many chickens does the woman have?` | `She has seven chickens.` | `The woman has seven chickens.` |
| F-06 | `How many birds does the woman have?` | `She has six birds.` | `The woman has six birds.` |
| F-07 | `How many mice does the man have?` | `He has two mice.` | `The man has two mice.` |
| F-08 | `How many mice does the woman have?` | `She has one mouse.` | `The woman has one mouse.` |
| F-09 | `How many snakes does the woman have?` | `She has three snakes.` | `The woman has three snakes.` |

P49 圖片把 guinea pigs 作為 `mice` 教材題目的一部分；正式發布前管理員必須決定沿用教材名詞或替換圖片，不能由系統自行更名。

## 8. 候選關卡 G：那些是什麼？（配合第 50 頁）

建議 interaction：`plural_picture_qa`。固定問句 `What are those?`，學生說完整回答。

| 題號 | 圖片 | 主要答案 | 可接受答案 | alt_zh |
| --- | --- | --- | --- | --- |
| G-01 | cars | `They are cars.` | `Those are cars.` | 四輛汽車 |
| G-02 | bicycles | `They are bicycles.` | `They are bikes.`；`Those are bicycles.` | 兩輛腳踏車 |
| G-03 | drums | `They are drums.` | `Those are drums.` | 兩個鼓 |
| G-04 | cameras | `They are cameras.` | `Those are cameras.` | 三台相機 |
| G-05 | buses | `They are buses.` | `Those are buses.` | 三輛公車 |
| G-06 | trucks | `They are trucks.` | `Those are trucks.` | 兩輛卡車 |
| G-07 | paper airplanes | `They are paper airplanes.` | `They are paper planes.`；`Those are paper airplanes.` | 三架紙飛機 |
| G-08 | motorcycles | `They are motorcycles.` | `They are motorbikes.`；`Those are motorcycles.` | 兩輛機車 |
| G-09 | boats | `They are boats.` | `Those are boats.` | 四艘船 |

## 9. 發布前固定閘門

- P39、P49 的每組數量由管理員再次逐圖計數；圖片修改後必須重新核准答案。
- P40、P50 沒有在提供的教師版找到同版頁，不能把本文件候選名詞當成教師答案。
- 數字辨識先正規化阿拉伯數字、英文數字、`oh`／`zero`、`double`／重複數字，再依題型判定。
- 電話題永不詢問學生或家長真實號碼，也不把作答保存為電話資料。
- 前端不取得完整 accepted responses；後端從已發布版本取得答案並重新驗證 entitlement、題組狀態與順序。
- 圖片與示範音檔保持私人；示範音檔依文字與設定雜湊只生成一次，學生不能觸發付費 TTS。
- staff 預覽不寫進度、不發獎；學生維持循序解鎖。
- 原始學生錄音不保存，僅保留必要評分與辨識結果。

## 10. 管理員核准欄位

| 關卡 | 內容核准人／時間 | 圖片權利 | 數量／答案複核 | 環境 E2E | 發布狀態 |
| --- | --- | --- | --- | --- | --- |
| A 看圖數一數 | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| B 這些是什麼 | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| C 英文算一算 | 待填 | 不適用 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| D 現在幾點 | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| E 數字代碼朗讀 | 待填 | 不適用 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| F 誰有幾隻動物 | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| G 那些是什麼 | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |

所有必要欄位核准後，才可設計 Phase 3 的 additive schema／Function allowlist 與 idempotent 草稿建立流程；正式 migration、Function 部署及題組發布仍需依重大改動閘門另行授權。
