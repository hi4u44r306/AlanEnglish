import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("migration keeps spiral review private and records idempotent attempts", async () => {
    const sql = await read("supabase/migrations/20260911013350_spiral_review_stage1.sql");
    for (const table of ["spiral_review_units", "spiral_review_cards", "spiral_review_assignments", "student_spiral_review_progress", "student_spiral_review_attempts"]) {
        assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
        assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, "i"));
    }
    assert.match(sql, /unique \(student_id, request_key\)/i);
    assert.match(sql, /pg_advisory_xact_lock/i);
    assert.match(sql, /v_next_date := v_today \+ 1/i);
    assert.match(sql, /ae\.status = 'active'/i);
});

test("edge function verifies identity and teacher class permissions", async () => {
    const source = await read("supabase/functions/spiral-review/index.ts");
    assert.match(source, /verifyFirebaseRequest\(req, admin\)/);
    assert.match(source, /teacher_class_permissions/);
    assert.match(source, /academy_class_material_settings/);
    assert.match(source, /action === "preview_cards"/);
    assert.match(source, /book_page_spiral_review_content/);
    assert.match(source, /\.eq\("status", "published"\)/);
    assert.match(source, /PAGE_SOURCE_MISSING/);
    assert.match(source, /missingPages\.length/);
    assert.equal(source.includes("_{2,}"), true);
    assert.doesNotMatch(source, /book_page_learning_content/);
    assert.match(source, /Array\.isArray\(row\.pronunciation_prompts\)/);
    assert.match(source, /這本教材不在目標班級目前生效的教材設定中/);
    assert.match(source, /cards\.length < 6 \|\| cards\.length > 80/);
    assert.match(source, /submit_spiral_review_answer/);
    assert.doesNotMatch(source, /body\.role|body\.student_id|body\.learner_type/);
});

test("Workbook 1 seed covers every student-edition page and excludes unsafe prompts", async () => {
    const sql = await read("supabase/migrations/20260911093000_workbook1_page_learning_content.sql");
    assert.match(sql, /generate_series\(1, 119\)/i);
    assert.match(sql, /create table if not exists public\.book_page_spiral_review_content/i);
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /revoke all on table public\.book_page_spiral_review_content from public, anon, authenticated/i);
    assert.match(sql, /where book\.code = 'Workbook_1'/i);
    assert.match(sql, /pronunciation_prompts/i);
    assert.match(sql, /Baby Shark/i);
    assert.match(sql, /歌曲頁不建立自動字卡/);
    assert.match(sql, /\(51, 'I am 句型'/);
    assert.match(sql, /\(117, '總複習一'/);
    assert.match(sql, /page in \(9, 25, 38, 62, 68, 86, 98, 116\)/);
    assert.doesNotMatch(sql, /\(116, '總複習/);
    assert.doesNotMatch(sql, /Baby Shark[^\n]*jsonb_build_array/i);
    assert.match(sql, /jsonb_array_length\(pronunciation_prompts\) >= 6/i);
});

test("student queue uses five to six shuffled choices", async () => {
    const source = await read("supabase/functions/spiral-review/index.ts");
    assert.match(source, /slice\(0, 5\)/);
    assert.match(source, /distractors\.length < 4/);
    assert.match(source, /choices: shuffle\(\[card, \.\.\.distractors\]\)/);
    assert.match(source, /spiral_review_units\.status.*published/);
});
