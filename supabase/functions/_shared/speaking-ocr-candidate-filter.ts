import {
    textQaGenderIsConsistent,
    textQaQuestionContentValid
} from "./speaking-text-qa.ts";

const INSTRUCTION_PREFIX = /^(?:listen|look|read|repeat|say|write|match|circle|choose|complete|fill|color|draw|ask|answer|practice|play|sing|check|tick|trace|find|point|number)\b/i;
const NON_CONTENT = /(?:https?:\/\/|www\.|@|©|®|™|\bISBN\b)/i;

const englishWords = (value: string) => value.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];

const CONTROLLED_GENDER_PAIR = /\b(he|she|his|her|him|hers|boy|girl|man|woman)\s*\/\s*(he|she|his|her|him|hers|boy|girl|man|woman)\b/gi;
const HAS_CONTROLLED_GENDER_PAIR = /\b(?:he|she|his|her|him|hers|boy|girl|man|woman)\s*\/\s*(?:he|she|his|her|him|hers|boy|girl|man|woman)\b/i;
const genderSide = (value: string) => {
    const normalized = value.toLowerCase();
    if (["he", "his", "him", "boy", "man"].includes(normalized)) return "male";
    if (["she", "her", "hers", "girl", "woman"].includes(normalized)) return "female";
    return "";
};
const matchCase = (source: string, replacement: string) => {
    if (source === source.toUpperCase()) return replacement.toUpperCase();
    if (source[0] === source[0]?.toUpperCase()) return `${replacement[0]?.toUpperCase() || ""}${replacement.slice(1)}`;
    return replacement.toLowerCase();
};

// When a source does not have a reviewed red-answer marker but explicitly
// prints a controlled he/she or his/her choice, keep two complete, internally
// consistent source variants instead of guessing a gender or creating mixed
// forms such as "He ... her ...".
export const expandControlledGenderChoices = (value: unknown) => {
    const source = String(value || "");
    const pairs = [...source.matchAll(CONTROLLED_GENDER_PAIR)];
    if (!pairs.length || pairs.some(match => genderSide(match[1]) === genderSide(match[2]))) return [source];
    return (["male", "female"] as const).map(side => source.replace(
        CONTROLLED_GENDER_PAIR,
        (_whole, left, right) => {
            const selected = genderSide(left) === side ? left : right;
            return matchCase(left, selected);
        }
    ));
};

