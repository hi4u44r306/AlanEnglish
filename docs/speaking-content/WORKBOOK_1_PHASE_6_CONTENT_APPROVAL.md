# Workbook 1 Phase 6 人工內容核准清單

最後更新：2026-09-15

狀態：已完成學生版 P82、P84、P89、P92、P94、P96、P109 與教師版可對應頁面的人工核對；尚待管理員確認題量、圖片權利、P109 方位詞及最終用語。這份文件不是資料庫 manifest；尚未建立草稿、上傳圖片、生成 TTS、執行 migration 或發布。

## 1. 來源對照

| 學生版 | 教師版 | 建議內容 | 核對結果 |
| --- | --- | --- | --- |
| P82 | P74 | 字母名稱前的 `a`／`an` | 題面一致；依字母名稱的開頭音判定，不依字母外形 |
| P84 | P76 | 名詞前的 `a`／`an` | 題面一致；36 題過長，選 12 題代表題；不自然的末三題排除 |
| P89 | P81 | 代名詞與 Be 動詞 | 題面一致；保留六個不涉及外貌判定的固定句 |
| P92 | 教師版相鄰單元，未找到完整同版頁 | 肯定／否定附加問句 | 難度偏高，且含 `fool`、身高與外貌評價；不列入初階主線 |
| P94 | P85 | 所有格否定附加問句 | 題面一致；含家人／伴侶假設、疑似 `type` 錯字，暫不建立 |
| P96 | P87 | `in`／`on`／`under` | 圖與題面一致；八題可客觀核對 |
| P109 | P99 | `here`／`there`／`over there` | 圖與題面一致；九題需管理員逐一確認箭頭與方位詞 |

## 2. 候選關卡 A：字母前面用 A 還是 An？（配合第 82 頁）

建議 interaction：`spoken_article_letter`。畫面顯示單一大寫字母，學生說完整句 `It's a B.` 或 `It's an A.`。26 題拆成 A～I、J～R、S～Z 三個短回合，避免單關過長；三回合仍可屬同一關卡進度。

| 字母 | 主要答案 | 字母 | 主要答案 | 字母 | 主要答案 |
| --- | --- | --- | --- | --- | --- |
| A | `It's an A.` | J | `It's a J.` | S | `It's an S.` |
| B | `It's a B.` | K | `It's a K.` | T | `It's a T.` |
| C | `It's a C.` | L | `It's an L.` | U | `It's a U.` |
| D | `It's a D.` | M | `It's an M.` | V | `It's a V.` |
| E | `It's an E.` | N | `It's an N.` | W | `It's a W.` |
| F | `It's an F.` | O | `It's an O.` | X | `It's an X.` |
| G | `It's a G.` | P | `It's a P.` | Y | `It's a Y.` |
| H | `It's an H.` | Q | `It's a Q.` | Z | `It's a Z.` |
| I | `It's an I.` | R | `It's an R.` |  |  |

`It is`／`It's` 等價。後端必須使用英文字母名稱的發音規則；特別是 `H`、`L`、`M`、`N`、`R`、`S`、`X` 用 `an`，`U`、`Q` 用 `a`。

## 3. 候選關卡 B：單字前面用 A 還是 An？（配合第 84 頁）

建議 interaction：`spoken_article_noun`。從原頁選 12 個代表題，學生說完整句；不要求一口氣完成 36 個高度重複項目。

| 題號 | 顯示單字 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| B-01 | apple | `It's an apple.` | `It is an apple.` |
| B-02 | mouse | `It's a mouse.` | `It is a mouse.` |
| B-03 | elephant | `It's an elephant.` | `It is an elephant.` |
| B-04 | insect | `It's an insect.` | `It is an insect.` |
| B-05 | octopus | `It's an octopus.` | `It is an octopus.` |
| B-06 | pen | `It's a pen.` | `It is a pen.` |
| B-07 | nurse | `It's a nurse.` | `It is a nurse.` |
| B-08 | question | `It's a question.` | `It is a question.` |
| B-09 | school | `It's a school.` | `It is a school.` |
| B-10 | bicycle | `It's a bicycle.` | `It is a bicycle.`；`It's a bike.` |
| B-11 | answer | `It's an answer.` | `It is an answer.` |
| B-12 | apartment | `It's an apartment.` | `It is an apartment.` |

排除：P84 第 34 題 `It's a/an yellow.` 把形容詞單獨當名詞，第 35 題 `It's a/an Gary.` 對一般專有姓名不自然，第 36 題 `It's a/an my car.` 的冠詞與所有格衝突；不得把它們存成正式答案。第 10 題 `She's a girl.` 與本關統一的 `It is + article + noun` 題型不同，也不納入。

## 4. 候選關卡 C：代名詞配 Be 動詞（配合第 89 頁）

建議 interaction：`pronoun_be_sentence`。畫面顯示挖空句，學生說完整句。這些是固定教材句，不根據學生本人外貌或能力評價。

