// 老師端「單字島進度」：權限與數字。資料庫用記憶體假資料；身分驗證用假的。
// 執行：node --experimental-strip-types --test scripts/word-island-report-handler.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleWordIslandReportRequest } from "../supabase/functions/_shared/word-island-report-handler.ts";
import { summarizeStudentIslands, statusFor } from "../supabase/functions/_shared/word-island-report.ts";
import { WORD_BANK } from "../supabase/functions/_shared/word-challenge-bank.generated.ts";

const NOW = Date.parse("2026-11-18T04:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const iso = ms => new Date(ms).toISOString();
const level1 = WORD_BANK.filter(word => word.level === 1);
const level2 = WORD_BANK.filter(word => word.level === 2);
const row = (word, patch = {}) => ({ word_key: word.key, status: "mastered", first_mastered_at: iso(NOW - 3 * DAY), last_correct_at: iso(NOW - 3 * DAY), last_missed_at: null, upgrade_level: 0, last_upgraded_on: null, ...patch });

// ---- 假資料庫：只實作處理程式用到的查詢（eq / in / lte / or / order / range / maybeSingle） ----
function makeAdmin(tables) {
    return {
        from(name) {
            let rows = [...(tables[name] || [])];
            const order = [];
            let slice = null;
            const builder = {
                select() { return builder; },
                eq(column, value) { rows = rows.filter(item => item[column] === value); return builder; },
                in(column, values) { rows = rows.filter(item => values.includes(item[column])); return builder; },
                lte(column, value) { rows = rows.filter(item => item[column] <= value); return builder; },
                or(expression) {
                    // 只支援 "col.is.null,col.gte.value"。
                    const [isNull, gte] = expression.split(",");
                    const nullCol = isNull.split(".")[0];
                    const [gteCol, , gteValue] = gte.split(".");
                    rows = rows.filter(item => item[nullCol] == null || item[gteCol] >= gteValue);
                    return builder;
                },
                order(column) { order.push(column); return builder; },
                range(from, to) { slice = [from, to]; return builder; },
                async maybeSingle() { return { data: rows[0] || null, error: null }; },
                then(resolve) {
                    let out = rows;
                    if (order.length) out = [...out].sort((a, b) => { for (const col of order) { if (a[col] < b[col]) return -1; if (a[col] > b[col]) return 1; } return 0; });
                    if (slice) out = out.slice(slice[0], slice[1] + 1);
                    resolve({ data: out, error: null });
                }
            };
            return builder;
        }
    };
}

const student = (id, name, extra = {}) => ({ id, name, chinese_name: name, english_name: null, role: "student", account_status: "active", ...extra });
const enrollment = (studentId, classId, extra = {}) => ({ student_id: studentId, class_id: classId, status: "active", scheduled_departure_at: null, students: student(studentId, `學生${studentId}`), ...extra });

const baseTables = () => ({
    academy_classes: [{ id: 1, code: "E1", is_active: true }, { id: 3, code: "E3", is_active: true }],
    teacher_class_permissions: [
        { teacher_id: 20, can_publish: true, starts_at: "2026-01-01", ends_at: null, academy_classes: { code: "E1" } },
        { teacher_id: 21, can_publish: true, starts_at: "2026-01-01", ends_at: "2026-11-01", academy_classes: { code: "E1" } },
        { teacher_id: 22, can_publish: false, starts_at: "2026-01-01", ends_at: null, academy_classes: { code: "E1" } }
    ],
    academy_enrollments: [
        enrollment(1, 1), enrollment(2, 1), enrollment(3, 1), enrollment(4, 3),
        enrollment(5, 1, { scheduled_departure_at: "2026-11-01" }),
        enrollment(6, 1, { students: student(6, "學生6", { account_status: "disabled" }) }),
        enrollment(7, 1, { status: "left" })
    ],
    student_feature_rollouts: [
        { student_id: 1, feature_key: "word_challenge_server_v1", enabled: true },
        { student_id: 2, feature_key: "word_challenge_server_v1", enabled: true },
        { student_id: 4, feature_key: "word_challenge_server_v1", enabled: true }
    ],
    student_word_progress: [
        // 學生 1：佔領 5 個字，其中前 2 個已升級。
        ...level1.slice(0, 5).map((word, index) => ({ ...row(word, index < 2 ? { upgrade_level: 1, last_upgraded_on: "2026-11-17" } : {}), student_id: 1, bank_version: "v1" })),
        { ...row(level1[9], { status: "missed", first_mastered_at: null, last_correct_at: null, last_missed_at: iso(NOW - 10 * DAY) }), student_id: 2, bank_version: "v1" },
        ...level1.slice(0, 3).map(word => ({ ...row(word), student_id: 4, bank_version: "v1" })),
        { ...row(level1[0]), student_id: 1, bank_version: "OLD" }
    ]
});

const USERS = { "teacher-20": { id: 20, role: "teacher" }, "teacher-21": { id: 21, role: "teacher" }, "teacher-22": { id: 22, role: "teacher" }, "admin-30": { id: 30, role: "admin" }, "student-1": { id: 1, role: "student" } };
const call = async (token, body, tables = baseTables(), extra = {}) => {
    const response = await handleWordIslandReportRequest(new Request("https://edge.test/word-island-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: typeof body === "string" ? body : JSON.stringify(body)
    }), {
        admin: makeAdmin(tables),
        verifyUser: async req => {
            const user = USERS[(req.headers.get("Authorization") || "").replace("Bearer ", "")];
            if (!user) throw Object.assign(new Error("請先登入 Alan English"), { status: 401 });
            return user;
        },
        serverForAll: false,
        now: () => NOW,
        ...extra
    });
    return { status: response.status, json: await response.json(), headers: response.headers };
};

