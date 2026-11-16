// 單字大挑戰：Edge 處理程式 + 真實 PostgreSQL（PGlite）端到端流程。
// 身分驗證、會員權限用假的；資料庫函式是真的 migration。發獎函式用簡化版（和 word-challenge-sql.test.mjs 相同）。
// 執行：PGLITE_MODULE=<pglite/dist/index.js 的絕對路徑> node --test scripts/word-challenge-handler.test.mjs
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { handleWordChallengeRequest } from "../supabase/functions/_shared/word-challenge-handler.ts";
import { WORD_BANK } from "../supabase/functions/_shared/word-challenge-bank.generated.ts";

const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : "@electric-sql/pglite");
const db = new PGlite();
const migration = readFileSync(new URL("../supabase/migrations/20261111100000_word_challenge_server_v1.sql", import.meta.url), "utf8");
const xpMigration = readFileSync(new URL("../supabase/migrations/20261116100000_word_island_xp_v1.sql", import.meta.url), "utf8");
const upgradeMigration = readFileSync(new URL("../supabase/migrations/20261115100000_word_island_upgrade_v1.sql", import.meta.url), "utf8");

const SCALARS = new Set(["reveal_word_challenge_hint_v1", "get_word_challenge_summary_v1"]);
const toPgArray = list => `{${list.map(item => `"${String(item).replace(/"/g, '\\"')}"`).join(",")}}`;

// 只實作處理程式用到的最小資料庫介面。
const admin = {
    async rpc(name, args) {
        const keys = Object.keys(args);
        const placeholders = keys.map((key, index) => `${key} => $${index + 1}${key === "p_level" || key === "p_position" ? "::smallint" : ""}${key === "p_word_keys" ? "::text[]" : ""}`);
        const values = keys.map(key => (Array.isArray(args[key]) ? toPgArray(args[key]) : args[key]));
        try {
            const result = await db.query(`select * from public.${name}(${placeholders.join(", ")})`, values);
            if (SCALARS.has(name)) return { data: Object.values(result.rows[0])[0], error: null };
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error: { message: String(error.message), code: "P0001" } };
        }
    },
    from(table) {
        const filters = [];
        let columns = "*";
        const builder = {
            select(list) { columns = list; return builder; },
            eq(column, value) { filters.push([column, value]); return builder; },
            // 不接 maybeSingle，直接 await：回傳符合條件的全部列（單字島讀整份進度）。
            then(resolve) {
                const where = filters.map(([column], index) => `${column} = $${index + 1}`).join(" and ");
                db.query(`select ${columns} from public.${table} where ${where}`, filters.map(([, value]) => value))
                    .then(result => resolve({ data: result.rows, error: null }), error => resolve({ data: null, error: { message: String(error.message) } }));
            },
            async maybeSingle() {
                const where = filters.map(([column], index) => `${column} = $${index + 1}`).join(" and ");
                try {
                    const result = await db.query(`select ${columns} from public.${table} where ${where} limit 1`, filters.map(([, value]) => value));
                    return { data: result.rows[0] || null, error: null };
                } catch (error) {
                    return { data: null, error: { message: String(error.message) } };
                }
            }
        };
        return builder;
    }
};

const STUDENTS = { "student-1": { id: 1, role: "student" }, "teacher-2": { id: 2, role: "teacher" }, "student-5": { id: 5, role: "student" }, "student-7": { id: 7, role: "student" }, "student-8": { id: 8, role: "student" }, "student-9": { id: 9, role: "student" } };
const EXPIRED = new Set([7]);
const makeDeps = (overrides = {}) => ({
    admin,
    verifyUser: async req => {
        const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
        const user = STUDENTS[token];
        if (!user) throw Object.assign(new Error("請先登入 Alan English"), { status: 401 });
        return user;
    },
    loadAccess: async id => ({ is_active: !EXPIRED.has(id) }),
    serverForAll: false,
    ...overrides
});
const call = async (token, body, deps = makeDeps()) => {
    const response = await handleWordChallengeRequest(new Request("https://edge.test/word-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: typeof body === "string" ? body : JSON.stringify(body)
    }), deps);
    return { status: response.status, json: await response.json() };
};
// 兩個字中文相同時（big／large），優先找同等級的字；同一輪只會出同等級的字，兩個都算對。
const wordOf = (gloss, level = null) => WORD_BANK.find(word => word.gloss === gloss && (level === null || word.level === level)) || WORD_BANK.find(word => word.gloss === gloss);

