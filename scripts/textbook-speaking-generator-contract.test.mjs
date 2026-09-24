import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260903152751_textbook_speaking_question_bank.sql");
const ocrMigration = read("supabase/migrations/20260904005001_textbook_speaking_ocr_pipeline.sql");
const batchMigration = read("supabase/migrations/20260904021540_speaking_whole_book_ocr_batches.sql");
const wholeBookSizeMigration = read("supabase/migrations/20260921110000_allow_500mb_whole_book_source.sql");
const generationCountMigration = read("supabase/migrations/20260922012056_allow_30_speaking_generation_questions.sql");
const manager = read("supabase/functions/speaking-content-manager/index.ts");
const ttsManager = read("supabase/functions/speaking-tts-manager/index.ts");
const challenge = read("supabase/functions/speaking-challenge/index.ts");
const challengeView = read("supabase/functions/_shared/speaking-challenge-view.ts");
const voiceAssignment = read("supabase/functions/_shared/speaking-voice-assignment.ts");
const ttsText = read("supabase/functions/_shared/speaking-tts-text.ts");
const foundationTemplates = read("supabase/functions/_shared/workbook-one-foundations.ts");
const foundationAnswers = read("supabase/functions/_shared/speaking-foundation-answer.ts");
const pronunciationFlow = read("supabase/functions/_shared/speaking-pronunciation-flow.ts");
const bookEntitlement = read("supabase/functions/_shared/book-entitlement.ts");
const visualAssetMigration = read("supabase/migrations/20260912143926_workbook1_speaking_visual_assets.sql");
const pictureExtensionMigration = read("supabase/migrations/20260915054923_workbook1_p23_p24_picture_templates.sql");
const authoringRevisionMigration = read("supabase/migrations/20260916151037_speaking_authoring_revisions.sql");
const foundationUniquenessMigration = read("supabase/migrations/20260913113000_workbook1_foundation_template_uniqueness.sql");
const pronunciationLedgerMigration = read("supabase/migrations/20260913013037_speaking_pronunciation_request_ledger.sql");
const speakingCompletionMigration = read("supabase/migrations/20260907155832_speaking_challenge_completion_rewards.sql");
const foundationRoundMigration = read("supabase/migrations/20260913023814_speaking_foundation_round_sessions.sql");
const alphabetSequenceMigration = read("supabase/migrations/20260913170000_speaking_alphabet_audio_sequences.sql");
const alphabetSequenceClaimMigration = read("supabase/migrations/20260913173000_claim_speaking_alphabet_audio_sequence.sql");
const alphabetCandidateMigration = read("supabase/migrations/20260913180000_speaking_alphabet_audio_candidates.sql");
const alphabetSequence = read("supabase/functions/_shared/alphabet-audio-sequence.ts");
const alphabetMasterVoice = read("supabase/functions/_shared/alphabet-master-voice.ts");
const service = read("src/services/speakingContentService.js");
const adminPage = read("src/components/Pages/SpeakingContentAdmin.jsx");
const ocrPageMarkers = read("supabase/functions/_shared/speaking-ocr-page-markers.ts");
const app = read("src/app/App.jsx");
const challengeStyles = read("src/components/Pages/css/TextbookSpeakingChallenge.scss");
const foundationChallenge = read("src/components/Pages/WorkbookOneFoundationChallenge.jsx");
const pronunciationRecorder = read("src/components/Pages/SpeakingPronunciationRecorder.jsx");
const pronunciationRecorderStyles = read("src/components/Pages/css/SpeakingPronunciationRecorder.scss");

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
    assert.match(manager, /只能根據下方老師已核准的單頁教材文字/);
    assert.match(manager, /status: "draft"/);
    assert.match(manager, /publish_question_set/);
    assert.match(manager, /只有草稿題庫可以修改/);
});

test("3b. 單頁 AI 草稿由教材內容判斷 1 至 30 題並保留人工核准閘門", () => {
    assert.match(manager, /const autoQuestionCount = body\?\.auto_question_count === true/);
    assert.match(manager, /questions 可包含 1 至 30 題，題數必須反映這一頁的實際內容/);
    assert.match(manager, /source: "ai_page_auto"/);
    assert.match(manager, /detected_question_count: questions\.length/);
    assert.match(manager, /\["ocr_page_candidate", "ai_page_auto"\]\.includes\(metadata\?\.source\)/);
    assert.match(manager, /單頁手動或 AI 自動題庫至少 1 題才能發布/);
    assert.match(adminPage, /auto_question_count: true/);
    assert.match(adminPage, /AI 會依每頁實際可出題內容自動判斷題數/);
    assert.doesNotMatch(adminPage, /setQuestionCount/);
    assert.match(generationCountMigration, /requested_count between 1 and 30/);
    assert.match(manager, /generation_count_constraint_mismatch/);
});

test("3a. 逐頁 OCR 候選會排除同一教材現有的完整句，並保留來源供人工審核", () => {
    assert.match(manager, /const sentenceFingerprint =/);
    assert.match(manager, /findExistingSentenceMatches/);
    assert.match(manager, /\.eq\("book_id", bookId\)\.neq\("status", "archived"\)/);
    assert.match(manager, /all_questions_duplicate/);
    assert.match(manager, /duplicate_review: duplicateMatches\.length/);
    assert.match(manager, /excluded_duplicate_count: duplicateMatches\.length/);
    assert.match(adminPage, /已略過 \{duplicateReview\.excluded_count\} 題重複完整句/);
    assert.match(adminPage, /match\.source_page_label \|\| match\.title/);
});

