import assert from "node:assert/strict";
import test from "node:test";
import {
    extractGroupedNumberedTextQaForAi,
    extractNumberedTextQaPairs,
    filterOcrPageSpeakingCandidates,
    reviewedTextQaPromptIsComplete,
    validateGroupedNumberedTextQaMatch
} from "../supabase/functions/_shared/speaking-ocr-candidate-filter.ts";

test("Workbook 2 grouped questions keep all numbered clues and match shuffled answer bank by AI output", () => {
    const source = extractGroupedNumberedTextQaForAi(`[[PAGE P4]]
1. What is this? ( 汽車 )
2. What is this? ( 袋子 )
3. What is this? ( 蘋果 )
4. What is this? ( 帽子 )
5. What is this? ( 貓 )
6. What is this? ( 蛋 )
7. What is this? ( 橡皮擦 )
What 疑問句回答
It's an eraser.
[[RED_ANSWER: It's an eraser.]]
It's an egg.
[[RED_ANSWER: It's an egg.]]
It's a cat.
[[RED_ANSWER: It's a cat.]]
It's a hat.
[[RED_ANSWER: It's a hat.]]
It's an apple.
[[RED_ANSWER: It's an apple.]]
It a bag.
[[RED_ANSWER: It a bag.]]
It is a car.
[[RED_ANSWER: It is a car.]]`);
    assert.equal(source?.prompts.length, 7);
    assert.deepEqual(source?.prompts.map(row => row.clue), ["汽車", "袋子", "蘋果", "帽子", "貓", "蛋", "橡皮擦"]);
    assert.deepEqual(source?.answers, ["It's an eraser.", "It's an egg.", "It's a cat.", "It's a hat.", "It's an apple.", "It a bag.", "It is a car."]);
    const matched = validateGroupedNumberedTextQaMatch(source, [
        { number: 1, answer: "It is a car." },
        { number: 2, answer: "It a bag." },
        { number: 3, answer: "It's an apple." },
        { number: 4, answer: "It's a hat." },
        { number: 5, answer: "It's a cat." },
        { number: 6, answer: "It's an egg." },
        { number: 7, answer: "It's an eraser." }
    ]);
    assert.deepEqual(matched?.map(row => row.source_answer), ["It is a car.", "It a bag.", "It's an apple.", "It's a hat.", "It's a cat.", "It's an egg.", "It's an eraser."]);
    assert.equal(validateGroupedNumberedTextQaMatch(source, [
        { number: 1, answer: "It is a car." },
        { number: 2, answer: "It is a car." },
        { number: 3, answer: "It's an apple." }
    ]), null);
});

test("Workbook 2 P6, P8 and P10 each expose seven numbered text questions", () => {
    const pages = [
        `8. What is that? ( 鳥 )
9. What is that? ( 椅子 )
10. What is that? ( 襯衫 )
11. What is that? ( 狗 )
12. What is that? ( 香蕉 )
13. What is that? ( 魚 )
14. What is that? ( 盒子 )
It is a bird.
[[RED_ANSWER: It is a bird.]]
It is a chair.
It is a shirt.
It is a dog.
It is a banana.
It is a fish.
It is a box.`,
        `15. What animal is it? ( 雞 )
16. What animal is that? ( 馬 )
17. What animal is this? ( 母牛 )
18. What animal is it? ( 鴨 )
19. What animal is that? ( 青蛙 )
20. What animal is this? ( 綿羊 )
21. What animal is it? ( 大象 )
What ＋Ｎ 疑問句回答
It is a chicken.
It is a horse.
It is a cow.
It's a duck.
It's a frog.
It's a sheep.
It's an elephant.`,
        `22. What are these? ( 鞋子 )
23. What are these? ( 襪子 )
24. What are these? ( 豆子 )
25. What are these? ( 紅蘿蔔 )
26. What are these? ( 盒子 )
27. What are these? ( 時鐘 )
28. What are these? ( 書 )
What ... these 複數
They are books.
They are carrots.
They are clocks.
They are beans.
They are boxes.
They are socks.
They are shoes.`
    ];
    for (const [index, page] of pages.entries()) {
        const grouped = extractGroupedNumberedTextQaForAi(page);
        assert.equal(grouped?.prompts.length, 7, `P${[6, 8, 10][index]} prompts`);
        assert.equal(grouped?.answers.length, 7, `P${[6, 8, 10][index]} answers`);
    }
});
import { textQaQuestionContentValid } from "../supabase/functions/_shared/speaking-text-qa.ts";

