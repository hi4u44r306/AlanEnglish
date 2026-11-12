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

const STUDENTS = { "student-1": { id: 1, role: "student" }, "teacher-2": { id: 2, role: "teacher" }, "student-5": { id: 5, role: "student" }, "student-7": { id: 7, role: "student" } };
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
        insert into public.students values (1,'student','active',null),(2,'teacher','active',null),(5,'student','active',null),(7,'student','active',null);
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
    // 學生 1、5、7 被逐一開放；老師 2 也有資料列但不是學生。
    await db.exec("insert into public.student_feature_rollouts values (1,'word_challenge_server_v1',true),(5,'word_challenge_server_v1',true),(7,'word_challenge_server_v1',true),(2,'word_challenge_server_v1',true)");
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
