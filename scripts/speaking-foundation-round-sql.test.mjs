// Executes the real A-Z round migration in an isolated in-memory PostgreSQL.
// PGLITE_MODULE points to an independently installed @electric-sql/pglite entry;
// this test never reads credentials or connects to a Supabase project.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(process.env.PGLITE_MODULE
    ? pathToFileURL(process.env.PGLITE_MODULE).href
    : "@electric-sql/pglite");
const db = new PGlite();
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const completionMigration = read("supabase/migrations/20260907155832_speaking_challenge_completion_rewards.sql");
const roundMigration = read("supabase/migrations/20260913023814_speaking_foundation_round_sessions.sql");
const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const ids = Array.from({ length: 26 }, (_, index) => 1001 + index);
const questionOrder = `array[${ids.join(",")}]::bigint[]`;

const startRound = async studentId => (await scalar(`
    select public.start_speaking_foundation_round_v2(
        ${studentId}, 10, 1, ${questionOrder}
    ) result
`)).result;

const claimQuestion = async (studentId, roundId, questionId) => (await scalar(`
    select public.claim_speaking_foundation_round_question_v1(
        ${studentId}, '${roundId}'::uuid, ${questionId}
    ) result
`)).result;

const releaseClaim = async (studentId, roundId, claimToken) => (await scalar(`
    select public.release_speaking_foundation_round_claim_v1(
        ${studentId}, '${roundId}'::uuid, '${claimToken}'::uuid
    ) released
`)).released;

const saveAttempt = async ({ studentId, roundId, claimToken, questionId, answerMatch }) => (
    await scalar(`
        insert into public.speaking_pronunciation_attempts (
            student_id, question_set_id, question_id, recognized_text,
            foundation_round_id, foundation_claim_token, answer_match
        ) values ($1, 10, $2, 'test answer', $3::uuid, $4::uuid, $5)
        returning id
    `, [studentId, questionId, roundId, claimToken, answerMatch])
).id;

const recordAttempt = async ({ studentId, roundId, attemptId, claimToken }) => (await scalar(`
    select public.record_speaking_foundation_round_attempt_v1(
        ${studentId}, '${roundId}'::uuid, ${attemptId}, '${claimToken}'::uuid
    ) result
`)).result;

const recordAssessment = async ({
    version = "v1",
    studentId,
    roundId,
    claimToken,
    questionId,
    answerMatch,
    pronunciationScore = 88,
    accuracyScore = 89,
    fluencyScore = 87,
    completenessScore = 90,
    prosodyScore = 86,
    recognizedText = "test answer",
    wordResults = []
}) => (await scalar(`
    select public.record_speaking_foundation_assessment_${version}(
        $1, $2::uuid, $3, $4::uuid,
        $5, $6, $7, $8, $9, $10,
        $11::jsonb, $12
    ) result
`, [
    studentId, roundId, questionId, claimToken,
    pronunciationScore, accuracyScore, fluencyScore,
    completenessScore, prosodyScore, recognizedText,
    JSON.stringify(wordResults), answerMatch
])).result;

