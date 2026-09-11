type CuratedQuestion = {
    question_text: string;
    hint_zh: string;
    keywords: string[];
    simple_answer: string;
    model_answer: string;
    follow_up_question: string;
    pronunciation_notes_zh: string;
    accepted_intents: string[];
};

const question = (
    questionText: string,
    hintZh: string,
    answer: string,
    keywords: string[],
    pronunciationNotesZh: string,
    acceptedIntent: string,
    followUpQuestion = ""
): CuratedQuestion => ({
    question_text: questionText,
    hint_zh: hintZh,
    keywords,
    simple_answer: answer,
    model_answer: answer,
    follow_up_question: followUpQuestion,
    pronunciation_notes_zh: pronunciationNotesZh,
    accepted_intents: [acceptedIntent]
});

const template = ({
    key, number, pages, topic, introZh, learningGoalZh, answerType, questions
}: {
    key: string;
    number: string;
    pages: number[];
    topic: string;
    introZh: string;
    learningGoalZh: string;
    answerType: string;
    questions: CuratedQuestion[];
}) => ({
    catalogKey: "workbook1",
    templateKey: key,
    documentTitle: "Workbook 1 口說大挑戰",
    unitLabel: `Topic ${number}`,
    pageFromLabel: `P${Math.min(...pages)}`,
    pageToLabel: `P${Math.max(...pages)}`,
    sourcePages: pages,
    topic,
    title: `${number} ${topic}`,
    introZh,
    learningGoalZh,
    sourceText: questions.map(item => `${item.question_text} ${item.model_answer}`).join(" "),
    difficulty: "國小低年級",
    answerType,
    questions
});

const COLORS_AND_OBJECTS = [
    question("What color is a banana?", "香蕉通常是什麼顏色？", "A banana is yellow.", ["banana", "yellow"], "banana 的第二音節較重；yellow 的開頭 y 要清楚。", "學生完整說出香蕉是黃色的"),
    question("What color is the sky on a sunny day?", "晴天的天空是什麼顏色？", "The sky is blue.", ["sky", "blue"], "sky 的 sk 子音要連在一起；blue 的尾音要收清楚。", "學生完整說出天空是藍色的"),
    question("What color is an eggplant?", "茄子通常是什麼顏色？", "An eggplant is purple.", ["eggplant", "purple"], "eggplant 的第一音節較重；purple 的兩個音節要分清楚。", "學生完整說出茄子是紫色的"),
    question("What color is an orange?", "柳橙通常是什麼顏色？", "It is orange.", ["it", "is", "orange"], "orange 的第一音節較重。", "學生完整說出柳橙是橘色的"),
    question("What is this red fruit?", "這個紅色水果是蘋果。", "It is an apple.", ["it", "is", "an", "apple"], "an apple 可以自然連讀；apple 的第一音節較重。", "學生用 It is an apple 回答"),
    question("How many colors are in a rainbow?", "彩虹通常有幾種顏色？", "There are seven colors in a rainbow.", ["there", "are", "seven", "colors", "rainbow"], "seven 的第一音節較重；colors 與 rainbow 要說清楚。", "學生完整說出彩虹有七種顏色")
];

const NUMBERS_AND_MATH = [
    question("What is seven minus two?", "用英文說出七減二的答案。", "Seven minus two is five.", ["seven", "minus", "two", "five"], "minus 的第一音節較重；five 的尾音 v 要收清楚。", "學生完整說出七減二等於五"),
    question("What is seven plus four?", "用英文說出七加四的答案。", "Seven plus four is eleven.", ["seven", "plus", "four", "eleven"], "eleven 的第二音節較重；four 的尾音 r 不要過重。", "學生完整說出七加四等於十一"),
    question("What is twelve minus five?", "用英文說出十二減五的答案。", "Twelve minus five is seven.", ["twelve", "minus", "five", "seven"], "twelve 的尾音 v 要清楚；seven 不要漏掉第二音節。", "學生完整說出十二減五等於七"),
    question("What is three plus three?", "用英文說出三加三的答案。", "Three plus three is six.", ["three", "plus", "six"], "three 的 th 要輕咬舌；six 的尾音 ks 要完整。", "學生完整說出三加三等於六"),
    question("What is four plus three minus two?", "先算四加三，再減二。", "Four plus three minus two is five.", ["four", "plus", "three", "minus", "two", "five"], "放慢速度，把 plus 與 minus 兩個運算詞說清楚。", "學生完整說出四加三減二等於五"),
    question("Can you count from nine to thirteen?", "從九依序數到十三。", "Nine, ten, eleven, twelve, thirteen.", ["nine", "ten", "eleven", "twelve", "thirteen"], "每個數字之間短暫停頓；thirteen 的重音在 teen。", "學生依序說出九到十三")
];

