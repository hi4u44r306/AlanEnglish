import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260903152751_textbook_speaking_question_bank.sql");
const ocrMigration = read("supabase/migrations/20260904005001_textbook_speaking_ocr_pipeline.sql");
const batchMigration = read("supabase/migrations/20260904021540_speaking_whole_book_ocr_batches.sql");
const wholeBookSizeMigration = read("supabase/migrations/20260904030633_allow_whole_book_document_size.sql");
const manager = read("supabase/functions/speaking-content-manager/index.ts");
const ttsManager = read("supabase/functions/speaking-tts-manager/index.ts");
const challenge = read("supabase/functions/speaking-challenge/index.ts");
const voiceAssignment = read("supabase/functions/_shared/speaking-voice-assignment.ts");
const foundationTemplates = read("supabase/functions/_shared/workbook-one-foundations.ts");
const foundationAnswers = read("supabase/functions/_shared/speaking-foundation-answer.ts");
const bookEntitlement = read("supabase/functions/_shared/book-entitlement.ts");
const visualAssetMigration = read("supabase/migrations/20260912143926_workbook1_speaking_visual_assets.sql");
const foundationUniquenessMigration = read("supabase/migrations/20260913113000_workbook1_foundation_template_uniqueness.sql");
const pronunciationLedgerMigration = read("supabase/migrations/20260913013037_speaking_pronunciation_request_ledger.sql");
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

test("8. 整本 PDF 會建立可續跑的十頁批次與私人檔案狀態", () => {
    assert.match(batchMigration, /create table if not exists public\.speaking_source_chunks/);
    assert.match(batchMigration, /unique \(document_id, chunk_index\)/);
    assert.match(batchMigration, /enable row level security/);
    assert.match(batchMigration, /revoke all on table public\.speaking_source_chunks from public, anon, authenticated/);
    assert.match(manager, /WHOLE_BOOK_CHUNK_PAGES = 10/);
    assert.match(manager, /MAX_WHOLE_BOOK_BYTES = 100 \* 1024 \* 1024/);
    assert.match(manager, /create_book_upload/);
    assert.match(manager, /confirm_book_upload/);
    assert.match(manager, /extract_book_chunk/);
});

test("9. 管理員可查看整本進度、逐批重試並逐批人工核准", () => {
    assert.match(adminPage, /整本教材分批辨識/);
    assert.match(adminPage, /繼續批次 OCR/);
    assert.match(adminPage, /單獨重試/);
    assert.match(adminPage, /逐批校正並核准/);
    assert.match(manager, /status: "failed"/);
    assert.match(manager, /status: "completed"/);
});

test("10. 單一來源維持 20MB，只有整本分批原檔可放寬到 100MB", () => {
    assert.match(wholeBookSizeMigration, /when chunk_count is null then 20971520/);
    assert.match(wholeBookSizeMigration, /else 104857600/);
    assert.match(wholeBookSizeMigration, /drop constraint if exists speaking_source_documents_byte_size_check/);
    assert.match(manager, /code === "23514"/);
    assert.match(manager, /單一來源上限 20MB，整本分批 PDF 上限 100MB/);
});

test("11. Workbook 1 人工範例不呼叫付費 AI，仍需草稿預覽與管理員發布", () => {
    assert.match(manager, /create_workbook_1_starter/);
    assert.match(manager, /workbook_1_name_intro_v1/);
    assert.match(manager, /source: "curated_template"/);
    assert.match(manager, /status: "draft"/);
    assert.match(service, /createWorkbookOneStarterQuestionSet/);
    assert.match(adminPage, /不執行 OCR，也不呼叫付費 AI/);
    assert.match(adminPage, /預覽學生畫面/);
    assert.match(adminPage, /核准、發布並產生語音/);
});

test("12. Workbook 2 精選大關卡依教師版內容建立，仍需管理員預覽發布", () => {
    assert.match(manager, /create_workbook_2_starter/);
    assert.match(manager, /workbook_2_origin_places_v1/);
    assert.match(manager, /Where are you from\?/);
    assert.match(manager, /They come from Australia\./);
    assert.match(service, /createWorkbookTwoStarterQuestionSet/);
    assert.match(adminPage, /建立 Workbook 2「我來自哪裡？」/);
    assert.match(adminPage, /不執行 OCR，也不呼叫付費 AI/);
});

test("13. 示範語音固定男女聲交錯並可由管理員安全預覽", () => {
    assert.match(voiceAssignment, /en-US-Chirp3-HD-Autonoe/);
    assert.match(voiceAssignment, /en-US-Chirp3-HD-Puck/);
    assert.match(voiceAssignment, /questionSetId.*sortOrder/s);
    assert.match(ttsManager, /preview_question_audio/);
    assert.match(ttsManager, /createR2PresignedUrl\(asset\.private_object_key, "GET", 15 \* 60\)/);
    assert.match(service, /getSpeakingQuestionAudioPreview/);
    assert.match(adminPage, /女聲 · Autonoe/);
    assert.match(adminPage, /男聲 · Puck/);
});