before(async () => {
    await db.exec(`
        create role anon;
        create role authenticated;
        create role service_role;
        create schema private;

        create table public.students (
            id bigint primary key,
            role text not null default 'student',
            archived_at timestamptz,
            account_status text default 'active'
        );
        create table public.speaking_question_sets (
            id bigint primary key,
            status text not null,
            version integer not null,
            generation_metadata jsonb not null default '{}'::jsonb
        );
        create table public.speaking_questions (
            id bigint primary key,
            question_set_id bigint not null references public.speaking_question_sets(id),
            model_answer text not null
        );
        create table public.speaking_pronunciation_attempts (
            id bigint generated always as identity primary key,
            student_id bigint not null references public.students(id),
            question_set_id bigint not null references public.speaking_question_sets(id),
            question_id bigint not null references public.speaking_questions(id),
            pronunciation_score numeric(5,2) not null default 0,
            accuracy_score numeric(5,2) not null default 0,
            fluency_score numeric(5,2) not null default 0,
            completeness_score numeric(5,2) not null default 0,
            prosody_score numeric(5,2) not null default 0,
            recognized_text text,
            word_results jsonb not null default '[]'::jsonb,
            created_at timestamptz not null default now()
        );
        create table public.speaking_challenge_question_progress (
            student_id bigint not null references public.students(id),
            question_set_id bigint not null references public.speaking_question_sets(id),
            question_id bigint not null references public.speaking_questions(id),
            status text not null,
            opened_at timestamptz,
            completed_at timestamptz,
            updated_at timestamptz,
            unique(student_id, question_id)
        );
        create table public.student_gamification_balances (
            student_id bigint primary key references public.students(id),
            total_xp integer not null default 0,
            points_balance integer not null default 0,
            updated_at timestamptz not null default now()
        );
        create table public.student_gamification_ledger (
            id bigint generated always as identity primary key,
            student_id bigint not null references public.students(id),
            xp_delta integer not null,
            points_delta integer not null,
            source_type text not null,
            source_key text not null,
            description text,
            metadata jsonb,
            created_at timestamptz not null default now(),
            unique(student_id, source_type, source_key)
        );

        create function private.ae_level_for_xp(p_xp integer) returns integer
        language sql immutable security invoker set search_path = ''
        as $$ select greatest(1, 1 + greatest(0, coalesce(p_xp, 0)) / 100) $$;
        create function private.ae_level_reward_points(p_level integer) returns integer
        language sql immutable security invoker set search_path = ''
        as $$ select case when p_level > 1 then 5 else 0 end $$;
        create function private.ae_student_can_earn_points(p_student_id bigint) returns boolean
        language sql stable security invoker set search_path = ''
        as $$ select exists (select 1 from public.students where id = p_student_id and role = 'student') $$;
        create function private.ae_gamification_grant_v2(
            p_student_id bigint,
            p_xp_delta integer,
            p_points_delta integer,
            p_source_type text,
            p_source_key text,
            p_description text default null,
            p_metadata jsonb default '{}'::jsonb
        ) returns boolean
        language plpgsql security invoker set search_path = ''
        as $$
        declare v_inserted integer := 0;
        begin
            insert into public.student_gamification_ledger (
                student_id, xp_delta, points_delta, source_type, source_key, description, metadata
            ) values (
                p_student_id, p_xp_delta, p_points_delta, p_source_type, p_source_key, p_description, p_metadata
            ) on conflict (student_id, source_type, source_key) do nothing;
            get diagnostics v_inserted = row_count;
            if v_inserted = 0 then return false; end if;
            insert into public.student_gamification_balances (student_id, total_xp, points_balance)
            values (p_student_id, p_xp_delta, p_points_delta)
            on conflict (student_id) do update
            set total_xp = public.student_gamification_balances.total_xp + excluded.total_xp,
                points_balance = public.student_gamification_balances.points_balance + excluded.points_balance,
                updated_at = now();
            return true;
        end;
        $$;

        insert into public.students(id) select generate_series(1, 8);
        insert into public.speaking_question_sets(id, status, version, generation_metadata)
        values (10, 'published', 1, '{"interaction_type":"alphabet_round"}'::jsonb);
        insert into public.speaking_questions(id, question_set_id, model_answer)
        select 1000 + value, 10, chr(64 + value)
        from generate_series(1, 26) value;
    `);
    await db.exec(completionMigration);
    await db.exec(roundMigration);
    await db.exec(read("supabase/migrations/20260914000000_speaking_alphabet_intro_progress.sql"));
    await db.exec(read("supabase/migrations/20260918063338_speaking_challenge_daily_sessions.sql"));
    await db.exec(read("supabase/migrations/20260913013037_speaking_pronunciation_request_ledger.sql"));
    await db.exec(read("supabase/migrations/20261003123607_speaking_audio_monthly_budget.sql"));
    await db.exec(read("supabase/migrations/20261006150733_speaking_local_completeness.sql"));
    await db.exec(read("supabase/migrations/20261006154419_speaking_ten_daily_rounds.sql"));
    await db.exec(read("supabase/migrations/20261006155728_speaking_alphabet_basic_cost_tracking.sql"));
    await db.exec(read("supabase/migrations/20260929160325_speaking_challenge_modes.sql"));
    await db.exec(read("supabase/migrations/20261007025513_speaking_daily_level_and_alphabet_limits.sql"));
});