const TIME_AND_DAY = [
    question("It is seven o'clock in the morning. What time is it?", "現在是早上七點。", "It is seven o'clock.", ["it", "is", "seven", "o'clock"], "seven o'clock 可以自然連讀，o'clock 的第二音節較重。", "學生完整說出現在七點"),
    question("What do you do at seven in the morning?", "用吃早餐的完整句回答。", "I have breakfast at seven.", ["I", "have", "breakfast", "seven"], "breakfast 的第一音節較重；at seven 可以輕快連讀。", "學生完整說出七點吃早餐"),
    question("What do you say when you see a friend after lunch?", "午餐後見到朋友時要說午安。", "Good afternoon.", ["good", "afternoon"], "afternoon 的重音放在 noon。", "學生用 Good afternoon 問候"),
    question("What do you do before nine at night?", "用做功課的完整句回答。", "I do my homework before nine.", ["I", "do", "homework", "before", "nine"], "homework 的第一音節較重；before 的第二音節較重。", "學生完整說出九點前做功課"),
    question("What do you say before going to bed?", "睡覺前要說晚安。", "I say good night.", ["I", "say", "good", "night"], "night 的尾音 t 要收清楚。", "學生完整說出睡前說晚安"),
    question("What do you do after you brush your teeth?", "刷完牙後準備去睡覺。", "I go to bed.", ["I", "go", "to", "bed"], "go to 可以自然連讀；bed 的尾音 d 要清楚。", "學生完整說出刷牙後上床睡覺")
];

const BODY_PARTS = [
    question("What do you use to see?", "用眼睛看東西。", "I use my eyes to see.", ["I", "use", "eyes", "see"], "eyes 的尾音 z 要清楚；see 的長母音要拉完整。", "學生完整說出用眼睛看"),
    question("What do you use to hear?", "用耳朵聽聲音。", "I use my ears to hear.", ["I", "use", "ears", "hear"], "ears 與 hear 的母音不同，要慢慢說清楚。", "學生完整說出用耳朵聽"),
    question("What do you use to smell?", "用鼻子聞味道。", "I use my nose to smell.", ["I", "use", "nose", "smell"], "nose 的尾音 z 要清楚；smell 的 sm 子音要連在一起。", "學生完整說出用鼻子聞"),
    question("What do you use to eat?", "用嘴巴吃東西。", "I use my mouth to eat.", ["I", "use", "mouth", "eat"], "mouth 的 th 要輕咬舌；eat 的長母音要清楚。", "學生完整說出用嘴巴吃"),
    question("Are these your knees?", "肯定回答，說它們是我的膝蓋。", "Yes, they are my knees.", ["yes", "they", "are", "my", "knees"], "they 的 th 要輕咬舌；knees 的 k 不發音。", "學生肯定回答並說出膝蓋"),
    question("Is this your left shoulder?", "肯定回答，說這是我的左肩。", "Yes, it is my left shoulder.", ["yes", "it", "is", "my", "left", "shoulder"], "left 的尾音 ft 要清楚；shoulder 的第一音節較重。", "學生肯定回答並說出左肩")
];

const FAMILY_AND_PEOPLE = [
    question("Judy is Jack's mother. Who is Judy?", "Judy 是 Jack 的媽媽。", "She is Jack's mother.", ["she", "is", "Jack's", "mother"], "mother 的 th 要輕咬舌；Jack's 的尾音 s 要清楚。", "學生完整說出 Judy 是 Jack 的媽媽"),
    question("Mike is Jack's father. Who is Mike?", "Mike 是 Jack 的爸爸。", "He is Jack's father.", ["he", "is", "Jack's", "father"], "father 的 th 要輕咬舌；he is 可以自然連讀。", "學生完整說出 Mike 是 Jack 的爸爸"),
    question("Jean is Jack's sister. Who is Jean?", "Jean 是 Jack 的姊妹。", "She is Jack's sister.", ["she", "is", "Jack's", "sister"], "sister 的第一音節較重；Jack's 的尾音 s 要保留。", "學生完整說出 Jean 是 Jack 的姊妹"),
    question("Who are your mother's parents?", "媽媽的父母是外公和外婆。", "They are my grandparents.", ["they", "are", "my", "grandparents"], "grandparents 的第一音節較重，不要漏掉尾音 s。", "學生完整說出他們是祖父母"),
    question("How many parents does Jack have?", "Jack 有爸爸和媽媽。", "He has two parents.", ["he", "has", "two", "parents"], "parents 的第一音節較重，尾音 s 要保留。", "學生完整說出 Jack 有兩位家長"),
    question("How many grandparents does Jack have?", "Jack 有外公和外婆。", "He has two grandparents.", ["he", "has", "two", "grandparents"], "grandparents 的第一音節較重，不要漏掉尾音 s。", "學生完整說出 Jack 有兩位祖父母")
];

