import test from "node:test";
import assert from "node:assert/strict";
import { leaderboardNameSource, maskLeaderboardName, resolveLeaderboardScope } from "../supabase/functions/_shared/gamification-leaderboard.ts";

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

test("排行榜名字遮罩：永遠只有一個 〇，不洩漏字數", () => {
    const cases = {
        "王": "王〇", "王明": "王〇", "王小明": "王〇明", "王小明華": "王〇華",
        "歐陽娜娜": "歐〇娜", "愛新覺羅溥儀": "愛〇儀",
        "Kevin": "K〇n", "kevin": "K〇n", "Al": "A〇", "K": "K〇",
        "Kevin Chen": "K〇n", "Mary-Jane O'Neil": "M〇l",
        "王小明 Kevin": "王〇明", "王小明(Kevin)": "王〇明", "Kevin 王小明": "王〇明", " 王 小明 ": "王〇明",
        "": "同學", "   ": "同學", "1234": "同學", "😀": "同學", null: "同學", undefined: "同學"
    };
    for (const [input, expected] of Object.entries(cases)) {
        const value = input === "null" ? null : input === "undefined" ? undefined : input;
        assert.equal(maskLeaderboardName(value), expected, `輸入 ${input}`);
    }
});

test("排行榜名字來源：中文名 → 英文名 → name，name 最後", () => {
    assert.equal(leaderboardNameSource({ chinese_name: "王小明", english_name: "Amy", name: "x" }), "王小明");
    assert.equal(leaderboardNameSource({ chinese_name: null, english_name: "Amy", name: "x" }), "Amy");
    assert.equal(leaderboardNameSource({ name: "靠北" }), "靠北");
    assert.equal(leaderboardNameSource(null, "Fallback"), "Fallback");
});
