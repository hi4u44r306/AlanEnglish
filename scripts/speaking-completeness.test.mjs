import { test } from "node:test";
import assert from "node:assert/strict";
import { assessReadingCompleteness as assess, readingCoverage } from "../supabase/functions/_shared/speaking-completeness.ts";
const question = (answerTemplate = "I like apples.", interactionType = "", acceptedAnswers = []) => ({ answerTemplate, interactionType, acceptedAnswers });
test("完整朗讀 100 分；漏字依順序計算，不測量發音", () => {
    const result = assess(question(), "I like apples!");
    assert.equal(result.scores.completeness, 100); assert.equal(result.scores.pronunciation, null);
    assert.equal(result.answer_match, true);
    assert.equal(assess(question("I like apples.", "standard_sentence"), "I like apples!").answer_match, true);
    assert.throws(() => assess(question("I like apples.", "unknown_type"), "I like apples!"));
    assert.equal(assess(question(), "I apples").scores.completeness, 67);
    assert.equal(assess(question(), "I apples").answer_match, false);
});
test("順序與重複不灌分，縮寫一致", () => {
    assert.equal(readingCoverage("I like apples", "apples like I").score, 33);
    assert.equal(readingCoverage("I like apples", "I I I").score, 33);
    assert.equal(readingCoverage("He is happy", "He's happy").score, 100);
});
test("有效但無關文字為零，空白或超長拒絕", () => {
    assert.equal(assess(question(), "school bag").scores.completeness, 0);
    for (const text of ["", "123", "a".repeat(2001), null]) assert.throws(() => assess(question(), text));
});
test("圖片問答保留正式答案規則，不把完整度當語意正確", () => {
    assert.equal(assess(question("She is a teacher.", "picture_qa"), "She is a teacher and a doctor.").answer_match, false);
    assert.equal(assess(question("He is a teacher.", "text_qa", ["She is a teacher."]), "She is a teacher.").answer_match, true);
});
test("姓名欄位接受完整句型，只有姓名不能通過", () => {
    assert.equal(assess(question("My name is [你的名字]."), "My name is Amy.").scores.completeness, 100);
    assert.equal(assess(question("My name is [你的名字]."), "Amy").answer_match, false);
});
test("字母採現有別名／順序規則；不偽造音素評分", () => {
    assert.equal(assess(question("A", "alphabet_round"), "A").scores.completeness, 100);
    assert.equal(assess(question("A B C", "letter_spelling"), "A C B").answer_match, false);
});
test("答錯的挑戰不回傳隱藏參考字句", () => {
    const result = assess(question("The password is pumpkin.", "text_qa"), "hello there");
    assert.equal(JSON.stringify(result).includes("pumpkin"), false);
});

const keyAnswer = "What is this? It is a key. Is it yours? Yes, it's mine. (No, it's not.)";
for (const type of ["standard_sentence", "text_qa", "picture_qa", "picture_gap_sentence"]) {
    test(`${type} 括號回答擇一或兩種都唸，完整回答都是 100 分`, () => {
        for (const ending of ["Yes, it's mine.", "No, it's not.", "No, it is not.", "Yes, it's mine. No, it's not.", "No, it's not. Yes, it's mine."]) {
            const result = assess(question(keyAnswer, type), "What is this? It is a key. Is it yours? " + ending);
            assert.equal(result.scores.completeness, 100);
            assert.equal(result.answer_match, true);
            assert.equal(result.scores.prosody, null);
        }
    });
}
test("括號替代回答仍要求共用句子，不接受只唸回覆或無關回答", () => {
    for (const spoken of ["No, it's not.", "Yes, it's mine.", "It is a desk.", "Yes, it's mine. No, it's not."]) {
        assert.equal(assess(question(keyAnswer, "picture_qa"), spoken).answer_match, false);
    }
});
test("全形括號、反向肯定選項與 acceptedAnswers 也各自比對", () => {
    const template = "Is it yours? No, it isn't.（Yes, it is.）";
    for (const spoken of ["Is it yours? No, it isn't.", "Is it yours? Yes, it is.", "Is it yours? No, it isn't. Yes, it is."]) {
        assert.equal(assess(question(template, "text_qa"), spoken).scores.completeness, 100);
        assert.equal(assess(question("It is a book.", "text_qa", [template]), spoken).answer_match, true);
    }
});
test("其他括號內容不自動轉成可接受回答", () => {
    const template = "It is a key. (Read clearly.)";
    assert.equal(assess(question(template, "text_qa"), "Read clearly.").answer_match, false);
    assert.equal(assess(question("I have no idea. (No, it isn't.)", "text_qa"), "No, it isn't.").answer_match, false);
});