test("keeps only complete, speakable English sentences for automatic OCR candidates", () => {
    const result = filterOcrPageSpeakingCandidates(`Workbook 3
Page 4
1. It is an eye.（一隻）
Look at the picture.
__________
| | | | |
They are her eyes.
A. This is my book!
www.alanenglish.com.tw`);

    assert.deepEqual(result.sentences, ["It is an eye.", "They are her eyes.", "This is my book!"]);
    assert.equal(result.sourceText, "It is an eye.\nThey are her eyes.\nThis is my book!");
    assert.ok(result.discardedSegments >= 5);
});

test("does not turn incomplete exercises or directions into automatic speaking questions", () => {
    const result = filterOcrPageSpeakingCandidates(`P12
Read and circle.
It is ____.
Name: __________
1 2 3 4`);

    assert.deepEqual(result.sentences, []);
    assert.ok(result.discardedSegments >= 4);
});

test("expands printed he/she and his/her choices into consistent complete sentences", () => {
    const result = filterOcrPageSpeakingCandidates(`Who is the student?
He/She is my friend. His/Her name is Sam.
They are his/her eyes.`);

    assert.deepEqual(result.sentences, [
        "Who is the student?",
        "He is my friend.",
        "She is my friend.",
        "His name is Sam.",
        "Her name is Sam.",
        "They are his eyes.",
        "They are her eyes."
    ]);
    assert.equal(result.sentences.includes("He is my friend. Her name is Sam."), false);
});

test("keeps reviewed red text as a hint without turning the fragment into an answer", () => {
    const result = filterOcrPageSpeakingCandidates(`Whose book is it?
It is his/her book.
[[RED_ANSWER: his/her]]`);

    assert.deepEqual(result.sentences, [
        "Whose book is it?",
        "It is his book.",
        "It is her book."
    ]);
    assert.deepEqual(result.redAnswerHints, ["his/her"]);
    assert.equal(result.sentences.includes("his/her"), false);
});

test("requires opposite consistent alternatives only when a text question does not specify gender", () => {
    assert.equal(textQaQuestionContentValid({
        question_text: "Who is your friend?",
        model_answer: "He is my friend.",
        accepted_intents: ["She is my friend."]
    }), true);
    assert.equal(textQaQuestionContentValid({
        question_text: "Who is your friend?",
        model_answer: "He is my friend.",
        accepted_intents: []
    }), false);
    assert.equal(textQaQuestionContentValid({
        question_text: "Who is he?",
        model_answer: "He is my friend.",
        accepted_intents: []
    }), true);
    assert.equal(textQaQuestionContentValid({
        question_text: "Who is he?",
        model_answer: "He is my friend.",
        accepted_intents: ["She is my friend."]
    }), false);
    assert.equal(textQaQuestionContentValid({
        question_text: "Who is he?",
        model_answer: "This is my friend.",
        accepted_intents: []
    }), false);
    assert.equal(textQaQuestionContentValid({
        question_text: "How old is your dad?",
        model_answer: "He is forty years old.",
        accepted_intents: []
    }), true);
    assert.equal(textQaQuestionContentValid({
        question_text: "What's your mother's name?",
        model_answer: "His name is Sam.",
        accepted_intents: []
    }), false);
    assert.equal(textQaQuestionContentValid({
        question_text: "Whose eyes are these?",
        model_answer: "They are his eyes.",
        accepted_intents: ["They are her eyes."]
    }), true);
    assert.equal(textQaQuestionContentValid({
        question_text: "Whose eyes are these?",
        model_answer: "He has her eyes.",
        accepted_intents: ["She has his eyes."]
    }), false);
    assert.equal(textQaQuestionContentValid({
        question_text: "Do you have brothers or sisters?",
        model_answer: "No, I'm the only child.",
        accepted_intents: ["Yes, I have a brother and a sister."]
    }), true);
    assert.equal(textQaQuestionContentValid({
        question_text: "Your father is nice to you.",
        model_answer: "Yes! I am the apple of his eye.",
        accepted_intents: []
    }), true);
    assert.equal(textQaQuestionContentValid({
        question_text: "What are your brothers' names? Do you love them?",
        model_answer: "They are Sean and Kenny. No, they're naughty.",
        accepted_intents: []
    }), true);
});