before(async () => {
    await db.exec(`
        create role anon; create role authenticated; create role service_role bypassrls;
        create schema private;
        create table public.student_feature_rollouts (student_id bigint not null, feature_key text not null, enabled boolean not null default false, primary key (student_id, feature_key),
            constraint student_feature_rollouts_key_check check (feature_key in ('listening_rewards_v2','assignment_v2')));
        create table public.students (id bigint primary key, role text not null, account_status text, archived_at timestamptz);
        insert into public.students values (1,'student','active',null),(2,'teacher','active',null),(5,'student','active',null),(7,'student','active',null),(8,'student','active',null),(9,'student','active',null);
        create table public.student_gamification_balances (student_id bigint primary key references public.students(id), total_xp integer not null default 0, points_balance integer not null default 0, updated_at timestamptz default now());
        create table public.student_gamification_ledger (id bigserial primary key, student_id bigint not null, xp_delta integer not null, points_delta integer not null default 0, source_type text not null, source_key text not null, description text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique (student_id, source_type, source_key));
        create function private.ae_gamification_grant_v2(p_student_id bigint, p_xp_delta integer, p_points_delta integer, p_source_type text, p_source_key text, p_description text default null, p_metadata jsonb default '{}'::jsonb)
        returns boolean language plpgsql as $$
        declare n integer;
        begin
            insert into public.student_gamification_balances(student_id) values (p_student_id) on conflict do nothing;
            insert into public.student_gamification_ledger(student_id,xp_delta,points_delta,source_type,source_key,description,metadata) values (p_student_id,p_xp_delta,0,p_source_type,p_source_key,p_description,p_metadata || jsonb_build_object('base_xp',p_xp_delta)) on conflict (student_id,source_type,source_key) do nothing;
            get diagnostics n = row_count;
            if n = 0 then return false; end if;
            update public.student_gamification_balances set total_xp = total_xp + p_xp_delta where student_id = p_student_id;
            return true;
        end $$;
    `);
    await db.exec(migration);
    await db.exec(upgradeMigration);
    await db.exec(xpMigration);
    // 學生 1、5、7 被逐一開放；老師 2 也有資料列但不是學生。
    await db.exec("insert into public.student_feature_rollouts values (1,'word_challenge_server_v1',true),(5,'word_challenge_server_v1',true),(7,'word_challenge_server_v1',true),(8,'word_challenge_server_v1',true),(9,'word_challenge_server_v1',true),(2,'word_challenge_server_v1',true)");
});
after(async () => { await db.close(); });

test("requests need a valid login and a POST with a JSON body; OPTIONS is answered for browsers", async () => {
    assert.equal((await call(null, { action: "summary" })).status, 401);
    assert.equal((await call("student-1", "not json")).status, 400);
    assert.equal((await call("student-1", { action: "nope" })).status, 400);
    const options = await handleWordChallengeRequest(new Request("https://edge.test/", { method: "OPTIONS" }), makeDeps());
    assert.equal(options.status, 200);
    const get = await handleWordChallengeRequest(new Request("https://edge.test/", { method: "GET" }), makeDeps());
    assert.equal(get.status, 405);
});

test("teachers, students without the switch, and expired members all fall back to local mode", async () => {
    assert.equal((await call("teacher-2", { action: "summary" })).json.mode, "local");
    assert.equal((await call("teacher-2", { action: "start_round", level: 1 })).status, 403);
    assert.equal((await call("student-7", { action: "summary" })).json.mode, "local");
    assert.equal((await call("student-7", { action: "start_round", level: 1 })).json.code, "server_mode_off");
    // 沒有開放資料列的學生（學生 5 先暫時關掉）
    await db.exec("update public.student_feature_rollouts set enabled = false where student_id = 5");
    assert.equal((await call("student-5", { action: "summary" })).json.mode, "local");
    assert.equal((await call("student-5", { action: "start_round", level: 1 })).status, 403);
    // 全面開放時，沒有資料列的學生也走伺服器模式（會員仍須有效）。
    assert.equal((await call("student-5", { action: "summary" }, makeDeps({ serverForAll: true }))).json.mode, "server");
    assert.equal((await call("student-7", { action: "summary" }, makeDeps({ serverForAll: true }))).json.mode, "local");
    await db.exec("update public.student_feature_rollouts set enabled = true where student_id = 5");
});

