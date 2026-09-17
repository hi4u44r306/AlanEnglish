# Workbook 1 P21／P22 人工內容核准清單

最後更新：2026-09-15

狀態：已依學生版實際頁面完成逐題人工轉錄，等待管理員確認用詞、教學範圍與圖片使用權。這份文件是人工審查清單，不是可直接匯入資料庫的 manifest；尚未核准的欄位不得以 OCR、測試 fixture 或推測內容補齊。

## 1. 使用方式

1. 逐題對照 Workbook 1 P21／P22 原頁與教師版。
2. 先填內容與學生可見替代文字，再由另一位核准者確認圖片、冠詞、單複數、所有格及完整句。
3. 正式匯入仍使用既有管理員 P21／P22 人工內容流程；不要把本表另做成第二套 JSON／CSV 匯入器。
4. 圖片只在管理員流程中上傳私人 R2。本文件不得記錄 R2 object key、signed URL、Secret、供應商原始回應、學生資料或本機絕對路徑。
5. 「內容核准」與「環境 E2E」分開記錄；內容已核准不代表圖片、音檔、權限與麥克風驗收已通過。

題組共同資料：

| 欄位 | P21 | P22 |
| --- | --- | --- |
| 教材／版本 | Workbook 1 student 新版／119 頁 PDF | Workbook 1 student 新版／119 頁 PDF |
| 正式來源識別 | 學生版 P21；教師版沒有相同頁 | 學生版 P22；教師版 P19 為相同版面 |
| 實際題數 | 原頁確認 9 個圖片題位 | 原頁確認 9 個 A-I 圖片題位 |
| interaction type | `picture_qa` | `picture_gap_sentence` |
| source page | `P21` | `P22` |
| 內容核准人／時間 | 待填 | 待填 |
| 圖片使用權確認 | 待填 | 待填 |
| 環境 E2E | `NOT_RUN` | `NOT_RUN` |

## 2. P21 看圖完整問答

學生版 P21 原頁顯示 9 個物件及示例句型 `What is that? It is a ____.`，另列出 `Is it Mary's? Yes, it's hers. (No, it's not.)`，但沒有把各圖片綁定 Mary 所有權或肯定／否定。為避免臆造答案，本關候選內容只採可由原頁直接核對的第一組完整問答；所有權延伸句不納入自動判定。每列仍須由管理員逐題核准後才能建立草稿。

| 題位 | 圖片／來源題號 | 名詞、冠詞與所有權 | 完整問句 | 完整回答 | 可接受的完整說法 | 學生可見 alt_zh | 圖片權利／內容核准 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P21-01 | 彩色球／第 1 圖 | a ball；所有權未指定 | `What is that?` | `It is a ball.` | `What is that? It is a ball.`；`What's that? It's a ball.` | 一顆彩色球 | 原頁已核對；用詞與圖片權利待核准 |
| P21-02 | 禮物／第 2 圖 | a gift；所有權未指定 | `What is that?` | `It is a gift.` | `What is that? It is a gift.`；`What's that? It's a gift.` | 一份綁著蝴蝶結的禮物 | 原頁已核對；用詞與圖片權利待核准 |
| P21-03 | 小鳥／第 3 圖 | a bird；所有權未指定 | `What is that?` | `It is a bird.` | `What is that? It is a bird.`；`What's that? It's a bird.` | 一隻小鳥 | 原頁已核對；用詞與圖片權利待核准 |
| P21-04 | 貓／第 4 圖 | a cat；所有權未指定 | `What is that?` | `It is a cat.` | `What is that? It is a cat.`；`What's that? It's a cat.` | 一隻坐著的貓 | 原頁已核對；用詞與圖片權利待核准 |
| P21-05 | 奶瓶／第 5 圖 | a bottle；所有權未指定 | `What is that?` | `It is a bottle.` | `What is that? It is a bottle.`；`What's that? It's a bottle.` | 一個嬰兒奶瓶 | 原頁已核對；`bottle` 用詞與圖片權利待核准 |
| P21-06 | 老鼠／第 6 圖 | a mouse；所有權未指定 | `What is that?` | `It is a mouse.` | `What is that? It is a mouse.`；`What's that? It's a mouse.` | 一隻灰色小老鼠 | 原頁已核對；用詞與圖片權利待核准 |
| P21-07 | 玩具熊／第 7 圖 | a teddy bear；所有權未指定 | `What is that?` | `It is a teddy bear.` | `What is that? It is a teddy bear.`；`What's that? It's a teddy bear.` | 一隻粉紅色玩具熊 | 原頁已核對；`teddy bear` 用詞與圖片權利待核准 |
| P21-08 | 洋娃娃／第 8 圖 | a doll；所有權未指定 | `What is that?` | `It is a doll.` | `What is that? It is a doll.`；`What's that? It's a doll.` | 一個金髮洋娃娃 | 原頁已核對；用詞與圖片權利待核准 |
| P21-09 | 床／第 9 圖 | a bed；所有權未指定 | `What is that?` | `It is a bed.` | `What is that? It is a bed.`；`What's that? It's a bed.` | 一張鋪著紫色棉被的床 | 原頁已核對；用詞與圖片權利待核准 |