after(() => db.close());

test("A–Z 每個字母三次跨關卡共用，供應商失敗也占額度；其他字母仍可評分", async () => {
    await db.exec("insert into public.students(id) values(94); insert into public.speaking_question_sets(id,status,version,generation_metadata) values(30,'published',1,'{\"interaction_type\":\"alphabet_round\"}'); insert into public.speaking_questions(id,question_set_id,model_answer) values(3001,30,'a')");
    const reserve = async (set=10,q=1001) => (await scalar("select public.reserve_speaking_azure_alphabet_request_v1(94,$1,$2,3,'00000000-0000-4000-8000-000000000094') result",[set,q])).result;
    for (let i=0;i<3;i++) { const result=await reserve(); assert.equal(result.letter_remaining,2-i); }
    await db.exec("update public.speaking_pronunciation_requests set status='internal_failed' where student_id=94");
    assert.equal((await reserve(30,3001)).code,"alphabet_letter_daily_limit_reached");
    assert.equal((await reserve(10,1002)).allowed,true);
    assert.equal((await scalar("select count(*)::int n from public.speaking_pronunciation_requests where student_id=94")).n,4);
});

test("A–Z 正式連續通關只記一次今日完成；重送冪等，重開與再次送評均拒絕，隔天可用", async () => {
    await db.exec("insert into public.students(id) values(95)");
    const round=await startRound(95); let lastArgs;
    for(const q of ids) {
        const claim=await claimQuestion(95,round.round_id,q);
        lastArgs={version:'v3',studentId:95,roundId:round.round_id,claimToken:claim.claim_token,questionId:q,answerMatch:true,prosodyScore:null};
        const result=await recordAssessment(lastArgs);
        assert.equal(result.status,q===ids.at(-1)?'completed':'open');
    }
    assert.equal((await recordAssessment(lastArgs)).status,'completed');
    assert.equal((await scalar("select count(*)::int n from public.speaking_daily_level_completions where student_id=95")).n,1);
    assert.equal((await scalar(`select public.start_speaking_foundation_round_v2(95,10,1,${questionOrder}) result`)).result.code,'speaking_level_completed_today');
    assert.equal((await scalar("select public.reserve_speaking_azure_alphabet_request_v1(95,10,1001,3,'00000000-0000-4000-8000-000000000095') result")).result.code,'speaking_level_completed_today');
    assert.equal((await scalar("select public.reserve_speaking_local_request_v1(95,10,1001,'alphabet_round','00000000-0000-4000-8000-000000000095') result")).result.code,'speaking_level_completed_today');
    await db.exec("update public.speaking_daily_level_completions set activity_date=activity_date-1 where student_id=95");
    assert.equal((await scalar("select public.reserve_speaking_azure_alphabet_request_v1(95,10,1001,3,'00000000-0000-4000-8000-000000000095') result")).result.allowed,true);
});

