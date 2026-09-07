const QUESTION_VISUALS = {
    "What is this red fruit?": {
        src: "/images/speaking/workbook-1/red-apple.webp",
        alt: "題目圖片：一顆紅色水果",
        sourcePage: 30
    },
    "This yellow fruit is a lemon. What is this?": {
        src: "/images/speaking/workbook-1/lemon.webp",
        alt: "題目圖片：切開並疊起來的黃色水果",
        sourcePage: 111
    },
    "These fruits near you are peaches. What are these?": {
        src: "/images/speaking/workbook-1/peaches.webp",
        alt: "題目圖片：幾顆粉紅色水果",
        sourcePage: 111
    },
    "Those fruits over there are pears. What are those?": {
        src: "/images/speaking/workbook-1/pears.webp",
        alt: "題目圖片：幾顆淡黃色水果",
        sourcePage: 111
    }
};

export const getSpeakingQuestionVisual = questionText => QUESTION_VISUALS[String(questionText || "").trim()] || null;

export default QUESTION_VISUALS;
