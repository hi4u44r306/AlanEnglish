import assert from "node:assert/strict";
import test from "node:test";
import {
    sortSpeakingChallengeSets,
    speakingChallengeUnlockState
} from "../supabase/functions/_shared/speaking-challenge-progression.ts";

const challenges = [
    { id: 12, title: "02 打招呼與禮貌對話", speaking_questions: [{ id: 1201 }] },
    { id: 11, title: "00 A–Z 大小寫挑戰", speaking_questions: [{ id: 1101 }, { id: 1102 }] },
    { id: 13, title: "03 顏色與生活物品", speaking_questions: [{ id: 1301 }] }
];

test("口說關卡會依教材標題的固定編號排序", () => {
    assert.deepEqual(sortSpeakingChallengeSets(challenges).map(item => item.id), [11, 12, 13]);
});

test("P 開頭的教材頁碼會保留固定關卡順序", () => {
    assert.deepEqual(sortSpeakingChallengeSets([
        { id: 22, title: "P22 看圖說完整句子" },
        { id: 14, title: "P14 拼讀單字" }
    ]).map(item => item.id), [14, 22]);
});

test("學生必須完整通關前一關才會解鎖下一關", () => {
    const noProgress = speakingChallengeUnlockState(challenges, new Set());
    assert.deepEqual(noProgress.map(item => item.is_unlocked), [true, false, false]);

    const firstComplete = speakingChallengeUnlockState(challenges, new Set([1101, 1102]));
    assert.deepEqual(firstComplete.map(item => item.is_unlocked), [true, true, false]);

    const secondComplete = speakingChallengeUnlockState(challenges, new Set([1101, 1102, 1201]));
    assert.deepEqual(secondComplete.map(item => item.is_unlocked), [true, true, true]);
});
