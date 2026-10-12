import test from "node:test";
import assert from "node:assert/strict";
import { countPracticeSessions, loadPracticeSessionCounts } from "../supabase/functions/_shared/speaking-practice-count.ts";

test("同一次練習錄很多題只算一次；不同關卡分開算；沒有 session 的舊紀錄不算", () => {
    const counts = countPracticeSessions([
        { question_set_id: 7, client_session_id: "a" }, { question_set_id: 7, client_session_id: "a" },
        { question_set_id: 7, client_session_id: "b" }, { question_set_id: 31, client_session_id: "a" },
        { question_set_id: 7, client_session_id: null }, { question_set_id: 0, client_session_id: "c" }
    ]);
    assert.equal(counts.get(7), 2);
    assert.equal(counts.get(31), 1);
    assert.equal(counts.size, 2);
});

test("只讀該學生的練習紀錄，分頁讀到最後一頁為止", async () => {
    const calls = [];
    const pages = [Array.from({ length: 1000 }, (_, index) => ({ question_set_id: 7, client_session_id: `s${index % 3}` })), [{ question_set_id: 7, client_session_id: "s9" }]];
    const admin = { from: table => { const query = { filters: [table] };
        const chain = { select: columns => { query.columns = columns; return chain; }, eq: (key, value) => { query.filters.push(`${key}=${value}`); return chain; },
            not: (key, op, value) => { query.filters.push(`${key} not ${op} ${value}`); return chain; }, order: () => chain,
            range: async (from, to) => { calls.push({ ...query, from, to }); return { data: pages[calls.length - 1] || [], error: null }; } };
        return chain; } };
    const counts = await loadPracticeSessionCounts(admin, 42);
    assert.equal(counts.get(7), 4);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].filters, ["speaking_pronunciation_attempts", "student_id=42", "challenge_mode=easy", "client_session_id not is null"]);
    assert.equal(calls[0].columns, "question_set_id,client_session_id");
    assert.deepEqual([calls[1].from, calls[1].to], [1000, 1999]);
});