test("a whole server round: the answer is never sent early, hints stay in the rules, 9 right earns 10 XP once", async () => {
    const summary = await call("student-1", { action: "summary" });
    assert.equal(summary.json.mode, "server");
    assert.deepEqual(summary.json.mastered, []);

    const start = await call("student-1", { action: "start_round", level: 2 });
    assert.equal(start.status, 200);
    const { round_id: roundId, questions } = start.json;
    assert.equal(questions.length, 10);
    const raw = JSON.stringify(start.json);
    const words = questions.map(question => wordOf(question.gloss, 2));
    assert.ok(words.every(word => word && word.level === 2));
    // 回傳內容不含任何一題的完整答案或字庫 key。
    for (const word of words) {
        for (const forbidden of ['"display"', `"key":"${word.key}"`, `"word_key"`]) assert.equal(raw.includes(forbidden), false, forbidden);
        const values = [];
        JSON.stringify(start.json, (key, value) => { if (typeof value === "string" && key !== "kind") values.push(value.toLowerCase()); return value; });
        if (word.display.length > 2) assert.equal(values.includes(word.display.toLowerCase()), false, word.key);
    }

    // 第 0 題：提示到上限，再答錯。
    const hintTarget = words[0];
    const maxHints = Math.max(hintTarget.letters - 2, 0);
    let last = null;
    for (let index = 0; index < maxHints + 2; index += 1) last = await call("student-1", { action: "hint", round_id: roundId, position: 0 });
    assert.equal(last.status, 200);
    assert.equal(last.json.hint_count, maxHints);
    assert.equal(last.json.hints_left, 0);
    const given = last.json.template.filter(slot => slot.kind === "letter" && slot.hint).length;
    assert.equal(given, hintTarget.letters - 1);
    const wrong = await call("student-1", { action: "answer", round_id: roundId, position: 0, typed: "zzzz" });
    assert.equal(wrong.json.correct, false);
    assert.equal(wrong.json.expected, hintTarget.display);
    // 重送想改成對：拿到原本的結果。
    const resend = await call("student-1", { action: "answer", round_id: roundId, position: 0, typed: hintTarget.display });
    assert.equal(resend.json.correct, false);
    assert.equal(resend.json.already_answered, true);
    assert.equal((await call("student-1", { action: "hint", round_id: roundId, position: 0 })).json.code, "already_answered");

    // 還沒答完就結算：不行。
    assert.equal((await call("student-1", { action: "finish", round_id: roundId })).json.code, "round_incomplete");
    for (let position = 1; position < 10; position += 1) {
        const response = await call("student-1", { action: "answer", round_id: roundId, position, typed: words[position].display });
        assert.equal(response.json.correct, true, words[position].key);
    }
    const finish = await call("student-1", { action: "finish", round_id: roundId });
    assert.equal(finish.status, 200);
    assert.deepEqual([finish.json.correct_count, finish.json.unhinted_correct_count, finish.json.new_mastered_count, finish.json.xp_awarded, finish.json.already_finished, finish.json.total_xp], [9, 9, 9, 10, false, 10]);
    const again = await call("student-1", { action: "finish", round_id: roundId });
    assert.deepEqual([again.json.xp_awarded, again.json.already_finished, again.json.total_xp], [10, true, 10]);

    const after = await call("student-1", { action: "summary" });
    assert.equal(after.json.xp_today, 10);
    assert.equal(after.json.missed.length, 1);
    assert.equal(after.json.mastered.length, 9);
    assert.equal(after.json.best["2"], 9);
});

