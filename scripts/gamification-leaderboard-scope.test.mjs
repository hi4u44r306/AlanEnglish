import test from "node:test";
import assert from "node:assert/strict";
import { resolveLeaderboardScope } from "../supabase/functions/_shared/gamification-leaderboard.ts";

test("學生班級排行永遠使用後端查到的本人班級", () => {
    assert.deepEqual(resolveLeaderboardScope({
        role: "student",
        ownClass: "E3",
        requestedScope: "class",
        requestedClass: "E7"
    }), { scope: "class", classCode: "E3" });
});

test("學生可選擇綜合排行但不能指定其他班級", () => {
    assert.deepEqual(resolveLeaderboardScope({
        role: "student",
        ownClass: "E3",
        requestedScope: "overall",
        requestedClass: "E7"
    }), { scope: "overall", classCode: null });
});

test("教師與管理員的班級排行使用選定班級", () => {
    assert.deepEqual(resolveLeaderboardScope({
        role: "teacher",
        ownClass: "E1",
        requestedScope: "class",
        requestedClass: "E5"
    }), { scope: "class", classCode: "E5" });
});
