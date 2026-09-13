const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const letterQuestion = (letter: string) => ({
    question_text: letter,
    hint_zh: "看清楚字母，倒數結束後聽一次，再照著唸。",
    keywords: [letter],
    simple_answer: letter,
    model_answer: letter,
    follow_up_question: null,
    pronunciation_notes_zh: "只唸這個字母的英文名稱。",
    accepted_intents: [`學生清楚唸出字母 ${letter}`]
});

const spellingQuestion = (word: string) => {
    const letters = word.toUpperCase().replace(/[^A-Z]/g, "").split("");
    const answer = letters.join(" ");
    return {
        question_text: word,
        hint_zh: "請逐字母拼讀，不用唸整個單字。",
        keywords: [word],
        simple_answer: answer,
        model_answer: answer,
        follow_up_question: null,
        pronunciation_notes_zh: "每個字母分開唸清楚，順序不能改變。",
        accepted_intents: [`學生依序唸出 ${letters.join("-")}`]
    };
};

const spellingAnswer = (word: unknown) => String(word || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .join(" ");

export const workbookOneFoundationTemplateByKey = (templateKey: unknown) => Object.values(
    WORKBOOK_ONE_FOUNDATION_TEMPLATES
).find((template: any) => template.templateKey === String(templateKey || "")) || null;

export const approvedSpellingContentMatches = (
    template: any,
    sourcePrompts: unknown,
    questions: unknown
) => {
    if (!template?.approvedSourcePageLabel || !Array.isArray(sourcePrompts) || !Array.isArray(questions)) return false;
    const approvedPrompts = sourcePrompts.map(value => String(value || "").trim()).filter(Boolean);
    const expectedPrompts = template.questions.map((question: any) => String(question.question_text || "").trim());
    const orderedQuestions = [...questions].sort((left: any, right: any) => Number(left?.sort_order) - Number(right?.sort_order));
    return approvedPrompts.length === expectedPrompts.length
        && approvedPrompts.every((prompt, index) => prompt === expectedPrompts[index])
        && orderedQuestions.length === expectedPrompts.length
        && orderedQuestions.every((question: any, index: number) => {
            const prompt = String(question?.question_text || "").trim();
            const expectedAnswer = spellingAnswer(expectedPrompts[index]);
            return Number(question?.sort_order) === index
                && prompt === expectedPrompts[index]
                && String(question?.simple_answer || "").trim() === expectedAnswer
                && String(question?.model_answer || "").trim() === expectedAnswer;
        });
};

const spellingTemplate = (page: number, words: string[], extraMetadata: Record<string, unknown> = {}) => ({
    catalogKey: "workbook1",
    templateKey: `workbook_1_p${page}_letter_spelling_v1`,
    documentTitle: `Workbook 1 P${page} 拼讀關`,
    unitLabel: `P${page} 拼讀`,
    pageFromLabel: `P${page}`,
    pageToLabel: `P${page}`,
    sourcePages: [page],
    topic: "看單字逐字母拼讀",
    title: `P${page} 看字拼讀`,
    sourceText: words.join(", "),
    difficulty: "國小低年級",
    answerType: "exact_letter_sequence",
    approvedSourcePageLabel: `P${page}`,
    sourceRequiresReview: false,
    metadata: {
        interaction_type: "letter_spelling",
        shuffle: true,
        approved_source_table: "book_page_spiral_review_content",
        approved_source_page_label: `P${page}`,
        ...extraMetadata
    },
    questions: words.map(spellingQuestion)
});

export const WORKBOOK_ONE_FOUNDATION_ACTIONS = [
    "create_workbook_1_alphabet_round",
    "create_workbook_1_spelling_p14",
    "create_workbook_1_spelling_p15",
    "create_workbook_1_spelling_p16",
    "create_workbook_1_spelling_p17"
];

export const WORKBOOK_ONE_FOUNDATION_TEMPLATES: Record<string, any> = {
    create_workbook_1_alphabet_round: {
        catalogKey: "workbook1",
        templateKey: "workbook_1_alphabet_round_v1",
        documentTitle: "Workbook 1 A–Z 基礎口說",
        unitLabel: "A–Z",
        pageFromLabel: "起始關",
        pageToLabel: "起始關",
        sourcePages: [],
        topic: "A–Z 大小寫辨識與發音",
        title: "00 A–Z 大小寫挑戰",
        sourceText: "Listen to the English alphabet from A to Z, then identify and pronounce every uppercase or lowercase letter.",
        difficulty: "國小低年級",
        answerType: "exact_letter_name",
        sourceRequiresReview: false,
        metadata: {
            interaction_type: "alphabet_round",
            shuffle: true,
            count: 26,
            countdown_seconds: 3,
            reset_on_failure: true,
            intro_audio_mode: "alphabet_sequence"
        },
        questions: alphabet.map(letterQuestion)
    },
    create_workbook_1_spelling_p14: spellingTemplate(14, [
        "apple", "juice", "world", "orange", "purple", "dance", "plane", "black", "queen", "friends"
    ]),
    create_workbook_1_spelling_p15: spellingTemplate(15, [
        "thanks", "welcome", "nice", "great", "teacher", "chair", "elephant", "paper", "bottle", "computer", "sunny", "weather"
    ]),
    create_workbook_1_spelling_p16: spellingTemplate(16, [
        "Taiwan", "Chinese", "McDonald's", "America", "Kentucky", "Starbucks", "Costco", "Tasty", "Family", "Gogoro", "Microsoft", "Domino's"
    ], { contains_brand_names: true, brand_review_completed: true }),
    create_workbook_1_spelling_p17: spellingTemplate(17, [
        "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"
    ])
};