test("notes come back for UK spellings and same-meaning words; skipping gives the answer", async () => {
    const start = await call("student-1", { action: "start_round", level: 0 });
    // 練錯的字：只出前一輪錯的那 1 個字。
    assert.equal(start.json.questions.length, 1);
    const word = wordOf(start.json.questions[0].gloss, 2);
    const skip = await call("student-1", { action: "answer", round_id: start.json.round_id, position: 0, skipped: true });
    assert.equal(skip.json.skipped, true);
    assert.equal(skip.json.correct, false);
    assert.equal(skip.json.expected, word.display);
    const finish = await call("student-1", { action: "finish", round_id: start.json.round_id });
    assert.equal(finish.json.xp_awarded, 0, "a missed-words round never pays");

    const gray = WORD_BANK.find(item => item.key === "gray");
    const level = gray.level;
    // 找到一輪裡有 gray 的機會不穩，直接用英式拼法對 gray 單題開局：改走 level 0 的 onlyKeys 不可行，所以改驗答案判斷：用另一位學生開 gray 所在等級並找出 gray。
    let found = null;
    for (let attempt = 0; attempt < 40 && !found; attempt += 1) {
        const round = await call("student-5", { action: "start_round", level });
        const index = round.json.questions.findIndex(question => question.gloss === gray.gloss);
        if (index >= 0) found = { round: round.json, index };
    }
    assert.ok(found, "gray should appear in a level round within 40 tries");
    const uk = await call("student-5", { action: "answer", round_id: found.round.round_id, position: found.index, typed: "grey" });
    assert.deepEqual([uk.json.correct, uk.json.note, uk.json.matched], [true, "uk", "grey"]);
});

test("a student can never use another student's round, and bad input is refused politely", async () => {
    const start = await call("student-1", { action: "start_round", level: 3 });
    const roundId = start.json.round_id;
    for (const action of [{ action: "answer", position: 0, typed: "x" }, { action: "hint", position: 0 }, { action: "finish" }]) {
        const response = await call("student-5", { ...action, round_id: roundId });
        assert.equal(response.status, 404);
        assert.equal(response.json.code, "round_not_found");
    }
    assert.equal((await call("student-1", { action: "answer", round_id: "not-a-uuid", position: 0 })).status, 400);
    assert.equal((await call("student-1", { action: "answer", round_id: roundId, position: 99 })).status, 400);
    assert.equal((await call("student-1", { action: "answer", round_id: roundId, position: -1 })).status, 400);
    assert.equal((await call("student-1", { action: "start_round", level: 9 })).status, 400);
    assert.equal((await call("student-1", { action: "start_round", level: "abc" })).status, 400);
    // 前端傳來的身分欄位一律不採用。
    const spoof = await call("student-1", { action: "summary", student_id: 5, role: "admin" });
    assert.equal(spoof.json.mode, "server");
});

test("database failures become a generic 500 without leaking details", async () => {
    const broken = { ...admin, rpc: async () => ({ data: null, error: { message: "connection to server at 10.0.0.1 secret=abc failed", code: "08006" } }) };
    const response = await call("student-1", { action: "summary" }, makeDeps({ admin: broken }));
    assert.equal(response.status, 500);
    assert.doesNotMatch(JSON.stringify(response.json), /10\.0\.0\.1|secret|abc/);
});

// ---------- 單字島 ----------
const ISLAND_SIZE = 16;
const level1 = WORD_BANK.filter(word => word.level === 1);
const DAY_MS = 24 * 60 * 60 * 1000;

test("island_summary shows every island of a level, only the first is open, and never leaks an unclaimed English word", async () => {
    const summary = await call("student-8", { action: "island_summary", level: 1 });
    assert.equal(summary.status, 200);
    assert.equal(summary.json.mode, "server");
    const islands = summary.json.islands;
    assert.equal(islands.length, Math.ceil(level1.length / ISLAND_SIZE));
    assert.equal(islands[0].unlocked, true);
    assert.ok(islands.slice(1).every(island => island.unlocked === false));
    assert.equal(islands[0].tiles.length, ISLAND_SIZE);
    assert.ok(islands[0].tiles.every(tile => tile.state === "open"));
    assert.ok(islands[1].tiles.every(tile => tile.state === "locked"));
    const raw = JSON.stringify(summary.json);
    for (const forbidden of ['"display"', '"key"', '"word_key"']) assert.equal(raw.includes(forbidden), false, forbidden);
    const values = [];
    JSON.stringify(summary.json, (key, value) => { if (typeof value === "string") values.push(value.toLowerCase()); return value; });
    for (const word of level1.filter(item => item.display.length > 3)) assert.equal(values.includes(word.display.toLowerCase()), false, word.key);
    assert.equal((await call("student-8", { action: "island_summary", level: 0 })).status, 400);
    assert.equal((await call("student-8", { action: "island_summary", level: 7 })).status, 400);
});