test("keeps every reviewed Workbook 3 numbered question and turns blanks into speaking slots", () => {
    const page5 = extractNumberedTextQaPairs(`Personal questions
1. Who are you?
I am ________, your _________.
2. What is your name?
My name is _________.
3. Are you happy with your name? You like it or hate it?
Yes, I like it. Why do you ask?
4. How many letters are in your name? How do you spell your name?
_____ letters. _ - _ - _ - _ - _
5. What's your last name? Your family name?
My surname is _________.
6. Do you have a nickname?
________ / Sweet potato / No, I don't have a nickname.
7. Do you want to change your name? What would it be?
No, I like my name. / Yes, I like the name "_________."`);
    assert.deepEqual(page5, [
        { question_text: "Who are you?", model_answer: "I am [你的名字], your [你的身分].", accepted_answers: [] },
        { question_text: "What is your name?", model_answer: "My name is [你的名字].", accepted_answers: [] },
        { question_text: "Are you happy with your name? You like it or hate it?", model_answer: "Yes, I like it. Why do you ask?", accepted_answers: [] },
        { question_text: "How many letters are in your name? How do you spell your name?", model_answer: "[字母數] letters. [名字拼字]", accepted_answers: [] },
        { question_text: "What's your last name? Your family name?", model_answer: "My surname is [你的姓氏].", accepted_answers: [] },
        { question_text: "Do you have a nickname?", model_answer: "[你的暱稱]", accepted_answers: ["Sweet potato", "No, I don't have a nickname."] },
        { question_text: "Do you want to change your name? What would it be?", model_answer: "No, I like my name.", accepted_answers: ["Yes, I like the name \"[你想換的新名字].\""] }
    ]);

    const page7 = extractNumberedTextQaPairs(`Personal questions
8. Are you a boy/girl?
Can't you tell? Of course, I am a boy/ girl.
9. Are you a fool?
No, I am a genius.
10. Hey, are you with me?
Yes, I am listening.
11. What's your father's name?
He is ______ / His name is ________.
12. What's your mother's name?
She is ______ / Her name is ________.
13. Do you love them?
Yes, I do. For sure.
14. How old are you? What age are you?
I am _____ years old. How about you?`);
    assert.deepEqual(page7, [
        { question_text: "Are you a boy/girl?", model_answer: "Can't you tell? Of course, I am a boy.", accepted_answers: ["Can't you tell? Of course, I am a girl."] },
        { question_text: "Are you a fool?", model_answer: "No, I am a genius.", accepted_answers: [] },
        { question_text: "Hey, are you with me?", model_answer: "Yes, I am listening.", accepted_answers: [] },
        { question_text: "What's your father's name?", model_answer: "He is [爸爸的名字]", accepted_answers: ["His name is [爸爸的名字]."] },
        { question_text: "What's your mother's name?", model_answer: "She is [媽媽的名字]", accepted_answers: ["Her name is [媽媽的名字]."] },
        { question_text: "Do you love them?", model_answer: "Yes, I do. For sure.", accepted_answers: [] },
        { question_text: "How old are you? What age are you?", model_answer: "I am [你的年齡] years old. How about you?", accepted_answers: [] }
    ]);

    const page9 = extractNumberedTextQaPairs(`Personal questions
15. How old is your dad?
He is _____ years old. How about yours?
16. How old is your mom?
She is _____ years old. How about yours?
17. What's your grandfather's name? And what age? Do you like him?
He's _____. _____ years old. I always love him.
18. What's your grandmother's name? And what age? Do you like her?
She's _____. _____ years old. I always love her.
19. Do you have brothers or sisters?
No, I'm the only child. / Yes, I have a brother and a sister.
20. What's your brother's name? Do you love him?
His name is _____. I don't love him, sometimes.
21. What's your sister's name? Do you love her?
Her name is _____. I love her, sometimes.`);
    assert.deepEqual(page9, [
        { question_text: "How old is your dad?", model_answer: "He is [爸爸的年齡] years old. How about yours?", accepted_answers: [] },
        { question_text: "How old is your mom?", model_answer: "She is [媽媽的年齡] years old. How about yours?", accepted_answers: [] },
        { question_text: "What's your grandfather's name? And what age? Do you like him?", model_answer: "He's [爺爺的名字]. [爺爺的年齡] years old. I always love him.", accepted_answers: [] },
        { question_text: "What's your grandmother's name? And what age? Do you like her?", model_answer: "She's [奶奶的名字]. [奶奶的年齡] years old. I always love her.", accepted_answers: [] },
        { question_text: "Do you have brothers or sisters?", model_answer: "No, I'm the only child.", accepted_answers: ["Yes, I have a brother and a sister."] },
        { question_text: "What's your brother's name? Do you love him?", model_answer: "His name is [兄弟的名字]. I don't love him, sometimes.", accepted_answers: [] },
        { question_text: "What's your sister's name? Do you love her?", model_answer: "Her name is [姊妹的名字]. I love her, sometimes.", accepted_answers: [] }
    ]);
});