const YES_NO_AND_CONTRACTIONS = [
    question("Are you a student?", "使用 Yes 與 I am 完整回答。", "Yes, I am.", ["yes", "I", "am"], "Yes 後短暫停頓；I am 要自然連讀。", "學生用 Yes I am 肯定回答"),
    question("Is this a pen?", "使用 Yes 與 it is 完整回答。", "Yes, it is.", ["yes", "it", "is"], "it is 可以自然連讀，但兩個字都要聽得見。", "學生用 Yes it is 肯定回答"),
    question("Is that a pencil?", "使用 No 與 it isn't 完整回答。", "No, it isn't.", ["no", "it", "isn't"], "isn't 的尾音 nt 要收清楚。", "學生用 No it isn't 否定回答"),
    question("Are these your books?", "使用 Yes 與 they are 完整回答。", "Yes, they are.", ["yes", "they", "are"], "they 的 th 要輕咬舌；they are 可以自然連讀。", "學生用 Yes they are 肯定回答"),
    question("Is she a nurse?", "使用 Yes 與 she is 完整回答。", "Yes, she is.", ["yes", "she", "is"], "she 的 sh 要清楚；she is 不要漏掉 is。", "學生用 Yes she is 肯定回答"),
    question("Are they your friends?", "使用 No 與 they aren't 完整回答。", "No, they aren't.", ["no", "they", "aren't"], "aren't 的尾音 nt 要清楚；they 的 th 要輕咬舌。", "學生用 No they aren't 否定回答")
];

const PLACES_AND_THINGS = [
    question("The cat is under the bed. Where is the cat?", "貓在床底下。", "It is under the bed.", ["it", "is", "under", "bed"], "under 的第一音節較重；bed 的尾音 d 要清楚。", "學生完整說出貓在床底下"),
    question("The pencils are in the cup. Where are the pencils?", "鉛筆在杯子裡。", "They are in the cup.", ["they", "are", "in", "cup"], "they 的 th 要輕咬舌；in the 可以自然連讀。", "學生完整說出鉛筆在杯子裡"),
    question("The book is on the desk. Where is the book?", "書在桌上。", "It is on the desk.", ["it", "is", "on", "desk"], "on the 可以自然連讀；desk 的 sk 尾音要清楚。", "學生完整說出書在桌上"),
    question("This yellow fruit is a lemon. What is this?", "靠近你的黃色水果是檸檬。", "It is a lemon.", ["it", "is", "a", "lemon"], "lemon 的第一音節較重。", "學生用 It is a lemon 回答"),
    question("These fruits near you are peaches. What are these?", "靠近你的水果是桃子。", "They are peaches.", ["they", "are", "peaches"], "peaches 有兩個音節，尾音 iz 要說清楚。", "學生用 They are peaches 回答"),
    question("Those fruits over there are pears. What are those?", "遠處的水果是梨子。", "They are pears.", ["they", "are", "pears"], "those 的 th 要輕咬舌；pears 的尾音 z 要清楚。", "學生用 They are pears 回答")
];

const QUESTIONS_AND_REVIEW = [
    question("How are you today?", "說自己今天很好並道謝。", "I am fine, thank you.", ["I", "am", "fine", "thank", "you"], "fine 的尾音 n 要清楚；thank 的 th 要輕咬舌。", "學生完整回答近況"),
    question("Ben is nine years old. How old is Ben?", "Ben 九歲。", "He is nine years old.", ["he", "is", "nine", "years", "old"], "years 的尾音 z 要清楚；old 的尾音 d 要收好。", "學生完整說出 Ben 九歲"),
    question("Mary is in the library. Where is Mary?", "Mary 在圖書館。", "She is in the library.", ["she", "is", "in", "library"], "library 要分成清楚的音節，第一音節較重。", "學生完整說出 Mary 在圖書館"),
    question("Anna cares for patients at a hospital. What does she do?", "Anna 在醫院照顧病人，她是護士。", "She is a nurse.", ["she", "is", "a", "nurse"], "nurse 的尾音要收清楚；she is 可以自然連讀。", "學生完整說出 Anna 是護士"),
    question("Tom and Amy are in your class. Who are they?", "Tom 和 Amy 是你的同學。", "They are my classmates.", ["they", "are", "my", "classmates"], "classmates 的兩個部分都要說清楚，尾音 s 要保留。", "學生完整說出他們是同學"),
    question("It is four o'clock. What time is it?", "現在是四點。", "It is four o'clock.", ["it", "is", "four", "o'clock"], "four o'clock 可以自然連讀；o'clock 的第二音節較重。", "學生完整說出現在四點")
];

