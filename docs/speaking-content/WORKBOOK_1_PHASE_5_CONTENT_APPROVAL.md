# Workbook 1 Phase 5 人工內容核准清單

最後更新：2026-09-15

狀態：已完成學生版 P60、P70～P71、P73、P75、P79～P80、P87、P90、P100 與教師版可對應頁面的人工核對；尚待管理員確認補句答案、圖片權利、自然用語與是否納入選用對話。這份文件不是資料庫 manifest；尚未建立草稿、上傳圖片、生成 TTS、執行 migration 或發布。

## 1. 來源對照

| 學生版 | 教師版 | 建議內容 | 核對結果 |
| --- | --- | --- | --- |
| P60 | 未找到同版頁 | 早晨句型與人物 | 只有句型及人物空格，沒有固定配對答案；只作非計分暖身候選 |
| P70 | 未找到同版頁 | 下午句型 | 只有句型與重複人物圖，沒有回答；只作非計分暖身候選 |
| P71 | P64 | 我的早晨 | 題面一致但教師版也沒有答案；可依中文提示整理候選完整句，需管理員核准 |
| P73 | P66 | 我的下午 | 題面一致但教師版也沒有答案；九句需管理員核准自然用語 |
| P75 | P68 | 我的晚上 | 題面一致但教師版也沒有答案；八句需管理員核准自然用語 |
| P79 | P72 | 稱謂與婚姻狀態 | 題面一致；依性別、年齡及婚姻狀態分類較過時，不建立學生必過關卡 |
| P80 | 未找到同版頁 | 晚間句型與人物 | 沒有固定配對答案；只作非計分暖身候選 |
| P87 | P79 | Family Tree | 圖與題目一致；七題均可由家族圖客觀核對 |
| P90 | 未找到同版頁 | 睡前句型與人物 | 沒有固定配對答案，部分內容涉及家庭界線；只作非計分暖身候選 |
| P100 | 未找到同版頁 | 早安／晚安對話 | 有完整雙人台詞，但包含家庭假設、品牌與不自然說法；改寫核准前不進主線 |

## 2. 候選關卡 A：我的早晨（配合第 71 頁）

建議 interaction：`daily_routine_sentence`。畫面顯示原頁小圖與中文提示，學生說完整英文句；不可只說空格單字。下列答案依教材中文提示及句型重建，管理員核准前只屬候選，不能作正式後端答案。

| 題號 | 中文提示 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| A-01 | 夏天五點半日出，這是清晨 | `The sun rises at five thirty a.m. in summer. It's early morning.` | `The sun rises at 5:30 a.m. in summer. It is early morning.` |
| A-02 | 清晨介於五點到八點 | `Early morning is from five to eight o'clock.` | 數字或英文數字正規化後等價 |
| A-03 | 我通常早起 | `I usually get up early.` | 無 |
| A-04 | 我七點吃早餐 | `I have breakfast at seven.` | `I eat breakfast at seven.` |
| A-05 | 我也很早去上學 | `I also go to school early.` | 無 |
| A-06 | 我上學從不遲到 | `I never go to school late.` | `I am never late for school.` |
| A-07 | 我早上有四堂課 | `I have four classes in the morning.` | `I have four lessons in the morning.` |
| A-08 | 我在中午吃午餐 | `I have lunch at noon.` | `I eat lunch at noon.` |

## 3. 候選關卡 B：我的下午（配合第 73 頁）

建議 interaction：`daily_routine_sentence`。固定人物 Jim 只是教材角色，不要求學生提供自己的作息。

| 題號 | 中文提示 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| B-01 | Jim 午餐後小睡 | `Jim takes a nap after lunch.` | 無 |
| B-02 | Jim 午休後總是覺得累 | `Jim always feels tired after a nap.` | 無 |
| B-03 | Jim 不喜歡下午課 | `Jim doesn't like afternoon classes.` | `Jim does not like afternoon classes.` |
| B-04 | Jim 喜歡上午課 | `Jim likes morning classes.` | 無 |
| B-05 | 你喜歡上午或下午課？ | `Do you like to take morning or afternoon classes?` | `Do you like morning or afternoon classes?` |
| B-06 | Jim 下午有四堂課 | `Jim has four classes in the afternoon.` | `Jim has four lessons in the afternoon.` |
| B-07 | Jim 擅長數學和體育 | `Jim is good at math and P.E.` | `Jim is good at math and PE.` |
| B-08 | Jim 放學後走回家 | `Jim walks home after school.` | 無 |
| B-09 | Jim 在傍晚吃晚餐 | `Jim has dinner in the evening.` | `Jim eats dinner in the evening.` |

B-05 是一般偏好問句，若保留為必過題，只要求學生朗讀教材句，不收集或保存個人偏好。

## 4. 候選關卡 C：我的晚上（配合第 75 頁）

| 題號 | 中文提示 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| C-01 | Tina 在傍晚遛狗 | `Tina walks her dog in the evening.` | 無 |
| C-02 | Tina 有時候和朋友玩 | `Sometimes, Tina plays with her friends.` | `Tina sometimes plays with her friends.` |
| C-03 | Tina 七點半洗澡 | `Tina takes a shower at seven thirty.` | `Tina takes a shower at 7:30.` |
| C-04 | Tina 九點前做完功課 | `Tina does her homework before nine.` | `Tina does her homework before 9.` |
| C-05 | Tina 總是準時睡覺 | `Tina always goes to bed on time.` | 無 |
| C-06 | Tina 的媽媽夜間做家事 | `Tina's mom does housework at night.` | `Tina's mother does housework at night.`；`house work` 正規化為 `housework` |
| C-07 | Tina 的爸爸直到午夜才睡 | `Tina's dad doesn't sleep until midnight.` | `Tina's father does not sleep until midnight.` |
| C-08 | 他們絕不會整晚熬夜不睡 | `They never stay up all night.` | 無 |

