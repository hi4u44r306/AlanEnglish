# Workbook 1 Phase 2 人工內容核准清單

最後更新：2026-09-15

狀態：已完成學生版 P26～P28、P32、P34～P36、P85 與可對應教師版頁面的人工核對；尚待管理員確認用詞、圖片權利與最終題目。這是規格與核准清單，不是可直接匯入資料庫的 manifest；本批尚未建立草稿、上傳圖片、生成 TTS 或發布。

## 1. 來源與核對結果

| 學生版頁面 | 教師版核對頁 | 建議關卡 | 核對狀態 |
| --- | --- | --- | --- |
| P26～P27 | P23～P24 | 完整句與縮寫 | 題型與文字一致；教材中的 `itn't` 為明顯拼字錯誤，不得成為標準答案 |
| P28 | P25 | 顏色快問快答 | 圖片一致，但教師版不是答案本；歧義顏色須排除或另行核准 |
| P32 | P29 | 客廳物品 | 圖片與箭頭一致，但原頁沒有英文答案；只作 P34 詞彙交叉參考 |
| P34 | P31 | 客廳裡有什麼？ | 九組問句與圖片一致；`rug`／`carpet`、`table`／`coffee table` 需保留同義答案 |
| P35～P36 | P32～P33 | 打招呼與禮貌對話 | 文字一致；負面干擾選項不放入學生提示；過時說法不列主線必過 |
| P85 | 未找到同版對應頁 | 日常問候複習 | 學生新版有十個片語；教師版同頁區段為不同內容，不據此臆造答案 |

教材圖片只能透過既有管理員流程上傳私人資產。每張圖片的裁切範圍、來源頁、替代文字與使用權都要核准；文件不記錄 R2 object key、signed URL 或任何 Secret。

## 2. 候選關卡 A：完整句與縮寫（配合第 26～27 頁）

建議 interaction：`sentence_transformation`。畫面顯示未縮寫句或圖片提示，學生必須說完整句；縮寫與完整形式都可接受，不因 Speech-to-Text 是否輸出 apostrophe 而判錯。

| 題號 | 畫面提示 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| A-01 | `What is this?` 請用縮寫說一次 | `What's this?` | `What is this?` |
| A-02 | `It is a cat.` 請用縮寫說一次 | `It's a cat.` | `It is a cat.` |
| A-03 | `What is that?` 請用縮寫說一次 | `What's that?` | `What is that?` |
| A-04 | `That is a mouse.` 請用縮寫說一次 | `That's a mouse.` | `That is a mouse.` |
| A-05 | `Is this a pen? Yes, it is. It is a pen.` 請用縮寫說一次 | `Yes, it is. It's a pen.` | `Yes, it is. It is a pen.` |
| A-06 | `Is that a pencil? No, it is not.` 請用縮寫說一次 | `No, it isn't.` | `No, it is not.`；`No, it's not.` |
| A-07 | 圖片：chair | `This is a chair, isn't it?` | `This is a chair, is it not?` |
| A-08 | 圖片：desk | `That is a desk, isn't it?` | `That is a desk, is it not?` |
| A-09 | 圖片：cat；提示「不是狗」 | `It is not a dog, is it?` | `It isn't a dog, is it?`；`It's not a dog, is it?` |

排除：P26 的鴨子圖片搭配 `This is not a duck, is it?` 是文法填空而非真實看圖語意，容易讓孩子困惑；P27 第 7 題的改疑問句版面也可能同時導向 `Isn't it an eraser?` 與 `Is it not an eraser?`。兩題在管理員確認教學目標前都不納入自動判定。

## 3. 候選關卡 B：顏色快問快答（配合第 28 頁）

建議 interaction：`picture_qa`。固定問句為 `What color is it?`，學生說 `It is ...` 或 `It's ...`。只保留圖像與教材顏色都清楚的七題。

| 題號 | 圖片 | 主要答案 | 可接受答案 | alt_zh |
| --- | --- | --- | --- | --- |
| B-01 | apple | `It is red.` | `It's red.` | 一顆紅蘋果 |
| B-02 | orange | `It is orange.` | `It's orange.` | 一顆橘色柳橙 |
| B-03 | banana | `It is yellow.` | `It's yellow.` | 一根黃色香蕉 |
| B-04 | sky | `It is blue.` | `It's blue.` | 藍色天空 |
| B-05 | blueberries | `They are blue.` | `They're blue.`；`The berries are blue.` | 一碗藍莓 |
| B-06 | cloud | `It is white.` | `It's white.`；`The cloud is white.` | 一朵白雲 |
| B-07 | coffee | `It is brown.` | `It's brown.`；`The coffee is brown.` | 一杯棕色咖啡 |

排除：forest 受季節與插圖色調影響；eggplant 插圖不是典型紫色；自己的頭髮、老人的頭髮屬個人或灰／白歧義；rainbow 為多色開放答案。這些不得成為學生必過題。

## 4. 候選關卡 C：客廳裡有什麼？（配合第 32、34 頁）

建議 interaction：`picture_qa`。P32 只用來確認生活場景與物件，標準問答以 P34 的九組圖片為準。否定題必須說出正確物件，不能只回答 `No`。

