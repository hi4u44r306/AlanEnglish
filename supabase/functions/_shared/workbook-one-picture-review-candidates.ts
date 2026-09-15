export type WorkbookOnePictureReviewCandidate = {
    prompt_text: string;
    answer_text: string;
    accepted_full_responses: string[];
    pronunciation_notes_zh: string;
    alt_zh: string;
};

const candidate = (
    prompt_text: string,
    answer_text: string,
    alt_zh: string,
    accepted_full_responses: string[] = []
): WorkbookOnePictureReviewCandidate => ({
    prompt_text, answer_text, accepted_full_responses, pronunciation_notes_zh: "", alt_zh
});

const WORKBOOK_ONE_PICTURE_REVIEW_CANDIDATES: Record<string, WorkbookOnePictureReviewCandidate[]> = {
    P21: [
        candidate("What is that?", "It is a ball.", "一顆彩色球", ["What's that? It's a ball."]),
        candidate("What is that?", "It is a gift.", "一份綁著蝴蝶結的禮物", ["What's that? It's a gift."]),
        candidate("What is that?", "It is a bird.", "一隻小鳥", ["What's that? It's a bird."]),
        candidate("What is that?", "It is a cat.", "一隻坐著的貓", ["What's that? It's a cat."]),
        candidate("What is that?", "It is a bottle.", "一個嬰兒奶瓶", ["What's that? It's a bottle."]),
        candidate("What is that?", "It is a mouse.", "一隻灰色小老鼠", ["What's that? It's a mouse."]),
        candidate("What is that?", "It is a teddy bear.", "一隻粉紅色玩具熊", ["What's that? It's a teddy bear."]),
        candidate("What is that?", "It is a doll.", "一個金髮洋娃娃", ["What's that? It's a doll."]),
        candidate("What is that?", "It is a bed.", "一張鋪著紫色棉被的床", ["What's that? It's a bed."])
    ],
    P22: [
        candidate("The ____ is in the tree.", "The apple is in the tree.", "一顆蘋果和一棵蘋果樹"),
        candidate("The ____ is on the floor.", "The ball is on the floor.", "一顆彩色球和木地板"),
        candidate("The ____ is in the desert.", "The camel is in the desert.", "一隻駱駝和沙漠"),
        candidate("The ____ is in the pond.", "The duck is in the pond.", "一隻黃色小鴨和池塘"),
        candidate("The ____ is in the forest.", "The elephant is in the forest.", "一隻大象和森林"),
        candidate("The ____ is in the river.", "The fish is in the river.", "一條魚和河流"),
        candidate("The ____ is on the prairie.", "The giraffe is on the prairie.", "一隻長頸鹿和草原"),
        candidate("The ____ is in the race.", "The horse is in the race.", "一匹馬和賽馬場景"),
        candidate("The ____ is in my mouth.", "The ice is in my mouth.", "一塊冰和嘴巴")
    ],
    P23: [
        candidate("The ____ is in my closet.", "The jacket is in my closet.", "一件外套和一個衣櫃"),
        candidate("The ____ is in his palace.", "The king is in his palace.", "一頂皇冠和一座宮殿"),
        candidate("The ____ is in the zoo.", "The lion is in the zoo.", "一隻獅子和動物園"),
        candidate("The ____ are in the jungle.", "The monkeys are in the jungle.", "兩隻猴子和叢林"),
        candidate("The ____ is in the hospital.", "The nurse is in the hospital.", "一位穿白袍、拿著文件的人和醫院"),
        candidate("The ____ is in the sea.", "The octopus is in the sea.", "一隻章魚和海浪"),
        candidate("The ____ is in the case.", "The pencil is in the case.", "一枝鉛筆和鉛筆盒"),
        candidate("The ____ is in her garden.", "The queen is in her garden.", "一位戴著皇冠的女子和花園"),
        candidate("The ____ is in your kitchen.", "The raccoon is in your kitchen.", "一隻浣熊和廚房")
    ],
    P24: [
        candidate("The ____ are in the classroom.", "The students are in the classroom.", "三位坐在書桌前的學生和教室"),
        candidate("The ____ are not in the cage.", "The tigers are not in the cage.", "兩隻老虎和一個鳥籠"),
        candidate("The ____ is not in my hands.", "The umbrella is not in my hands.", "一把雨傘和幾隻手"),
        candidate("The ____ are on the table.", "The vegetables are on the table.", "一組蔬菜和擺著食物的餐桌"),
        candidate("The ____ is riding on the broom.", "The witch is riding on the broom.", "一位騎著掃帚的女巫"),
        candidate("The ____ is not in the concert.", "The xylophone is not in the concert.", "一個木琴和音樂會場景"),
        candidate("The ____ are in the mountains.", "The yaks are in the mountains.", "犛牛和山區景色"),
        candidate("The ____ is not in Taipei.", "The zoo is not in Taipei.", "動物園圖案和台北一〇一大樓")
    ]
};

export const workbookOnePictureReviewCandidates = (pageLabel: unknown) => {
    const normalizedPage = String(pageLabel || "").trim().toUpperCase();
    const rows = WORKBOOK_ONE_PICTURE_REVIEW_CANDIDATES[normalizedPage];
    return rows ? rows.map(row => ({ ...row, accepted_full_responses: [...row.accepted_full_responses] })) : null;
};