test("island_start refuses locked, invalid, claimed and local-mode requests; a correct answer claims the tile", async () => {
    assert.equal((await call("student-8", { action: "island_start", level: 1, island: 1, tile: 0 })).json.code, "island_locked");
    for (const bad of [{ island: 99, tile: 0 }, { island: 0, tile: 16 }, { island: 0, tile: -1 }, { island: "x", tile: 0 }]) {
        assert.equal((await call("student-8", { action: "island_start", level: 1, ...bad })).json.code, "invalid_tile", JSON.stringify(bad));
    }
    assert.equal((await call("student-8", { action: "island_start", level: 0, island: 0, tile: 0 })).status, 400);
    assert.equal((await call("teacher-2", { action: "island_start", level: 1, island: 0, tile: 0 })).status, 403);
    assert.equal((await call("student-7", { action: "island_start", level: 1, island: 0, tile: 0 })).json.code, "server_mode_off");
    assert.equal((await call("teacher-2", { action: "island_summary", level: 1 })).json.mode, "local");
    assert.equal((await call("student-7", { action: "island_summary", level: 1 })).json.mode, "local");

    const start = await call("student-8", { action: "island_start", level: 1, island: 0, tile: 0 });
    assert.equal(start.status, 200);
    assert.equal(start.json.question.gloss, level1[0].gloss);
    assert.equal(JSON.stringify(start.json).includes('"display"'), false);
    const answer = await call("student-8", { action: "answer", round_id: start.json.round_id, position: 0, typed: level1[0].display });
    assert.deepEqual([answer.json.correct, answer.json.hint_count, answer.json.recently_seen, answer.json.cooldown_until], [true, 0, false, null]);

    const summary = await call("student-8", { action: "island_summary", level: 1 });
    const claimed = summary.json.islands[0].tiles[0];
    assert.deepEqual([claimed.state, claimed.display], ["claimed", level1[0].display]);
    assert.ok(Number.isFinite(Date.parse(claimed.claimed_at)), "a claimed tile reports when it was claimed");
    assert.equal("claimed_at" in summary.json.islands[0].tiles[1], false, "an unclaimed tile has no claim time");
    assert.equal(summary.json.islands[0].claimed_count, 1);
    assert.equal((await call("student-8", { action: "island_start", level: 1, island: 0, tile: 0 })).json.code, "tile_claimed");
});

