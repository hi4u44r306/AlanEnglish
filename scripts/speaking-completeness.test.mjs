import { test } from "node:test";
import assert from "node:assert/strict";
import { assessReadingCompleteness as assess, readingCoverage } from "../supabase/functions/_shared/speaking-completeness.ts";
const question = (answerTemplate = "I like apples.", interactionType = "", acceptedAnswers = []) => ({ answerTemplate, interactionType, acceptedAnswers });
test('一般朗讀以 70 分為門檻，69 分以下不通過',()=>{
 const q=question('one two three four five six seven eight nine ten');
 const pass=assess(q,'one two three four five six seven');assert.equal(pass.scores.completeness,70);assert.equal(pass.answer_match,true);
 assert.equal(assess(q,'one two three four five six').answer_match,false);
});
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
test("th 放寬：mouth 聽成 mouse 也通過，但回報 th 要念清楚", () => {
    const q = question("It is her mouth.", "picture_gap_sentence");
    const result = assess(q, "It is her mouse.");
    assert.equal(result.answer_match, true);
    assert.equal(result.scores.completeness, 100);
    assert.deepEqual(result.pronunciation_tips, [{ word: "mouth", heard: "mouse", sound: "th" }]);
    assert.match(result.feedback, /mouth 的 th/);
    assert.equal(assess(question("They are her teeth.", "picture_gap_sentence"), "They are her tees.").answer_match, true);
    assert.equal(assess(question("I have three apples."), "I have tree apples.").pronunciation_tips[0].heard, "tree");
});
test("th 放寬不放過其他錯字：答案字不對仍不通過", () => {
    const q = question("It is her mouth.", "picture_gap_sentence");
    assert.equal(assess(q, "It is her nose.").answer_match, false);
    assert.equal(assess(q, "It is his mouth.").answer_match, false);
    const exact = assess(q, "It is her mouth.");
    assert.equal(exact.answer_match, true);
    assert.deepEqual(exact.pronunciation_tips, []);
});
import { localRecheckCandidate } from "../supabase/functions/_shared/speaking-completeness.ts";
test("再確認：只差一個字（多半是聽錯）才送 Azure", () => {
    const gap = question("It is her mouth.", "picture_gap_sentence");
    assert.equal(localRecheckCandidate(gap, "It is her moth").eligible, true);
    assert.equal(localRecheckCandidate(gap, "It is her moth").referenceText, "It is her mouth.");
    assert.equal(localRecheckCandidate(gap, "It is his mouth").eligible, false, "代名詞換掉是意思錯");
    assert.equal(localRecheckCandidate(gap, "It is her").eligible, false, "漏念不送");
    assert.equal(localRecheckCandidate(gap, "It is not her mouth").eligible, false, "否定詞不同不送");
    assert.equal(localRecheckCandidate(gap, "I like apples very much").eligible, false, "差很多不送");
    assert.equal(localRecheckCandidate(question("What is this? It is a cat.", "picture_qa"), "What is this? It is a cap").eligible, true);
    assert.equal(localRecheckCandidate(question("I have three apples."), "I have four apples").eligible, false, "數字換掉是意思錯");
    assert.equal(localRecheckCandidate(question("I like red apples."), "I like bed apples").eligible, true);
});
test("再確認：字母、拼字與個人化答案不送", () => {
    assert.equal(localRecheckCandidate(question("A", "alphabet_round"), "B").eligible, false);
    assert.equal(localRecheckCandidate(question("My name is [name].", "picture_qa"), "My name is Amy").eligible, false);
});
test("同音字算對：eye 聽成 I、two 聽成 to 都通過，而且不提醒", () => {
    const eye = assess(question("It is an eye.", "picture_gap_sentence"), 'It is an "I".');
    assert.equal(eye.answer_match, true);
    assert.deepEqual(eye.pronunciation_tips, []);
    assert.equal(assess(question("I have two cats."), "I have to cats.").answer_match, true);
    assert.equal(assess(question("I can see a bee.", "standard_sentence"), "I can sea a be.").scores.completeness, 100);
    // 不同音的錯字仍不通過；no／know 不算同音放寬。
    assert.equal(assess(question("It is an eye.", "picture_gap_sentence"), "It is an ear.").answer_match, false);
    assert.equal(assess(question("Yes, I know.", "text_qa"), "Yes, I no.").scores.completeness < 100, true);
});
test("連音算對：its ears 聽成 its years 也通過；本來就是 years 的題目不受影響", () => {
    assert.equal(assess(question("They are its ears.", "picture_gap_sentence"), "They are its years.").answer_match, true);
    assert.equal(assess(question("They are its ears."), "They are its years.").scores.completeness, 100);
    assert.equal(assess(question("I am ten years old."), "I am ten years old.").scores.completeness, 100);
    assert.equal(assess(question("I am ten years old."), "I am ten ears old.").scores.completeness < 100, true);
    assert.equal(assess(question("They are its ears.", "picture_gap_sentence"), "They are its yes.").answer_match, false);
});