const normalizeSentence = (value: string) => value
    .replace(/^\s*(?:\d{1,3}|[A-Za-z])\s*[.)、]\s*/, "")
    .replace(/^\s*(?:[A-Za-z][A-Za-z ]{0,20})\s*[:：]\s*/, "")
    .replace(/\s*[（(][^A-Za-z()]*[）)]/gu, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();

const normalizeLearnerClue = (value: unknown) => String(value || "")
    .replace(/\s*;\s*/g, "；")
    .replace(/\s*[,，]\s*/g, "，")
    .replace(/\s+/g, " ")
    .trim();

const trailingLearnerClue = (value: string) => normalizeLearnerClue(value
    .match(/[（(]\s*([^()（）A-Za-z]+?)\s*[）)]\s*$/u)?.[1]
    || "");

export const textQaPromptWithLearnerClue = (question: string, clue: string) => {
    const normalizedQuestion = normalizeSentence(question);
    const normalizedClue = normalizeLearnerClue(clue);
    return normalizedQuestion && normalizedClue
        ? `${normalizedQuestion}（${normalizedClue}）`
        : normalizedQuestion;
};

const isSpeakableSentence = (value: string) => {
    if (value.length < 4 || value.length > 240 || value.includes("_") || value.includes("[無法辨識]") || NON_CONTENT.test(value)) return false;
    if (!/^[A-Za-z“"']/.test(value) || !/[.!?][”"')\]]?$/.test(value)) return false;
    if (/^(?:page\s*)?\d{1,4}[.)]?$/i.test(value) || INSTRUCTION_PREFIX.test(value)) return false;
    if (value.replace(/[A-Za-z0-9\s.,!?'’"()\-–—:;]/g, "")) return false;
    return englishWords(value).length >= 2;
};

// The reviewed OCR source remains untouched for audit. This stricter view is
// only used when making automatic, standard-sentence speaking candidates.
export const filterOcrPageSpeakingCandidates = (sourceText: unknown) => {
    const seen = new Set<string>();
    const sentences: string[] = [];
    let discardedSegments = 0;
    const normalizedSource = String(sourceText || "").replace(/\r/g, "");
    const redAnswerHints = [...normalizedSource.matchAll(/\[\[RED_ANSWER:\s*([^\]\n]+?)\s*\]\]/gi)]
        .map(match => match[1].replace(/\s+/g, " ").trim().slice(0, 120))
        .filter((hint, index, all) => hint && all.indexOf(hint) === index)
        .slice(0, 30);
    const lines = normalizedSource.replace(/\[\[RED_ANSWER:\s*[^\]\n]+?\s*\]\]/gi, "").split("\n");

    for (const line of lines) {
        const segments = line.match(/[^.!?]+[.!?]+(?:[”"')\]]+)?/g) || [line];
        for (const segment of segments) {
            const expanded = expandControlledGenderChoices(segment);
            let keptVariant = false;
            for (const variant of expanded) {
                const sentence = normalizeSentence(variant);
                const fingerprint = sentence.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim();
                if (!isSpeakableSentence(sentence) || !fingerprint || seen.has(fingerprint)) continue;
                seen.add(fingerprint);
                sentences.push(sentence);
                keptVariant = true;
            }
            if (!keptVariant) discardedSegments += 1;
        }
    }

    return { sourceText: sentences.join("\n"), sentences, discardedSegments, redAnswerHints };
};

const sentenceSegments = (value: string) => value.match(/[^.!?]+[.!?]+(?:[”"')\]]+)?/g) || [];

const answerSlotLabels = (question: string) => {
    const normalized = question.toLowerCase();
    if (/who are you/.test(normalized)) return ["你的名字", "你的身分"];
    if (/how many letters|spell your name/.test(normalized)) return ["字母數", "名字拼字"];
    if (/last name|family name|surname/.test(normalized)) return ["你的姓氏"];
    if (/nickname/.test(normalized)) return ["你的暱稱"];
    if (/change your name/.test(normalized)) return ["你想換的新名字"];
    if (/grandfather's name/.test(normalized)) return ["爺爺的名字", "爺爺的年齡"];
    if (/grandmother's name/.test(normalized)) return ["奶奶的名字", "奶奶的年齡"];
    if (/father's name/.test(normalized)) return ["爸爸的名字"];
    if (/mother's name/.test(normalized)) return ["媽媽的名字"];
    if (/brother's name/.test(normalized)) return ["兄弟的名字"];
    if (/sister's name/.test(normalized)) return ["姊妹的名字"];
    if (/how old is your dad/.test(normalized)) return ["爸爸的年齡"];
    if (/how old is your mom/.test(normalized)) return ["媽媽的年齡"];
    if (/how old are you|what age are you/.test(normalized)) return ["你的年齡"];
    if (/what is your name|what's your name/.test(normalized)) return ["你的名字"];
    return ["你的回答"];
};

const reviewedAnswerTemplate = (value: string, question: string) => {
    const labels = answerSlotLabels(question);
    let slotIndex = 0;
    return normalizeSentence(value).replace(
        /(?:[_＿]+\s*(?:-\s*[_＿]+\s*)+)|[_＿]{2,}/g,
        () => `[${labels[Math.min(slotIndex++, labels.length - 1)]}]`
    );
};

const REVIEWED_DIALOGUE_CUE = /^(?:nice to meet you|hello|hi|good morning|good afternoon|good evening|good night|thank you|thanks|goodbye|bye)[!.]?$/i;

export const reviewedTextQaPromptIsComplete = (prompt: string) => {
    const promptHasGenderChoice = HAS_CONTROLLED_GENDER_PAIR.test(prompt);
    if (englishWords(prompt).length < 2
        || (!promptHasGenderChoice && prompt.replace(/[A-Za-z0-9\s.,!?'’"()\-–—:;/]/g, "") !== "")
        || !/[.!?](?:["')\]]+)?$/.test(prompt)) return false;
    if (prompt.includes("?")) return true;
    // A small set of complete social cues are valid conversational prompts.
    // Other statements and sentence fragments (for example Workbook 3 P17
    // idiom stems) are source context, not questions for the learner.
    return REVIEWED_DIALOGUE_CUE.test(prompt);
};

const likelyGroupedAnswerLine = (value: string) => englishWords(value).length >= 1
    && (/[.!?](?:["')\]]+)?$/.test(value) || /[_＿]{2,}/.test(value));

// Some reviewed pages print all numbered prompts first, then a separately
// ordered answer bank. Never pair these by position: the teacher's answers may
// run backwards or be shuffled. Keep the numbered clue for AI matching while
// retaining the original OCR text for human review.
export const extractGroupedNumberedTextQaForAi = (sourceText: unknown) => {
    const lines = String(sourceText || "").replace(/\r/g, "").split("\n").map(line => line.trim());
    const numbered = lines.flatMap((line, index) => {
        const match = line.match(/^(\d{1,3})[.)、]\s*(.+)$/);
        if (!match) return [];
        const question = normalizeSentence(match[2]);
        if (!reviewedTextQaPromptIsComplete(question)) return [];
        const clue = trailingLearnerClue(match[2]);
        return [{ number: Number(match[1]), question, clue, index }];
    });
    if (numbered.length < 2 || numbered.length > 30 || !numbered.every(item => item.clue)
        || new Set(numbered.map(item => item.question)).size === numbered.length) return null;
    const lastPromptIndex = numbered[numbered.length - 1].index;
    if (numbered.some((item, index) => index && item.index !== numbered[index - 1].index + 1)) return null;
    const answers = lines.slice(lastPromptIndex + 1)
        .filter(line => line && !/^\[\[(?:RED_ANSWER|PAGE)\b/i.test(line))
        .map(line => normalizeSentence(line))
        .filter(isSpeakableSentence);
    if (answers.length !== numbered.length || new Set(answers).size !== answers.length) return null;
    return {
        prompts: numbered.map(({ number, question, clue }) => ({ number, question, clue })),
        answers
    };
};

export const validateGroupedNumberedTextQaMatch = (source: ReturnType<typeof extractGroupedNumberedTextQaForAi>, rows: unknown) => {
    if (!source || !Array.isArray(rows) || rows.length !== source.prompts.length) return null;
    const answerByNumber = new Map<number, string>();
    const usedAnswers = new Set<string>();
    for (const row of rows) {
        const number = Number(row?.number);
        const answer = String(row?.answer || "").trim();
        if (!source.prompts.some(prompt => prompt.number === number)
            || !source.answers.includes(answer) || answerByNumber.has(number) || usedAnswers.has(answer)) return null;
        answerByNumber.set(number, answer);
        usedAnswers.add(answer);
    }
    return source.prompts.map(prompt => ({
        ...prompt,
        source_answer: answerByNumber.get(prompt.number) as string
    }));
};

// Reviewed personal-question pages use either an interleaved prompt/answer
// layout or a grouped layout where every numbered prompt is followed by the
// same number of teacher-designed response lines. Every numbered block remains
// one question. OCR blanks become named speaking slots so personal names and
// ages stay variable instead of causing the whole source question to be
// discarded.
export const extractNumberedTextQaPairs = (sourceText: unknown) => {
    let blocks: Array<{ prompt: string; answers: string[] }> = [];
    let current: { prompt: string; answers: string[] } | null = null;
    for (const rawLine of String(sourceText || "").replace(/\r/g, "").split("\n")) {
        const line = rawLine.trim();
        const numbered = line.match(/^\d{1,3}[.)、]\s*(.+)$/);
        if (numbered) {
            if (current) blocks.push(current);
            current = { prompt: numbered[1].trim(), answers: [] };
        } else if (current && line && !/^\[\[(?:PAGE|RED_ANSWER)\b/i.test(line)) {
            current.answers.push(line);
        }
    }
    if (current) blocks.push(current);

    const groupedLayout = blocks.length > 1
        && blocks.slice(0, -1).every(block => block.answers.length === 0)
        && blocks[blocks.length - 1].answers.length >= blocks.length;
    if (groupedLayout) {
        const groupedAnswers = blocks[blocks.length - 1].answers
            .filter(line => !/^\[\[RED_ANSWER\s*:/i.test(line));
        while (groupedAnswers.length > blocks.length && !likelyGroupedAnswerLine(groupedAnswers[0])) {
            groupedAnswers.shift();
        }
        while (groupedAnswers.length > blocks.length
            && !likelyGroupedAnswerLine(groupedAnswers[groupedAnswers.length - 1])) {
            groupedAnswers.pop();
        }
        if (groupedAnswers.length === blocks.length) {
            blocks = blocks.map((block, index) => ({ ...block, answers: [groupedAnswers[index]] }));
        }
    }

    return blocks.flatMap(block => {
        const prompt = normalizeSentence(block.prompt);
        const clue = trailingLearnerClue(block.prompt);
        const questions = reviewedTextQaPromptIsComplete(prompt)
            ? [textQaPromptWithLearnerClue(prompt, clue)] : [];
        if (!questions.length) return [];

        const answers = Array.from(new Set(block.answers.flatMap(answerLine => {
            const genderVariants = expandControlledGenderChoices(answerLine);
            return genderVariants.flatMap(variant => {
                const alternatives = HAS_CONTROLLED_GENDER_PAIR.test(answerLine) ? [variant] : variant.split(/\s*\/\s*/);
                return alternatives
                    .map(alternative => reviewedAnswerTemplate(alternative, prompt))
                    .filter(answer => (englishWords(answer).length >= 1 || /\[[^\]]+\]/.test(answer))
                        && !answer.includes("_"));
            });
        })));
        if (!answers.length) return [];

        return questions.flatMap(question => {
            // The learner clue is display-only metadata. Validate gender and
            // spoken prompt completeness against the English source prompt so
            // numeric clues such as （8） cannot invalidate an otherwise
            // complete question.
            const compatibleAnswers = answers.filter(answer => textQaGenderIsConsistent(prompt, answer));
            if (!compatibleAnswers.length) return [];
            const modelAnswer = compatibleAnswers[0];
            const acceptedAnswers = compatibleAnswers.slice(1);
            return textQaQuestionContentValid({
                question_text: prompt,
                model_answer: modelAnswer,
                accepted_intents: acceptedAnswers
            }) ? [{ question_text: question, model_answer: modelAnswer, accepted_answers: acceptedAnswers }] : [];
        });
    });
};
