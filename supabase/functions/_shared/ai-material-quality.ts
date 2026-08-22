export const DIFFICULTY_GUIDES: Record<string, string> = {
    "國小低年級": [
        "對應台灣國小一至二年級（Pre-A1～A1 入門）",
        "以家庭、學校、顏色、數字、食物、動物、日常動作等熟悉主題為主",
        "每句約 3～7 個英文單字；reading/listening 全文約 35～60 字",
        "只使用 be 動詞、have、like、can、簡單現在式與最基礎疑問句",
        "題目必須能從單句或文章中的明確資訊直接找到答案，不做推論"
    ].join("；"),
    "國小中年級": [
        "對應台灣國小三至四年級（CEFR A1）",
        "使用常見生活與校園字彙，避免抽象、罕見或國中以上單字",
        "每句約 5～10 個英文單字；reading/listening 全文約 60～100 字",
        "可使用簡單現在式、現在進行式、can、Wh- 疑問句、時間與地點介系詞",
        "以直接理解、字義辨識與簡單句型判斷為主；不要設計陷阱題"
    ].join("；"),
    "國小高年級": [
        "對應台灣國小五至六年級（CEFR A1～A2 初階）",
        "使用常見生活、旅行、自然、健康與校園情境，生字需能由上下文理解",
        "每句約 7～14 個英文單字；reading/listening 全文約 90～140 字",
        "可使用簡單現在式、現在進行式、簡單過去式、be going to、比較級及 because/when",
        "可有一題單步推論，其餘答案應能由文章或已學句型明確判斷"
    ].join("；"),
    "國中基礎": [
        "對應台灣國中七年級基礎（CEFR A2）",
        "以日常溝通與校園情境為主，避免高中程度片語與複雜學術字彙",
        "每句約 10～18 個英文單字；reading/listening 全文約 120～180 字",
        "可使用國一常見時態、連接詞、比較級與基礎情態動詞",
        "推論不得超過一步，且四個選項必須只有一個明確正確答案"
    ].join("；")
};

export const getDifficultyGuide = (difficulty: string) => (
    DIFFICULTY_GUIDES[difficulty]
    || `依照「${difficulty || "國小中年級"}」控制字彙、句長與文法；若描述不明，使用台灣國小三至四年級程度`
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
