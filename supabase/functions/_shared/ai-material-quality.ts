export const TAIWAN_CURRICULUM_REFERENCE = {
    title: "十二年國民基本教育課程綱要－語文領域（英語文）",
    sourceUrl: "https://www.naer.edu.tw/PageSyllabus?fid=177",
    nationalEnglishStartsAtGrade: 3,
    elementaryOralWordTarget: 300,
    elementarySpellingWordTarget: 180
} as const;

type DifficultyProfile = {
    alignment: string;
    goals: string[];
    topics: string[];
    languageLimits: string[];
    assessment: string[];
};

// alignment / goals are based on the national curriculum.
// Sentence length, passage length and grammar exclusions are Alan English safety guardrails
// that keep generated material from drifting above the selected grade band.
export const DIFFICULTY_PROFILES: Record<string, DifficultyProfile> = {
    "國小低年級": {
        alignment: "Alan English 課綱前導（台灣國小一至二年級；全國部定英語從三年級第二學習階段開始，因此不得宣稱低年級是部定英語階段）",
        goals: [
            "建立 26 個字母大小寫、字母音、最基礎自然發音與聽說興趣",
            "聽懂並說出招呼、自我介紹、教室指令及單句生活用語"
        ],
        topics: [
            "自己與家人、學校與教室、數字 1～20、顏色、形狀、身體、動物、食物、玩具、天氣、感受與日常動作"
        ],
        languageLimits: [
            "以單字、短語及每句約 3～7 個英文單字為主；reading/listening 全文約 30～60 字",
            "只使用 I am、You are、This is、I have、I like、I can、簡單現在式及 what/who/how many 等最基礎問句",
            "不得使用過去式、未來式、比較級、複雜連接詞、音標符號或抽象字彙；新字以 3～5 個為限",
            "題目指示與解說可以使用繁體中文，避免要求學生閱讀長篇英文"
        ],
        assessment: [
            "優先使用聽音辨字、字圖配對、單句理解、直接問答及簡單分類",
            "答案必須可由一個明確字詞、圖片線索或單句直接判斷，不做推論"
        ]
    },
    "國小中年級": {
        alignment: "十二年國教英語文第二學習階段（台灣國小三至四年級；部定必修每週 1 節）",
        goals: [
            "辨識與聽寫 26 個字母，運用子音、母音及其組合的基礎自然發音規則",
            "聽懂並讀懂課堂所學字詞、簡易教室用語、日常生活用語與簡易句型",
            "以正確發音朗讀簡易句子，認識國內外基本招呼與主要節慶"
        ],
        topics: [
            "自己與家人、朋友、學校生活、數字、顏色、形狀、身體、動物、食物飲料、服飾、住家、天氣、時間、興趣與日常作息"
        ],
        languageLimits: [
            "每句約 4～9 個英文單字；reading/listening 全文約 40～85 字；新字以 4～6 個為限",
            "使用 be 動詞、have/has、like、can、there is/are、簡單現在式、基礎現在進行式及基礎 Wh- 問句",
            "不得使用完成式、被動語態、關係子句、複雜比較、長篇敘事或必須查課外知識才能理解的字詞",
            "使用自然發音而非音標符號，句型需能在台灣國小校園與家庭生活中實際溝通"
        ],
        assessment: [
            "以字詞辨識、句型判斷、直接細節、教室或生活對話及字詞分類為主",
            "答案必須能從已學字詞、單句或短文的明確資訊找到；不得設計推論題或文字陷阱"
        ]
    },
    "國小高年級": {
        alignment: "十二年國教英語文第三學習階段（台灣國小五至六年級；部定必修每週 2 節；國小畢業累積目標為口語應用至少 300 字詞、拼寫至少 180 字詞）",
        goals: [
            "聽懂簡易日常對話、歌謠、韻文、故事與短劇的主要內容",
            "看懂校園標示、教室用語、簡易對話與短文，並能介紹自己、家人及朋友",
            "能將故事事件排序，並綜合明確相關資訊作一次簡易猜測"
        ],
        topics: [
            "朋友與人際、日常作息、學校生活、健康、運動、購物與價格、時間日期月份、交通、旅行、自然環境、節慶文化、科技與學習習慣"
        ],
        languageLimits: [
            "每句約 6～13 個英文單字；reading/listening 全文約 70～130 字；新字以 5～8 個為限",
            "以簡單現在式、現在進行式與基礎情態動詞為核心；僅在主題需要時使用高年級常見的簡單過去式、be going to 或基礎比較級",
            "不得使用現在完成式、複雜被動語態、關係子句、多層從屬子句或國中以上學術字彙",
            "體裁可使用生活對話、校園標示、菜單、地圖、時刻表、通知、歌謠、韻文及簡短故事"
        ],
        assessment: [
            "混合直接細節、主旨、對話目的、故事排序與字詞分類",
            "整份教材最多一題單步推論，且推論必須只整合文中兩項明確資訊；其餘答案直接可查"
        ]
    },
    "國中基礎": {
        alignment: "台灣國中七年級基礎銜接",
        goals: [
            "鞏固國小累積字詞與基本句型，進入日常對話、短文及故事理解"
        ],
        topics: [
            "校園、家庭、朋友、休閒、健康、購物、交通、旅行、節慶、自然與數位生活"
        ],
        languageLimits: [
            "每句約 10～18 個英文單字；reading/listening 全文約 120～180 字",
            "可使用國一常見時態、連接詞、比較級與基礎情態動詞，避免高中程度片語與學術字彙"
        ],
        assessment: [
            "推論不得超過一步，且四個選項必須只有一個明確正確答案"
        ]
    }
};

