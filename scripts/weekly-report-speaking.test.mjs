import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeWeeklySpeakingChallenge } from "../supabase/functions/_shared/weekly-report-speaking.ts";

const week = {
    previous_start_at: "2026-09-07T16:00:00.000Z",
    start_at: "2026-09-14T16:00:00.000Z",
    end_at: "2026-09-21T16:00:00.000Z"
};

const questionSets = [{
    id: 18,
    title: "P28 顏色",
    topic: "顏色",
    books: { id: 1, name: "Workbook 1", code: "WB1" },
    speaking_questions: [{ id: 101 }, { id: 102 }, { id: 103 }]
}];

test("口說大挑戰只計算題目的首次完成並辨識本週通關", () => {
    const result = summarizeWeeklySpeakingChallenge({
        week,
        questionSets,
        progress: [
            { question_set_id: 18, question_id: 101, completed_at: "2026-09-10T02:00:00.000Z" },
            { question_set_id: 18, question_id: 102, completed_at: "2026-09-16T02:00:00.000Z" },
            { question_set_id: 18, question_id: 103, completed_at: "2026-09-17T02:00:00.000Z" },
            { question_set_id: 18, question_id: 103, completed_at: "2026-09-17T02:00:00.000Z" }
        ],
        rewards: [{
            source_key: "question_set:18",
            xp_delta: 30,
            points_delta: 3,
            created_at: "2026-09-17T02:00:01.000Z"
        }]
    });

    assert.equal(result.completed_questions, 2);
    assert.equal(result.previous_completed_questions, 1);
    assert.equal(result.completed_challenges, 1);
    assert.equal(result.xp_awarded, 30);
    assert.equal(result.ae_points_awarded, 3);
    assert.equal(result.current_challenge.progress_percent, 100);
    assert.equal(result.current_challenge.book_name, "Workbook 1");
    assert.equal(result.recent_clears[0].title, "P28 顏色");
});

test("未完成整關時只顯示題目進度，不虛報通關與獎勵", () => {
    const result = summarizeWeeklySpeakingChallenge({
        week,
        questionSets,
        progress: [
            { question_set_id: 18, question_id: 101, completed_at: "2026-09-16T02:00:00.000Z" }
        ],
        rewards: []
    });

    assert.equal(result.completed_questions, 1);
    assert.equal(result.completed_challenges, 0);
    assert.equal(result.xp_awarded, 0);
    assert.equal(result.ae_points_awarded, 0);
    assert.equal(result.current_challenge.completed_questions, 1);
    assert.equal(result.current_challenge.total_questions, 3);
    assert.equal(result.current_challenge.progress_percent, 33);
});

test("較早通關保留在累積成果，但不算成本週新通關", () => {
    const result = summarizeWeeklySpeakingChallenge({
        week,
        questionSets,
        progress: [
            { question_set_id: 18, question_id: 101, completed_at: "2026-09-08T02:00:00.000Z" },
            { question_set_id: 18, question_id: 102, completed_at: "2026-09-09T02:00:00.000Z" },
            { question_set_id: 18, question_id: 103, completed_at: "2026-09-10T02:00:00.000Z" }
        ],
        rewards: []
    });

    assert.equal(result.completed_questions, 0);
    assert.equal(result.previous_completed_questions, 3);
    assert.equal(result.completed_challenges, 0);
    assert.equal(result.previous_completed_challenges, 1);
    assert.equal(result.all_time_completed_challenges, 1);
});
