const INSTRUCTION_PREFIX = /^(?:listen|look|read|repeat|say|write|match|circle|choose|complete|fill|color|draw|ask|answer|practice|play|sing|check|tick|trace|find|point|number)\b/i;
const NON_CONTENT = /(?:https?:\/\/|www\.|@|©|®|™|\bISBN\b)/i;

const englishWords = (value: string) => value.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];

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
    const lines = String(sourceText || "").replace(/\r/g, "").split("\n");

    for (const line of lines) {
        const segments = line.match(/[^.!?]+[.!?]+(?:[”"')\]]+)?/g) || [line];
        for (const segment of segments) {
            const sentence = normalizeSentence(segment);
            const fingerprint = sentence.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim();
            if (!isSpeakableSentence(sentence) || !fingerprint || seen.has(fingerprint)) {
                discardedSegments += 1;
                continue;
            }
            seen.add(fingerprint);
            sentences.push(sentence);
        }
    }

    return { sourceText: sentences.join("\n"), sentences, discardedSegments };
};
