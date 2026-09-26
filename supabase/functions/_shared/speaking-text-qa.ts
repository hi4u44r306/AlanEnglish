const clean = (value: unknown, maximum = 2000) => String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);

// Chinese teaching clues may be placed before, inside, or after the English
// prompt. Check the speakable English rather than the last visible character.
export const textQaPromptIsComplete = (value: unknown) => {
    const spoken = clean(value, 800).replace(/？/g, "?")
        .replace(/[^\x20-\x7E]/g, " ")
        .replace(/[()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
    return /[A-Za-z]/.test(spoken) && /[.!?]["']?$/.test(spoken);
};

export const textQaGenderSignal = (value: unknown) => {
    const tokens = String(value || "").toLowerCase().match(/[a-z]+/g) || [];
    const male = tokens.some(token => [
        "he", "his", "him", "himself", "boy", "man", "father", "dad", "daddy",
        "grandfather", "grandpa", "brother", "son", "husband", "uncle", "nephew"
    ].includes(token));
    const female = tokens.some(token => [
        "she", "her", "hers", "herself", "girl", "woman", "mother", "mom", "mommy", "mum",
        "grandmother", "grandma", "sister", "daughter", "wife", "aunt", "niece"
    ].includes(token));
    return male && female ? "mixed" : male ? "male" : female ? "female" : "neutral";
};

export const textQaGenderIsConsistent = (questionText: unknown, answerText: unknown) => {
    const questionGender = textQaGenderSignal(questionText);
    const answerGender = textQaGenderSignal(answerText);
    const question = String(questionText || "").toLowerCase();
    const answer = String(answerText || "").toLowerCase();
    const mixedPronouns = (/\bhe\b/.test(answer) && /\b(?:her|hers)\b/.test(answer))
        || (/\bshe\b/.test(answer) && /\b(?:his|him)\b/.test(answer));
    if (mixedPronouns) return false;
    const neutralPluralFamilyAnswer = answerGender === "neutral"
        && /\b(?:brothers|sisters)\b/.test(question)
        && /\b(?:they|them|their)\b/.test(answer);
    if (questionGender === "male" && answerGender !== "male" && !neutralPluralFamilyAnswer) return false;
    if (questionGender === "female" && answerGender !== "female" && !neutralPluralFamilyAnswer) return false;
    return true;
};

export const textQaGenderSkeleton = (value: unknown) => String(value || "").toLowerCase()
    .replace(/\b(?:he|she|his|her|him|hers|himself|herself|boy|girl|man|woman|father|mother|dad|mom|daddy|mommy|mum|grandfather|grandmother|grandpa|grandma|brother|sister|son|daughter|husband|wife|uncle|aunt|nephew|niece)\b/g, "{gender}")
    .replace(/[^a-z{}]+/g, " ")
    .trim();

export const textQaQuestionContentValid = (question: any) => {
    const questionText = clean(question?.question_text, 800);
    const modelAnswer = clean(question?.model_answer);
    const alternatives = [...new Set((Array.isArray(question?.accepted_intents) ? question.accepted_intents : [])
        .map((answer: unknown) => clean(answer, 500)).filter(Boolean))]
        .filter(answer => answer !== modelAnswer);
    const answers = [modelAnswer, ...alternatives].filter(Boolean);
    if (!textQaPromptIsComplete(questionText) || answers.length < 1
        || answers.some(answer => !textQaGenderIsConsistent(questionText, answer))) return false;
    const questionGender = textQaGenderSignal(questionText);
    const modelGender = textQaGenderSignal(modelAnswer);
    if (questionGender !== "neutral" || !["male", "female"].includes(modelGender)) return true;
    return alternatives.some(answer => textQaGenderSignal(answer) !== modelGender
        && ["male", "female"].includes(textQaGenderSignal(answer))
        && textQaGenderSkeleton(answer) === textQaGenderSkeleton(modelAnswer));
};
