// 單字大挑戰 Edge Function 的處理邏輯。依賴（資料庫、身分驗證、權限）都從外面傳進來，方便用假資料在本機測試。
// 原則：不信任前端傳來的 role／student_id／分數；對錯由這裡用伺服器字庫判斷；答案在作答之後才回傳；
// 任何一步失敗都回明確錯誤，前端會退回「本機模式」（照常能玩，只是不記到帳號）。
import { WORD_BANK_VERSION } from "./word-challenge-bank.generated.ts";
import { checkWordAnswer, findServerWord, meaningPeersOf } from "./word-challenge-answer.ts";
import {
    BASE_REVEALED,
    QUESTION_COUNT,
    hintTemplate,
    nextHintCount,
    normalizeTyped,
    pickRoundWords,
    toRoundQuestion
} from "./word-challenge-round.ts";

export const ROLLOUT_FEATURE_KEY = "word_challenge_server_v1";

export type WordChallengeStudent = { id: number; role: string };
export type WordChallengeDeps = {
    admin: any;
    verifyUser: (req: Request) => Promise<WordChallengeStudent>;
    loadAccess: (studentId: number) => Promise<{ is_active: boolean }>;
    serverForAll: boolean;
    random?: () => number;
};

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "7200"
};
const respond = (status: number, payload: Record<string, unknown>) => new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

class HttpError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 資料庫函式丟出的 WORD_CHALLENGE_* 錯誤 → 對學生友善的訊息與狀態碼。
const DB_ERRORS: Record<string, [number, string, string]> = {
    WORD_CHALLENGE_STUDENT_NOT_ALLOWED: [403, "student_not_allowed", "這個帳號目前不能記錄單字大挑戰成績"],
    WORD_CHALLENGE_ROUND_NOT_FOUND: [404, "round_not_found", "找不到這一輪，請重新開始"],
    WORD_CHALLENGE_ROUND_CLOSED: [409, "round_closed", "這一輪已經結束"],
    WORD_CHALLENGE_ROUND_EXPIRED: [409, "round_expired", "這一輪時間太久，已經過期，請重新開始"],
    WORD_CHALLENGE_ROUND_INCOMPLETE: [409, "round_incomplete", "還有題目沒答完"],
    WORD_CHALLENGE_ALREADY_ANSWERED: [409, "already_answered", "這一題已經答過了"],
    WORD_CHALLENGE_ITEM_NOT_FOUND: [404, "item_not_found", "找不到這一題"],
    WORD_CHALLENGE_DAILY_ROUND_LIMIT: [429, "daily_round_limit", "今天玩的輪數太多了，明天再來"],
    WORD_CHALLENGE_INVALID_LEVEL: [400, "invalid_level", "等級不正確"],
    WORD_CHALLENGE_INVALID_WORDS: [400, "invalid_words", "題目不正確"],
    WORD_CHALLENGE_INVALID_NOTE: [400, "invalid_note", "資料不正確"]
};

const rpc = async (admin: any, name: string, args: Record<string, unknown>) => {
    const { data, error } = await admin.rpc(name, args);
    if (error) {
        const known = Object.keys(DB_ERRORS).find(code => String(error.message || "").includes(code));
        if (known) {
            const [status, code, message] = DB_ERRORS[known];
            throw new HttpError(status, code, message);
        }
        throw error;
    }
    return data;
};

// 是否走伺服器模式：全面開放，或這個學生被逐一開放；而且會員有效。沒有資料列＝關閉。
async function serverModeFor(deps: WordChallengeDeps, student: WordChallengeStudent): Promise<boolean> {
    if (student.role !== "student") return false;
    let enabled = deps.serverForAll;
    if (!enabled) {
        const { data, error } = await deps.admin
            .from("student_feature_rollouts")
            .select("enabled")
            .eq("student_id", student.id)
            .eq("feature_key", ROLLOUT_FEATURE_KEY)
            .maybeSingle();
        if (error) throw error;
        enabled = data?.enabled === true;
    }
    if (!enabled) return false;
    const access = await deps.loadAccess(student.id);
    return access.is_active === true;
}

const requireServerMode = async (deps: WordChallengeDeps, student: WordChallengeStudent) => {
    if (student.role !== "student") throw new HttpError(403, "student_only", "只有學生帳號會記錄單字大挑戰成績");
    if (!await serverModeFor(deps, student)) throw new HttpError(403, "server_mode_off", "目前不記錄到帳號，請用本機模式");
};

const readRound = async (deps: WordChallengeDeps, student: WordChallengeStudent, roundId: string) => {
    if (!UUID_PATTERN.test(roundId)) throw new HttpError(400, "invalid_round", "資料不正確");
    const { data, error } = await deps.admin
        .from("word_challenge_rounds")
        .select("id,student_id,level,bank_version,status")
        .eq("id", roundId)
        .eq("student_id", student.id)
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "round_not_found", "找不到這一輪，請重新開始");
    return data;
};

const readItem = async (deps: WordChallengeDeps, roundId: string, position: number) => {
    if (!Number.isInteger(position) || position < 0 || position >= QUESTION_COUNT) throw new HttpError(400, "invalid_position", "資料不正確");
    const { data, error } = await deps.admin
        .from("word_challenge_round_items")
        .select("word_key,typed,hint_count,answered_at,skipped")
        .eq("round_id", roundId)
        .eq("position", position)
        .maybeSingle();
    if (error) throw error;
    const word = data ? findServerWord(String(data.word_key)) : null;
    if (!data || !word) throw new HttpError(404, "item_not_found", "找不到這一題");
    return { item: data, word };
};