test("3aa. 逐頁草稿只使用核准逐字稿中保留的頁碼，刪除草稿不刪 OCR 來源", () => {
    assert.match(manager, /const markedSourcePageLabels =/);
    assert.match(manager, /const eligiblePageCandidates = sectionPages\.length === 1 \? sectionPages : retainedMarkedPages/);
    assert.match(manager, /逐頁候選草稿只能使用核准逐字稿中實際保留的頁碼/);
    assert.match(manager, /source_preserved: true/);
    assert.match(adminPage, /const retainedPages = markedSourcePageLabels\(section\)/);
    assert.match(adminPage, /建立／重新產生 \$\{selectedPages\.length\} 頁草稿/);
    assert.match(adminPage, /查看已保留的核准逐字稿/);
    assert.match(adminPage, /OCR 逐字稿仍保留，可重新建立/);
});

test("3ab. 可指定頁碼重建未發布草稿，且新草稿成功前保留舊草稿", () => {
    assert.match(adminPage, /replace_question_set_id: existingByPage\.get\(page\)\?\.status === "draft"/);
    assert.match(adminPage, /已發布，不能由此直接覆蓋/);
    assert.match(adminPage, /新草稿完整建立成功後才會取代舊草稿/);
    assert.match(manager, /const replaceQuestionSetId =/);
    assert.match(manager, /linkedStudentRows\.some\(Boolean\)/);
    assert.match(manager, /filter\(questionSet => Number\(questionSet\.id\) !== replaceQuestionSetId\)/);
    assert.match(manager, /await removeReplacedDraft\(Number\(questionSet\.id\)\)/);
    assert.match(manager, /delete\(\)\.eq\("id", newQuestionSetId\)\.eq\("status", "draft"\)/);
});

test("3b. 同一 OCR 批次的逐頁草稿使用全來源遞增版號，並為無法自動出題頁保留人工補題草稿", () => {
    assert.match(manager, /const questionSetVersionContext = async/);
    assert.match(manager, /version: Number\(latestVersionResult\.data\?\.version \|\| 0\) \+ 1/);
    assert.match(manager, /previousSetId: previousPageResult\.data\?\.id \|\| null/);
    assert.match(manager, /manual_authoring_reason: "no_speakable_sentence"/);
    assert.match(manager, /manualAuthoringReason = "all_questions_duplicate"/);
    assert.match(manager, /questions\.length > 0/);
    assert.match(adminPage, /本次逐頁建立結果/);
    assert.match(adminPage, /打開補題/);
});