逐題核准要求：

- 圖片與問答對象一一相符。
- 問句須以問號結尾；完整評分目標為「問句＋回答」。
- 肯定／否定、Mary's／hers 等所有格與代名詞須依原頁核對。
- `alt_zh` 會提供給學生與螢幕閱讀器，只描述圖片，不得直接揭露完整標準答案。

## 3. P22 看圖補完整句

學生版 P22 與教師版 P19 的版面一致，圖片依英文字母 A-I 排列；下表已依兩份原頁完成候選轉錄。每題恰有一個空格，完整答案不得只填單字；管理員仍須確認圖片使用權與教材預期用詞後才能建立草稿。

| 題位 | 核准句型 | 圖片主詞 | 核准完整句 | 可接受的完整說法 | 學生可見 alt_zh | 圖片權利／內容核准 |
| --- | --- | --- | --- | --- | --- | --- |
| P22-01 | `The ____ is in the tree.` | apple | `The apple is in the tree.` | `The apple is in the tree.` | 一顆蘋果和一棵蘋果樹 | 兩份原頁已核對；圖片權利待核准 |
| P22-02 | `The ____ is on the floor.` | ball | `The ball is on the floor.` | `The ball is on the floor.` | 一顆彩色球和木地板 | 兩份原頁已核對；圖片權利待核准 |
| P22-03 | `The ____ is in the desert.` | camel | `The camel is in the desert.` | `The camel is in the desert.` | 一隻駱駝和沙漠 | 兩份原頁已核對；圖片權利待核准 |
| P22-04 | `The ____ is in the pond.` | duck | `The duck is in the pond.` | `The duck is in the pond.` | 一隻黃色小鴨和池塘 | 兩份原頁已核對；圖片權利待核准 |
| P22-05 | `The ____ is in the forest.` | elephant | `The elephant is in the forest.` | `The elephant is in the forest.` | 一隻大象和森林 | 兩份原頁已核對；圖片權利待核准 |
| P22-06 | `The ____ is in the river.` | fish | `The fish is in the river.` | `The fish is in the river.` | 一條魚和河流 | 兩份原頁已核對；圖片權利待核准 |
| P22-07 | `The ____ is on the prairie.` | giraffe | `The giraffe is on the prairie.` | `The giraffe is on the prairie.` | 一隻長頸鹿和草原 | 兩份原頁已核對；圖片權利待核准 |
| P22-08 | `The ____ is in the race.` | horse | `The horse is in the race.` | `The horse is in the race.` | 一匹馬和賽馬場景 | 兩份原頁已核對；圖片權利待核准 |
| P22-09 | `The ____ is in my mouth.` | ice | `The ice is in my mouth.` | `The ice is in my mouth.` | 一塊冰和嘴巴 | 兩份原頁已核對；圖片權利待核准 |

### P23／P24 邊界

- 學生版 P23／教師版 P20 延續 J-R，共 9 題。
- 學生版 P24／教師版 P21 延續 S-Z，共 8 題。
- 現有專用管理流程只允許 `source_page = P22`，不能把 P23／P24 圖片偽裝成 P22，也不能共用同一個 template key 覆蓋已發布內容。
- 後續應各自使用穩定 template key 與正確來源頁，沿用 `picture_gap_sentence` 安全契約；完成逐題轉錄、圖片權利與管理員核准後再建立草稿。

每題完成內容核准後，環境內還必須核對「空格停 2 秒」整句音檔為 `ready`，並實際試聽空格前後文字與停頓。學生端不再提供單字點選發音。

## 4. 圖片與發布閘門

每一題都必須確認：

- 圖片格式為 JPG、PNG 或 WebP，大小不超過 10MB，且管理員流程已完成 MIME、檔案簽章與 R2 HEAD 驗證。
- 資產狀態為 `ready`，題目與圖片連結存在，來源教材與頁碼一致。
- 圖片尺寸及非敏感 asset ID 可記錄在管理系統；不得把私人 object key 或 signed URL 複製到本文件。
- P21 的問句、回答與所有可接受說法都是完整問答。
- P22 的句型恰有一個空格，完整答案保留原句結構；停頓整句音檔為 `ready`。
- 題數與正式來源完全一致，且核准人與核准時間已記錄。
- 任一項缺少時維持 `draft`，不得發布。

## 5. 驗收紀錄

不產生 Speech／TTS 費用的驗收：

- 管理員逐題預覽與來源對照。
- 未登入、非管理員、無 pronunciation 或無 Workbook 1 entitlement 均被拒絕。
- 未授權請求不新增 request ledger，也不呼叫供應商。
- 學生回應不含完整答案、accepted responses 或私人 R2 key。
- 圖片與停頓整句的短效網址可載入；句型單字不可點選，空格答案不會出現在音檔中。
- 隨機順序無遺漏或重複；桌面、412px、鍵盤、螢幕閱讀器與 safe area 通過。

會產生 Azure 費用的真實麥克風驗收另行取得同意後執行：

- P21 只說回答須失敗；完整問句加回答須通過。
- P22 只說空格單字須失敗；完整句須通過。
- 經核准的完整替代說法通過，明確錯答失敗。
- 完成紀錄只在合法完整作答後寫入。
