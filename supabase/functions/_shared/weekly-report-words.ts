// 週報的「單字」一行：累計會拼幾個字，以及和上週比有沒有增加。
// 為什麼不顯示「本週拼了幾個」：學生這週只聽力、沒玩單字時會變成 0，家長會誤會孩子退步。
// 所以顯示「累計」（只增不減）和「比上週多 M 個／和上週一樣」；從沒學會過任何字的學生整行不出現。
//
// 定義：student_word_progress 裡 first_mastered_at 不為空 ＝ 曾經學會（沒用提示答對過）。
// 不用 status = 'mastered'，因為學會過的字再答錯會被改成 'missed'，累計數字會變少。

// 題庫版本。不 import 題庫本身（會把整個題庫打包進週報函式）；scripts/weekly-report-words.test.mjs 會確認它和題庫版本相同。
export const WORD_PROGRESS_BANK_VERSION = "v1";

export type WordMastery = { total: number; previous: number };

export type WordMasterySummary = {
    total_mastered: number;
    previous_mastered: number;
    added: number;
    text: string;
};

const countMastered = async (admin: any, studentId: number, before: string): Promise<number> => {
    const { count, error } = await admin
        .from("student_word_progress")
        .select("word_key", { count: "exact", head: true })
        .eq("student_id", studentId)
        .eq("bank_version", WORD_PROGRESS_BANK_VERSION)
        .not("first_mastered_at", "is", null)
        .lt("first_mastered_at", before);
    if (error) throw error;
    return Number(count) || 0;
};

// total：到這一週結束（下週一 00:00 台北，不含）為止曾學會的字數；previous：到這一週開始為止的字數。
// studentId 一律由呼叫端用伺服器已驗證的學生傳入，這裡只回傳兩個數字，不回傳字的清單。
export async function loadWordMastery(admin: any, studentId: number, startAt: string, endAt: string): Promise<WordMastery> {
    if (!Number.isInteger(Number(studentId)) || Number(studentId) <= 0) throw new Error("student_id 不正確");
    const [total, previous] = await Promise.all([
        countMastered(admin, Number(studentId), endAt),
        countMastered(admin, Number(studentId), startAt)
    ]);
    return { total, previous };
}

// 沒有學會任何字（或資料不合理）就回 null，畫面、文字摘要、Email 都不顯示這一行。
export function summarizeWordMastery(input: { total?: unknown; previous?: unknown } | null | undefined): WordMasterySummary | null {
    const total = Number(input?.total);
    const rawPrevious = Number(input?.previous);
    if (!Number.isFinite(total) || !Number.isInteger(total) || total <= 0) return null;
    const previous = Number.isFinite(rawPrevious) && rawPrevious >= 0 ? Math.min(Math.floor(rawPrevious), total) : 0;
    const added = Math.max(0, total - previous);
    return {
        total_mastered: total,
        previous_mastered: previous,
        added,
        text: added > 0 ? `累計會拼 ${total} 個字，比上週多 ${added} 個` : `累計會拼 ${total} 個字，和上週一樣`
    };
}
