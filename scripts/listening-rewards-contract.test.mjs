import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260902021837_listening_rewards_and_level_up.sql");
const recordPlay = read("supabase/functions/record-play/index.ts");
const assignmentManager = read("supabase/functions/assignment-manager/index.ts");
const gamification = read("supabase/functions/gamification/index.ts");
const player = read("src/components/fragment/MusicPlayer.jsx");
const studentAssignments = read("src/components/Pages/StudentAssignments.jsx");
const rewardFeedback = read("src/components/fragment/ListeningRewardFeedback.jsx");
const rewardsPage = read("src/components/Pages/Rewards.jsx");

test("有效聆聽必須涵蓋至少 80% 且由伺服器完成原子結算", () => {
    assert.match(recordPlay, /MINIMUM_LISTENING_COVERAGE = 80/);
    assert.match(recordPlay, /normalizeCoverageRanges/);
    assert.match(recordPlay, /complete_listening_reward_session_v2/);
    assert.match(migration, /p_coverage_percent < 80/);
    assert.match(migration, /for update/);
});

test("同一學生只能有一個可計獎的進行中工作階段", () => {
    assert.match(migration, /where student\.id = p_student_id and student\.role = 'student'\s*for update/);
    assert.match(migration, /superseded_by_new_session/);
    assert.match(recordPlay, /start_listening_reward_session_v2/);
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

test("新作業只計發布後的有效聽力，且不再用 AI 分數加成", () => {
    assert.match(migration, /assignment_listening_events/);
    assert.match(migration, /assignment_listening_progress/);
    assert.match(migration, /p_listened_at >= greatest\(/);
    assert.match(migration, /assignment\.created_at/);
    assert.doesNotMatch(migration, /'assignment_90'/);
    assert.doesNotMatch(migration, /'assignment_100'/);
    assert.match(migration, /greatest\(0, 2 - v_points_today\)/);
});

test("正式庫以學生灰度旗標啟用新規則，未啟用者保持舊流程", () => {
    assert.match(migration, /student_feature_rollouts/);
    assert.match(migration, /feature_key in \('listening_rewards_v2'\)/);
    assert.match(recordPlay, /listeningRewardsV2Enabled/);
    assert.match(recordPlay, /record_student_music_play/);
    assert.match(migration, /Missing rows always mean disabled/);
    assert.equal(
        (migration.match(/raise exception 'LISTENING_REWARDS_V2_DISABLED'/g) || []).length,
        2
    );
});

test("同一有效聽力可同時累計總進度與相符作業，但同一 session 不會重複計數", () => {
    assert.match(migration, /record_student_music_play_v2/);
    assert.match(migration, /primary key \(assignment_id, session_id\)/);
    assert.match(migration, /on conflict \(assignment_id, session_id\) do nothing/);
    assert.match(migration, /assignment\.source_type = 'music_track'/);
    assert.match(migration, /assignment_listening_progress_track_idx/);
    assert.match(migration, /assignment_listening_events_track_idx/);
    assert.match(migration, /assignment_listening_events_session_idx/);
});

test("新班級作業只能發布聽力，每檔預設 3 次且上限 10 次", () => {
    assert.match(assignmentManager, /sourceType !== "music_track"/);
    assert.match(assignmentManager, /legacy_ai_assignment_read_only/);
    assert.match(assignmentManager, /Math\.min\(\s*10,/);
    assert.doesNotMatch(studentAssignments, /required_listens \|\| assignment\?\.required_listens \|\| 7/);
    assert.match(studentAssignments, /assignment\?\.required_listens \|\| 3/);
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
        "start_listening_reward_session_v2",
        "complete_listening_reward_session_v2",
        "request_reward_redemption",
        "record_game_gamification"
    ]) {
        assert.match(migration, new RegExp(`revoke all on function public\\.${functionName}`));
    }
    assert.match(migration, /to service_role/g);
});