test("a wrong answer cools the tile until tomorrow, and seeing the answer then typing it never counts (old loophole closed)", async () => {
    const target = level1[1];
    const start = await call("student-8", { action: "island_start", level: 1, island: 0, tile: 1 });
    const wrong = await call("student-8", { action: "answer", round_id: start.json.round_id, position: 0, typed: "zzzz" });
    assert.equal(wrong.json.correct, false);
    assert.equal(wrong.json.expected, target.display);
    assert.ok(wrong.json.cooldown_until);

    const summary = await call("student-8", { action: "island_summary", level: 1 });
    const tile = summary.json.islands[0].tiles[1];
    assert.deepEqual([tile.state, tile.review], ["cooldown", true]);
    assert.ok(tile.cooldown_until);
    assert.equal((await call("student-8", { action: "island_start", level: 1, island: 0, tile: 1 })).json.code, "tile_cooldown");

    // 舊漏洞：答錯看到答案後，用「練最近錯的字」馬上打對。現在要被當成「剛看過答案」，不算學會。
    const practice = await call("student-8", { action: "start_round", level: 0 });
    const position = practice.json.questions.findIndex(question => question.gloss === target.gloss);
    assert.ok(position >= 0);
    const retry = await call("student-8", { action: "answer", round_id: practice.json.round_id, position, typed: target.display });
    assert.equal(retry.json.correct, true);
    assert.equal(retry.json.recently_seen, true);
    assert.equal(retry.json.hint_count, 1);
    const stillOpen = await call("student-8", { action: "island_summary", level: 1 });
    assert.equal(stillOpen.json.islands[0].tiles[1].state, "cooldown", "still not claimed the same day");
    const row = await db.query("select first_mastered_at from public.student_word_progress where student_id = 8 and word_key = $1", [target.key]);
    assert.equal(row.rows[0].first_mastered_at, null);

    // 隔天（台北時間）：格子重新打開，答對才算佔領，而且不是「剛看過答案」。
    const tomorrow = makeDeps({ now: () => Date.now() + DAY_MS + 60 * 1000 });
    const reopened = await call("student-8", { action: "island_summary", level: 1 }, tomorrow);
    assert.equal(reopened.json.islands[0].tiles[1].state, "open");
    const again = await call("student-8", { action: "island_start", level: 1, island: 0, tile: 1 }, tomorrow);
    assert.equal(again.status, 200);
    const win = await call("student-8", { action: "answer", round_id: again.json.round_id, position: 0, typed: target.display }, tomorrow);
    assert.deepEqual([win.json.correct, win.json.recently_seen, win.json.hint_count], [true, false, 0]);
    const claimed = await call("student-8", { action: "island_summary", level: 1 }, tomorrow);
    assert.equal(claimed.json.islands[0].tiles[1].state, "claimed");
});

test("the next island opens only after every tile of the previous one is claimed", async () => {
    const keys = level1.slice(0, ISLAND_SIZE).map(word => word.key);
    const insert = "insert into public.student_word_progress (student_id, bank_version, word_key, status, first_mastered_at, last_correct_at, correct_count) select 9, 'v1', k, 'mastered', now(), now(), 1 from unnest($1::text[]) as k";
    await db.query(insert, [toPgArray(keys.slice(0, ISLAND_SIZE - 1))]);
    let summary = await call("student-9", { action: "island_summary", level: 1 });
    assert.equal(summary.json.islands[0].claimed_count, ISLAND_SIZE - 1);
    assert.equal(summary.json.islands[1].unlocked, false);
    assert.equal((await call("student-9", { action: "island_start", level: 1, island: 1, tile: 0 })).json.code, "island_locked");

    await db.query(insert, [toPgArray([keys[ISLAND_SIZE - 1]])]);
    summary = await call("student-9", { action: "island_summary", level: 1 });
    assert.equal(summary.json.islands[1].unlocked, true);
    assert.equal(summary.json.islands[2].unlocked, false);
    const open = await call("student-9", { action: "island_start", level: 1, island: 1, tile: 0 });
    assert.equal(open.status, 200);
    assert.equal(open.json.question.gloss, level1[ISLAND_SIZE].gloss);

    // 學會過的字之後又答錯：仍然算佔領（只標「待複習」），不會被收回。
    await db.query("update public.student_word_progress set status = 'missed', last_missed_at = now() where student_id = 9 and word_key = $1", [keys[0]]);
    summary = await call("student-9", { action: "island_summary", level: 1 });
    assert.deepEqual([summary.json.islands[0].tiles[0].state, summary.json.islands[0].tiles[0].review], ["claimed", true]);
    assert.equal(summary.json.islands[1].unlocked, true);
});

