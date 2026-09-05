const ANSWER_SLOT_PATTERN = /[\u005B［]([^\u005D］]{1,80})[\u005D］]/g;
const ENGLISH_SLOT_VALUE = /^[A-Za-z0-9][A-Za-z0-9 .,'!?&-]{0,59}$/;

const clientError = (message: string, status: number, code: string) => Object.assign(new Error(message), { status, code });

export const readSpeakingSlotValues = (value: unknown) => {
    if (value === null || value === undefined || value === "") return {} as Record<string, string>;
    if (typeof value !== "string" || value.length > 1000) {
        throw clientError("個人化答案格式不正確", 400, "invalid_slot_values");
    }
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch {
        throw clientError("個人化答案格式不正確", 400, "invalid_slot_values");
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        throw clientError("個人化答案格式不正確", 400, "invalid_slot_values");
    }
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length > 5) throw clientError("個人化答案欄位太多", 400, "invalid_slot_values");

    const result: Record<string, string> = {};
    for (const [rawLabel, rawValue] of entries) {
        const label = rawLabel.trim();
        const answer = String(rawValue || "").replace(/\s+/g, " ").trim();
        if (!label || label.length > 80 || !ENGLISH_SLOT_VALUE.test(answer)) {
            throw clientError("個人化答案請使用 1 至 60 個英文字元", 422, "invalid_slot_value");
        }
        result[label] = answer;
    }
    return result;
};

export const buildSpeakingReferenceText = (template: unknown, slotValues: Record<string, string>) => {
    const source = String(template || "");
    const labels = [...source.matchAll(ANSWER_SLOT_PATTERN)]
        .map(match => String(match[1] || "").trim())
        .filter((label, index, all) => label && all.indexOf(label) === index);
    const suppliedLabels = Object.keys(slotValues);
    if (labels.length !== suppliedLabels.length || labels.some(label => !slotValues[label])) {
        throw clientError("請先填完題目中的個人化英文答案", 422, "answer_slots_required");
    }
    if (suppliedLabels.some(label => !labels.includes(label))) {
        throw clientError("個人化答案與目前題目不符", 422, "answer_slots_mismatch");
    }
    return source
        .replace(ANSWER_SLOT_PATTERN, (_placeholder, rawLabel) => slotValues[String(rawLabel || "").trim()] || "")
        .replace(/\s+/g, " ")
        .trim();
};
