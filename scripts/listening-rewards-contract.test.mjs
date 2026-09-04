import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260902021837_listening_rewards_and_level_up.sql");
const masteryMigration = read("supabase/migrations/20260903003717_listening_mastery_reward_allocation.sql");
const academyAccessMigration = read("supabase/migrations/20260903114141_academy_all_access_assignment_v2.sql");
const recordPlay = read("supabase/functions/record-play/index.ts");
const assignmentManager = read("supabase/functions/assignment-manager/index.ts");
const gamification = read("supabase/functions/gamification/index.ts");
const player = read("src/components/fragment/MusicPlayer.jsx");
const footerPlayer = read("src/components/assets/scss/FooterPlayer.scss");
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
    assert.match(recordPlay, /start_listening_reward_session_v3/);
    assert.match(player, /if \(repeatTrack\) \{[\s\S]{0,260}resetListeningSession\(\)/);
});

test("舊V2資料保留稽核；V3改為10次熟練、每檔終身一次、每日3檔", () => {
    assert.match(migration, /v_rewarded_before < 10/);
    assert.match(migration, /mod\(v_rewarded_before \+ 1, 5\) = 0/);
    assert.match(migration, /concat\('track:', p_track_id, ':', v_day\)/);
    assert.match(migration, /'listening_daily'/);
    assert.doesNotMatch(migration, /listening_challenge/);
    assert.match(masteryMigration, /v_count >= 10.*v_daily < 3/);
    assert.match(masteryMigration, /'listening_mastery', concat\('track:', p_track_id\)/);
    assert.match(recordPlay, /complete_listening_reward_session_v3/);
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

test("總次數照常累計，但V3同一session只分配一份作業或自主", () => {
    assert.match(migration, /record_student_music_play_v2/);
    assert.match(migration, /primary key \(assignment_id, session_id\)/);
    assert.match(migration, /on conflict \(assignment_id, session_id\) do nothing/);
    assert.match(migration, /assignment\.source_type = 'music_track'/);
    assert.match(migration, /assignment_listening_progress_track_idx/);
    assert.match(migration, /assignment_listening_events_track_idx/);
    assert.match(migration, /assignment_listening_events_session_idx/);
    assert.match(masteryMigration, /session_id uuid primary key/);
    assert.match(masteryMigration, /order by a.due_at asc nulls last, a.created_at asc, a.id asc\s+limit 1/);
    assert.match(masteryMigration, /p_started_at >= greatest/);
});

test("舊版班級作業在 V2 灰度前維持聽力，每檔預設 3 次且上限 10 次", () => {
    assert.match(assignmentManager, /sourceType !== "music_track"/);
    assert.match(assignmentManager, /legacy_ai_assignment_read_only/);
    assert.match(assignmentManager, /Math\.min\(\s*10,/);
    assert.doesNotMatch(studentAssignments, /required_listens \|\| assignment\?\.required_listens \|\| 7/);
    assert.match(studentAssignments, /assignment\?\.required_listens \|\| 3/);
});

test("只有有效在校生可取得點數與兌換，實體獎品每 30 天限一次", () => {
    assert.match(gamification, /student\.learner_type !== "academy_student"/);
    assert.match(gamification, /code: "academy_rewards_required"/);
    assert.match(academyAccessMigration, /ae_student_can_earn_points/);
    assert.match(academyAccessMigration, /v_effective_points_delta/);
    assert.match(migration, /PHYSICAL_REDEMPTION_COOLDOWN/);
    assert.match(migration, /now\(\) - interval '30 days'/);
    assert.match(rewardsPage, /hasRewardsAccess/);
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

test("正常播放器事件延遲不會整段漏算，且 metadata 載入後會補建 session", () => {
    assert.match(player, /isNaturalListeningInterval/);
    assert.doesNotMatch(player, /MAX_NATURAL_LISTEN_GAP_SECONDS/);
    assert.match(player, /onCanPlay=\{event => \{[\s\S]{0,180}ensureListeningSession\(event\.currentTarget\)/);
    assert.match(player, /sessionStartPromiseRef/);
});

test("未達 80% 會保存診斷但不增加次數或獎勵", () => {
    assert.match(recordPlay, /ineligibility_reason: "insufficient_coverage"/);
    assert.match(recordPlay, /counted: false/);
    assert.match(recordPlay, /minimum_coverage_percent: MINIMUM_LISTENING_COVERAGE/);
    assert.match(player, /result\?\.counted === false/);
});

test("900px 以下使用平板精簡播放器且自訂樣式最後載入", () => {
    assert.ok(
        player.indexOf('react-h5-audio-player/lib/styles.css') <
        player.indexOf('../assets/scss/FooterPlayer.scss')
    );
    assert.match(footerPlayer, /Compact bottom player[\s\S]{0,100}@media only screen and \(max-width: 900px\)/);
    assert.match(footerPlayer, /@media only screen and \(min-width: 901px\) and \(max-width: 1080px\)/);
    assert.match(footerPlayer, /\.rhap_volume-controls \{[\s\S]{0,80}display: none !important/);
});