const profileToPrompt = (profile: DifficultyProfile) => [
    `課綱定位：${profile.alignment}`,
    `學習目標：${profile.goals.join("；")}`,
    `合適主題：${profile.topics.join("；")}`,
    `語言限制：${profile.languageLimits.join("；")}`,
    `評量方式：${profile.assessment.join("；")}`
].join("\n");

export const DIFFICULTY_GUIDES: Record<string, string> = Object.fromEntries(
    Object.entries(DIFFICULTY_PROFILES).map(([key, profile]) => [key, profileToPrompt(profile)])
);

export const getDifficultyGuide = (difficulty: string) => (
    DIFFICULTY_GUIDES[difficulty]
    || `依照「${difficulty || "國小中年級"}」控制字彙、句長與文法；若描述不明，使用台灣國小三至四年級第二學習階段規格`
);

type RandomIndex = (upperExclusive: number) => number;

const secureRandomIndex: RandomIndex = (upperExclusive) => {
    if (!Number.isInteger(upperExclusive) || upperExclusive <= 1) return 0;
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % upperExclusive;
};

const shuffledCopy = <T>(items: T[], randomIndex: RandomIndex) => {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.min(index, Math.max(0, randomIndex(index + 1)));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
};

const buildBalancedPositions = (questionCount: number, randomIndex: RandomIndex) => {
    const startPosition = randomIndex(4);
    const positions = Array.from(
        { length: questionCount },
        (_, index) => (startPosition + index) % 4
    );
    return shuffledCopy(positions, randomIndex);
};

export const balanceCorrectAnswerPositions = (
    content: any,
    randomIndex: RandomIndex = secureRandomIndex
) => {
    if (!Array.isArray(content?.questions)) return content;

    const targetPositions = buildBalancedPositions(content.questions.length, randomIndex);
    const questions = content.questions.map((question: any, questionIndex: number) => {
        const options = Array.isArray(question?.options)
            ? question.options.map((option: any) => String(option ?? "").trim())
            : [];
        const answer = String(question?.answer ?? "").trim();

        if (
            options.length !== 4
            || new Set(options).size !== 4
            || !options.includes(answer)
        ) {
            return {
                ...question,
                question: String(question?.question ?? "").trim(),
                options,
                answer,
                explanation: String(question?.explanation ?? "").trim()
            };
        }

        const distractors = shuffledCopy(
            options.filter((option: string) => option !== answer),
            randomIndex
        );
        distractors.splice(targetPositions[questionIndex], 0, answer);

        return {
            ...question,
            question: String(question?.question ?? "").trim(),
            options: distractors,
            answer,
            explanation: String(question?.explanation ?? "").trim()
        };
    });

    return { ...content, questions };
};