// 升級（兩段式）：資料庫用真實時間判斷「不同天」，所以測試把佔領時間改到幾天前，而不是調假時鐘。
test("a claimed tile upgrades once on a later day; a same-day claim, a hinted answer or a second try never upgrades", async () => {
    const tile = level1[0];
    // 今天才佔領的格子：不能升級（要不同天）。
    assert.equal((await call("student-8", { action: "island_start", level: 1, island: 0, tile: 0 })).json.code, "tile_claimed");
    await db.query("update public.student_word_progress set first_mastered_at = now() - interval '3 days' where student_id = 8 and word_key = $1", [tile.key]);
    let view = (await call("student-8", { action: "island_summary", level: 1 })).json;
    assert.deepEqual([view.islands[0].tiles[0].level, view.islands[0].tiles[0].can_upgrade], [0, true]);
    assert.equal("upgrade_limit" in view, false, "there is no per-account daily cap any more");

    const first = await call("student-8", { action: "island_start", level: 1, island: 0, tile: 0 });
    const up = await call("student-8", { action: "answer", round_id: first.json.round_id, position: 0, typed: tile.display });
    assert.deepEqual([up.json.upgraded, up.json.upgrade_level], [true, 1]);
    view = (await call("student-8", { action: "island_summary", level: 1 })).json;
    assert.deepEqual([view.islands[0].tiles[0].level, view.islands[0].tiles[0].can_upgrade, view.upgrades_today, view.islands[0].level_sum], [1, false, 1, 1]);
    // 已經升級：同一天、之後都不能再「升級」，也不能用練習（這座島還沒升滿）。
    assert.equal((await call("student-8", { action: "island_start", level: 1, island: 0, tile: 0 })).json.code, "tile_claimed");
    assert.equal((await call("student-8", { action: "island_start", level: 1, island: 0, tile: 0, practice: true })).json.code, "tile_claimed");
    assert.equal((await db.query("select upgrade_level from public.student_word_progress where student_id = 8 and word_key = $1", [tile.key])).rows[0].upgrade_level, 1);
});

test("there is no daily cap: many tiles can upgrade on the same day, and the database refuses a second level", async () => {
    const keys = level1.slice(0, ISLAND_SIZE).map(word => word.key);
    await db.query("update public.student_word_progress set first_mastered_at = now() - interval '3 days' where student_id = 9 and word_key = any($1::text[])", [toPgArray(keys)]);
    // 第 0 格在前面的測試被標成「剛答錯」，所以從第 1 格開始，一口氣升 8 塊。
    for (let tile = 1; tile <= 8; tile += 1) {
        const start = await call("student-9", { action: "island_start", level: 1, island: 0, tile });
        const answer = await call("student-9", { action: "answer", round_id: start.json.round_id, position: 0, typed: level1[tile].display });
        assert.deepEqual([answer.json.upgraded, answer.json.upgrade_level], [true, 1], `tile ${tile} ${JSON.stringify([start.json, answer.json])}`);
    }
    const view = (await call("student-9", { action: "island_summary", level: 1 })).json;
    assert.equal(view.upgrades_today, 8);
    assert.ok(view.islands[0].completed_at, "a fully claimed island reports when it was completed");
    assert.equal(view.islands[1].completed_at, null);

    // 繞過 Edge 直接叫資料庫升級已經升過的格子：不會再升（最多一級）。
    const direct = await db.query("select * from public.start_word_challenge_round_v1(9, 'v1', 1::smallint, $1::text[])", [toPgArray([level1[1].key])]);
    const roundId = direct.rows[0].round_id;
    await db.query("select * from public.record_word_challenge_answer_v1(9, $1, 0::smallint, $2, true, null, false)", [roundId, level1[1].display]);
    const refused = await db.query("select * from public.upgrade_word_island_tile_v1(9, $1, 0::smallint)", [roundId]);
    assert.equal(refused.rows[0].upgraded, false);
});