export const WORKBOOK_ONE_FOLLOWUP_TEMPLATES: Record<string, any> = {
    create_workbook_1_colors: template({
        key: "workbook_1_colors_objects_v1", number: "03", pages: [28, 30, 34, 84],
        topic: "顏色與生活物品", introZh: "和新朋友玩顏色猜謎。先聽問題，再用完整英文句子說出顏色或物品。",
        learningGoalZh: "能回答常見顏色問題，並正確使用 a、an、It is 與 There are。", answerType: "fixed_visual_context", questions: COLORS_AND_OBJECTS
    }),
    create_workbook_1_numbers: template({
        key: "workbook_1_numbers_math_v1", number: "04", pages: [39, 42, 43, 49],
        topic: "數字與簡單算術", introZh: "用英文和同學一起算數學。聽清楚 plus 與 minus，再把整個算式和答案說出來。",
        learningGoalZh: "能說出 1～13，並用完整英文句子回答基礎加減法。", answerType: "fixed_math", questions: NUMBERS_AND_MATH
    }),
    create_workbook_1_time: template({
        key: "workbook_1_time_daily_routine_v1", number: "05", pages: [46, 60, 70, 75, 80, 90],
        topic: "時間與我的一天", introZh: "從早上起床到晚上睡覺，練習說時間、日常活動和不同時段的問候。",
        learningGoalZh: "能回答整點時間，並用簡短完整句描述早餐、功課與睡前活動。", answerType: "fixed_daily_routine", questions: TIME_AND_DAY
    }),
    create_workbook_1_body: template({
        key: "workbook_1_body_parts_v1", number: "06", pages: [64, 78],
        topic: "我的身體部位", introZh: "跟著問題指出自己的身體部位，並說說眼睛、耳朵、鼻子和嘴巴能做什麼。",
        learningGoalZh: "能說出常見身體部位，並正確使用單數 it 與複數 they。", answerType: "fixed_body_parts", questions: BODY_PARTS
    }),
    create_workbook_1_family: template({
        key: "workbook_1_family_people_v1", number: "07", pages: [79, 87, 89, 104],
        topic: "家人與人物介紹", introZh: "認識 Jack 的家人，練習用 he、she、they 與家庭稱謂介紹人物。",
        learningGoalZh: "能回答人物關係與家庭成員數量，並正確使用 mother、father、sister 與 grandparents。", answerType: "fixed_family_context", questions: FAMILY_AND_PEOPLE
    }),
    create_workbook_1_yes_no: template({
        key: "workbook_1_yes_no_contractions_v1", number: "08", pages: [26, 27, 34, 51, 53, 92, 94],
        topic: "Yes／No 與縮寫回答", introZh: "朋友會問你幾個簡單的是非題。聽清楚主詞，再用正確的 be 動詞完整回答。",
        learningGoalZh: "能使用 Yes／No、I am、it is、they are，以及 isn't／aren't 回答問題。", answerType: "fixed_yes_no", questions: YES_NO_AND_CONTRACTIONS
    }),
    create_workbook_1_places: template({
        key: "workbook_1_places_demonstratives_v1", number: "09", pages: [96, 109, 111, 112, 114],
        topic: "東西在哪裡？", introZh: "和朋友玩尋寶遊戲，找出東西在裡面、上面或下面，並分清楚近處和遠處的物品。",
        learningGoalZh: "能使用 in、on、under、this、these、those 與 it／they 描述位置及物品。", answerType: "fixed_location_context", questions: PLACES_AND_THINGS
    }),
    create_workbook_1_review: template({
        key: "workbook_1_wh_questions_review_v1", number: "10", pages: [99, 101, 102, 105, 106, 108, 117, 118, 119],
        topic: "問句與總複習", introZh: "完成 Workbook 1 的最後口說任務。分辨 How、How old、Who、Where、What 與 What time，並用完整句回答。",
        learningGoalZh: "能聽懂六種常見疑問句，綜合運用人物、年齡、地點、職業與時間回答。", answerType: "fixed_wh_review", questions: QUESTIONS_AND_REVIEW
    })
};
