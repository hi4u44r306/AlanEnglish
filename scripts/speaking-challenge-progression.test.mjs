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

test("Workbook 3 首批關卡依起始頁、結束頁與編號穩定排序", () => {
    assert.deepEqual(sortSpeakingChallengeSets([
        { id: 32, title: "P8 眼睛", generation_metadata: { source_pages: [8] } },
        { id: 31, title: "P4～P5 石榴", generation_metadata: { source_pages: [4, 5] } },
        { id: 30, title: "P4 石榴", generation_metadata: { source_pages: [4] } }
    ]).map(item => item.id), [30, 31, 32]);
});

test("學生必須完整通關前一關才會解鎖下一關", () => {
    const noProgress = speakingChallengeUnlockState(challenges, new Set());
    assert.deepEqual(noProgress.map(item => item.is_unlocked), [true, false, false]);

    const firstComplete = speakingChallengeUnlockState(challenges, new Set([1101, 1102]));
    assert.deepEqual(firstComplete.map(item => item.is_unlocked), [true, true, false]);

    const secondComplete = speakingChallengeUnlockState(challenges, new Set([1101, 1102, 1201]));
    assert.deepEqual(secondComplete.map(item => item.is_unlocked), [true, true, true]);

    const historicalLaterComplete = speakingChallengeUnlockState(challenges, new Set([1101, 1102, 1301]));
    assert.deepEqual(historicalLaterComplete.map(item => item.is_unlocked), [true, true, false]);
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

test("每個分類第一關固定開放，後續關卡只依同分類順序解鎖", () => {
    const grouped = [
        { id: 7, title: "00 A–Z", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: [{ id: 701 }] },
        { id: 10, title: "P14 看字拼讀", generation_metadata: { source_pages: [14] }, speaking_questions: [{ id: 1001 }] },
        { id: 11, title: "P15 看字拼讀", generation_metadata: { source_pages: [15] }, speaking_questions: [{ id: 1101 }] },
        { id: 3, title: "02 打招呼", generation_metadata: { template_key: "workbook_1_greetings_polite_v1", source_pages: [35] }, speaking_questions: [{ id: 301 }] },
        { id: 4, title: "03 顏色與生活物品", generation_metadata: { template_key: "workbook_1_colors_objects_v1", source_pages: [84] }, speaking_questions: [{ id: 401 }] }
    ];

    const beforePreparation = speakingChallengeUnlockState(grouped, new Set());
    assert.deepEqual(beforePreparation.map(item => [item.id, item.is_unlocked]), [[7, true], [10, true], [11, false], [3, true], [4, false]]);

    const afterPreparation = speakingChallengeUnlockState(grouped, new Set([701]));
    assert.deepEqual(afterPreparation.map(item => [item.id, item.is_unlocked]), [[7, true], [10, true], [11, false], [3, true], [4, false]]);

    const afterFirstTextbook = speakingChallengeUnlockState(grouped, new Set([701, 1001]));
    assert.deepEqual(afterFirstTextbook.map(item => [item.id, item.is_unlocked]), [[7, true], [10, true], [11, true], [3, true], [4, false]]);

    const afterFirstTopic = speakingChallengeUnlockState(grouped, new Set([301]));
    assert.deepEqual(afterFirstTopic.map(item => [item.id, item.is_unlocked]), [[7, true], [10, true], [11, false], [3, true], [4, true]]);
});