test("pairs grouped Workbook 3 prompts with the matching reviewed answers", () => {
    const page11 = extractNumberedTextQaPairs(`[[PAGE P11]]
22. What are your brothers' names?( 尚恩 , 肯尼 ) Do you love them?( 不 , 調皮 )
23. What are your sisters' names?( 貝蒂 , 露易莎 ) Do you love them?( 是 , 可愛 )
24. How many people are there in your family?
25. Do you live with your parents?
26. Do you live with your grandparents?
27. Who do you live with?( 雙親 )
28. Who do you sleep with?( 單獨 , 我覺得孤單 )
They are Sean and Kenny. No, they're naughty.
They are Betty and Louisa. Yes, they're cute.
There are _____ people in my family.
Yes, they are kind. They're generous and witty.
Yes, I live with them./Yes, they just moved in./No, they live alone.
I live with my parents.
I sleep alone in my room. I feel lonely.`);

    assert.equal(page11.length, 7);
    assert.deepEqual(page11[0], {
        question_text: "What are your brothers' names? Do you love them?",
        model_answer: "They are Sean and Kenny. No, they're naughty.",
        accepted_answers: []
    });
    assert.deepEqual(page11[4], {
        question_text: "Do you live with your grandparents?",
        model_answer: "Yes, I live with them.",
        accepted_answers: ["Yes, they just moved in.", "No, they live alone."]
    });
    assert.equal(page11[6].question_text, "Who do you sleep with?");
    assert.equal(page11[6].model_answer, "I sleep alone in my room. I feel lonely.");

    const page15 = extractNumberedTextQaPairs(`[[PAGE P15]]
29. How are you? How are you doing? ( 很好 )
30. Nice to meet you !
31. Are you a student?
32. How old are you? (8)
33. Are you sure? You look like a 6-year-old boy/girl.
34. Are you in Grade 1 or 2 ?
35. What class are you in? ( 五班 )
Greetings
Great.
Nice to meet you, too. / Me too.
Yes, I am. Am I not like a student?
I am eight.
Really? I have good genes.
I'm in grade 2. I'm in the second grade.
I'm in class 5. I'm in the fifth class.`);

    assert.equal(page15.length, 7);
    assert.deepEqual(page15[0], {
        question_text: "How are you? How are you doing?",
        model_answer: "Great.",
        accepted_answers: []
    });
    assert.deepEqual(page15[1], {
        question_text: "Nice to meet you!",
        model_answer: "Nice to meet you, too.",
        accepted_answers: ["Me too."]
    });
    assert.equal(page15[6].model_answer, "I'm in class 5. I'm in the fifth class.");

    const page17 = extractNumberedTextQaPairs(`[[PAGE P17]]
36. Your father is nice to you. ( 掌上明珠 )
37. My father works hard and ...( 顧家好男人 )
38. He has to work hard. Anyway,...( 出生不是含著金湯匙 )
39. He often cheats on the test. ( 是的 , 抄襲者 )
40. Please be quiet! I am going to...( 用功讀書 )
41. Why are you always studying hard? ( 書蟲 )
42. Have you ever skipped class? ( 不 , 老師的模範生 )
Yes! I am the apple of his eye.
He is also a family man.
He was not born with a silver spoon.
Yes, he is a copycat.
I am going to hit the books.
I am a bookworm. I like to read a lot.
No, I am the teacher's pet. I am a model student.`);

    assert.equal(page17.length, 2);
    assert.equal(page17[0].question_text, "Why are you always studying hard?");
    assert.equal(page17[0].model_answer, "I am a bookworm. I like to read a lot.");
    assert.equal(page17[1].question_text, "Have you ever skipped class?");

    const page20 = extractNumberedTextQaPairs(`[[PAGE P20]]
43. Are you hungry?
44. What do you want for breakfast?
45. What would you like for lunch?
46. Do you want to eat some desserts after dinner?
47. Do you prefer fish or meat?
48. What is your favorite food/dessert/fruit?
49. How often do you eat bread/eat out/at a fast food restaurant/in a rest...
Yes, I'm starving. I can eat a cow.
What do you have? I want a hamburger and milk.
Fried rice or noodles. Either is fine.
A piece of chocolate cake and coffee, please.
Fish is my favorite.
I like fried chicken./ chocolate cake./ bananas.
I eat ______ once a week/ twice a month/ 3 times a year.`);

    assert.equal(page20.length, 6);
    assert.equal(page20[0].model_answer, "Yes, I'm starving. I can eat a cow.");
    assert.equal(page20[5].question_text, "What is your favorite food/dessert/fruit?");
});

