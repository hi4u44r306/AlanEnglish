const INSTRUCTION_PREFIX = /^(?:listen|look|read|repeat|say|write|match|circle|choose|complete|fill|color|draw|ask|answer|practice|play|sing|check|tick|trace|find|point|number)\b/i;
const NON_CONTENT = /(?:https?:\/\/|www\.|@|©|®|™|\bISBN\b)/i;

const englishWords = (value: string) => value.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];

const CONTROLLED_GENDER_PAIR = /\b(he|she|his|her|him|hers|boy|girl|man|woman)\s*\/\s*(he|she|his|her|him|hers|boy|girl|man|woman)\b/gi;
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
    .replace(/\s*[（(][^A-Za-z()]*[）)]\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();

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