export async function handleWordChallengeRequest(req: Request, deps: WordChallengeDeps): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return respond(405, { error: "不支援這個方法", code: "method_not_allowed" });

    try {
        const student = await deps.verifyUser(req);
        let body: any = {};
        try {
            body = await req.json();
        } catch {
            throw new HttpError(400, "invalid_body", "資料不正確");
        }
        const action = String(body?.action || "");

        if (action === "summary") {
            if (!await serverModeFor(deps, student)) return respond(200, { mode: "local", bank_version: WORD_BANK_VERSION });
            const summary = await rpc(deps.admin, "get_word_challenge_summary_v1", { p_student_id: student.id, p_bank_version: WORD_BANK_VERSION });
            return respond(200, { mode: "server", bank_version: WORD_BANK_VERSION, ...summary });
        }

        await requireServerMode(deps, student);

        if (action === "start_round") {
            const level = Number(body?.level);
            if (!Number.isInteger(level) || level < 0 || level > 6) throw new HttpError(400, "invalid_level", "等級不正確");
            const summary = await rpc(deps.admin, "get_word_challenge_summary_v1", { p_student_id: student.id, p_bank_version: WORD_BANK_VERSION });
            const mastered: string[] = Array.isArray(summary?.mastered) ? summary.mastered : [];
            const missed: string[] = Array.isArray(summary?.missed) ? summary.missed : [];
            // 練錯的字：從伺服器記的錯字挑最近的 10 個；沒有錯字就不開。
            const onlyKeys = level === 0 ? missed.slice(0, QUESTION_COUNT) : null;
            const words = pickRoundWords(level, mastered, { onlyKeys, random: deps.random });
            if (!words.length) throw new HttpError(400, "no_words", "目前沒有可以練習的字");
            const started = await rpc(deps.admin, "start_word_challenge_round_v1", {
                p_student_id: student.id,
                p_bank_version: WORD_BANK_VERSION,
                p_level: level,
                p_word_keys: words.map(word => word.key)
            });
            const row = Array.isArray(started) ? started[0] : started;
            return respond(200, {
                round_id: row.round_id,
                expires_at: row.expires_at,
                level,
                questions: words.map((word, position) => toRoundQuestion(word, position, BASE_REVEALED))
            });
        }

        if (action === "hint") {
            const roundId = String(body?.round_id || "");
            const position = Number(body?.position);
            const round = await readRound(deps, student, roundId);
            if (round.status !== "open") throw new HttpError(409, "round_closed", "這一輪已經結束");
            const { word, item } = await readItem(deps, roundId, position);
            const maxHints = Math.max(word.letters - 1 - BASE_REVEALED, 0);
            const count = await rpc(deps.admin, "reveal_word_challenge_hint_v1", {
                p_student_id: student.id, p_round_id: roundId, p_position: position, p_max_hints: maxHints
            });
            const hints = Number(count);
            return respond(200, {
                position,
                hint_count: hints,
                hints_left: Math.max(maxHints - hints, 0),
                template: hintTemplate(word, Number.isFinite(hints) ? hints : nextHintCount(word, Number(item.hint_count) || 0))
            });
        }

        if (action === "answer") {
            const roundId = String(body?.round_id || "");
            const position = Number(body?.position);
            const skipped = body?.skipped === true;
            const typed = normalizeTyped(body?.typed);
            await readRound(deps, student, roundId);
            const { word, item } = await readItem(deps, roundId, position);
            // 已經答過：用當時存的答案重新算說明文字，不採用這次傳來的內容。
            const basis = item.answered_at ? String(item.typed ?? "") : typed;
            const result = skipped && !item.answered_at
                ? { correct: false, note: null, expected: word.display } as const
                : checkWordAnswer(basis, word, meaningPeersOf(word));
            const stored = await rpc(deps.admin, "record_word_challenge_answer_v1", {
                p_student_id: student.id,
                p_round_id: roundId,
                p_position: position,
                p_typed: typed,
                p_correct: result.correct,
                p_note: result.note === "empty" ? null : result.note,
                p_skipped: skipped
            });
            const row = Array.isArray(stored) ? stored[0] : stored;
            return respond(200, {
                position,
                correct: row.correct === true,
                note: row.note ?? null,
                matched: (result as { matched?: string }).matched ?? null,
                skipped: row.skipped === true,
                hint_count: Number(row.hint_count) || 0,
                already_answered: row.already_answered === true,
                expected: word.display
            });
        }

        if (action === "finish") {
            const roundId = String(body?.round_id || "");
            await readRound(deps, student, roundId);
            const finished = await rpc(deps.admin, "finish_word_challenge_round_v1", {
                p_student_id: student.id, p_round_id: roundId, p_award_xp: true
            });
            const row = Array.isArray(finished) ? finished[0] : finished;
            return respond(200, {
                total_questions: Number(row.total_questions),
                correct_count: Number(row.correct_count),
                unhinted_correct_count: Number(row.unhinted_correct_count),
                new_mastered_count: Number(row.new_mastered_count),
                xp_awarded: Number(row.xp_awarded),
                already_finished: row.already_finished === true,
                total_xp: Number(row.total_xp)
            });
        }

        throw new HttpError(400, "unknown_action", "不支援這個動作");
    } catch (error) {
        const status = Number((error as { status?: unknown })?.status);
        if (error instanceof HttpError || (Number.isInteger(status) && status >= 400 && status < 500)) {
            const known = error as HttpError;
            return respond(known.status, { error: known.message, code: known.code ?? null });
        }
        console.error("word-challenge failed", (error as { code?: string })?.code || (error as Error)?.name);
        return respond(500, { error: "單字大挑戰服務暫時有問題", code: null });
    }
}
