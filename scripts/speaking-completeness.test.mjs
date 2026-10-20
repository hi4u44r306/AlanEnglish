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
import { readingAnswerAlternatives } from "../supabase/functions/_shared/speaking-completeness.ts";
const passes = (answer, spoken, type = "") => assess(question(answer, type), spoken).answer_match;
test("數字：阿拉伯數字與英文念法互通，數字不同仍不通過", () => {
    for (const type of ["", "text_qa"]) {
        assert.equal(passes("I take a bath at 8:30.", "I take a bath at eight thirty.", type), true);
        assert.equal(passes("I take a bath at eight thirty.", "I take a bath at 8:30.", type), true);
        assert.equal(passes("It's 5.1 meters.", "It's five point one meters.", type), true);
        assert.equal(passes("I get up at 7:00.", "I get up at seven o'clock.", type), true);
        assert.equal(passes("It is the 8th day.", "It is the eighth day.", type), true);
        assert.equal(passes("There are 3,940 people.", "There are three thousand nine hundred forty people.", type), true);
        assert.equal(passes("She was born in 1999.", "She was born in nineteen ninety-nine.", type), true);
        assert.equal(passes("He is seventy-five.", "He is 75.", type), true);
        assert.equal(passes("She is in her 20s.", "She is in her twenties.", type), true);
    }
    // 長句本來就容許錯一個字（70%）；短句才看得出數字念錯。
    assert.equal(passes("It's 8:30.", "It's nine thirty.", "text_qa"), false);
    assert.equal(passes("5.1", "five point two", "text_qa"), false);
    assert.equal(passes("3 apples.", "four apples.", "text_qa"), false);
});
test("its／it's、your／you're 等同音片語互通，代名詞不同仍不通過", () => {
    assert.equal(passes("They are its ears.", "They are it's ears.", "picture_gap_sentence"), true);
    assert.equal(passes("They are its ears.", "They are it's ears."), true);
    assert.equal(passes("It's a cat.", "Its a cat.", "text_qa"), true);
    assert.equal(passes("Whose bag is this?", "Who's bag is this?", "text_qa"), true);
    assert.equal(passes("Your bag is red.", "You're bag is red.", "text_qa"), true);
    assert.equal(passes("They're my friends.", "There my friends.", "text_qa"), true);
    assert.equal(passes("They are its ears.", "They are his ears.", "picture_gap_sentence"), false);
    assert.equal(passes("Your bag is red.", "My bag is red.", "text_qa"), false);
});
test("複合字與縮寫連寫或分開都算對，不同字仍不通過", () => {
    assert.equal(passes("I am in the living room.", "I am in the livingroom.", "text_qa"), true);
    assert.equal(passes("I am in the livingroom.", "I am in the living room.", "text_qa"), true);
    assert.equal(passes("It's 2 p.m.", "It's 2pm.", "text_qa"), true);
    assert.equal(passes("I watch TV.", "I watch T V.", "text_qa"), true);
    assert.equal(passes("I watch TV every day.", "I watch T V every day."), true);
    assert.equal(passes("I am in the living room.", "I am in the bedroom.", "text_qa"), false);
    assert.equal(passes("It's 2 p.m.", "It's 2am.", "text_qa"), false);
});
test("英美拼法與人名拼法互通，不同人名或名詞仍不通過", () => {
    assert.equal(passes("My favourite colour is blue.", "My favorite color is blue.", "text_qa"), true);
    assert.equal(passes("It is 5 metres long.", "It is five meters long.", "text_qa"), true);
    assert.equal(passes("This is Sean.", "This is Shawn.", "text_qa"), true);
    assert.equal(passes("Hi, I'm Sarah.", "Hi, I'm Sara.", "text_qa"), true);
    assert.equal(passes("I live in Keelung.", "I live in Jilong.", "text_qa"), true);
    assert.equal(passes("This is Sean.", "This is John.", "text_qa"), false);
    assert.equal(passes("It is grey.", "It is gray.", "text_qa"), true);
    assert.equal(passes("It is grey.", "It is green.", "text_qa"), false);
});
test("題目括號：可省略、可唸出、大寫或縮寫可替換前一字", () => {
    for (const type of ["", "text_qa"]) {
        assert.equal(passes("She wants two dozen (of) beer.", "She wants two dozen beer.", type), true);
        assert.equal(passes("She wants two dozen (of) beer.", "She wants two dozen of beer.", type), true);
        assert.equal(passes("I'm (We're) in bed.", "We're in bed.", type), true);
        assert.equal(passes("I'm (We're) in bed.", "I'm in bed.", type), true);
        assert.equal(passes("It can (also) save you (as well).", "It can save you as well.", type), true);
    }
    assert.equal(passes("I'm (We're) in bed.", "They're in bed.", "text_qa"), false);
    assert.equal(passes("I want (some) beer.", "I want milk.", "text_qa"), false);
    assert.equal(readingAnswerAlternatives("It can (also) save you (as well).").some(text => /[()]/.test(text)), false);
});
test("題目斜線：任選一個說法都算對，兩個都漏或換成別的字不通過", () => {
    for (const type of ["", "text_qa"]) {
        assert.equal(passes("Your passport/card is out of date.", "Your card is out of date.", type), true);
        assert.equal(passes("Your passport/card is out of date.", "Your passport is out of date.", type), true);
        assert.equal(passes("I feel worried/nervous.", "I feel nervous.", type), true);
        assert.equal(passes("It is cloudy/partly cloudy.", "It is partly cloudy.", type), true);
        assert.equal(passes("Mind the gap. / Mind your step.", "Mind your step.", type), true);
        assert.equal(passes("I like fried chicken./ chocolate cake./ bananas.", "I like chocolate cake.", type), true);
        assert.equal(passes("Are you ready to order?/ Can I take your order? What's your specialty?", "Can I take your order? What's your specialty?", type), true);
    }
    // 長句本來就容許漏一個字（70%）；短句才看得出兩個選項都沒唸。
    assert.equal(passes("Your passport/card is lost.", "Your is lost.", "text_qa"), false);
    assert.equal(passes("Your passport/card is lost.", "Your bag is lost.", "text_qa"), false);
    assert.equal(passes("I feel worried/nervous.", "I feel happy.", "text_qa"), false);
    assert.equal(passes("I like fried chicken./ chocolate cake./ bananas.", "bananas"), false);
    const variants = readingAnswerAlternatives("I like fried chicken./ chocolate cake./ bananas. Mind the gap. / Mind your step. A/B/C/D");
    assert.equal(variants.length <= 32 && variants.length > 0, true);
    assert.equal(variants.some(text => /[/()]/.test(text) || !/[a-z]/i.test(text)), false);
});
test("放寬規則不改變是否題：No, it isn't. 唸成 Yes, it is. 仍不通過", () => {
    assert.equal(passes("No, it isn't.", "Yes, it is.", "text_qa"), false);
    assert.equal(passes("No, it isn't.", "Yes, it is."), false);
    assert.equal(passes("Is it your bag? No, it isn't.", "Is it your bag? Yes, it is.", "text_qa"), false);
});
test("同一句同時有 it is 和 its；斜線後是兩句以上的選項", () => {
    assert.equal(assess(question("Yes, it is its heart.", "text_qa"), "Yes, it's it's heart.").answer_match, true);
    assert.equal(assess(question("Yes, it is its heart.", "text_qa"), "Yes, it's heart.").answer_match, false);
    assert.equal(assess(question("Please give me some, thank you./ No way. I hate it.", "text_qa"), "Please give me some, thank you.").answer_match, true);
    assert.equal(assess(question("Please give me some, thank you./ No way. I hate it.", "text_qa"), "No way. I hate it.").answer_match, true);
});
test("合併 it's／you're 時挑對位置", () => {
    assert.equal(assess(question("Don't give your number to a stranger. You're asking for trouble.", "text_qa"), "Don't give you're number to a stranger. You're asking for trouble.").answer_match, true);
});
test("重要名詞與地名人名一定要念對", () => {
    const passes = (answer, text, type = "") => assess(question(answer, type), text).answer_match;
    for (const type of ["", "text_qa"]) {
        assert.equal(passes("They come from Italy.", "They come from Japan.", type), false);
        assert.equal(passes("They come from Italy.", "They come from Italy.", type), true);
        assert.equal(passes("I need some milk and salt.", "I need some sugar and salt.", type), false);
        assert.equal(passes("I need some milk and salt.", "I need some milk salt.", type), true);
        // 單複數不同仍算念到；不規則複數不互通。
        assert.equal(passes("I have two cats.", "I have two cat.", type), true);
        assert.equal(passes("There are two boxes on the table.", "There are two box on the table.", type), true);
        // 不在名單裡、句中大寫的人名也要念對。
        assert.equal(passes("This is Zelda's bag.", "This is Linda's bag.", type), false);
        assert.equal(passes("This is Zelda's bag.", "This is Zelda's bag.", type), true);
        // 拼法、同音與人名的不同寫法仍算對。
        assert.equal(passes("My favourite colour is blue.", "My favorite color is blue.", type), true);
        assert.equal(passes("My favorite color is blue.", "My favourite colour is blue.", type), true);
        assert.equal(passes("My best friend is Sean.", "My best friend is Shawn.", type), true);
        assert.equal(passes("It is an eye.", "It is an I.", type), true);
    }
    // 分數不變，只有是否通過改變。
    assert.equal(assess(question("They come from Italy."), "They come from Japan.").scores.completeness, 75);
});
test("找出重要字：名詞、句中大寫的人名地名，不含句首與 I", async () => {
    const { keyWordsOf } = await import("../supabase/functions/_shared/speaking-key-nouns.ts");
    assert.deepEqual(keyWordsOf("They come from Italy."), ["italy"]);
    assert.deepEqual(keyWordsOf("I need some milk and salt."), ["milk", "salt"]);
    assert.deepEqual(keyWordsOf("This is Zelda's bag."), ["zelda's", "bag"]);
    assert.deepEqual(keyWordsOf("Good morning. I am happy."), ["morning"]);
    assert.deepEqual(keyWordsOf("Stand up. / Sit down."), []);
});
test("同音字也是答案字、所有格的人名拼法", () => {
    assert.equal(assess(question("Yes! I am the apple of his eye.", "text_qa"), "Yes! I am the apple of his I.").answer_match, true);
    assert.equal(assess(question("No, she is not. She is Ann's twin brother.", "text_qa"), "No, she is not. She is Anne's twin brother.").answer_match, true);
    assert.equal(assess(question("No, she is not. She is Ann's twin brother.", "text_qa"), "No, she is not. She is Mary's twin brother.").answer_match, false);
});
