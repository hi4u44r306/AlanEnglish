import assert from "node:assert/strict";
import test from "node:test";
import {
    sortSpeakingChallengeSets,
    speakingChallengeCatalogSection,
    speakingChallengeSourcePages,
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

test("Workbook 1 依入門、課本頁序、主題分區排序", () => {
    const grouped = [
        { id: 3, title: "02 打招呼", generation_metadata: { template_key: "workbook_1_greetings_polite_v1", source_pages: [100, 35, 36] } },
        { id: 10, title: "P14 看字拼讀", generation_metadata: { interaction_type: "letter_spelling", source_pages: [14] } },
        { id: 1, title: "01 我的名字", generation_metadata: { template_key: "workbook_1_name_intro_v1", source_pages: [18, 19, 20] } },
        { id: 7, title: "00 A–Z", generation_metadata: { interaction_type: "alphabet_round", source_pages: [] } }
    ];

    assert.deepEqual(sortSpeakingChallengeSets(grouped).map(item => item.id), [7, 10, 1, 3]);
    assert.deepEqual(grouped.map(speakingChallengeCatalogSection), ["topic", "textbook", "textbook", "preparation"]);
    assert.deepEqual(speakingChallengeSourcePages(grouped[0]), [35, 36, 100]);
});

test("主題練習也必須依 Workbook 的前一關順序解鎖", () => {
    const grouped = [
        { id: 7, title: "00 A–Z", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: [{ id: 701 }] },
        { id: 10, title: "P14 看字拼讀", generation_metadata: { source_pages: [14] }, speaking_questions: [{ id: 1001 }] },
        { id: 11, title: "P15 看字拼讀", generation_metadata: { source_pages: [15] }, speaking_questions: [{ id: 1101 }] },
        { id: 3, title: "02 打招呼", generation_metadata: { template_key: "workbook_1_greetings_polite_v1", source_pages: [35] }, speaking_questions: [{ id: 301 }] }
    ];

    const beforePreparation = speakingChallengeUnlockState(grouped, new Set());
    assert.deepEqual(beforePreparation.map(item => [item.id, item.is_unlocked]), [[7, true], [10, false], [11, false], [3, false]]);

    const afterPreparation = speakingChallengeUnlockState(grouped, new Set([701]));
    assert.deepEqual(afterPreparation.map(item => [item.id, item.is_unlocked]), [[7, true], [10, true], [11, false], [3, false]]);

    const afterFirstTextbook = speakingChallengeUnlockState(grouped, new Set([701, 1001]));
    assert.deepEqual(afterFirstTextbook.map(item => [item.id, item.is_unlocked]), [[7, true], [10, true], [11, true], [3, false]]);
});
