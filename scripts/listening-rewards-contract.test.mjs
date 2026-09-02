import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260902021837_listening_rewards_and_level_up.sql");
const recordPlay = read("supabase/functions/record-play/index.ts");
const gamification = read("supabase/functions/gamification/index.ts");
const player = read("src/components/fragment/MusicPlayer.jsx");
const rewardFeedback = read("src/components/fragment/ListeningRewardFeedback.jsx");
const rewardsPage = read("src/components/Pages/Rewards.jsx");

test("有效聆聽必須涵蓋至少 80% 且由伺服器完成原子結算", () => {
    assert.match(recordPlay, /MINIMUM_LISTENING_COVERAGE = 80/);
    assert.match(recordPlay, /normalizeCoverageRanges/);
    assert.match(recordPlay, /complete_listening_reward_session/);
    assert.match(migration, /p_coverage_percent < 80/);
    assert.match(migration, /for update/);
});

test("同一學生只能有一個可計獎的進行中工作階段", () => {
    assert.match(migration, /create unique index if not exists listening_coverage_sessions_one_open_reward_idx/);
    assert.match(migration, /superseded_by_new_session/);
    assert.match(recordPlay, /start_listening_reward_session/);
    assert.match(player, /if \(repeatTrack\) \{[\s\S]{0,260}resetListeningSession\(\)/);
});

test("每日前十首不同音檔各得 5 XP 且每五首得 1 AE Point", () => {
    assert.match(migration, /v_rewarded_before < 10/);
    assert.match(migration, /mod\(v_rewarded_before \+ 1, 5\) = 0/);
    assert.match(migration, /concat\('track:', p_track_id, ':', v_day\)/);
    assert.match(migration, /'listening_daily'/);
    assert.doesNotMatch(migration, /listening_challenge/);
});

test("升等點數依等級區間一次性發放", () => {
    assert.match(migration, /when p_level between 2 and 5 then 5/);
    assert.match(migration, /when p_level between 6 and 10 then 10/);
    assert.match(migration, /when p_level between 11 and 20 then 15/);
    assert.match(migration, /when p_level >= 21 then 20/);
    assert.match(migration, /concat\('level:', v_level\)/);
    assert.match(rewardFeedback, /LEVEL UP!/);
});

test("加速播放、背景分頁與未回應注意力確認不會累積獎勵", () => {
    assert.match(player, /usedAcceleratedPlaybackRef\.current = true/);
    assert.match(player, /document\.visibilityState !== "hidden"/);
    assert.match(player, /ATTENTION_CHECK_SECONDS = 30/);
    assert.match(player, /CONTINUOUS_ATTENTION_MINUTES = 15/);
    assert.match(player, /NO_INTERACTION_CHECK_COUNT = 5/);
    assert.match(recordPlay, /used_accelerated_playback/);
});

test("作業高分只加 XP 且遊戲 AE Points 每日上限為 2", () => {
    assert.match(migration, /new\.student_id,\s*20,\s*0,\s*'assignment_90'/);
    assert.match(migration, /new\.student_id,\s*10,\s*0,\s*'assignment_100'/);
    assert.match(migration, /greatest\(0, 2 - v_points_today\)/);
});

test("試用會員不可兌換且實體獎品每 30 天限一次", () => {
    assert.match(gamification, /student\.learner_type === "trial_user"/);
    assert.match(migration, /TRIAL_REDEMPTION_LOCKED/);
    assert.match(migration, /PHYSICAL_REDEMPTION_COOLDOWN/);
    assert.match(migration, /now\(\) - interval '30 days'/);
    assert.match(rewardsPage, /redemptionAllowed/);
});

test("獎勵與兌換 RPC 僅允許 service role 執行", () => {
    for (const functionName of [
        "start_listening_reward_session",
        "complete_listening_reward_session",
        "request_reward_redemption",
        "record_game_gamification"
    ]) {
        assert.match(migration, new RegExp(`revoke all on function public\\.${functionName}`));
    }
    assert.match(migration, /to service_role/g);
});