test("今日完成不借用歷史通關；今日重試可累積，簡單與挑戰共用每日一次且公開角色無權限", async () => {
    await db.exec("insert into public.students(id) values(96); insert into public.speaking_question_sets(id,status,version) values(40,'published',1); insert into public.speaking_questions(id,question_set_id,model_answer) values(4001,40,'Hello'),(4002,40,'Goodbye')");
    for(const q of [4001,4002]) await scalar("select public.complete_speaking_challenge_question_v2(96,40,$1) result",[q]);
    const session='00000000-0000-4000-8000-000000000096';
    const save = async(q,s=session) => db.query("insert into public.speaking_pronunciation_attempts(student_id,question_set_id,question_id,answer_match,client_session_id) values(96,40,$1,true,$2::uuid)",[q,s]);
    const complete=async(q,s=session,mode='easy')=>(await scalar("select public.complete_speaking_daily_question_v1(96,40,$1,$2::uuid,$3) result",[q,s,mode])).result;
    await save(4001); assert.equal((await complete(4001)).challenge_completed,false);
    await save(4002,'00000000-0000-4000-8000-000000000097');
    assert.equal((await complete(4001)).challenge_completed,false,'已評分但尚未成功寫入完成操作的題目，不可使整關通關');
    assert.equal((await complete(4002,'00000000-0000-4000-8000-000000000097')).challenge_completed,true);
    assert.equal((await complete(4002,'00000000-0000-4000-8000-000000000097')).xp_awarded,0);
    await assert.rejects(complete(4001,session,'challenge'),/DAILY_LEVEL_COMPLETED/);
    const policy=(await scalar("select public.speaking_daily_level_policy_v1(96,null) result")).result;
    assert.deepEqual(policy.completed_set_ids,[40]);
    for(const role of ['anon','authenticated']) for(const fn of ['speaking_daily_level_policy_v1(bigint,bigint)','complete_speaking_daily_question_v1(bigint,bigint,bigint,uuid,text)','record_speaking_foundation_assessment_v3(bigint,uuid,bigint,uuid,numeric,numeric,numeric,numeric,numeric,text,jsonb,boolean)'])
        assert.equal((await scalar("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,'public.'+fn])).allowed,false);
    await db.exec('set role anon');
    try { await assert.rejects(db.query('select * from public.speaking_daily_level_completions'),/permission denied/); }
    finally { await db.exec('reset role'); }
});

test("正確題只推進 server index；答錯後持久化歸零且不留下完成進度", async () => {
    const round = await startRound(1);
    const firstClaim = await claimQuestion(1, round.round_id, ids[0]);
    assert.equal(firstClaim.status, "claimed");
    const duplicateClaim = await claimQuestion(1, round.round_id, ids[0]);
    assert.equal(duplicateClaim.status, "busy");

    const firstAttempt = await saveAttempt({
        studentId: 1, roundId: round.round_id, claimToken: firstClaim.claim_token,
        questionId: ids[0], answerMatch: true
    });
    const firstResult = await recordAttempt({
        studentId: 1, roundId: round.round_id, attemptId: firstAttempt, claimToken: firstClaim.claim_token
    });
    assert.deepEqual({ status: firstResult.status, next: firstResult.next_index }, { status: "open", next: 1 });
    assert.equal((await scalar("select count(*)::int count from public.speaking_challenge_question_progress where student_id=1")).count, 0);

    const secondClaim = await claimQuestion(1, round.round_id, ids[1]);
    const secondAttempt = await saveAttempt({
        studentId: 1, roundId: round.round_id, claimToken: secondClaim.claim_token,
        questionId: ids[1], answerMatch: false
    });
    const failed = await recordAttempt({
        studentId: 1, roundId: round.round_id, attemptId: secondAttempt, claimToken: secondClaim.claim_token
    });
    assert.deepEqual({ status: failed.status, next: failed.next_index }, { status: "failed", next: 0 });
    const replay = await recordAttempt({
        studentId: 1, roundId: round.round_id, attemptId: secondAttempt, claimToken: secondClaim.claim_token
    });
    assert.deepEqual({ status: replay.status, next: replay.next_index }, { status: "failed", next: 0 });
    assert.equal((await scalar("select count(*)::int count from public.speaking_challenge_question_progress where student_id=1")).count, 0);
});

test("claim 防止並行付費；失敗釋放後可重試，有 in-flight 時不能換新回合", async () => {
    const round = await startRound(2);
    const firstClaim = await claimQuestion(2, round.round_id, ids[0]);
    const busyStart = await startRound(2);
    assert.equal(busyStart.status, "busy");
    assert.equal((await scalar("select count(*)::int count from public.speaking_foundation_rounds where student_id=2 and status='open'")).count, 1);
    assert.equal(await releaseClaim(2, round.round_id, firstClaim.claim_token), true);
    const retryClaim = await claimQuestion(2, round.round_id, ids[0]);
    assert.equal(retryClaim.status, "claimed");
    assert.notEqual(retryClaim.claim_token, firstClaim.claim_token);
    assert.equal(await releaseClaim(2, round.round_id, retryClaim.claim_token), true);
});

test("前 25 題不落 progress；第 26 題以單一交易完成 26 題並只發一次獎勵", async () => {
    const round = await startRound(3);
    for (let index = 0; index < 25; index += 1) {
        const claim = await claimQuestion(3, round.round_id, ids[index]);
        const attemptId = await saveAttempt({
            studentId: 3, roundId: round.round_id, claimToken: claim.claim_token,
            questionId: ids[index], answerMatch: true
        });
        const result = await recordAttempt({ studentId: 3, roundId: round.round_id, attemptId, claimToken: claim.claim_token });
        assert.equal(result.status, "open");
        assert.equal(result.next_index, index + 1);
    }
    assert.equal((await scalar("select count(*)::int count from public.speaking_challenge_question_progress where student_id=3")).count, 0);

    const finalClaim = await claimQuestion(3, round.round_id, ids[25]);
    const finalAttempt = await saveAttempt({
        studentId: 3, roundId: round.round_id, claimToken: finalClaim.claim_token,
        questionId: ids[25], answerMatch: true
    });
    await db.exec(`
        create function private.reject_test_progress() returns trigger
        language plpgsql set search_path = '' as $$
        begin
            if new.question_id = 1003 then raise exception 'TEST_PROGRESS_FAILURE'; end if;
            return new;
        end;
        $$;
        create trigger reject_test_progress before insert on public.speaking_challenge_question_progress
        for each row execute function private.reject_test_progress();
    `);
    await assert.rejects(
        recordAttempt({ studentId: 3, roundId: round.round_id, attemptId: finalAttempt, claimToken: finalClaim.claim_token }),
        /TEST_PROGRESS_FAILURE/
    );
    assert.equal((await scalar("select count(*)::int count from public.speaking_challenge_question_progress where student_id=3")).count, 0);
    assert.deepEqual(await scalar(`select next_index, active_claim_token is not null claimed from public.speaking_foundation_rounds where id='${round.round_id}'`), {
        next_index: 25,
        claimed: true
    });
    await db.exec("drop trigger reject_test_progress on public.speaking_challenge_question_progress; drop function private.reject_test_progress();");

    const completed = await recordAttempt({
        studentId: 3, roundId: round.round_id, attemptId: finalAttempt, claimToken: finalClaim.claim_token
    });
    assert.equal(completed.status, "completed");
    assert.equal(completed.next_index, 26);
    assert.equal(completed.challenge_complete, true);
    assert.equal(completed.reward_granted, true);
    assert.equal((await scalar("select count(*)::int count from public.speaking_challenge_question_progress where student_id=3 and status='completed'")).count, 26);
    assert.deepEqual(
        await scalar("select total_xp, points_balance from public.student_gamification_balances where student_id=3"),
        { total_xp: 30, points_balance: 3 }
    );

    const replay = await recordAttempt({
        studentId: 3, roundId: round.round_id, attemptId: finalAttempt, claimToken: finalClaim.claim_token
    });
    assert.equal(replay.status, "completed");
    assert.equal((await scalar("select count(*)::int count from public.student_gamification_ledger where student_id=3")).count, 1);
});

test("錯學生、錯題序與到期回合 fail closed，且不會把回合誤標 failed", async () => {
    const round = await startRound(4);
    assert.equal((await claimQuestion(5, round.round_id, ids[0])).status, "invalid");
    assert.equal((await claimQuestion(4, round.round_id, ids[1])).status, "invalid");
    const claim = await claimQuestion(4, round.round_id, ids[0]);
    const wrongQuestionAttempt = await saveAttempt({
        studentId: 4, roundId: round.round_id, claimToken: claim.claim_token,
        questionId: ids[1], answerMatch: true
    });
    await assert.rejects(
        recordAttempt({ studentId: 4, roundId: round.round_id, attemptId: wrongQuestionAttempt, claimToken: claim.claim_token }),
        /FOUNDATION_ROUND_ATTEMPT_OUT_OF_ORDER/
    );
    assert.deepEqual(await scalar(`select status, next_index from public.speaking_foundation_rounds where id='${round.round_id}'`), {
        status: "open",
        next_index: 0
    });
    assert.equal(await releaseClaim(4, round.round_id, claim.claim_token), true);

    await db.query(`update public.speaking_foundation_rounds
        set started_at=now()-interval '1 hour', expires_at=now()-interval '1 second'
        where id=$1::uuid`, [round.round_id]);
    assert.equal((await claimQuestion(4, round.round_id, ids[0])).status, "expired");
    assert.deepEqual(await scalar(`select status, next_index from public.speaking_foundation_rounds where id='${round.round_id}'`), {
        status: "expired",
        next_index: 0
    });
});

test("沒有進行中 claim 時重開只保留一個 open round，過期 claim 可安全換新 token", async () => {
    const firstRound = await startRound(5);
    const replacementRound = await startRound(5);
    assert.notEqual(replacementRound.round_id, firstRound.round_id);
    assert.deepEqual(await scalar(`select
        count(*) filter (where status='open')::int open_count,
        count(*) filter (where status='expired')::int expired_count
        from public.speaking_foundation_rounds where student_id=5`), {
        open_count: 1,
        expired_count: 1
    });

    const staleClaim = await claimQuestion(5, replacementRound.round_id, ids[0]);
    await db.query(`update public.speaking_foundation_rounds
        set active_claimed_at=now()-interval '3 minutes',
            active_claim_expires_at=now()-interval '1 minute'
        where id=$1::uuid`, [replacementRound.round_id]);
    const renewedClaim = await claimQuestion(5, replacementRound.round_id, ids[0]);
    assert.equal(renewedClaim.status, "claimed");
    assert.notEqual(renewedClaim.claim_token, staleClaim.claim_token);
    assert.equal(await releaseClaim(5, replacementRound.round_id, staleClaim.claim_token), false);
    assert.equal(await releaseClaim(5, replacementRound.round_id, renewedClaim.claim_token), true);
});

test("錯誤起始題序與中途題庫版本變更都拒絕，且不誤完成 round", async () => {
    await assert.rejects(
        scalar(`select public.start_speaking_foundation_round_v1(
            6, 10, 1, array[${Array.from({ length: 26 }, () => ids[0]).join(",")}]::bigint[]
        ) result`),
        /FOUNDATION_ROUND_QUESTION_MISMATCH/
    );

    const round = await startRound(6);
    const claim = await claimQuestion(6, round.round_id, ids[0]);
    const attemptId = await saveAttempt({
        studentId: 6, roundId: round.round_id, claimToken: claim.claim_token,
        questionId: ids[0], answerMatch: true
    });
    await db.exec("update public.speaking_question_sets set version=2 where id=10");
    await assert.rejects(
        recordAttempt({ studentId: 6, roundId: round.round_id, attemptId, claimToken: claim.claim_token }),
        /FOUNDATION_SET_CHANGED/
    );
    assert.deepEqual(await scalar(`select status, next_index from public.speaking_foundation_rounds where id='${round.round_id}'`), {
        status: "open",
        next_index: 0
    });
    await db.exec("update public.speaking_question_sets set version=1 where id=10");
    assert.equal(await releaseClaim(6, round.round_id, claim.claim_token), true);
});

test("付費評分 attempt 與 round 推進使用單一交易，round 失敗不留下孤立 attempt", async () => {
    const round = await startRound(7);
    const claim = await claimQuestion(7, round.round_id, ids[0]);
    const beforeCount = (await scalar("select count(*)::int count from public.speaking_pronunciation_attempts where student_id=7")).count;
    await db.exec("update public.speaking_question_sets set version=2 where id=10");
    await assert.rejects(
        recordAssessment({
            studentId: 7,
            roundId: round.round_id,
            claimToken: claim.claim_token,
            questionId: ids[0],
            answerMatch: true
        }),
        /FOUNDATION_SET_CHANGED/
    );
    assert.equal(
        (await scalar("select count(*)::int count from public.speaking_pronunciation_attempts where student_id=7")).count,
        beforeCount
    );
    assert.deepEqual(await scalar(`select status, next_index from public.speaking_foundation_rounds where id='${round.round_id}'`), {
        status: "open",
        next_index: 0
    });
    await db.exec("update public.speaking_question_sets set version=1 where id=10");
    const completedStep = await recordAssessment({
        studentId: 7,
        roundId: round.round_id,
        claimToken: claim.claim_token,
        questionId: ids[0],
        answerMatch: true,
        pronunciationScore: 88.123
    });
    assert.equal(completedStep.status, "open");
    assert.equal(completedStep.next_index, 1);
    assert.equal(Number.isInteger(Number(completedStep.attempt_id)), true);

    const afterFirstCount = (await scalar("select count(*)::int count from public.speaking_pronunciation_attempts where student_id=7")).count;
    const replayedStep = await recordAssessment({
        studentId: 7,
        roundId: round.round_id,
        claimToken: claim.claim_token,
        questionId: ids[0],
        answerMatch: true,
        pronunciationScore: 88.123
    });
    assert.equal(replayedStep.attempt_id, completedStep.attempt_id);
    assert.equal(replayedStep.status, "open");
    assert.equal(replayedStep.next_index, 1);
    assert.equal(
        (await scalar("select count(*)::int count from public.speaking_pronunciation_attempts where student_id=7")).count,
        afterFirstCount
    );

    await assert.rejects(
        recordAssessment({
            studentId: 7,
            roundId: round.round_id,
            claimToken: claim.claim_token,
            questionId: ids[0],
            answerMatch: false
        }),
        /FOUNDATION_ASSESSMENT_REPLAY_MISMATCH/
    );
    await assert.rejects(
        recordAssessment({
            studentId: 7,
            roundId: round.round_id,
            claimToken: claim.claim_token,
            questionId: ids[0],
            answerMatch: true,
            pronunciationScore: 87
        }),
        /FOUNDATION_ASSESSMENT_REPLAY_MISMATCH/
    );
    await assert.rejects(
        recordAssessment({
            studentId: 7,
            roundId: round.round_id,
            claimToken: claim.claim_token,
            questionId: ids[0],
            answerMatch: true,
            recognizedText: "different answer"
        }),
        /FOUNDATION_ASSESSMENT_REPLAY_MISMATCH/
    );
    await assert.rejects(
        recordAssessment({
            studentId: 7,
            roundId: round.round_id,
            claimToken: claim.claim_token,
            questionId: ids[0],
            answerMatch: true,
            wordResults: [{ word: "different" }]
        }),
        /FOUNDATION_ASSESSMENT_REPLAY_MISMATCH/
    );
    await assert.rejects(
        recordAssessment({
            studentId: 7,
            roundId: "00000000-0000-4000-8000-000000000007",
            claimToken: "00000000-0000-4000-8000-000000000008",
            questionId: ids[0],
            answerMatch: true
        }),
        /FOUNDATION_ROUND_NOT_FOUND/
    );
});

test("新 table 與五個 round RPC 只開放 service_role", async () => {
    for (const role of ["anon", "authenticated"]) {
        const permissions = await scalar(`select
            has_table_privilege($1, 'public.speaking_foundation_rounds', 'SELECT') can_read,
            has_function_privilege($1, 'public.start_speaking_foundation_round_v1(bigint,bigint,integer,bigint[])', 'EXECUTE') can_start,
            has_function_privilege($1, 'public.claim_speaking_foundation_round_question_v1(bigint,uuid,bigint)', 'EXECUTE') can_claim,
            has_function_privilege($1, 'public.release_speaking_foundation_round_claim_v1(bigint,uuid,uuid)', 'EXECUTE') can_release,
            has_function_privilege($1, 'public.record_speaking_foundation_round_attempt_v1(bigint,uuid,bigint,uuid)', 'EXECUTE') can_record,
            has_function_privilege($1, 'public.record_speaking_foundation_assessment_v1(bigint,uuid,bigint,uuid,numeric,numeric,numeric,numeric,numeric,text,jsonb,boolean)', 'EXECUTE') can_assess`, [role]);
        assert.deepEqual(permissions, {
            can_read: false,
            can_start: false,
            can_claim: false,
            can_release: false,
            can_record: false,
            can_assess: false
        });
    }
    assert.equal((await scalar("select relrowsecurity enabled from pg_class where relname='speaking_foundation_rounds'")).enabled, true);
});


test("本機完整度保存 null 發音維度且標記來源；A–Z 仍按 claim 冪等", async () => {
    await db.exec("insert into public.students(id) values (91)");
    const round = await startRound(91);
    const claim = await claimQuestion(91, round.round_id, ids[0]);
    const args = {version:"v2",studentId:91,roundId:round.round_id,claimToken:claim.claim_token,questionId:ids[0],answerMatch:true,pronunciationScore:null,accuracyScore:null,fluencyScore:null,prosodyScore:null,completenessScore:100,recognizedText:"A"};
    const result = await recordAssessment(args);
    const replay = await recordAssessment(args);
    assert.equal(result.attempt_id,replay.attempt_id);
    const saved = await scalar("select assessment_kind,pronunciation_score,completeness_score from public.speaking_pronunciation_attempts where id=$1",[result.attempt_id]);
    assert.equal(saved.assessment_kind,"local_completeness_v1"); assert.equal(saved.pronunciation_score,null); assert.equal(Number(saved.completeness_score),100);
});
test("本機請求每天十輪、第十一輪拒絕，同輪只算一次，公開角色不能讀寫", async () => {
    await db.exec("insert into public.students(id) values (92)");
    const reserve = async session => (await scalar("select public.reserve_speaking_local_request_v1(92,10,1001,'alphabet_round',$1::uuid) result",[session])).result;
    const first = "00000000-0000-4000-8000-000000000001";
    assert.equal((await reserve(first)).challenge_usage.daily_used,1);
    assert.equal((await reserve(first)).challenge_usage.daily_used,1);
    for(let i=2;i<=10;i++) assert.equal((await reserve("00000000-0000-4000-8000-"+String(i).padStart(12,"0"))).allowed,true);
    const blocked = await reserve("00000000-0000-4000-8000-000000000011");
    assert.equal(blocked.code,"speaking_daily_limit_reached");
    assert.equal(blocked.daily_limit,10);
    assert.equal((await reserve(first)).allowed,true);
    assert.equal((await scalar("select count(*)::int n from public.speaking_challenge_sessions where student_id=92")).n,10);
    assert.equal((await scalar("select count(*)::int n from public.speaking_local_reading_requests where student_id=92")).n,12);
    await db.exec("set role anon");
    try { await assert.rejects(db.query("select * from public.speaking_local_reading_requests"),/permission denied/); }
    finally { await db.exec("reset role"); }
    assert.equal((await scalar("select has_function_privilege('authenticated','public.reserve_speaking_local_request_v1(bigint,bigint,bigint,text,uuid)','EXECUTE') allowed")).allowed,false);
});

test("A–Z 基本 Azure 沒有個人月額度及 160 次日上限；只計 Azure 秒數，prosody 未測量", async () => {
    await db.exec("insert into public.students(id) values(93)");
    const reserve=async()=> (await scalar("select public.reserve_speaking_azure_alphabet_request_v1(93,10,1001,3,'00000000-0000-4000-8000-000000000001') result")).result;
    const first=await reserve();assert.equal(first.allowed,true);
    assert.equal(first.challenge_usage.daily_limit,10);
    await db.exec("update public.speaking_audio_budget_policy set student_monthly_seconds=1,global_monthly_seconds=1");
    assert.equal((await reserve()).allowed,true);
    await db.exec("update public.speaking_pronunciation_requests set created_at=now()-interval '1 hour' where student_id=93");
    assert.equal((await reserve()).allowed,true);
    assert.equal((await reserve()).code,'alphabet_letter_daily_limit_reached');
    await db.exec("update public.speaking_pronunciation_requests set created_at=now()-interval '2 days' where student_id=93");
    assert.equal((await reserve()).allowed,true);
    const usage=(await scalar("select public.speaking_alphabet_cost_usage_v1() result")).result;
    assert.ok(Number(usage.reserved_seconds)>=3);
    await assert.rejects(db.query("select public.reserve_speaking_azure_alphabet_request_v1(93,10,1001,13,null)"),/INVALID_ALPHABET_REQUEST/);
    for(const role of ['anon','authenticated'])assert.equal((await scalar("select has_function_privilege($1,'public.speaking_alphabet_cost_usage_v1()','EXECUTE') allowed",[role])).allowed,false);
    const round=await startRound(93),claim=await claimQuestion(93,round.round_id,ids[0]);
    const recorded=await recordAssessment({version:'v2',studentId:93,roundId:round.round_id,claimToken:claim.claim_token,questionId:ids[0],answerMatch:true,prosodyScore:null});
    assert.equal((await scalar("select assessment_kind from public.speaking_pronunciation_attempts where id=$1",[recorded.attempt_id])).assessment_kind,'azure_pronunciation');
});
