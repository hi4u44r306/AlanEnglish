export const PRONUNCIATION_WORLDS = [
    {
        id: "daily-greetings",
        title: "日常問候",
        subtitle: "和新朋友打招呼",
        description: "從簡單問候開始，練習清楚、自然地說完整句子。",
        lessons: [
            {
                id: "greeting-good-morning",
                title: "早安問候",
                mission: "向老師或同學說早安",
                referenceText: "Good morning. How are you?",
                translation: "早安，你好嗎？",
                hint: "Good 的尾音要說清楚，morning 不要念得太快。"
            },
            {
                id: "greeting-introduction",
                title: "介紹自己",
                mission: "告訴新朋友你的名字",
                referenceText: "Hello. My name is Amy.",
                translation: "你好，我叫 Amy。",
                hint: "My name is 可以連在一起自然地說。"
            },
            {
                id: "greeting-feeling",
                title: "分享心情",
                mission: "回答今天過得如何",
                referenceText: "I am great today. Thank you.",
                translation: "我今天很好，謝謝你。",
                hint: "great 的 r 音可以慢慢練習。"
            },
            {
                id: "greeting-new-friend",
                title: "認識新朋友",
                mission: "有禮貌地結束第一次見面",
                referenceText: "It is nice to meet you.",
                translation: "很高興認識你。",
                hint: "nice 和 meet 是這句話的重點字。"
            }
        ]
    }
];

export const getPronunciationLesson = lessonId => PRONUNCIATION_WORLDS
    .flatMap(world => world.lessons)
    .find(lesson => lesson.id === lessonId) || null;