test("needs a login, a POST with a JSON body, and the right role; answers are never cached", async () => {
    assert.equal((await call(null, { action: "bootstrap" })).status, 401);
    assert.equal((await call("teacher-20", "not json")).status, 400);
    assert.equal((await call("student-1", { action: "bootstrap" })).status, 403);
    assert.equal((await call("teacher-20", { action: "nope" })).status, 400);
    const ok = await call("teacher-20", { action: "bootstrap" });
    assert.equal(ok.headers.get("Cache-Control"), "no-store");
    const deps = { admin: makeAdmin({}), verifyUser: async () => ({ id: 1, role: "teacher" }), serverForAll: false };
    assert.equal((await handleWordIslandReportRequest(new Request("https://edge.test/", { method: "OPTIONS" }), deps)).status, 200);
    assert.equal((await handleWordIslandReportRequest(new Request("https://edge.test/", { method: "GET" }), deps)).status, 405);
});

test("a teacher only gets the classes they are allowed; an expired or non-publishing permission gives none; an admin gets all four", async () => {
    assert.deepEqual((await call("teacher-20", { action: "bootstrap" })).json.classes, ["E1"]);
    assert.deepEqual((await call("teacher-21", { action: "bootstrap" })).json.classes, []);
    assert.deepEqual((await call("teacher-22", { action: "bootstrap" })).json.classes, []);
    assert.deepEqual((await call("admin-30", { action: "bootstrap" })).json.classes, ["E1", "E3", "E5", "E7"]);
});

test("a teacher cannot read another class, however the class code is written; bad codes are rejected", async () => {
    const other = await call("teacher-20", { action: "class_overview", class_code: "E3" });
    assert.equal(other.status, 403);
    assert.equal(other.json.code, "class_not_allowed");
    assert.doesNotMatch(JSON.stringify(other.json), /學生4/);
    assert.equal((await call("teacher-20", { action: "class_overview", class_code: "E2" })).status, 400);
    assert.equal((await call("teacher-20", { action: "class_overview", class_code: "" })).status, 400);
    assert.equal((await call("teacher-20", { action: "class_overview" })).status, 400);
    // 小寫、前後空白會被整理成 E1，仍然要有授權。
    assert.equal((await call("teacher-20", { action: "class_overview", class_code: " e1 " })).status, 200);
    assert.equal((await call("teacher-21", { action: "class_overview", class_code: "E1" })).status, 403);
    // 前端硬塞 role／student_id 不會改變結果。
    const forged = await call("teacher-20", { action: "class_overview", class_code: "E3", role: "admin", student_id: 4 });
    assert.equal(forged.status, 403);
    assert.equal((await call("admin-30", { action: "class_overview", class_code: "E3" })).status, 200);
});

test("the roster is only active students of that class: departed, disabled and left ones are out; response has no other class and no private fields", async () => {
    const { json } = await call("teacher-20", { action: "class_overview", class_code: "E1" });
    assert.deepEqual(json.students.map(item => item.student_id), [1, 2, 3]);
    assert.equal(json.totals.students, 3);
    const text = JSON.stringify(json);
    assert.doesNotMatch(text, /學生4|學生5|學生6|學生7/);
    assert.doesNotMatch(text, /email|firebase|password|word_key/i);
});