test("3c. 無圖片文字問答依題目線索限制性別，未指定時保留兩種完整答案", () => {
    assert.match(manager, /TEXT_QA_INTERACTION_TYPE = "text_qa"/);
    assert.match(manager, /不得依姓名、聲音或想像猜性別/);
    assert.match(manager, /學生只要說其中一個，不必把兩種都說出來/);
    assert.match(manager, /RED_ANSWER/);
    assert.match(manager, /red_answer_hint_count/);
    assert.match(manager, /accepted_intents: alternatives, visual_aid: \{\}/);
    assert.match(manager, /sourceHasQuestion && sourceHasAnswer\s*\? TEXT_QA_INTERACTION_TYPE/);
    assert.doesNotMatch(manager, /questions\.length !== rows\.length/);
    assert.match(manager, /rejected_ai_question_count/);
    assert.match(manager, /reviewed_numbered_text_qa_v2/);
    assert.match(manager, /generation_strategy: useDeterministicTextQa/);
    assert.match(manager, /numbered_question_count: useDeterministicTextQa/);
    assert.match(manager, /extractNumberedTextQaPairs/);
    assert.match(manager, /reviewedTextQaPromptIsComplete\(normalized\.question_text\)/);
    assert.match(manager, /textQaQuestionContentValid/);
    assert.match(manager, /exact_full_response_with_reviewed_alternatives/);
    assert.match(manager, /reviewed_full_response_with_variable_slots/);
    assert.match(manager, /ignoredSourcePageLabel/);
    assert.match(foundationAnswers, /"text_qa"/);
    assert.match(adminPage, /文字問答（無圖片）/);
    assert.match(adminPage, /其他可接受的完整答案/);
    assert.match(adminPage, /已維持一個編號一題/);
    assert.match(adminPage, /底線改為姓名、年齡或拼字等可變口說欄位/);
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
    assert.match(adminPage, /1 教材來源/);
    assert.match(adminPage, /2 製作中草稿/);
    assert.match(adminPage, /3 待發布/);
    assert.match(adminPage, /4 已發布/);
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
    assert.match(manager, /MAX_WHOLE_BOOK_BYTES = 500 \* 1024 \* 1024/);
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

test("9a. OCR 會要求結構化 JSON、保留舊回覆的安全 JSON 擷取，並預留密集十頁教材的輸出空間", () => {
    assert.match(manager, /const parseJsonObjectFromText =/);
    assert.match(manager, /const ocrResponseFormat =/);
    assert.match(manager, /const directOutput =/);
    assert.match(manager, /const ocrOutputFailureCode =/);
    assert.match(manager, /ocr_output_empty/);
    assert.match(manager, /ocr_output_not_json/);
    assert.match(manager, /\[歌曲歌詞略\]/);
    assert.match(manager, /ocr_response_content_filtered/);
    assert.match(manager, /type: "json_schema"/);
    assert.match(manager, /strict: true/);
    assert.match(manager, /WHOLE_BOOK_OCR_MAX_OUTPUT_TOKENS = 16_000/);
    assert.match(manager, /MAX_OCR_SOURCE_TEXT_CHARS = 60_000/);
    assert.match(manager, /ocr_output_truncated/);
});

test("9b. 整本 OCR 保留題目空格與圖片待核對標記，缺頁不會假裝辨識成功", () => {
    assert.match(manager, /\[\[IMAGE_REQUIRED: 題號或位置\]\]/);
    assert.match(manager, /wholeBookOcrPageMarkersMatch\(extracted\.sourceText/);
    assert.match(manager, /ocr_page_markers_mismatch/);
    assert.match(manager, /markedSourcePageLabels\(sourceText, chunkPages\)/);
    assert.match(manager, /if \(requiresPictureReview\) \{/);
    assert.match(manager, /請使用逐頁圖片草稿建立器/);
    assert.match(ocrPageMarkers, /markers\.every\(\(page, index\) => page === pageFrom \+ index\)/);
});

test("10. 單一來源維持 20MB，只有整本分批原檔可放寬到 500MB", () => {
    assert.match(wholeBookSizeMigration, /when chunk_count is null then 20971520/);
    assert.match(wholeBookSizeMigration, /else 524288000/);
    assert.match(wholeBookSizeMigration, /drop constraint if exists speaking_source_documents_byte_size_check/);
    assert.match(manager, /code === "23514"/);
    assert.match(manager, /單一來源上限 20MB，整本分批 PDF 上限 500MB/);
});

test("10a. 超大原始掃描頁可保留至 200MB，OCR 只使用安全的高品質衍生批次", () => {
    const splitter = read("src/services/pdfBookSplitter.js");
    assert.match(splitter, /MAX_WHOLE_BOOK_PAGE_BYTES = 200 \* 1024 \* 1024/);
    assert.match(splitter, /MAX_OCR_CHUNK_BYTES = 20 \* 1024 \* 1024/);
    assert.match(splitter, /createOcrDerivative/);
    assert.match(splitter, /original stays private in R2/);
    assert.match(service, /splitWholeBookPdf\(file, \{ onProgress \}\)/);
    assert.match(adminPage, /單頁原始掃描可達 200MB/);
    assert.match(adminPage, /建立高品質 OCR 副本/);
});

test("11. Workbook 1 人工範例不呼叫付費 AI，仍需草稿預覽與管理員發布", () => {
    assert.match(manager, /create_workbook_1_starter/);
    assert.match(manager, /workbook_1_name_intro_v1/);
    assert.match(manager, /source: "curated_template"/);
    assert.match(manager, /status: "draft"/);
    assert.match(service, /createWorkbookOneStarterQuestionSet/);
    assert.match(adminPage, /不執行 OCR，也不呼叫付費 AI/);
    assert.match(adminPage, /預覽學生畫面/);
    assert.match(adminPage, /核准並發布/);
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

test("13. 示範語音固定 Leda 女聲並可由管理員安全預覽", () => {
    assert.match(voiceAssignment, /en-US-Chirp3-HD-Leda/);
    assert.match(voiceAssignment, /en-US-Chirp3-HD-Puck/);
    assert.match(voiceAssignment, /SpeakingVoiceGender => "female"/);
    assert.match(ttsManager, /preview_question_audio/);
    assert.match(ttsManager, /createR2PresignedUrl\(asset\.private_object_key, "GET", 15 \* 60\)/);
    assert.match(service, /getSpeakingQuestionAudioPreview/);
    assert.match(adminPage, /女聲 · Leda/);
    assert.match(adminPage, /先產生並試聽示範語音/);
    assert.match(ttsText, /speakingAudioSourceMatchesModelAnswer/);
    assert.match(manager, /speakingAudioSourceMatchesModelAnswer\(asset\?\.source_text, question\?\.model_answer\)/);
});

test("14. 學生題目回傳視覺提示且保留正式口說流程", () => {
    assert.match(challenge, /pronunciation_notes_zh,visual_aid,sort_order/);
    assert.match(challenge, /demoMode/);
    assert.match(challenge, /question_prompt/);
    assert.match(challenge, /model_answer/);
    assert.match(challenge, /speaking_challenge_question_progress/);
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
    assert.match(manager, /questionIds\.length === 26 && !incompleteAudio/);
    assert.match(manager, /legacyMaster \|\| candidateMaster/);
    assert.match(manager, /alphabetRoundContentMatches/);
    assert.match(manager, /A–Z 題庫由固定 26 個字母模板鎖定/);
    assert.match(manager, /source_text,content_hash,byte_size,completed_at/);
    assert.match(ttsManager, /\.eq\("question_id", question\.id\)\.eq\("purpose", "model_answer"\)/);
    assert.doesNotMatch(ttsManager, /onConflict: "question_id"/);
    assert.match(ttsManager, /existing\?\.error_code === "42P10"/);
    assert.match(ttsManager, /fetchR2\(existing\.private_object_key, \{ method: "HEAD" \}\)/);
    assert.match(ttsManager, /stored\.headers\.get\("content-length"\)/);
    assert.match(ttsManager, /if \(stored\.status !== 404\)/);
    assert.match(ttsManager, /\.eq\("status", existing\.status\)/);
    assert.match(ttsManager, /\.eq\("updated_at", existing\.updated_at\)/);
    assert.match(ttsManager, /if \(!retriedLink\)/);
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
    assert.match(challenge, /\.select\("answer_match,created_at"\)/);
    assert.match(challenge, /attempt\.answer_match !== true/);
    assert.doesNotMatch(challenge, /body\?\.answer_match/);
    const coach = read("supabase/functions/pronunciation-coach/index.ts");
    assert.match(coach, /matchesFoundationAnswer/);
    assert.match(coach, /reserveProviderRequest/);
    assert.match(coach, /runSpeakingPronunciationFlow/);
    assert.doesNotMatch(coach, /audio_object_key|audio_saved_at/);
    assert.doesNotMatch(foundationRoundMigration, /audio_object_key|audio_saved_at/);
    assert.match(pronunciationLedgerMigration, /v_daily_count >= 160/);
    assert.match(coach, /foundationRetryFeedback/);
});

test("17. P21～P24 圖片、完整答案與停頓整句語音只由驗證後端讀取", () => {
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
    assert.match(pictureExtensionMigration, /speaking_question_sets_p23_p24_template_unique/);
    assert.match(pictureExtensionMigration, /workbook_1_p23_picture_gap_v1/);
    assert.match(pictureExtensionMigration, /workbook_1_p24_picture_gap_v1/);
    assert.match(manager, /speaking_question_visual_assets/);
    assert.match(manager, /speaking_question_word_audio/);
    assert.match(manager, /create_workbook_1_picture_draft/);
    assert.match(manager, /pictureGapAnswerMatchesPrompt/);
    assert.match(manager, /pictureQaResponseHasQuestionAndAnswer/);
    assert.match(manager, /acceptedResponsesValid/);
    assert.match(manager, /P21～P24 圖片題庫的顯示內容與後端完整答案必須同步/);
    assert.match(manager, /workbook_1_p23_picture_gap_v1/);
    assert.match(manager, /workbook_1_p24_picture_gap_v1/);
    assert.match(manager, /P21:[\s\S]*?questionCount: 9/);
    assert.match(manager, /P22:[\s\S]*?questionCount: 9/);
    assert.match(manager, /P23:[\s\S]*?questionCount: 9/);
    assert.match(manager, /P24:[\s\S]*?questionCount: 8/);
    assert.match(manager, /value\.length !== expectedQuestionCount/);
    assert.match(manager, /get_workbook_1_picture_review_candidates/);
    assert.match(manager, /workbookOnePictureReviewCandidates/);
    assert.match(service, /getWorkbookOnePictureReviewCandidates/);
    assert.match(manager, /picturePolicy\?\.pageLabels\.includes\(String\(asset\.source_page_label/);
    assert.match(manager, /createdQuestionSetId/);
    assert.match(manager, /create_picture_upload/);
    assert.match(manager, /confirm_picture_upload/);
    assert.match(manager, /discard_workbook_1_picture_draft/);
    assert.match(manager, /manual_picture_manifest/);
    assert.match(manager, /source_document_id: Number\(sourceSection\.document_id\)/);
    assert.match(manager, /hasExpectedSignature\(signatureBytes, asset\.mime_type\)/);
    assert.match(manager, /action === "preview_question_picture"/);
    assert.match(manager, /image_url: await createR2PresignedUrl\(asset\.private_object_key, "GET", 15 \* 60\)/);
    assert.match(manager, /expires_in_seconds: 15 \* 60/);
    assert.match(manager, /"Cache-Control": "private, no-store, max-age=0"/);
    const bootstrapSection = manager.slice(
        manager.indexOf("const loadBootstrap"),
        manager.indexOf("const validateApprovedFoundationSet")
    );
    assert.doesNotMatch(bootstrapSection, /createR2PresignedUrl|private_object_key|image_url/);
    assert.match(manager, /\.eq\("status", "draft"\)[\s\S]*?\.eq\("version", Number\(questionSet\.version\)\)[\s\S]*?\.eq\("updated_at", questionSet\.updated_at\)[\s\S]*?\.select\("id"\)[\s\S]*?\.maybeSingle\(\)/);
    assert.match(manager, /if \(!publishedSet\)/);
    assert.match(ttsManager, /generate_visible_word_audio/);
    assert.match(ttsManager, /WORKBOOK_ONE_PICTURE_GAP_TEMPLATES/);
    assert.doesNotMatch(ttsManager, /visibleSentenceWords/);
    assert.match(ttsManager, /PICTURE_SENTENCE_GAP_MS/);
    assert.match(ttsManager, /sentence_pattern/);
    assert.match(manager, /\.eq\("purpose", "question_prompt"\)/);
    assert.match(manager, /空格停 2 秒的整句女聲發音尚未全部完成/);
    assert.match(ttsManager, /status !== "ready" && item\.status !== "failed"/);
    assert.match(service, /uploadSpeakingQuestionPicture/);
    assert.match(adminPage, /WorkbookOnePictureContentAdmin/);
    assert.match(challenge, /authorizeSpeakingChallenge/);
    assert.match(challenge, /buildPublicSpeakingQuestion/);
    assert.doesNotMatch(challenge, /speaking_question_word_audio/);
    assert.match(challengeView, /圖片口說題目尚未完成安全發布/);
    assert.match(challengeView, /看圖補句的整句女聲發音尚未完成/);
    assert.match(challengeView, /sentence_audio_url/);
    assert.doesNotMatch(challengeView, /word_audio/);
    assert.match(challengeView, /kind: "private-image"/);
    assert.match(challengeView, /signPrivateObject\(visualAsset\.private_object_key\)/);
    assert.match(challengeView, /question_text: ""/);
    assert.match(challengeView, /model_answer: ""/);
    assert.match(challengeView, /pronunciation_notes_zh: ""/);
    assert.match(challenge, /correct_assessment_required/);
    assert.doesNotMatch(challengeView, /private_object_key:/);
});

test("24. 一般已發布關卡可建立新版草稿，固定來源模板維持鎖定，並以交易原子切換", () => {
    assert.match(manager, /create_question_set_revision/);
    assert.match(manager, /revision_source: "published_question_set"/);
    assert.match(manager, /interactionType === "alphabet_round" \|\| original\.generation_metadata\?\.approved_source_page_label/);
    assert.match(manager, /\.eq\("previous_set_id", Number\(original\.id\)\)/);
    assert.match(manager, /update_picture_draft_question/);
    assert.match(manager, /add_picture_draft_question/);
    assert.match(manager, /delete_draft_question/);
    assert.match(manager, /reorder_draft_questions/);
    assert.match(manager, /upsert\(\{[\s\S]*question_id: questionId, asset_id: asset\.id/);
    assert.match(manager, /publish_speaking_question_set_revision_v1/);
    assert.match(authoringRevisionMigration, /status = 'draft'/);
    assert.match(authoringRevisionMigration, /status = 'published'/);
    assert.match(authoringRevisionMigration, /for update/);
    assert.match(authoringRevisionMigration, /status = 'archived'/);
    assert.match(authoringRevisionMigration, /having count\(distinct progress\.question_id\) = v_old_question_count/);
    assert.match(authoringRevisionMigration, /revoke all on function public\.publish_speaking_question_set_revision_v1/);
    assert.match(authoringRevisionMigration, /grant execute on function public\.publish_speaking_question_set_revision_v1[\s\S]*to service_role/);
});

test("25. 管理員可刪除未發布草稿並安全下架任何正式關卡", () => {
    const archiveBlock = manager.slice(
        manager.indexOf('if (action === "archive_question_set")'),
        manager.indexOf('if (action === "create_workbook_1_picture_draft")')
    );
    assert.match(archiveBlock, /questionSet\.status === "draft"/);
    assert.match(archiveBlock, /speaking_challenge_question_progress/);
    assert.match(archiveBlock, /speaking_pronunciation_attempts/);
    assert.match(archiveBlock, /speaking_pronunciation_requests/);
    assert.match(archiveBlock, /speaking_foundation_rounds/);
    assert.match(archiveBlock, /speaking_alphabet_intro_listens/);
    assert.match(archiveBlock, /linkedStudentRows\.some\(Boolean\)/);
    assert.match(archiveBlock, /\.delete\(\)[\s\S]*?\.eq\("id", setId\)\.eq\("status", "draft"\)\.select\("id"\)\.maybeSingle\(\)/);
    assert.match(archiveBlock, /questionSet\.status !== "published"/);
    assert.match(archiveBlock, /\.eq\("previous_set_id", setId\)\.eq\("status", "draft"\)/);
    assert.doesNotMatch(archiveBlock, /目前只支援封存管理員建立的口說關卡/);
});

test("25.1 管理員只能封存沒有使用中關卡的教材來源", () => {
    const archiveSourceBlock = manager.slice(
        manager.indexOf('if (action === "archive_source_section")'),
        manager.indexOf('if (action === "create_manual_page_speaking_draft")')
    );
    assert.match(archiveSourceBlock, /speaking_source_sections/);
    assert.match(archiveSourceBlock, /speaking_question_sets/);
    assert.match(archiveSourceBlock, /\.neq\("status", "archived"\)/);
    assert.match(archiveSourceBlock, /仍有.*已發布關卡.*未發布草稿/s);
    assert.match(archiveSourceBlock, /status: "archived"/);
    assert.match(archiveSourceBlock, /speaking_source_documents/);
    assert.match(service, /archiveSpeakingSourceSection/);
    assert.match(adminPage, /封存舊來源/);
});

test("26. 管理員可用任意教材頁碼建立人工草稿並由空格規則產生停頓語音", () => {
    assert.match(manager, /create_manual_speaking_draft/);
    assert.match(manager, /admin_manual_builder/);
    assert.match(manager, /normalizeManualPageRange/);
    assert.match(manager, /MANUAL_INTERACTION_TYPES/);
    assert.match(manager, /pictureDraftPolicyForMetadata/);
    assert.match(manager, /pageLabels\.includes\(sourcePageLabel\)/);
    assert.match(manager, /update_manual_standard_question/);
    assert.match(manager, /add_manual_standard_question/);
    assert.match(ttsManager, /pictureGapDraftLabel/);
    assert.match(ttsManager, /manualStandardDraft/);
    assert.match(ttsManager, /PICTURE_SENTENCE_GAP_MS/);
    assert.match(service, /createManualSpeakingDraft/);
    assert.match(adminPage, /ManualSpeakingDraftAdmin/);
});

test("18. P21 必須說完整問答，P22 必須說含圖片答案的完整句子", () => {
    assert.match(foundationAnswers, /picture_qa/);
    assert.match(foundationAnswers, /picture_gap_sentence/);
    assert.match(foundationAnswers, /accepted\.some\(answer => hasSpeakingAnswerSlots\(answer\)/);
    assert.match(foundationAnswers, /matchesSpeakingAnswerTemplate\(answer, recognizedText\)/);
    const coach = read("supabase/functions/pronunciation-coach/index.ts");
    assert.match(coach, /matchesFoundationAnswer\(question\.interactionType, question\.answerTemplate, recognizedText, question\.acceptedAnswers\)/);
    assert.match(coach, /pictureInteraction\.prompt_text/);
    assert.match(coach, /pictureInteraction\.answer_text/);
    assert.match(coach, /usesUnscriptedFoundationAssessment\(interactionType\)/);
    assert.match(coach, /reference_text: question\.interactionType \? null/);
});

test("19. 學生只能讀取及評分已取得教材，付費 Speech 請求先原子保留額度", () => {
    assert.match(challenge, /_shared\/book-entitlement\.ts/);
    assert.match(challenge, /isBookEntitled/);
    assert.match(challenge, /assertBookEntitled/);
    assert.match(bookEntitlement, /book_entitlement_required/);
    const coach = read("supabase/functions/pronunciation-coach/index.ts");
    assert.match(coach, /assertBookEntitled/);
    assert.ok(coach.indexOf("await assertBookEntitled") < coach.indexOf('.select("model_answer,pronunciation_notes_zh,accepted_intents")'));
    assert.match(coach, /reserve_speaking_pronunciation_request/);
    assert.match(coach, /finishProviderRequest/);
    assert.match(coach, /\.select\("id"\)\.maybeSingle\(\)/);
    const finishProviderRequestSource = coach.slice(
        coach.indexOf("const finishProviderRequest"),
        coach.indexOf("const releaseFoundationRoundClaim")
    );
    assert.match(finishProviderRequestSource, /for \(let tryIndex = 0; tryIndex < 2; tryIndex \+= 1\)/);
    assert.match(finishProviderRequestSource, /\.eq\("status", "reserved"\)/);
    assert.match(finishProviderRequestSource, /\.select\("status,error_code,completed_at"\)/);
    assert.match(finishProviderRequestSource, /existing\?\.status === status/);
    assert.match(finishProviderRequestSource, /String\(existing\?\.error_code \|\| ""\) === String\(errorCode \|\| ""\)/);
    assert.match(finishProviderRequestSource, /Boolean\(existing\?\.completed_at\)/);
    assert.match(pronunciationFlow, /"internal_failed"/);
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

test("20. 手機口說操作列避開 Bottom Nav 與播放器，階段切換可由輔助科技得知", () => {
    assert.match(challengeStyles, /body:has\(\.ae-student-bottom-nav\) \.speaking-question-navigation/);
    assert.match(challengeStyles, /body:has\(\.ae-student-bottom-nav\) \.app-content\.has-player \.speaking-question-navigation/);
    assert.match(challengeStyles, /var\(--app-player-space, 110px\) \+ 74px/);
    assert.match(challengeStyles, /\.speaking-sr-only/);
    assert.match(challengeStyles, /\.speaking-back:focus-visible/);
    assert.match(foundationChallenge, /ref=\{phaseFocusRef\} tabIndex="-1"/);
    assert.doesNotMatch(foundationChallenge, /speaking-foundation-countdown" role="timer" aria-live/);
    const recorderSectionLine = pronunciationRecorder.split(/\r?\n/).find(line => line.includes("return <section")) || "";
    assert.doesNotMatch(recorderSectionLine, /aria-live/);
    assert.match(pronunciationRecorder, /role="status" aria-live="polite" aria-atomic="true"/);
    assert.match(pronunciationRecorderStyles, /\.speaking-pronunciation button:focus-visible/);
    assert.match(pronunciationRecorderStyles, /min-height: 44px; height: 44px/);
});

test("21. A–Z 只有同一個後端 round 連續答對 26 題才原子保存", () => {
    const coach = read("supabase/functions/pronunciation-coach/index.ts");
    assert.match(foundationRoundMigration, /create table if not exists public\.speaking_foundation_rounds/);
    assert.match(foundationRoundMigration, /cardinality\(question_order\) = 26/);
    assert.match(foundationRoundMigration, /status in \('open', 'failed', 'completed', 'expired'\)/);
    assert.match(foundationRoundMigration, /pg_advisory_xact_lock/);
    assert.match(foundationRoundMigration, /active_claim_token/);
    assert.match(foundationRoundMigration, /claim_speaking_foundation_round_question_v1/);
    assert.match(foundationRoundMigration, /release_speaking_foundation_round_claim_v1/);
    assert.match(foundationRoundMigration, /v_attempt\.answer_match is not true/);
    assert.match(foundationRoundMigration, /set status = 'failed', next_index = 0/);
    assert.match(foundationRoundMigration, /foreach v_question_id in array v_round\.question_order loop/);
    assert.match(foundationRoundMigration, /public\.complete_speaking_challenge_question_v2/);
    assert.match(speakingCompletionMigration, /private\.ae_gamification_grant_v2/);
    assert.match(speakingCompletionMigration, /'speaking_challenge_complete'/);
    assert.match(speakingCompletionMigration, /p_student_id,\s*30,\s*3,/);
    assert.match(challenge, /SPEAKING_CHALLENGE_REWARD_POLICY = Object\.freeze\(\{\s*xp: 30,\s*ae_points: 3,/);
    assert.match(challenge, /reward_policy: SPEAKING_CHALLENGE_REWARD_POLICY/);
    assert.match(foundationRoundMigration, /security invoker/g);
    assert.doesNotMatch(foundationRoundMigration, /security definer/);
    assert.match(foundationRoundMigration, /revoke all on table public\.speaking_foundation_rounds from public, anon, authenticated/);
    assert.match(foundationRoundMigration, /revoke all on function public\.start_speaking_foundation_round_v1/);
    assert.match(foundationRoundMigration, /revoke all on function public\.claim_speaking_foundation_round_question_v1/);
    assert.match(foundationRoundMigration, /revoke all on function public\.release_speaking_foundation_round_claim_v1/);
    assert.match(foundationRoundMigration, /revoke all on function public\.record_speaking_foundation_round_attempt_v1/);
    assert.match(foundationRoundMigration, /record_speaking_foundation_assessment_v1/);
    assert.match(foundationRoundMigration, /insert into public\.speaking_pronunciation_attempts/);
    assert.match(foundationRoundMigration, /create unique index if not exists speaking_pronunciation_attempts_foundation_claim_unique/);
    assert.match(foundationRoundMigration, /on public\.speaking_pronunciation_attempts\(foundation_claim_token\)/);
    assert.match(foundationRoundMigration, /where foundation_claim_token is not null/);
    assert.match(foundationRoundMigration, /on conflict \(foundation_claim_token\) where foundation_claim_token is not null/);
    assert.match(foundationRoundMigration, /FOUNDATION_ASSESSMENT_REPLAY_MISMATCH/);
    assert.match(foundationRoundMigration, /attempt\.word_results = coalesce\(p_word_results, '\[\]'::jsonb\)/);
    assert.match(foundationRoundMigration, /attempt\.pronunciation_score is not distinct from round\(p_pronunciation_score, 2\)/);
    assert.match(coach, /FOUNDATION_\(\?:ROUND\|SET\|ASSESSMENT_REPLAY_MISMATCH\)/);
    assert.match(foundationRoundMigration, /v_round_result := public\.record_speaking_foundation_round_attempt_v1/);
    assert.match(challenge, /start_foundation_round/);
    assert.match(challenge, /crypto\.getRandomValues/);
    assert.match(challenge, /foundation_round_required/);
    assert.match(challenge, /complete_speaking_challenge_question_v2/);
    assert.match(challengeView, /hideChallengeAnswerAudio/);
    assert.match(coach, /foundation_round_id/);
    assert.match(coach, /p_claim_token: claimToken/);
    assert.match(coach, /claim_speaking_foundation_round_question_v1/);
    assert.match(coach, /record_speaking_foundation_assessment_v2/);
    assert.match(pronunciationFlow, /const claimResult = await claim\(\)/);
    assert.match(pronunciationFlow, /requestId = await reserve\(\)/);
    assert.match(pronunciationFlow, /const assessment = await assess\(\)/);
    assert.match(pronunciationFlow, /const persisted = await saveAndRecordRound/);
    assert.match(pronunciationFlow, /attempt = persisted\.attempt/);
    assert.match(pronunciationFlow, /round = persisted\.round/);
    assert.match(pronunciationFlow, /await finishRequest\(requestId, "completed", null\)/);
    assert.ok(pronunciationFlow.indexOf("const claimResult = await claim()") < pronunciationFlow.indexOf("requestId = await reserve()"));
    assert.ok(pronunciationFlow.indexOf("requestId = await reserve()") < pronunciationFlow.indexOf("const assessment = await assess()"));
    assert.ok(pronunciationFlow.indexOf("const persisted = await saveAndRecordRound") < pronunciationFlow.indexOf('await finishRequest(requestId, "completed", null)'));
    assert.match(coach, /const PROVIDER_TIMEOUT_MS = 75_000/);
    assert.match(coach, /new AbortController\(\)/);
    assert.match(coach, /signal: providerController\.signal/);
    assert.match(coach, /return data === true/);
    assert.match(pronunciationFlow, /if \(claimToken && releaseClaim\)/);
    assert.match(coach, /p_answer_match: normalized\.answer_match/);
    assert.doesNotMatch(challenge, /p_student_id: Number\(body/);
});

test("22. A–Z 使用 server-only 單一女聲主音檔與 26 個時間區段，缺少來源只生成一次", () => {
    assert.match(alphabetSequenceMigration, /create table if not exists public\.speaking_question_set_audio_sequences/);
    assert.match(alphabetSequenceMigration, /primary key \(question_set_id, purpose\)/);
    assert.match(alphabetSequenceMigration, /enable row level security/);
    assert.match(alphabetSequenceMigration, /revoke all on table public\.speaking_question_set_audio_sequences from public, anon, authenticated/);
    assert.match(alphabetSequenceMigration, /grant select, insert, update, delete on table public\.speaking_question_set_audio_sequences to service_role/);
    assert.match(alphabetSequenceMigration, /jsonb_array_length\(segments\) = 26/);
    assert.match(alphabetSequenceClaimMigration, /claim_speaking_alphabet_audio_sequence/);
    assert.match(alphabetSequenceClaimMigration, /assembly_token uuid/);
    assert.match(alphabetSequenceClaimMigration, /revoke all on function public\.claim_speaking_alphabet_audio_sequence[\s\S]*from public, anon, authenticated/);
    assert.match(alphabetSequence, /ALPHABET_SEQUENCE_GAP_MS = 800/);
    assert.match(alphabetSequence, /單聲道 16-bit PCM WAV/);
    assert.doesNotMatch(ttsManager.slice(ttsManager.indexOf("Deno.serve")), /assemble_alphabet_master_audio/);
    const assemblySection = ttsManager.slice(
        ttsManager.indexOf("const assembleAlphabetMasterAudio"),
        ttsManager.indexOf("Deno.serve")
    );
    assert.doesNotMatch(assemblySection, /requestGoogleAudio/);
    assert.match(manager, /A–Z 的單一慢速主音檔尚未完成或已過期，不能發布/);
    assert.match(manager, /fetchR2\(sequence\.private_object_key, \{ method: "HEAD" \}\)/);
    assert.match(challenge, /alphabet_audio: alphabetAudio/);
    assert.match(challenge, /alphabetCandidateSequenceAllowed/);
    assert.match(challenge, /createR2PresignedUrl\(sequence\.private_object_key, "GET", 15 \* 60\)/);
    assert.match(challenge, /select\("question_set_version,source_fingerprint,status,duration_ms,private_object_key,byte_size,segments"\)/);
    assert.match(challengeView, /interactionType === "alphabet_round"/);
    assert.doesNotMatch(challenge, /private_object_key: sequence\.private_object_key/);
    assert.match(adminPage, /產生／載入新版 A–Z 女聲候選音檔/);
});

test("23. A–Z 以三個單次 Chirp 女聲請求建立候選，試聽核准後才原子切換", () => {
    assert.match(alphabetCandidateMigration, /create table if not exists public\.speaking_alphabet_audio_candidates/);
    assert.match(alphabetCandidateMigration, /enable row level security/);
    assert.match(alphabetCandidateMigration, /revoke all on table public\.speaking_alphabet_audio_candidates from public, anon, authenticated/);
    assert.match(alphabetCandidateMigration, /security invoker/);
    assert.match(alphabetCandidateMigration, /previous_sequence = to_jsonb\(current_sequence\)/);
    assert.match(alphabetCandidateMigration, /status = 'ready'/);
    assert.match(alphabetMasterVoice, /en-US-Chirp3-HD-Leda/);
    assert.match(alphabetMasterVoice, /en-US-Chirp3-HD-Aoede/);
    assert.match(alphabetMasterVoice, /en-US-Chirp3-HD-Zephyr/);
    assert.match(alphabetMasterVoice, /ph="ziː"/);
    assert.match(alphabetMasterVoice, /detectAlphabetSpeechBoundaries/);
    assert.match(ttsManager, /v1\/text:synthesize/);
    assert.match(ttsManager, /input: \{ ssml \}/);
    assert.doesNotMatch(ttsManager, /enableTimePointing/);
    assert.match(alphabetMasterVoice, /<say-as interpret-as="characters">/);
    assert.match(ttsManager, /prepare_alphabet_audio_candidate/);
    assert.match(ttsManager, /activate_alphabet_audio_candidate/);
    assert.match(ttsManager, /alphabetTemplateValid\(questionSet, questions\)/);
    assert.match(ttsManager, /alphabetCandidateValid\(candidate, ordered, questionSet, settingsHash, sourceFingerprint\)/);
    assert.match(ttsManager, /alphabetCandidateStored\(candidate\)/);
    assert.match(ttsManager, /fetchR2\(candidate\.private_object_key, \{ method: "HEAD" \}\)/);
    assert.match(ttsManager, /ALPHABET_SEQUENCE_GAP_MS,\s+alphabetAudioSequenceValid,/);
    assert.ok(ttsManager.indexOf("alphabetTemplateValid(questionSet, questions)") < ttsManager.indexOf("prepareAlphabetCandidate(admin, questions, questionSet, profile)"));
    assert.match(manager, /alphabetActiveCandidateAllowed/);
    assert.match(manager, /candidateMaster/);
    assert.match(manager, /activeCandidate\?\.private_object_key === sequence\?\.private_object_key/);
    assert.match(service, /prepareSpeakingAlphabetAudioCandidate/);
    assert.match(service, /activateSpeakingAlphabetAudioCandidate/);
    assert.match(adminPage, /先逐一完整試聽，再選一個套用/);
    assert.match(adminPage, /核准 \$\{candidate\.voice_label\} 套用學生版本/);
    assert.match(adminPage, /setAlphabetCandidatesListened/);
    assert.match(adminPage, /disabled=\{!alphabetCandidatesListened\[candidate\.candidate_id\]/);
});
