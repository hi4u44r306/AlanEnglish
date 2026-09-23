const clean = (value: unknown, maximum = 2000) => String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);

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
    if (answerGender === "mixed") return false;
    if (questionGender === "male" && answerGender !== "male") return false;
    if (questionGender === "female" && answerGender !== "female") return false;
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
    if (!questionText.endsWith("?") || answers.length < 1
        || answers.some(answer => answer.endsWith("?") || !textQaGenderIsConsistent(questionText, answer))) return false;
    const questionGender = textQaGenderSignal(questionText);
    const modelGender = textQaGenderSignal(modelAnswer);
    if (questionGender !== "neutral" || !["male", "female"].includes(modelGender)) return true;
    return alternatives.some(answer => textQaGenderSignal(answer) !== modelGender
        && ["male", "female"].includes(textQaGenderSignal(answer))
        && textQaGenderSkeleton(answer) === textQaGenderSkeleton(modelAnswer));
};