test("numbers: claimed, upgraded, review, current island, last practice, status, and who is recorded to the account", async () => {
    const { json } = await call("teacher-20", { action: "class_overview", class_code: "E1" });
    const [one, two, three] = json.students;
    assert.equal(one.recorded_to_account, true);
    assert.equal(one.claimed_total, 5, "the old bank version row is not counted");
    assert.equal(one.upgraded_total, 2);
    assert.equal(one.current.level, 1);
    assert.equal(one.current.island, 1);
    assert.equal(one.current.claimed, 5);
    assert.equal(one.current.total, 16);
    assert.equal(one.inactive_days, 3);
    assert.equal(one.status_code, "normal");
    // 學生 2：只答錯過一個字，有開存到帳號 → 待複習 1、10 天沒玩。
    assert.equal(two.claimed_total, 0);
    assert.equal(two.review_total, 1);
    assert.equal(two.inactive_days, 10);
    assert.equal(two.status_code, "warning");
    // 學生 3：沒有開存到帳號 → 老師看不到，不能算成「從沒玩」。
    assert.equal(three.recorded_to_account, false);
    assert.equal(three.status_code, "never");
    assert.deepEqual(json.totals, { students: 3, recorded: 2, never_played: 0, inactive_7_days: 1 });
});

test("more than 1000 progress rows are all counted (paging)", async () => {
    const tables = baseTables();
    const big = [];
    for (const word of WORD_BANK.slice(0, 672)) big.push({ ...row(word), student_id: 1, bank_version: "v1" });
    for (const word of WORD_BANK.slice(0, 672)) big.push({ ...row(word), student_id: 2, bank_version: "v1" });
    tables.student_word_progress = big;
    const { json } = await call("teacher-20", { action: "class_overview", class_code: "E1" }, tables);
    assert.equal(json.students[0].claimed_total, 672);
    assert.equal(json.students[1].claimed_total, 672);
});

test("serverForAll counts every student as recorded; a database error gives a plain 500 without details", async () => {
    const all = await call("teacher-20", { action: "class_overview", class_code: "E1" }, baseTables(), { serverForAll: true });
    assert.equal(all.json.students.every(item => item.recorded_to_account), true);
    const broken = { from() { throw Object.assign(new Error("secret db detail"), { code: "XX000" }); } };
    const failed = await call("teacher-20", { action: "bootstrap" }, baseTables(), { admin: broken });
    assert.equal(failed.status, 500);
    assert.doesNotMatch(JSON.stringify(failed.json), /secret|XX000/);
});

test("summaries: the focus is the most recently touched level; a fully claimed level shows no open island; the 7/14/30 day rule", () => {
    const rows = [
        ...level1.map(word => row(word, { first_mastered_at: iso(NOW - 40 * DAY), last_correct_at: iso(NOW - 40 * DAY) })),
        row(level2[0], { first_mastered_at: iso(NOW - DAY), last_correct_at: iso(NOW - DAY) })
    ];
    const summary = summarizeStudentIslands(rows, NOW);
    assert.equal(summary.current.level, 2);
    assert.equal(summary.current.island, 1);
    assert.equal(summary.current.claimed, 1);
    const first = summary.per_level.find(item => item.level === 1);
    assert.equal(first.claimed, level1.length);
    assert.equal(first.current_island, null);
    assert.equal(first.islands_full, first.islands_total);
    assert.equal(summarizeStudentIslands([], NOW).status_code, "never");
    assert.deepEqual([statusFor(0), statusFor(6), statusFor(7), statusFor(13), statusFor(14), statusFor(29), statusFor(30)], ["normal", "normal", "warning", "warning", "concern", "concern", "critical"]);
});

test("days without practice are counted by the Taipei calendar day", () => {
    // 台北 11/18 00:30 玩過（UTC 11/17 16:30）；現在是台北 11/18 23:00 → 同一天，0 天。
    const last = Date.parse("2026-11-17T16:30:00.000Z");
    const now = Date.parse("2026-11-18T15:00:00.000Z");
    const rows = [row(level1[0], { first_mastered_at: iso(last), last_correct_at: iso(last) })];
    assert.equal(summarizeStudentIslands(rows, now).inactive_days, 0);
    // 到了台北 11/19 00:00（UTC 11/18 16:00）就是 1 天。
    assert.equal(summarizeStudentIslands(rows, Date.parse("2026-11-18T16:00:00.000Z")).inactive_days, 1);
});
