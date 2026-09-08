import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = await read("supabase/migrations/20260907155832_speaking_challenge_completion_rewards.sql");
const edge = await read("supabase/functions/speaking-challenge/index.ts");
const page = await read("src/components/Pages/TextbookSpeakingChallenge.jsx");

test("whole speaking challenge reward is settled atomically with a lifetime source key", () => {
    assert.match(migration, /pg_advisory_xact_lock/);
    assert.match(migration, /v_completed_questions = v_total_questions/);
    assert.match(migration, /'speaking_challenge_complete'/);
    assert.match(migration, /concat\('question_set:', p_question_set_id\)/);
    assert.match(migration, /private\.ae_gamification_grant_v2\([\s\S]*?30,[\s\S]*?3,/);
    assert.match(migration, /reward_granted/);
});

test("reward RPC is service-role only and validates published question ownership", () => {
    assert.match(migration, /question_set\.status = 'published'/);
    assert.match(migration, /question\.id = p_question_id/);
    assert.match(migration, /revoke all on function public\.complete_speaking_challenge_question_v2[\s\S]*?from public, anon, authenticated/);
    assert.match(migration, /grant execute on function public\.complete_speaking_challenge_question_v2[\s\S]*?to service_role/);
});

test("edge function never trusts client reward amounts and returns database settlement", () => {
    assert.match(edge, /admin\.rpc\("complete_speaking_challenge_question_v2"/);
    assert.match(edge, /p_student_id: Number\(user\.id\)/);
    assert.match(edge, /p_question_set_id: setId/);
    assert.match(edge, /p_question_id: questionId/);
    assert.doesNotMatch(edge, /body\?\.(xp|points|ae_points)/);
});

test("student page only celebrates a newly granted whole-challenge reward", () => {
    assert.match(page, /completion\?\.challenge_complete && completion\?\.reward_granted/);
    assert.match(page, /SpeakingChallengeCompletion reward=\{completionReward\}/);
    assert.match(page, /完成整個大挑戰可獲得 30 XP/);
});