C-06／C-07 沿用教材角色，不延伸成「媽媽一定做家事」或「爸爸一定晚睡」的家庭刻板印象；管理員可在發布前改成中性角色，改寫後必須建立新內容版本。

## 5. 候選關卡 D：Jack 的家人（配合第 87 頁）

建議 interaction：`family_tree_qa`。畫面顯示同一張虛構家族圖及一個問題，學生說完整回答。資料只屬教材角色，不詢問學生真實家庭成員。

| 題號 | 問句 | 主要答案 | 可接受答案 |
| --- | --- | --- | --- |
| D-01 | `How many people are there in Jack's family?` | `There are eight people in Jack's family.` | `There are eight.` |
| D-02 | `How many parents does Jack have?` | `He has two parents.` | `Jack has two parents.` |
| D-03 | `How many sisters does Jack have?` | `He has one sister.` | `Jack has one sister.` |
| D-04 | `How many grandparents does Jack have?` | `He has four grandparents.` | `Jack has four grandparents.` |
| D-05 | `Who is Jack's sister?` | `Jean is Jack's sister.` | `His sister is Jean.` |
| D-06 | `Who is Jack's father?` | `Mike is Jack's father.` | `His father is Mike.` |
| D-07 | `Who is Jack's mother?` | `Judy is Jack's mother.` | `His mother is Judy.` |

D-01～D-04 的數字須由管理員再次對照家族連線核准；圖片若重製或裁切，必須重新檢查人物數與關係。

## 6. 非計分暖身候選：P60、P70、P80、P90

這四頁列出早晨、下午、晚間或睡前句型，旁邊放置多個人物與空白線，但沒有把人物綁定到唯一台詞，也沒有提供回答。若要使用，只能設計成學生自由點選句子跟讀的非計分暖身：

- 不計入主線通關或下一關解鎖。
- 不宣稱某個人物是唯一說話者。
- 不把自由回答送進嚴格正誤評分。
- 不收集真實家庭作息、睡眠安排或其他不必要個資。
- 若日後補上管理員核准的角色／句子配對，必須建立獨立版本與測試。

## 7. 延後內容：P79 與 P100

P79 以 `Mr.`、`Mrs.`、`Ms.`、`Miss` 推論性別、年齡與婚姻狀態，且包含「成年男性 18 歲以上」的舊式說明。它不適合作為國小學生自動判定必過關卡，Phase 5 先排除。

P100 有早安與晚安雙人對話，可在改寫後成為角色扮演候選，但目前包含 `Go ask your mom`、`McDonald's`、要求與家長同睡及 `Toothfairy` 等家庭假設、品牌或不自然台詞。管理員須先核准一份去品牌、尊重不同家庭型態且自然的完整對話；改寫不得冒充教材原句，應保存 `adapted_from_page: 100` 與新版本來源。

## 8. 兒童容錯、隱私與發布護欄

- contraction、標點、大小寫及阿拉伯數字／英文數字先正規化，再比較核心動詞、時間與名詞。
- `have`／`eat` breakfast 或 lunch、`classes`／`lessons` 等只接受核准清單內同義句。
- 時間題不能只因 STT 輸出 `7:30` 或 `seven thirty` 不同而判錯。
- 學生只說空格單字不能完成句子關卡；失敗提示一次只指出一個最重要差異。
- 個人偏好、家庭成員、睡眠與作息回答不保存成公開標準答案，也不作帳號資料。
- 前端不取得完整 accepted responses；後端從已發布版本取得答案並重新驗證 entitlement、題組狀態與順序。
- staff 預覽不寫進度、不發獎；學生維持循序解鎖。
- 圖片與示範音檔保持私人；示範音檔依文字與設定雜湊只生成一次，學生不能觸發付費 TTS。
- 原始學生錄音不保存，只保留必要評分與辨識結果。

## 9. 管理員核准欄位

| 關卡 | 內容核准人／時間 | 圖片權利 | 答案／自然用語複核 | 環境 E2E | 發布狀態 |
| --- | --- | --- | --- | --- | --- |
| A 我的早晨 | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| B 我的下午 | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| C 我的晚上 | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| D Jack 的家人 | 待填 | 待填 | 待填 | `NOT_RUN` | `NOT_CREATED` |
| P60／P70／P80／P90 暖身 | 待填 | 待填 | `OPTIONAL_UNSCORED` | `NOT_RUN` | `NOT_CREATED` |
| P79 稱謂 | 不適用 | 不適用 | `EXCLUDED` | `NOT_RUN` | `NOT_CREATED` |
| P100 對話 | 待填 | 待填 | `BLOCKED_REWRITE_APPROVAL` | `NOT_RUN` | `NOT_CREATED` |

所有必要欄位核准後，才可設計 Phase 5 的 additive schema／Function allowlist、兒童容錯契約與 idempotent 草稿建立流程；正式 migration、Function 部署及題組發布仍需依重大改動閘門另行授權。