test("14. 學生題目回傳視覺提示且保留正式口說流程", () => {
    assert.match(challenge, /pronunciation_notes_zh,visual_aid,sort_order/);
    assert.match(challenge, /demoMode/);
    assert.match(challenge, /question_prompt/);
    assert.match(challenge, /model_answer/);
    assert.match(challenge, /complete_speaking_challenge_question_v2/);
});

test("15. Workbook 1 基礎關卡只建立草稿，P14～P17 必須逐字符合已發布正式來源", () => {
    for (const action of [
        "create_workbook_1_alphabet_round",
        "create_workbook_1_spelling_p14",
        "create_workbook_1_spelling_p15",
        "create_workbook_1_spelling_p16",
        "create_workbook_1_spelling_p17"
    ]) assert.match(foundationTemplates, new RegExp(action));
    assert.match(foundationTemplates, /questions: alphabet\.map\(letterQuestion\)/);
    assert.match(foundationTemplates, /approvedSourcePageLabel: `P\$\{page\}`/);
    assert.match(foundationTemplates, /sourceRequiresReview: false/);
    assert.match(foundationTemplates, /brand_review_completed: true/);
    assert.doesNotMatch(foundationTemplates, /"thirteen"/);
    assert.match(manager, /book_page_spiral_review_content/);
    assert.match(manager, /approvedPrompts\.length === templatePrompts\.length/);
    assert.match(manager, /正式核准單字與內建草稿不一致/);
    assert.match(manager, /approved_source: approvedSource/);
    assert.match(manager, /validateApprovedFoundationSet/);
    assert.match(manager, /現有題庫已過期或與正式核准內容不一致/);
    assert.match(manager, /題庫已過期或與最新正式核准內容不一致/);
    assert.match(manager, /P14～P17 題庫由正式核准來源鎖定/);
    assert.match(manager, /不能使用舊人工核准流程/);
    assert.match(manager, /confirm_workbook_1_foundation_source/);
    assert.match(manager, /content_reviewed_at/);
    assert.match(manager, /if \(!reviewedSection\) return json\(409/);
    assert.match(manager, /if \(!reviewedSet\) return json\(409/);
    assert.match(manager, /speaking_source_sections!inner\(status\)/);
    assert.match(manager, /content_reviewed_at: null/);
    assert.match(manager, /reviewed_at: null/);
    assert.match(manager, /questionIds\.length !== 26/);
    assert.match(manager, /A–Z 的 26 個標準發音尚未全部完成/);
    assert.match(foundationUniquenessMigration, /speaking_question_sets_foundation_template_active_unique/);
    assert.match(foundationUniquenessMigration, /workbook_1_p17_letter_spelling_v1/);
    assert.match(ttsManager, /mayPrepareAlphabetDraft/);
    assert.match(ttsManager, /questions\.slice\(0, 50\)/);
    assert.match(service, /createWorkbookOneFoundationQuestionSet/);
    assert.match(adminPage, /已對照原頁，核准內容/);
});

test("16. 字母與逐字拼讀由後端精確核對，完成紀錄不能由前端直接偽造", () => {
    assert.match(foundationAnswers, /alphabet_round/);
    assert.match(foundationAnswers, /letter_spelling/);
    assert.match(foundationAnswers, /spoken\.length !== expected\.length/);
    assert.match(challenge, /speaking_pronunciation_attempts/);
    assert.match(challenge, /correct_assessment_required/);
    assert.match(challenge, /matchesFoundationAnswer/);
    const coach = read("supabase/functions/pronunciation-coach/index.ts");
    assert.match(coach, /matchesFoundationAnswer/);
    assert.match(coach, /reserveProviderRequest/);
    assert.match(pronunciationLedgerMigration, /v_daily_count >= 160/);
    assert.match(coach, /foundationRetryFeedback/);
});

test("17. P21／P22 圖片、完整答案與逐字語音只由驗證後端讀取", () => {
    for (const table of [
        "speaking_visual_assets",
        "speaking_question_visual_assets",
        "speaking_question_interactions",
        "speaking_question_word_audio"
    ]) {
        assert.match(visualAssetMigration, new RegExp(`create table if not exists public\\.${table}`));
        assert.match(visualAssetMigration, new RegExp(`alter table public\\.${table} enable row level security`));
        assert.match(visualAssetMigration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
        assert.match(visualAssetMigration, new RegExp(`grant select, insert, update, delete on table public\\.${table} to service_role`));
    }
    assert.match(visualAssetMigration, /image\/jpeg.*image\/png.*image\/webp/s);
    assert.match(visualAssetMigration, /byte_size between 1 and 10485760/);
    assert.match(visualAssetMigration, /speaking_question_sets_picture_template_active_unique/);
    assert.match(manager, /speaking_question_visual_assets/);
    assert.match(manager, /speaking_question_word_audio/);
    assert.match(manager, /create_workbook_1_picture_draft/);
    assert.match(manager, /pictureGapAnswerMatchesPrompt/);
    assert.match(manager, /pictureQaResponseHasQuestionAndAnswer/);
    assert.match(manager, /acceptedResponsesValid/);
    assert.match(manager, /P21／P22 圖片題庫的顯示內容與後端完整答案必須同步/);
    assert.match(manager, /createdQuestionSetId/);
    assert.match(manager, /create_picture_upload/);
    assert.match(manager, /confirm_picture_upload/);
    assert.match(manager, /discard_workbook_1_picture_draft/);
    assert.match(manager, /manual_picture_manifest/);
    assert.match(manager, /source_document_id: Number\(sourceSection\.document_id\)/);
    assert.match(manager, /hasExpectedSignature\(signatureBytes, asset\.mime_type\)/);
    assert.match(manager, /visualAidByQuestion/);
    assert.match(manager, /image_url: await createR2PresignedUrl\(asset\.private_object_key, "GET", 15 \* 60\)/);
    assert.match(ttsManager, /generate_visible_word_audio/);
    assert.match(ttsManager, /visibleSentenceWords/);
    assert.match(ttsManager, /status !== "ready" && item\.status !== "failed"/);
    assert.match(service, /uploadSpeakingQuestionPicture/);
    assert.match(adminPage, /WorkbookOnePictureContentAdmin/);
    assert.match(challenge, /圖片口說題目尚未完成安全發布/);
    assert.match(challenge, /P22 的可見單字發音尚未完整/);
    assert.match(challenge, /kind: "private-image"/);
    assert.match(challenge, /createR2PresignedUrl\(visualAsset\.private_object_key, "GET", 15 \* 60\)/);
    assert.match(challenge, /question_text: ""/);
    assert.match(challenge, /model_answer: ""/);
    assert.match(challenge, /correct_assessment_required/);
    assert.doesNotMatch(challenge, /private_object_key:/);
});

test("18. P21 必須說完整問答，P22 必須說含圖片答案的完整句子", () => {
    assert.match(foundationAnswers, /picture_qa/);
    assert.match(foundationAnswers, /picture_gap_sentence/);
    assert.match(foundationAnswers, /accepted\.includes\(spoken\)/);
    assert.match(challenge, /`\$\{pictureInteraction\.prompt_text\} \$\{pictureInteraction\.answer_text\}`/);
    const coach = read("supabase/functions/pronunciation-coach/index.ts");
    assert.match(coach, /pictureInteraction\.prompt_text/);
    assert.match(coach, /pictureInteraction\.answer_text/);
    assert.match(coach, /reference_text: question\.interactionType \? null/);
});

test("19. 學生只能讀取及評分已取得教材，付費 Speech 請求先原子保留額度", () => {
    assert.match(challenge, /_shared\/book-entitlement\.ts/);
    assert.match(challenge, /isBookEntitled/);
    assert.match(challenge, /assertBookEntitled/);
    assert.match(bookEntitlement, /book_entitlement_required/);
    const coach = read("supabase/functions/pronunciation-coach/index.ts");
    assert.match(coach, /assertBookEntitled/);
    assert.ok(coach.indexOf("await assertBookEntitled") < coach.indexOf('.select("model_answer,pronunciation_notes_zh")'));
    assert.match(coach, /reserve_speaking_pronunciation_request/);
    assert.match(coach, /finishProviderRequest/);
    assert.match(coach, /\.select\("id"\)\.maybeSingle\(\)/);
    assert.match(coach, /"internal_failed"/);
    assert.ok(challenge.indexOf("await assertBookEntitled") < challenge.indexOf("const { data: setQuestions"));
    assert.match(pronunciationLedgerMigration, /pg_advisory_xact_lock/);
    assert.match(pronunciationLedgerMigration, /speaking_pronunciation_requests_student_created_idx/);
    assert.match(pronunciationLedgerMigration, /status in \('reserved', 'completed', 'provider_failed', 'unassessable', 'internal_failed'\)/);
    assert.match(pronunciationLedgerMigration, /security invoker/);
    assert.doesNotMatch(pronunciationLedgerMigration, /security definer/);
    assert.match(pronunciationLedgerMigration, /revoke all on table public\.speaking_pronunciation_requests from public, anon, authenticated/);
    assert.match(pronunciationLedgerMigration, /grant execute on function public\.reserve_speaking_pronunciation_request/);
    assert.match(pronunciationLedgerMigration, /Raw microphone audio is never stored/);
});