| 題號 | 顯示句 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| C-01 | `I ___ a good student.` | `I am a good student.` | `I'm a good student.` |
| C-02 | `We ___ good students.` | `We are good students.` | `We're good students.` |
| C-03 | `You ___ a smart student.` | `You are a smart student.` | `You're a smart student.` |
| C-04 | `You ___ smart students.` | `You are smart students.` | `You're smart students.` |
| C-05 | `They ___ my friends.` | `They are my friends.` | `They're my friends.` |
| C-06 | `It ___ my pet cat.` | `It is my pet cat.` | `It's my pet cat.` |

排除 `He is a tall boy.` 與 `She is a pretty girl.`，避免把性別化外貌評價做成兒童必過判定。

## 5. 候選關卡 D：東西在哪裡？（配合第 96 頁）

建議 interaction：`picture_location_qa`。畫面顯示裁切圖片與問句，學生說完整回答。

| 題號 | 問句 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| D-01 | `Where is the man?` | `He is in the car.` | `He's in the car.` |
| D-02 | `Where is the girl?` | `She is on her bed.` | `She's on her bed.`；`She is on the bed.` |
| D-03 | `Where is the cat?` | `It is on the bed.` | `It's on the bed.` |
| D-04 | `Where is the girl?` | `She is under the table.` | `She's under the table.` |
| D-05 | `Where are the students?` | `They are on the bus.` | `They're on the bus.` |
| D-06 | `Where are the girl and the cat?` | `They are on the bench.` | `They're on the bench.` |
| D-07 | `Where are the pencils?` | `They are in the cup.` | `They're in the cup.`；`They are in the pencil cup.` |
| D-08 | `Where is the monkey?` | `It is in the box.` | `It's in the box.` |

## 6. 候選關卡 E：這裡還是那裡？（配合第 109 頁）

建議 interaction：`picture_location_adverb`。保留原頁編號與箭頭，發布前由管理員逐題確認近／遠與容器語意。

| 題號 | 圖片編號／提示 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| E-01 | 1／鳥在這裡 | `The bird is here.` | 無 |
| E-02 | 2／手錶在這邊 | `His watch is over here.` | `The watch is over here.` |
| E-03 | 3／鞋子在那邊 | `Her shoes are over there.` | `The shoes are over there.` |
| E-04 | 4／杯子在這裡 | `The cup is here.` | 無 |
| E-05 | 5／把箱子放在下方那裡 | `Put the box down there.` | 無 |
| E-06 | 6／雨傘在那裡面 | `The umbrella is in there.` | 無 |
| E-07 | 7／瓶子在這邊 | `Your bottle is over here.` | `The bottle is over here.` |
| E-08 | 8／門在那邊 | `The door is over there.` | 無 |
| E-09 | 9／很高興來到這裡 | `I am glad to be here.` | `I'm glad to be here.` |

E-01～E-09 是依原頁編號與中文提示整理的候選答案；教師版沒有另附答案。任何箭頭或編號重製後都必須重新核准，不能沿用舊答案雜湊。

## 7. 明確延後：P92、P94 附加問句

兩頁同時提高文法與語音辨識難度，而且包含 `fool`、`fat woman`、身高／外貌及多個家庭／伴侶關係假設；P94 還有疑似 `type` 的教材錯字。Phase 6 不將它們做成學生主線或自動判分題。若日後要做進階選修，必須先由管理員改寫成中性、自然、不羞辱的句子，並建立新的 adapted 版本與獨立核准紀錄。

## 8. 兒童容錯與後端判定

- `a`／`an` 依下一個詞實際開頭音判定；不可只看第一個字母，也不可接受兩者皆對。
- `It's`／`It is`、`He's`／`He is`、`She's`／`She is`、`They're`／`They are` 先正規化。
- 核心 article、Be 動詞、位置詞與名詞必須存在；只說名詞或介系詞不能通關。
- `bike`／`bicycle` 等只接受核准清單內同義詞，不用通用語意相似度放寬核心答案。
- 失敗提示一次只指出一個最重要差異，不播放完整答案。
- 前端不取得完整 accepted responses；後端從已發布版本取得答案並重新驗證 entitlement、題組狀態與順序。
- staff 預覽不寫進度、不發獎；學生維持循序解鎖。
- 圖片與示範音檔保持私人；示範音檔依文字與設定雜湊只生成一次，學生不能觸發付費 TTS。
- 原始學生錄音不保存，只保留必要評分與辨識結果。

## 9. 管理員核准欄位

| 關卡 | 內容核准人／時間 | 圖片權利 | 答案／位置複核 | 環境 E2E | 發布狀態 |
| --- | --- | --- | --- | --- | --- |
| A 字母 A／An | 待填 | 不適用 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| B 單字 A／An | 待填 | 不適用 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| C 代名詞 Be 動詞 | 待填 | 不適用 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| D In／On／Under | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| E Here／There | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| P92／P94 附加問句 | 不適用 | 不適用 | `EXCLUDED_PENDING_REWRITE` | `NOT_RUN` | `NOT_CREATED` |

所有必要欄位核准後，才可設計 Phase 6 的 additive schema／Function allowlist、兒童容錯契約與 idempotent 草稿建立流程；正式 migration、Function 部署及題組發布仍需依重大改動閘門另行授權。
