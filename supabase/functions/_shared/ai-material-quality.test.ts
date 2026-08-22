import {
    balanceCorrectAnswerPositions,
    getDifficultyGuide
} from "./ai-material-quality.ts";

const assert = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message);
};

Deno.test("balances correct answers across A B C D without changing answer text", () => {
    const questions = Array.from({ length: 8 }, (_, index) => ({
        question: `Question ${index + 1}`,
        options: [
            `Correct ${index + 1}`,
            `Wrong B ${index + 1}`,
            `Wrong C ${index + 1}`,
            `Wrong D ${index + 1}`
        ],
        answer: `Correct ${index + 1}`,
        explanation: "說明"
    }));
    const original = { title: "Test", questions };
    const balanced = balanceCorrectAnswerPositions(original, () => 0);
    const positionCounts = [0, 0, 0, 0];

    balanced.questions.forEach((question: any, index: number) => {
        const answerIndex = question.options.indexOf(question.answer);
        assert(answerIndex >= 0, `Q${index + 1} 的答案必須仍存在於選項中`);
        assert(new Set(question.options).size === 4, `Q${index + 1} 的選項不得重複`);
        assert(question.answer === `Correct ${index + 1}`, `Q${index + 1} 的答案文字不可改變`);
        positionCounts[answerIndex] += 1;
    });

    assert(positionCounts.every(count => count === 2), "8 題時 A、B、C、D 應各有 2 題");
    assert(original.questions[0].options[0] === "Correct 1", "不得直接修改原始教材物件");
});

Deno.test("provides explicit Taiwan elementary grade constraints", () => {
    const lower = getDifficultyGuide("國小低年級");
    const middle = getDifficultyGuide("國小中年級");
    const upper = getDifficultyGuide("國小高年級");

    assert(lower.includes("一至二年級") && lower.includes("3～7"), "低年級規格必須包含年級與句長");
    assert(middle.includes("三至四年級") && middle.includes("5～10"), "中年級規格必須包含年級與句長");
    assert(upper.includes("五至六年級") && upper.includes("7～14"), "高年級規格必須包含年級與句長");
});