test("a fully upgraded island lets the student practice any tile; after 7 quiet days a cloud asks to review the 3 stalest tiles, and practice clears it", async () => {
    const keys = level1.slice(0, ISLAND_SIZE).map(word => word.key);
    await db.query("update public.student_word_progress set status = 'mastered', last_missed_at = null, first_mastered_at = now() - interval '10 days', last_correct_at = now() - interval '9 days', upgrade_level = 1, last_upgraded_on = (now() - interval '8 days')::date where student_id = 9 and word_key = any($1::text[])", [toPgArray(keys)]);
    // 讓第 5、6、7 格最久沒碰。
    await db.query("update public.student_word_progress set last_correct_at = now() - interval '30 days' where student_id = 9 and word_key = any($1::text[])", [toPgArray([keys[5], keys[6], keys[7]])]);

    let view = (await call("student-9", { action: "island_summary", level: 1 })).json.islands[0];
    assert.deepEqual([view.maxed, view.needs_review], [true, true]);
    assert.deepEqual(view.tiles.filter(tile => tile.stale).map(tile => tile.tile), [5, 6, 7]);
    assert.ok(view.tiles.every(tile => tile.can_practice === true));

    // 平常的練習：不是升級，答對只更新「最近答對時間」，答錯只標待複習、島不退步。
    const start = await call("student-9", { action: "island_start", level: 1, island: 0, tile: 5, practice: true });
    assert.equal(start.status, 200);
    const answer = await call("student-9", { action: "answer", round_id: start.json.round_id, position: 0, typed: level1[5].display });
    assert.deepEqual([answer.json.correct, answer.json.upgraded], [true, false]);
    view = (await call("student-9", { action: "island_summary", level: 1 })).json.islands[0];
    assert.equal(view.needs_review, false, "touching the island clears the cloud");
    assert.equal(view.maxed, true);

    const wrong = await call("student-9", { action: "island_start", level: 1, island: 0, tile: 6, practice: true });
    const miss = await call("student-9", { action: "answer", round_id: wrong.json.round_id, position: 0, typed: "zzzz" });
    assert.equal(miss.json.correct, false);
    view = (await call("student-9", { action: "island_summary", level: 1 })).json.islands[0];
    assert.deepEqual([view.maxed, view.claimed_count, view.tiles[6].level], [true, 16, 1]);
});

// 單字島 XP：新佔領 +2、升級 +3、每天最多 30；用提示或練習不給；舊式整輪不重複發。
test("island XP: +2 for a new tile, +3 for an upgrade, nothing for hinted or practice answers, capped at 30 a day", async () => {
    const claimTile = async (tile, typed) => {
        const start = await call("student-1", { action: "island_start", level: 1, island: 0, tile });
        assert.equal(start.status, 200, JSON.stringify(start.json));
        return call("student-1", { action: "answer", round_id: start.json.round_id, position: 0, typed });
    };
    const first = await claimTile(0, level1[0].display);
    assert.equal(first.json.xp.xp_awarded, 2);
    assert.deepEqual([first.json.xp.level_before, first.json.xp.level_after, first.json.xp.progress_after - first.json.xp.progress_before, first.json.xp.daily_cap], [1, 1, 2, 30]);
    // 答錯：不給 XP（沒有 xp 欄位內容）。
    const wrong = await claimTile(1, "zzzz");
    assert.equal(wrong.json.xp, null);
    // 同一輪重複送答案：不會重複發。
    const start = await call("student-1", { action: "island_start", level: 1, island: 0, tile: 2 });
    await call("student-1", { action: "answer", round_id: start.json.round_id, position: 0, typed: level1[2].display });
    const again = await call("student-1", { action: "answer", round_id: start.json.round_id, position: 0, typed: level1[2].display });
    assert.equal(again.json.xp, null);
    assert.equal((await db.query("select count(*)::int n from public.student_gamification_ledger where student_id = 1 and source_type = 'word_island'")).rows[0].n, 2);
    // 升級 +3：把這塊地的佔領時間改到幾天前再答。
    await db.query("update public.student_word_progress set first_mastered_at = now() - interval '3 days' where student_id = 1 and word_key = $1", [level1[0].key]);
    const up = await claimTile(0, level1[0].display);
    assert.deepEqual([up.json.upgraded, up.json.xp.xp_awarded], [true, 3]);
    // 每天最多 30：把今天已拿的假裝成 29，下一塊新地只能拿 1。
    await db.query("insert into public.student_gamification_ledger(student_id,xp_delta,source_type,source_key,metadata) values (1, 22, 'word_island', 'test:filler', '{\"base_xp\":22}'::jsonb)");
    const cap1 = await claimTile(3, level1[3].display);
    assert.equal(cap1.json.xp.xp_awarded, 1);
    const cap2 = await claimTile(4, level1[4].display);
    assert.deepEqual([cap2.json.xp.xp_awarded, cap2.json.xp.daily_xp], [0, 30]);
});
