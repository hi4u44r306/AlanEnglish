import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260903114141_academy_all_access_assignment_v2.sql");
const effectiveAccess = read("supabase/functions/_shared/effective-access.ts");
const generator = read("supabase/functions/generate-ai-material/index.ts");
const pronunciation = read("supabase/functions/pronunciation-coach/index.ts");
const gamification = read("supabase/functions/gamification/index.ts");
const billing = read("supabase/functions/billing-manager/index.ts");
const membership = read("supabase/functions/membership-manager/index.ts");
const assignmentManager = read("supabase/functions/assignment-manager/index.ts");
const assignmentService = read("src/services/assignmentService.js");
const teacherAssignments = read("src/components/Pages/TeacherAssignments.jsx");
const pronunciationPage = read("src/components/Pages/PronunciationCoach.jsx");
const navbar = read("src/components/fragment/MainNavbar.jsx");
const plan = read("docs/ASSIGNMENT_V2_PLAN.md");

test("1. 在校方案包含全部正式聽力、AI、發音與班級作業", () => {
    assert.match(migration, /where code = 'academy_internal'/);
    for (const feature of ["listening", "assignments", "ai_materials", "pronunciation"]) {
        assert.match(migration, new RegExp(`'${feature}', true`));
    }
    assert.match(migration, /'requires_book_entitlement', false/);
    assert.match(migration, /ai_daily_limit = 5/);
    assert.match(generator, /plan_codes\.includes\("academy_internal"\)/);
});

test("2. 教材包 90 天權限可聽全部正式教材，但不含 AI、發音與作業", () => {
    assert.match(migration, /where code = 'textbook_access'/);
    assert.match(migration, /購買教材附贈 90 天平台使用權/);
    assert.match(migration, /'requires_book_entitlement', false/);
    for (const feature of ["assignments", "ai_materials", "pronunciation"]) {
        assert.match(migration, new RegExp(`'${feature}', false`));
    }
});

test("3. 混合作業採版本化且由灰度旗標控制，不破壞舊作業", () => {
    assert.match(migration, /feature_key in \('listening_rewards_v2', 'assignment_v2'\)/);
    assert.match(migration, /add column if not exists schema_version smallint not null default 1/);
    assert.match(migration, /'multi_activity_v2'/);
    assert.match(migration, /schema_version = 2/);
    assert.match(plan, /舊版聽力作業/);
    assert.match(plan, /assignment_v2/);
});

test("4. 新作業可組合聽力、共用 AI 題組與發音練習", () => {
    assert.match(migration, /item_type in \('listening', 'ai_quiz', 'pronunciation'\)/);
    for (const table of [
        "book_page_learning_content",
        "assignment_items",
        "assignment_ai_items",
        "assignment_pronunciation_prompts",
        "student_assignment_item_progress",
        "assignment_pronunciation_attempts",
    ]) assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(migration, /question_snapshot jsonb not null/);
});

test("5. 頁碼 AI 必須有教師核准來源，不能只靠頁碼名稱生成", () => {
    assert.match(migration, /source_text text/);
    assert.match(migration, /status in \('draft', 'published', 'archived'\)/);
    assert.match(migration, /Page labels alone must never be used as AI source content/);
    assert.match(plan, /只有頁碼、沒有核准文字來源時/);
});

test("6. 發音作業限制評分次數，且只保存分數不保存原始錄音", () => {
    assert.match(migration, /max_scored_attempts integer not null default 3/);
    assert.match(migration, /max_scored_attempts between 1 and 5/);
    assert.match(migration, /completion_mode in \('practice', 'target_score'\)/);
    assert.match(migration, /Raw student audio is not stored/);
    assert.doesNotMatch(migration, /audio_(?:url|blob|path)/i);
});

test("7. 新表只由驗證身分的 Edge Function 經 service role 存取", () => {
    assert.match(migration, /enable row level security/);
    assert.match(migration, /revoke all on table public\.assignment_items from public, anon, authenticated/);
    assert.match(migration, /grant select, insert, update, delete on table public\.assignment_items to service_role/);
    assert.doesNotMatch(migration, /grant usage, select on all sequences in schema public/);
});

test("8. 發音權限獨立判斷並相容舊 AI 方案欄位", () => {
    assert.match(effectiveAccess, /pronunciation: boolean/);
    assert.match(effectiveAccess, /features\.pronunciation_practice/);
    assert.match(effectiveAccess, /features\.ai_materials/);
    assert.match(pronunciation, /features\.pronunciation/);
    assert.doesNotMatch(pronunciation, /features\.ai_materials/);
    assert.match(pronunciationPage, /features\?\.pronunciation/);
    assert.match(navbar, /hasPronunciationAccess/);
});

test("9. AI 目標價 299 在新 Stripe Price 完成前不先改資料庫價格", () => {
    assert.doesNotMatch(migration, /price_twd/);
    assert.match(plan, /目標 NT\$299/);
    assert.match(plan, /不得先改前端或資料庫顯示價格/);
});

test("10. 只有有效在校英文班學生可取得 AE Points 與兌換獎品", () => {
    assert.match(migration, /create or replace function private\.ae_student_can_earn_points/);
    assert.match(migration, /student\.learner_type = 'academy_student'/);
    assert.match(migration, /enrollment\.status = 'active'/);
    assert.match(migration, /v_effective_points_delta/);
    assert.match(migration, /if v_can_earn_points.*v_new_level > v_old_level/);
    assert.match(gamification, /code: "academy_rewards_required"/);
    assert.match(gamification, /points_added: 0/);
});

test("11. 在校生已包含 AI，不可從畫面或直接 API 重複購買", () => {
    assert.match(billing, /code: "academy_ai_already_included"/);
    assert.match(billing, /英文班在校方案已包含 AI 教材與發音練習/);
    assert.match(membership, /if \(hasActiveAcademyEnrollment\) return false/);
});

test("12. 老師以核准頁面來源預覽並建立不可變混合作業快照", () => {
    assert.match(assignmentManager, /action === "upsert_page_learning_content"/);
    assert.match(assignmentManager, /action === "preview_assignment_v2" \|\| action === "create_assignment_v2"/);
    assert.match(assignmentManager, /getPublishedPageContent/);
    assert.match(assignmentManager, /請先選擇目標教材中已發布且含核准文字的頁面來源/);
    assert.match(assignmentManager, /question_snapshot/);
    assert.match(assignmentManager, /assignment_pronunciation_prompts/);
    assert.match(assignmentManager, /assignment_v2_results_not_ready/);
    assert.match(assignmentService, /previewAssignmentV2/);
    assert.match(assignmentService, /createAssignmentV2/);
    assert.match(teacherAssignments, /混合作業 V2/);
    assert.match(teacherAssignments, /核對後發布頁面來源/);
});