test("accepts complete P15 conversation cues without turning P17 idiom stems into questions", () => {
    assert.equal(reviewedTextQaPromptIsComplete("Nice to meet you!"), true);
    assert.equal(reviewedTextQaPromptIsComplete("Are you sure? You look like a 6-year-old boy/girl."), true);
    assert.equal(reviewedTextQaPromptIsComplete("Your father is nice to you."), false);
    assert.equal(reviewedTextQaPromptIsComplete("Please be quiet! I am going to..."), false);
    assert.equal(reviewedTextQaPromptIsComplete("How often do you eat bread/eat out/in a rest..."), false);

    const reviewedPage15 = extractNumberedTextQaPairs(`[[PAGE P15]]
29. How are you? How are you doing? (很好)
Great.
[[RED_ANSWER: Great.]]
30. Nice to meet you!
Nice to meet you, too. / Me too.
[[RED_ANSWER: Nice to meet you, too. / Me too.]]
31. Are you a student?
Yes, I am. Am I not like a student?
[[RED_ANSWER: Yes, I am. Am I not like a student?]]
32. How old are you? (8)
I am eight.
[[RED_ANSWER: I am eight.]]
33. Are you sure? You look like a 6-year-old boy/girl.
Really? I have good genes.
[[RED_ANSWER: Really? I have good genes.]]
34. Are you in Grade 1 or 2?
I'm in grade 2. I'm in the second grade.
[[RED_ANSWER: I'm in grade 2. I'm in the second grade.]]
35. What class are you in? (五班)
I'm in class 5. I'm in the fifth class.
[[RED_ANSWER: I'm in class 5. I'm in the fifth class.]]`);

    assert.equal(reviewedPage15.length, 7);
    assert.equal(reviewedPage15[1].question_text, "Nice to meet you!");
    assert.equal(reviewedPage15[4].question_text, "Are you sure? You look like a 6-year-old boy/girl.");
});
