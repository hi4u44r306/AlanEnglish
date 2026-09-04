import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260903152751_textbook_speaking_question_bank.sql");
const ocrMigration = read("supabase/migrations/20260904005001_textbook_speaking_ocr_pipeline.sql");
const manager = read("supabase/functions/speaking-content-manager/index.ts");
const service = read("src/services/speakingContentService.js");
const adminPage = read("src/components/Pages/SpeakingContentAdmin.jsx");
const app = read("src/app/App.jsx");

test("1. 教材來源、版本題庫、題目與生成工作都有 additive schema", () => {
    for (const table of ["speaking_source_documents", "speaking_source_sections", "speaking_question_sets", "speaking_questions", "speaking_generation_jobs"]) {
        assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
    }
    assert.match(migration, /speaking_question_sets_unique_version/);
    assert.match(migration, /request_key uuid not null/);
});

test("2. 新資料表不允許前端直接存取，只能由驗證後端處理", () => {
    assert.match(migration, /enable row level security/g);
    assert.match(migration, /revoke all on table public\.speaking_questions from public, anon, authenticated/);
    assert.match(migration, /grant select, insert, update, delete on table public\.speaking_questions to service_role/);
    assert.match(manager, /verifyFirebaseRequest/);
    assert.match(manager, /只有管理員可以管理教材口說題庫/);
});

test("3. AI 只能使用人工核准教材來源且永遠先產生草稿", () => {
    assert.match(manager, /body\?\.confirmed !== true/);
    assert.match(manager, /section\.status !== "reviewed"/);
    assert.match(manager, /只能根據下方老師已核准的教材文字/);
    assert.match(manager, /status: "draft"/);
    assert.match(manager, /publish_question_set/);
    assert.match(manager, /只有草稿題庫可以修改/);
});

test("4. 題庫包含問題、提示、關鍵字、兩種回答與發音提示", () => {
    for (const field of ["question_text", "hint_zh", "keywords", "simple_answer", "model_answer", "follow_up_question", "pronunciation_notes_zh", "accepted_intents"]) {
        assert.match(migration, new RegExp(`${field}`));
        assert.match(adminPage, new RegExp(`${field}`));
    }
});

test("5. 管理頁透過指定 Edge Function 並有受保護管理員路由", () => {
    assert.match(service, /speaking-content-manager/);
    assert.match(adminPage, /教材 AI 口說題庫/);
    assert.match(adminPage, /人工核對/);
    assert.match(app, /path="\/admin\/speaking-content"/);
    assert.match(app, /allowedRoles=\{\["admin"\]\}/);
});

test("6. PDF 與圖片採私人 R2 直傳並在後端重新驗證", () => {
    assert.match(manager, /createR2PresignedUrl/);
    assert.match(manager, /fetchR2\(document\.private_object_key, \{ method: "HEAD" \}\)/);
    assert.match(manager, /MAX_SOURCE_FILE_BYTES = 20 \* 1024 \* 1024/);
    assert.match(manager, /application\/pdf/);
    assert.match(manager, /image\/webp/);
    assert.match(ocrMigration, /byte_size bigint/);
    assert.match(ocrMigration, /Private Cloudflare R2 object key/);
    assert.doesNotMatch(manager, /public_object_url/);
});

test("7. OCR 文字必須人工核准，OpenAI 暫存檔會刪除", () => {
    assert.match(manager, /ocr_status: "review_required"/);
    assert.match(manager, /review_ocr_source/);
    assert.match(manager, /document\?\.ocr_status !== "review_required"/);
    assert.match(manager, /status: "reviewed"/);
    assert.match(manager, /method: "DELETE"/);
    assert.match(manager, /store: false/);
    assert.match(adminPage, /核准 OCR 教材文字/);
});