| 題號 | 畫面問句／圖片 | 主要答案 | 可接受答案 | alt_zh |
| --- | --- | --- | --- | --- |
| C-01 | `Is it a vase?`／vase | `Yes, it is.` | `Yes, it is a vase.` | 一個花瓶 |
| C-02 | `Is that a couch?`／couch | `Yes, it is.` | `Yes, that is a couch.` | 一張沙發 |
| C-03 | `Is it a television?`／window | `No, it isn't. It is a window.` | `No, it's not. It's a window.` | 一扇窗戶 |
| C-04 | `Is it a family picture?`／family picture | `Yes, it is.` | `Yes, it is a family picture.` | 一張全家福照片 |
| C-05 | `Is that a desk?`／rug | `No, it isn't. It is a rug.` | `No, it's not. It's a rug.`；以 `carpet` 取代 `rug` | 一張地毯 |
| C-06 | `Is that a cabinet?`／cabinet | `Yes, it is.` | `Yes, that is a cabinet.` | 一個客廳櫃子 |
| C-07 | `Is this a chair?`／lamp | `No, it isn't. It is a lamp.` | `No, it's not. It's a lamp.` | 一盞立燈 |
| C-08 | `Is that a curtain?`／curtain | `Yes, it is.` | `Yes, that is a curtain.` | 一幅窗簾 |
| C-09 | `Is it a bench?`／coffee table | `No, it isn't. It is a coffee table.` | `No, it's not. It's a table.`；`No, it is not. It is a coffee table.` | 一張客廳茶几 |

## 5. 候選關卡 D：看情境說問候（配合第 35、85 頁）

建議 interaction：`situation_phrase`。畫面以情境圖與中文提示呈現，不在作答前朗讀英文標準答案。

| 題號 | 情境提示 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| D-01 | 早上見面 | `Good morning.` | `Good morning!` |
| D-02 | 一般見面打招呼 | `Hello.` | `Hi.` |
| D-03 | 第一次見面 | `Nice to meet you.` | `It's nice to meet you.` |
| D-04 | 要離開、說再見 | `Goodbye.` | `Good bye.`；`Bye.` |
| D-05 | 問候對方近況 | `How are you?` | `How are you doing?` |
| D-06 | 睡前道晚安 | `Good night.` | `Goodnight.` |
| D-07 | 晚上見面 | `Good evening.` | `Good evening!` |
| D-08 | 下午見面 | `Good afternoon.` | `Good afternoon!` |

P85 的 `What is your name?` 應另走個人回答模型，不把真實姓名寫成公開答案；`How do you do?` 現代兒童日常使用率低，保留為教材來源說明，不列主線必過。

## 6. 候選關卡 E：禮貌回答（配合第 36 頁）

建議 interaction：`dialogue_response`。畫面顯示對方的一句話，學生說自然完整回應；教材中的負面干擾選項不得出現在提示、accepted responses 或朗讀音檔。

| 題號 | 對方說 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| E-01 | `Hi.` | `Hello.` | `Hi.`；`Hello!` |
| E-02 | `How are you?` | `Great, thanks.` | `I'm great, thanks.`；`I'm fine, thank you.`；`Good, thanks.` |
| E-03 | `Good night.` | `Good night.` | `Goodnight.`；教材原選項 `See you.` |
| E-04 | `Nice to meet you.` | `Nice to meet you, too.` | `Me too.`；`Nice meeting you, too.` |
| E-05 | `Good afternoon.` | `Good afternoon.` | `Good afternoon!` |
| E-06 | `What's your name?` | 結構化個人回答：`My name is {display_name}.` | `{display_name}.`；不得把 `Frank` 當成所有學生唯一答案 |

排除：`How do you do?` 不列主線必過。若管理員仍要保留，只能作選用教材複習，且接受相同回覆 `How do you do?`。

## 7. 發布前固定閘門

- 每關維持 6～12 題；固定答案、同義答案與個人化答案分開建模。
- 前端不得收到 accepted responses 或完整評分規則；後端依已發布版本判定。
- Speech-to-Text 的大小寫、標點、apostrophe、`it's`／`it is` 等正規化差異不得誤判。
- 圖片題逐一確認裁切、來源頁、alt_zh、MIME、私人資產狀態與使用權。
- 管理員與老師可預覽所有已發布關卡，但不寫學生進度、不發獎。
- 學生循序解鎖；未發布或未核准題組不可從直接網址進入。
- 示範音檔只在發布或補產生時建立一次並依內容雜湊重用；學生播放不觸發 TTS。
- 原始錄音只在瀏覽器暫存，送評後不保存私人錄音物件。

## 8. 管理員核准欄位

| 關卡 | 內容核准人／時間 | 圖片權利 | 個人回答規則 | 環境 E2E | 發布狀態 |
| --- | --- | --- | --- | --- | --- |
| A 完整句與縮寫 | 待填 | 待填 | 不適用 | `NOT_RUN` | `NOT_CREATED` |
| B 顏色快問快答 | 待填 | 待填 | 不適用 | `NOT_RUN` | `NOT_CREATED` |
| C 客廳裡有什麼 | 待填 | 待填 | 不適用 | `NOT_RUN` | `NOT_CREATED` |
| D 看情境說問候 | 待填 | 待填 | 不適用 | `NOT_RUN` | `NOT_CREATED` |
| E 禮貌回答 | 待填 | 視素材而定 | 待核准 | `NOT_RUN` | `NOT_CREATED` |

只有所有必要欄位核准後，才可設計 additive migration／Function 變更與 idempotent 草稿建立流程；正式 migration、Function 部署與發布仍需依重大改動閘門另行授權。
