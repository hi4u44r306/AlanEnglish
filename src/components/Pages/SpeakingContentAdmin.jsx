import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { AlertCircle, AlertTriangle, Archive, BookOpen, CheckCircle2, ChevronDown, Eye, FileText, LoaderCircle, Pencil, Plus, RefreshCcw, Search, Sparkles, UploadCloud, Volume2, Wrench } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
    activateSpeakingAlphabetAudioCandidate,
    archiveSpeakingQuestionSet,
    archiveSpeakingSourceSection,
    confirmWorkbookOneFoundationSource,
    confirmPageCandidateSpeakingDraft,
    createSpeakingQuestionSetRevision,
    createWorkbookOneFoundationQuestionSet,
    createWorkbookOneStarterQuestionSet,
    createWorkbookTwoStarterQuestionSet,
    generateSpeakingQuestionSet,
    getSpeakingContentBootstrap,
    extractSpeakingSourceDocument,
    extractSpeakingBookChunk,
    generateSpeakingQuestionSetAudio,
    generateSpeakingVisibleWordAudio,
    getSpeakingQuestionAudioPreview,
    getSpeakingQuestionPicturePreview,
    publishSpeakingQuestionSet,
    prepareSpeakingAlphabetAudioCandidate,
    reviewSpeakingOcrSource,
    saveReviewedSpeakingSource,
    uploadAndExtractSpeakingSource,
    uploadWholeBookSource,
    updateDraftSpeakingQuestion
} from "../../services/speakingContentService";
import SpeakingVisualAid from "./SpeakingVisualAid";
import SpeakingPictureQuestionSetEditor from "./SpeakingPictureQuestionSetEditor";
import WorkbookOnePictureContentAdmin from "./WorkbookOnePictureContentAdmin";
import ManualSpeakingDraftAdmin from "./ManualSpeakingDraftAdmin";
import SpeakingManualStandardEditor from "./SpeakingManualStandardEditor";
import "./css/Platform.scss";
import "./css/SpeakingContentAdmin.scss";

const emptySource = {
    book_id: "", document_title: "", unit_label: "", page_from_label: "", page_to_label: "",
    topic: "", language_level: "國小中年級", source_text: "", confirmed: false
};
const SOURCE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const emptyWholeBook = { book_id: "", document_title: "" };
const WORKBOOK_ONE_FOUNDATION_STARTERS = [
    { action: "create_workbook_1_alphabet_round", templateKey: "workbook_1_alphabet_round_v1", title: "A–Z 大小寫挑戰", note: "26 個大小寫字母；介紹頁播放單一女聲主音檔，挑戰時自動收音且不播放答案。" },
    { action: "create_workbook_1_spelling_p14", templateKey: "workbook_1_p14_letter_spelling_v1", title: "P14 看字拼讀", note: "10 個正式來源已核准單字；建立時由後端再次核對版本。" },
    { action: "create_workbook_1_spelling_p15", templateKey: "workbook_1_p15_letter_spelling_v1", title: "P15 看字拼讀", note: "12 個正式來源已核准單字；建立時由後端再次核對版本。" },
    { action: "create_workbook_1_spelling_p16", templateKey: "workbook_1_p16_letter_spelling_v1", title: "P16 看字拼讀", note: "12 個已核准專有名詞／品牌；保留正式拼字與大小寫。" },
    { action: "create_workbook_1_spelling_p17", templateKey: "workbook_1_p17_letter_spelling_v1", title: "P17 看字拼讀", note: "12 個正式來源已核准數字單字；建立時由後端再次核對版本。" }
];
const WORKBOOK_ONE_PAGE_STARTERS = [
    { action: "create_workbook_1_p26_p27_contractions", templateKey: "workbook_1_p26_p27_contractions_v1", title: "完整句與縮寫", pages: "P26～P27", note: "9 題固定句型；完整句與正確縮寫都可接受。排除教材中容易混淆的兩題，建立後仍需逐題核准。" }
];

const asOne = value => Array.isArray(value) ? value[0] : value;
const pageNumber = value => Number(String(value || "").match(/\d+/)?.[0] || Number.MAX_SAFE_INTEGER);
const questionSetPageLabels = (questionSet, section) => {
    const metadata = questionSet?.generation_metadata || {};
    const labels = Array.isArray(metadata.source_pages)
        ? metadata.source_pages.map(page => `P${Number(page)}`).filter(label => /^P\d+$/.test(label))
        : metadata.source_page_label ? [String(metadata.source_page_label).toUpperCase()] : sourcePageLabels(section);
    return [...new Set(labels)];
};
const questionSetSingleSourcePage = questionSet => {
    const metadata = questionSet?.generation_metadata || {};
    const explicitLabel = String(metadata.source_page_label || "").trim().toUpperCase();
    if (/^P[1-9][0-9]{0,3}$/.test(explicitLabel)) return explicitLabel;
    if (Array.isArray(metadata.source_pages) && metadata.source_pages.length === 1) {
        const page = Number(metadata.source_pages[0]);
        if (Number.isInteger(page) && page > 0) return `P${page}`;
    }
    return null;
};
const questionSetOrigin = questionSet => ({
    admin_manual_builder: "手動建立",
    ocr_page_candidate: "OCR 候選",
    ai_page_auto: "AI 逐頁自動判斷",
    ai_generated: "AI 產生"
}[questionSet?.generation_metadata?.source] || (questionSet?.generation_metadata?.template_key ? "系統範本" : "既有題庫"));
const manualAuthoringReasonLabel = reason => ({
    no_speakable_sentence: "本頁只有填空、中文單字或不完整句，已建立空白單頁草稿，請人工新增題目。",
    all_questions_duplicate: "本頁可辨識句子都已存在其他關卡，已建立空白單頁草稿供人工確認。"
}[reason] || "本頁需要人工補充題目後才能核准。");
const pageGenerationStatusLabel = row => ({
    pending: "等待處理",
    processing: "教材分析、重複檢查與儲存中…",
    created: `${row.generationStrategy === "reviewed_numbered_text_qa" ? "教材問答草稿" : "AI 草稿"} ${row.questionCount} 題${row.rejectedQuestionCount > 0 ? ` · 安全略過 ${row.rejectedQuestionCount} 題不完整候選` : ""}`,
    manual: manualAuthoringReasonLabel(row.reason),
    failed: `未建立：${row.message}`
}[row.status] || "等待處理");
const interactionTypeLabel = interactionType => ({
    standard_sentence: "完整句朗讀",
    text_qa: "文字問答（無圖片）",
    picture_qa: "看圖問答",
    picture_gap_sentence: "看圖補句"
}[interactionType] || "口說練習");

const draftReadiness = (questionSet, section) => {
    if (questionSet?.status !== "draft") return { ready: false, issues: [] };
    const metadata = questionSet.generation_metadata || {};
    const interactionType = String(metadata.interaction_type || "");
    const questions = [...(questionSet.speaking_questions || [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
    const issues = [];
    const manualSinglePage = (["admin_manual_builder", "admin_page_builder", "ai_page_auto"].includes(metadata.source)
        || (["ocr_page_candidate", "ai_page_auto"].includes(metadata.source) && metadata.auto_question_count === true))
        && Array.isArray(metadata.source_pages) && metadata.source_pages.length === 1;
    if (!manualSinglePage && questions.length < 3) issues.push({ message: `目前只有 ${questions.length} 題，發布至少需要 3 題。` });
    if (manualSinglePage && questions.length < 1) issues.push({ message: "本頁目前沒有題目，請先人工新增至少一題。" });
    if (section?.status !== "reviewed") issues.push({ message: "教材來源尚未完成人工核對。" });
    if (metadata.requires_content_review === true && !metadata.content_reviewed_at) {
        issues.push({ message: "這份候選草稿尚未完成逐題人工核准。" });
    }
    questions.forEach((question, index) => {
        const label = `第 ${index + 1} 題`;
        const interaction = asOne(question.speaking_question_interactions);
        const questionInteractionType = String(interaction?.interaction_type || interactionType || "standard_sentence");
        const visualLink = asOne(question.speaking_question_visual_assets);
        const visual = asOne(visualLink?.speaking_visual_assets);
        if (["picture_qa", "picture_gap_sentence"].includes(questionInteractionType)) {
            if (!String(interaction?.prompt_text || "").trim()) issues.push({ questionId: question.id, message: `${label}缺少學生看到的題目。` });
            if (!String(interaction?.answer_text || "").trim()) issues.push({ questionId: question.id, message: `${label}缺少完整答案。` });
            if (questionInteractionType === "picture_qa" && !String(interaction?.prompt_text || "").trim().endsWith("?")) issues.push({ questionId: question.id, message: `${label}的完整問句必須以 ? 結尾。` });
            if (questionInteractionType === "picture_gap_sentence" && !/_{2,}/.test(String(interaction?.prompt_text || ""))) issues.push({ questionId: question.id, message: `${label}至少需要一個挖空。` });
            if (visual?.status !== "ready") issues.push({ questionId: question.id, message: `${label}尚未完成私人圖片上傳。` });
            if (!String(visual?.alt_zh || "").trim()) issues.push({ questionId: question.id, message: `${label}缺少圖片替代文字。` });
        } else {
            if (!String(question.model_answer || "").trim()) issues.push({ questionId: question.id, message: `${label}缺少完整示範回答。` });
            if (questionInteractionType === "text_qa" && !String(question.question_text || "").trim().endsWith("?")) {
                issues.push({ questionId: question.id, message: `${label}的文字問答必須是完整問句並以 ? 結尾。` });
            }
        }
    });
    return { ready: issues.length === 0, issues };
};

const DraftReadinessPanel = ({ readiness, interactionType, answerAudioEnabled = false }) => readiness.ready
    ? <div className="speaking-readiness is-ready"><CheckCircle2 /><div><strong>內容檢查完成</strong><span>{interactionType === "picture_gap_sentence" ? "發布時會自動產生或更新停頓整句語音。" : interactionType === "standard_sentence" || answerAudioEnabled ? "發布時會自動產生或更新全部示範語音。" : interactionType === "text_qa" ? "可以直接以純文字問答發布，不會產生示範語音。" : "可以預覽學生畫面並發布。"}</span></div></div>
    : <div className="speaking-readiness has-issues" role="alert"><AlertCircle /><div><strong>還有 {readiness.issues.length} 項需要處理</strong><ul>{readiness.issues.map((issue, index) => <li key={`${issue.questionId || "set"}-${index}`}>{issue.message}</li>)}</ul></div></div>;

const sourcePageLabels = section => {
    const from = String(section?.page_from_label || "").trim().toUpperCase().match(/^P?(\d{1,4})$/);
    const to = String(section?.page_to_label || section?.page_from_label || "").trim().toUpperCase().match(/^P?(\d{1,4})$/);
    const fromNumber = Number(from?.[1]);
    const toNumber = Number(to?.[1]);
    if (!Number.isInteger(fromNumber) || !Number.isInteger(toNumber) || fromNumber < 1 || toNumber < fromNumber || toNumber - fromNumber > 49) return [];
    return Array.from({ length: toNumber - fromNumber + 1 }, (_, index) => `P${fromNumber + index}`);
};

const markedSourcePageLabels = section => {
    const allowedPages = new Set(sourcePageLabels(section));
    const labels = [...String(section?.source_text || "").matchAll(/\[\[PAGE\s+P([1-9][0-9]{0,3})\]\]/gi)]
        .map(match => `P${Number(match[1])}`)
        .filter(label => allowedPages.size === 0 || allowedPages.has(label));
    return [...new Set(labels)];
};
const createRequestKey = () => ((typeof window !== "undefined" && window.crypto?.randomUUID?.()) || [
    Math.random().toString(16).slice(2, 10), Math.random().toString(16).slice(2, 6), "4" + Math.random().toString(16).slice(2, 5),
    "8" + Math.random().toString(16).slice(2, 5), Math.random().toString(16).slice(2, 14)
].map((value, index) => index === 4 ? value.padEnd(12, "0").slice(0, 12) : value.padEnd(index === 0 ? 8 : 4, "0").slice(0, index === 0 ? 8 : 4)).join("-"));

const chunkStatusLabel = status => ({
    pending_upload: "等待上傳", uploaded: "等待 OCR", processing: "辨識中",
    review_required: "待人工核准", completed: "已核准", failed: "辨識失敗"
}[status] || status);
const isStaleChunk = chunk => chunk.status === "processing"
    && Number.isFinite(Date.parse(chunk.processing_started_at || ""))
    && Date.now() - Date.parse(chunk.processing_started_at) > 10 * 60 * 1000;

const WholeBookCard = ({ document, chunks, disabled, onProcess, onRetry }) => {
    const finished = chunks.filter(chunk => ["review_required", "completed"].includes(chunk.status)).length;
    const reviewed = chunks.filter(chunk => chunk.status === "completed").length;
    const failed = chunks.filter(chunk => chunk.status === "failed").length;
    const actionable = chunks.filter(chunk => ["uploaded", "failed"].includes(chunk.status) || isStaleChunk(chunk));
    const percent = chunks.length ? Math.round((finished / chunks.length) * 100) : 0;
    return <article className="speaking-book-job">
        <header><div><span>整本教材 · {document.page_count} 頁</span><h3>{document.title}</h3>{document.original_filename && <p>原始檔案：{document.original_filename}</p>}<p>{finished}/{chunks.length} 批已辨識 · {reviewed}/{chunks.length} 批已核准</p></div><strong>{percent}%</strong></header>
        <div className="speaking-book-job__bar" aria-label={`OCR 完成 ${percent}%`}><span style={{ width: `${percent}%` }} /></div>
        <div className="speaking-book-job__chunks">{chunks.map(chunk => <div className={`speaking-book-chunk ${chunk.status}`} key={chunk.id}>
            <span>P{chunk.page_from}–P{chunk.page_to}</span><small>{isStaleChunk(chunk) ? "處理中斷，可重試" : chunkStatusLabel(chunk.status)}</small>
            {(chunk.status === "failed" || isStaleChunk(chunk)) && <button type="button" disabled={disabled} onClick={() => onRetry(chunk)} aria-label={`重試第 ${chunk.chunk_index + 1} 批`}><RefreshCcw size={15} /></button>}
        </div>)}</div>
        {failed > 0 && <p className="speaking-book-job__warning"><AlertTriangle size={16} />有 {failed} 批失敗，可單獨重試，不必重新上傳整本書。</p>}
        {actionable.length > 0 && <button type="button" className="platform-primary" disabled={disabled} onClick={() => onProcess(document, actionable)}>
            {disabled ? <LoaderCircle className="speaking-spin" size={17} /> : <Sparkles size={17} />}{finished > 0 ? "繼續批次 OCR" : "開始批次 OCR"}
        </button>}
        {actionable.length === 0 && reviewed < chunks.length && <p className="speaking-book-job__notice">OCR 已完成，請在下方逐批校正並核准。</p>}
        {reviewed === chunks.length && chunks.length > 0 && <p className="speaking-book-job__complete"><CheckCircle2 size={17} />整本教材文字已全部核准。</p>}
    </article>;
};

const OcrReviewEditor = ({ section, disabled, onReview }) => {
    const [form, setForm] = useState({
        unit_label: section.unit_label || "", page_from_label: section.page_from_label || "",
        page_to_label: section.page_to_label || "", topic: section.topic || "",
        language_level: section.language_level || "國小中年級", source_text: section.source_text || "", confirmed: false
    });
    const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
    const isMultiPage = sourcePageLabels(form).length > 1;
    const retainedPages = markedSourcePageLabels(form);
    const missingPageMarkers = isMultiPage && retainedPages.length === 0;
    return <div className="speaking-ocr-review">
        <div className="speaking-ocr-review__notice"><strong>AI 已完成文字辨識，尚未核准</strong><span>請對照原課本校正錯字、頁碼與題目順序。不需要建立關卡的頁面，請連同該頁的 <code>[[PAGE P頁碼]]</code> 與內容一起刪除；系統只處理逐字稿中實際留下的頁碼。</span></div>
        {missingPageMarkers && <div className="speaking-ocr-review__notice" role="alert"><strong>這批尚無可建立關卡的頁碼</strong><span>目前逐字稿沒有符合本批頁碼的 <code>[[PAGE P頁碼]]</code> 標記。請對照原始 PDF，為要保留的每頁加上獨立標記，再核准；只有文字 OCR 無法判定圖片與空格的配對，圖片題仍需逐題核對並提供圖片。</span></div>}
        {isMultiPage && !missingPageMarkers && <p>目前保留 {retainedPages.length} 頁：{retainedPages.join("、")}</p>}
        <div className="platform-form">
            <div className="platform-form-grid">
                <label><span>Unit／單元</span><input value={form.unit_label} onChange={event => update("unit_label", event.target.value)} disabled={disabled} /></label>
                <label><span>主題</span><input required value={form.topic} onChange={event => update("topic", event.target.value)} disabled={disabled} /></label>
                <label><span>開始頁</span><input value={form.page_from_label} onChange={event => update("page_from_label", event.target.value)} disabled={disabled} /></label>
                <label><span>結束頁</span><input value={form.page_to_label} onChange={event => update("page_to_label", event.target.value)} disabled={disabled} /></label>
                <label><span>程度</span><select value={form.language_level} onChange={event => update("language_level", event.target.value)} disabled={disabled}><option>國小低年級</option><option>國小中年級</option><option>國小高年級</option></select></label>
            </div>
            <label><span>OCR 辨識文字</span><textarea rows="14" minLength="20" value={form.source_text} onChange={event => update("source_text", event.target.value)} disabled={disabled} /></label>
            <label className="speaking-confirm"><input type="checkbox" checked={form.confirmed} onChange={event => update("confirmed", event.target.checked)} disabled={disabled} /><span>我已逐頁對照原教材，並確認逐字稿中留下的頁碼就是之後要建立關卡的頁面。</span></label>
            <button type="button" className="platform-primary" disabled={disabled || missingPageMarkers || !form.confirmed || form.source_text.trim().length < 20 || !form.topic.trim()} onClick={() => onReview(section.id, form)}>核准 OCR 教材文字</button>
        </div>
    </div>;
};

const plannedVoice = () => ({ gender: "female", label: "女聲 · Leda" });

const QuestionAudioPreview = ({ firebaseUser, questionSet, question }) => {
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const metadata = questionSet.generation_metadata || {};
    const canPreview = questionSet.status === "published" || (questionSet.status === "draft" && (
        Boolean(metadata.content_reviewed_at)
        || ["admin_manual_builder", "admin_page_builder"].includes(metadata.source)
    ));
    const voice = plannedVoice(questionSet.id, question.sort_order, questionSet.generation_metadata?.interaction_type);
    const loadPreview = async () => {
        setLoading(true);
        try {
            const result = await getSpeakingQuestionAudioPreview(firebaseUser, questionSet.id, question.id);
            setPreview(result);
        } catch (error) { toast.error(error.message || "示範語音尚未準備完成"); }
        finally { setLoading(false); }
    };
    return <div className={`speaking-voice-preview ${voice.gender}`}>
        <span>{voice.label}</span>
        {canPreview && <button type="button" disabled={loading} onClick={loadPreview} aria-label={`試聽第 ${Number(question.sort_order || 0) + 1} 題${voice.gender === "female" ? "女聲" : "男聲"}示範`}>
            <Volume2 size={16} />{loading ? "載入中…" : "試聽"}
        </button>}
        {preview?.audio_url && <audio controls autoPlay src={preview.audio_url} aria-label={`第 ${Number(question.sort_order || 0) + 1} 題示範語音`} />}
    </div>;
};

const QuestionPicturePreview = ({ firebaseUser, question }) => {
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const loadPreview = async () => {
        setLoading(true);
        setFailed(false);
        try {
            const result = await getSpeakingQuestionPicturePreview(firebaseUser, question.id);
            if (Number(result?.question_id) !== Number(question.id) || !result?.image_url || !result?.alt_zh) {
                throw new Error("圖片預覽回應不完整");
            }
            setPreview(result);
        } catch {
            setPreview(null);
            setFailed(true);
        } finally {
            setLoading(false);
        }
    };
    return <div className="speaking-picture-preview">
        <button
            type="button"
            className="platform-secondary"
            disabled={loading}
            onClick={loadPreview}
            aria-label={`${preview ? "重新載入" : "載入"}第 ${Number(question.sort_order || 0) + 1} 題圖片預覽`}
        >
            <Eye size={17} />{loading ? "載入中…" : preview ? "重新載入圖片" : "載入圖片預覽"}
        </button>
        {failed && <p role="status">圖片尚未準備完成，請確認上傳狀態後再試。</p>}
        {preview?.image_url && <SpeakingVisualAid variant="thumbnail" aid={{
            kind: "private-image", image_url: preview.image_url, alt_zh: preview.alt_zh
        }} />}
    </div>;
};

const StudentQuestionSetPreview = ({ questionSet, firebaseUser }) => {
    const questions = [...(questionSet.speaking_questions || [])].sort((a, b) => a.sort_order - b.sort_order);
    const interactionType = String(questionSet.generation_metadata?.interaction_type || "");
    const groupedTextQa = questionSet.generation_metadata?.candidate_filter?.generation_strategy === "ai_grouped_numbered_text_qa";
    const answerAudioEnabled = interactionType === "text_qa" && questionSet.generation_metadata?.requires_answer_audio === true;
    const isPictureQa = interactionType === "picture_qa";
    const isPictureGap = interactionType === "picture_gap_sentence";
    const isPictureSet = isPictureQa || isPictureGap;
    const previewDescription = isPictureQa
        ? "學生只會看到圖片，並在同一次錄音說出完整問句與回答。"
        : isPictureGap
            ? "學生會看到圖片與挖空句型，可點聽已顯示的單字，再說出完整句子。"
            : interactionType === "text_qa"
                ? "學生會看到純文字問題，說出一個可接受的完整答案；不需要圖片。"
                : "學生會先聽問題，自行回答；需要時才展開提示與示範句。";
    return <details className="speaking-student-preview">
        <summary><Eye size={17} />預覽學生畫面</summary>
        <div className="speaking-student-preview__screen">
            <header><span>口說大挑戰預覽</span><h5>{questionSet.title}</h5><p>{previewDescription}</p></header>
            <div className="speaking-student-preview__questions">{questions.map((question, index) => <article key={question.id}>
                <span>第 {index + 1} 題</span>{!isPictureQa && <strong>{question.question_text}</strong>}
                {groupedTextQa && <p>題目線索：{String(question.hint_zh || "").match(/^題目線索：([^。]+)。/)?.[1] || "請核對原頁"}</p>}
                {isPictureSet
                    ? <QuestionPicturePreview firebaseUser={firebaseUser} question={question} />
                    : <SpeakingVisualAid variant="thumbnail" aid={question.visual_aid} />}
                {isPictureSet
                    ? <details><summary>查看管理員核對資料（學生不會看到）</summary><p>{question.question_text}</p><em>{question.model_answer}</em></details>
                    : <details><summary>學生需要提示時顯示</summary><p>{question.hint_zh}</p><em>{question.simple_answer}</em></details>}
                {!isPictureSet && (interactionType !== "text_qa" || answerAudioEnabled) && <QuestionAudioPreview firebaseUser={firebaseUser} questionSet={questionSet} question={question} />}
                {!isPictureSet && <small>{question.pronunciation_notes_zh || "完成錄音後顯示發音回饋。"}</small>}
            </article>)}</div>
            <p className="speaking-student-preview__note">{interactionType === "text_qa" && !answerAudioEnabled ? "這是管理員內容預覽；發布後學生閱讀題目、直接口說回答，可使用錄音回聽與逐字發音回饋，不播放示範音檔。" : "這是管理員內容預覽；發布後學生可使用示範語音、錄音回聽與逐字發音回饋。"}</p>
        </div>
    </details>;
};

const QuestionEditor = ({ question, interactionType, disabled, onSave }) => {
    const [form, setForm] = useState({
        question_text: question.question_text || "", hint_zh: question.hint_zh || "",
        keywords: (question.keywords || []).join("、"), simple_answer: question.simple_answer || "",
        model_answer: question.model_answer || "", follow_up_question: question.follow_up_question || "",
        pronunciation_notes_zh: question.pronunciation_notes_zh || "",
        accepted_intents: (question.accepted_intents || []).join("\n"),
        visual_kind: question.visual_aid?.kind || "", visual_value: question.visual_aid?.value || "",
        visual_alt_zh: question.visual_aid?.alt_zh || ""
    });
    const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
    return <article className="speaking-question-editor">
        <div className="speaking-question-editor__number">Q{Number(question.sort_order || 0) + 1}</div>
        <div className="platform-form">
            <label><span>AI 要問學生的問題</span><input value={form.question_text} onChange={event => update("question_text", event.target.value)} disabled={disabled} /></label>
            <label><span>中文提示</span><input value={form.hint_zh} onChange={event => update("hint_zh", event.target.value)} disabled={disabled} /></label>
            <div className="platform-form-grid">
                <label><span>關鍵字（用、分隔）</span><input value={form.keywords} onChange={event => update("keywords", event.target.value)} disabled={disabled} /></label>
                <label><span>延伸問題</span><input value={form.follow_up_question} onChange={event => update("follow_up_question", event.target.value)} disabled={disabled} /></label>
            </div>
            <label><span>簡易回答</span><textarea rows="2" value={form.simple_answer} onChange={event => update("simple_answer", event.target.value)} disabled={disabled} /></label>
            <label><span>完整示範回答</span><textarea rows="3" value={form.model_answer} onChange={event => update("model_answer", event.target.value)} disabled={disabled} /></label>
            <div className="platform-form-grid">
                <label><span>發音／重音提示</span><textarea rows="3" value={form.pronunciation_notes_zh} onChange={event => update("pronunciation_notes_zh", event.target.value)} disabled={disabled} /></label>
                <label><span>{interactionType === "text_qa" ? "其他可接受的完整答案（每行一項）" : "可接受回答意思（每行一項）"}</span><textarea rows="3" value={form.accepted_intents} onChange={event => update("accepted_intents", event.target.value)} disabled={disabled} />{interactionType === "text_qa" && <small>問句未指定性別時，請列出另一種完整答案；例如示範為 He…his…，此處填 She…her…。</small>}</label>
            </div>
            <div className="platform-form-grid">
                <label><span>輔助圖類型</span><select value={interactionType === "text_qa" ? "" : form.visual_kind} onChange={event => update("visual_kind", event.target.value)} disabled={disabled || interactionType === "text_qa"}><option value="">不需要圖片</option><option value="flag">國旗</option><option value="color-object">顏色與物品</option><option value="clock">時鐘</option><option value="routine">日常情境</option></select>{interactionType === "text_qa" && <small>文字問答固定不使用圖片，只依題目文字與核准答案判定。</small>}</label>
                <label><span>圖卡代號</span><input value={form.visual_value} onChange={event => update("visual_value", event.target.value)} disabled={disabled} placeholder="例如 taiwan、banana、7" /></label>
            </div>
            {form.visual_kind && <label><span>圖片替代文字（繁體中文）</span><input value={form.visual_alt_zh} onChange={event => update("visual_alt_zh", event.target.value)} disabled={disabled} placeholder="例如：時鐘顯示七點整" /></label>}
            {!disabled && <button type="button" className="platform-secondary" onClick={() => onSave(question.id, {
                ...form,
                keywords: form.keywords.split(/[、,，]/).map(item => item.trim()).filter(Boolean),
                accepted_intents: form.accepted_intents.split("\n").map(item => item.trim()).filter(Boolean),
                visual_aid: form.visual_kind ? { kind: form.visual_kind, value: form.visual_value, alt_zh: form.visual_alt_zh } : {}
            })}>儲存這一題</button>}
        </div>
    </article>;
};

export default function SpeakingContentAdmin() {
    const { firebaseUser } = useAuth();
    const [data, setData] = useState({ books: [], documents: [], chunks: [], sections: [], question_sets: [] });
    const [source, setSource] = useState(emptySource);
    const [wholeBook, setWholeBook] = useState(emptyWholeBook);
    const [wholeBookFile, setWholeBookFile] = useState(null);
    const [wholeBookProgress, setWholeBookProgress] = useState(null);
    const [sourceFile, setSourceFile] = useState(null);
    const [pendingDocumentId, setPendingDocumentId] = useState(null);
    const [working, setWorking] = useState("");
    const [loading, setLoading] = useState(true);
    const [alphabetCandidates, setAlphabetCandidates] = useState(null);
    const [alphabetCandidatesListened, setAlphabetCandidatesListened] = useState({});
    const [questionSetFilter, setQuestionSetFilter] = useState("draft");
    const [selectedQuestionSetId, setSelectedQuestionSetId] = useState(null);
    const [activeWorkspace, setActiveWorkspace] = useState("drafts");
    const [activeSourceTab, setActiveSourceTab] = useState("whole-book");
    const [questionSetSearch, setQuestionSetSearch] = useState("");
    const [bookFilter, setBookFilter] = useState("all");
    const [selectedPageCandidateIds, setSelectedPageCandidateIds] = useState([]);
    const [selectedSourcePages, setSelectedSourcePages] = useState({});
    const [pageGenerationReport, setPageGenerationReport] = useState(null);
    const [pageGenerationProgress, setPageGenerationProgress] = useState(null);

    const load = useCallback(async () => {
        if (!firebaseUser) return;
        setLoading(true);
        try { setData(await getSpeakingContentBootstrap(firebaseUser)); }
        catch (error) { toast.error(error.message || "口說題庫資料讀取失敗"); }
        finally { setLoading(false); }
    }, [firebaseUser]);
    useEffect(() => { load(); }, [load]);

    const sourceRows = useMemo(() => data.sections.map(section => ({
        ...section,
        document: data.documents.find(document => document.id === section.document_id),
        book: data.books.find(book => Number(book.id) === Number(data.documents.find(document => document.id === section.document_id)?.book_id)),
        questionSets: data.question_sets.filter(questionSet => questionSet.source_section_id === section.id)
    })).sort((left, right) => String(left.book?.name || "").localeCompare(String(right.book?.name || ""), "zh-Hant")
        || pageNumber(left.page_from_label) - pageNumber(right.page_from_label)
        || Number(left.id) - Number(right.id)), [data]);
    const wholeBookState = useMemo(() => {
        const documents = data.documents.filter(document => Number(document.chunk_count) > 0).sort((left, right) => {
            const updatedDifference = Date.parse(right.created_at || right.updated_at || 0) - Date.parse(left.created_at || left.updated_at || 0);
            return updatedDifference || Number(right.id) - Number(left.id);
        });
        const currentByBook = new Map();
        const supersededDocumentIds = new Set();
        documents.forEach(document => {
            const bookKey = document.book_id == null ? `document-${document.id}` : `book-${document.book_id}`;
            if (currentByBook.has(bookKey)) supersededDocumentIds.add(String(document.id));
            else currentByBook.set(bookKey, document);
        });
        const rows = Array.from(currentByBook.values()).map(document => ({
            document,
            chunks: data.chunks.filter(chunk => String(chunk.document_id) === String(document.id)).sort((a, b) => a.chunk_index - b.chunk_index)
        }));
        return {
            rows,
            activeDocumentIds: new Set(rows.map(row => String(row.document.id))),
            supersededDocumentIds
        };
    }, [data.documents, data.chunks]);
    const wholeBookRows = wholeBookState.rows;
    const workbookOne = useMemo(() => data.books.find(book => String(book.code || book.name || "").toLowerCase().replace(/[^a-z0-9]/g, "") === "workbook1"), [data.books]);
    const workbookTwo = useMemo(() => data.books.find(book => String(book.code || book.name || "").toLowerCase().replace(/[^a-z0-9]/g, "") === "workbook2"), [data.books]);
    const workbookOneStarter = useMemo(() => data.question_sets.find(questionSet => questionSet.generation_metadata?.template_key === "workbook_1_name_intro_v1"), [data.question_sets]);
    const workbookTwoStarter = useMemo(() => data.question_sets.find(questionSet => questionSet.generation_metadata?.template_key === "workbook_2_origin_places_v1"), [data.question_sets]);
    const workbookOneFoundationSets = useMemo(() => new Map(data.question_sets
        .filter(questionSet => WORKBOOK_ONE_FOUNDATION_STARTERS.some(item => item.templateKey === questionSet.generation_metadata?.template_key))
        .map(questionSet => [questionSet.generation_metadata.template_key, questionSet])), [data.question_sets]);
    const workbookOnePageSets = useMemo(() => new Map(data.question_sets
        .filter(questionSet => WORKBOOK_ONE_PAGE_STARTERS.some(item => item.templateKey === questionSet.generation_metadata?.template_key))
        .map(questionSet => [questionSet.generation_metadata.template_key, questionSet])), [data.question_sets]);
    const questionSetSection = useMemo(() => new Map(sourceRows.flatMap(section => section.questionSets.map(questionSet => [Number(questionSet.id), section]))), [sourceRows]);
    const questionSetWorkflowStatus = useCallback(questionSet => {
        if (questionSet.status === "published") return "published";
        if (questionSet.status !== "draft") return questionSet.status;
        return draftReadiness(questionSet, questionSetSection.get(Number(questionSet.id))).ready ? "ready" : "draft";
    }, [questionSetSection]);
    const questionSetCounts = useMemo(() => ({
        draft: data.question_sets.filter(questionSet => questionSetWorkflowStatus(questionSet) === "draft").length,
        ready: data.question_sets.filter(questionSet => questionSetWorkflowStatus(questionSet) === "ready").length,
        published: data.question_sets.filter(questionSet => questionSet.status === "published").length,
        all: data.question_sets.length
    }), [data.question_sets, questionSetWorkflowStatus]);
    const pageCandidateReviewQueue = useMemo(() => data.question_sets
        .filter(questionSet => questionSet.status === "draft"
            && ["ocr_page_candidate", "ai_page_auto"].includes(questionSet.generation_metadata?.source)
            && questionSet.generation_metadata?.requires_content_review === true
            && !questionSet.generation_metadata?.content_reviewed_at)
        .sort((left, right) => {
            const leftPage = Number(String(left.generation_metadata?.source_page_label || "").replace(/\D/g, ""));
            const rightPage = Number(String(right.generation_metadata?.source_page_label || "").replace(/\D/g, ""));
            return leftPage - rightPage || Number(left.id) - Number(right.id);
        }), [data.question_sets]);
    const allPendingOcrSourceRows = useMemo(() => sourceRows.filter(section => (
        section.status === "draft"
        && section.questionSets.length === 0
        && section.document?.source_kind !== "pasted_text"
    )), [sourceRows]);
    const pendingOcrSourceRows = useMemo(() => allPendingOcrSourceRows.filter(section => (
        Number(section.document?.chunk_count) <= 0
        || wholeBookState.activeDocumentIds.has(String(section.document_id))
    )), [allPendingOcrSourceRows, wholeBookState.activeDocumentIds]);
    const pendingOcrGroups = useMemo(() => {
        const groups = new Map();
        pendingOcrSourceRows.forEach(section => {
            const key = section.book?.id == null ? `document-${section.document_id}` : `book-${section.book.id}`;
            if (!groups.has(key)) groups.set(key, {
                key,
                name: section.book?.name || section.document?.title || "未分類教材",
                sections: []
            });
            groups.get(key).sections.push(section);
        });
        return Array.from(groups.values()).sort((left, right) => left.name.localeCompare(right.name, "zh-Hant"));
    }, [pendingOcrSourceRows]);
    const hiddenPendingOcrCount = allPendingOcrSourceRows.length - pendingOcrSourceRows.length;
    const reviewedSourceRows = useMemo(() => sourceRows.filter(section => section.status === "reviewed"), [sourceRows]);
    const reviewedSourceGroups = useMemo(() => {
        const groups = new Map();
        reviewedSourceRows.forEach(section => {
            const key = section.book?.id == null ? `document-${section.document_id}` : `book-${section.book.id}`;
            if (!groups.has(key)) groups.set(key, {
                key,
                name: section.book?.name || section.document?.title || "未分類教材",
                sections: []
            });
            groups.get(key).sections.push(section);
        });
        return Array.from(groups.values()).sort((left, right) => left.name.localeCompare(right.name, "zh-Hant"));
    }, [reviewedSourceRows]);
    const reviewQueueCount = useMemo(() => (
        pendingOcrSourceRows.length
        + data.chunks.filter(chunk => chunk.status === "failed" && wholeBookState.activeDocumentIds.has(String(chunk.document_id))).length
    ), [data.chunks, pendingOcrSourceRows, wholeBookState.activeDocumentIds]);
    const visibleSourceRows = useMemo(() => {
        const query = questionSetSearch.trim().toLowerCase();
        return sourceRows.map(section => ({
            ...section,
            questionSets: section.questionSets.filter(questionSet => (
                (questionSetFilter === "all" || questionSetWorkflowStatus(questionSet) === questionSetFilter)
                && (bookFilter === "all" || Number(questionSet.book_id) === Number(bookFilter))
                && (!query || [questionSet.title, questionSet.topic, section.topic, section.unit_label]
                    .some(value => String(value || "").toLowerCase().includes(query)))
            ))
        })).filter(section => section.questionSets.length > 0);
    }, [bookFilter, questionSetFilter, questionSetSearch, questionSetWorkflowStatus, sourceRows]);
    const visibleQuestionSetRows = useMemo(() => visibleSourceRows.flatMap(section => {
        const pageCandidateSets = [];
        const sourceGroupedSets = [];
        section.questionSets.forEach(questionSet => {
            const pageLabels = questionSetPageLabels(questionSet, section);
            if (["ocr_page_candidate", "ai_page_auto"].includes(questionSet.generation_metadata?.source) && pageLabels.length === 1) {
                pageCandidateSets.push({ questionSet, pageLabel: pageLabels[0] });
            } else {
                sourceGroupedSets.push(questionSet);
            }
        });
        return [
            ...pageCandidateSets.map(({ questionSet, pageLabel }) => ({
                ...section,
                displayKey: `page-candidate-${questionSet.id}`,
                page_from_label: pageLabel,
                page_to_label: pageLabel,
                topic: questionSet.topic || section.topic,
                unit_label: `${pageLabel} 單頁關卡`,
                language_level: questionSet.difficulty || section.language_level,
                questionSets: [questionSet],
                isPageCandidateRow: true
            })),
            ...(sourceGroupedSets.length > 0 ? [{
                ...section,
                displayKey: `source-${section.id}`,
                questionSets: sourceGroupedSets,
                isPageCandidateRow: false
            }] : [])
        ];
    }).sort((left, right) => String(left.book?.name || "").localeCompare(String(right.book?.name || ""), "zh-Hant")
        || pageNumber(left.page_from_label) - pageNumber(right.page_from_label)
        || Number(left.questionSets[0]?.id || left.id) - Number(right.questionSets[0]?.id || right.id)), [visibleSourceRows]);
    const selectedQuestionSet = useMemo(() => data.question_sets.find(questionSet => Number(questionSet.id) === Number(selectedQuestionSetId)) || null, [data.question_sets, selectedQuestionSetId]);

    useEffect(() => {
        if (selectedQuestionSet && (questionSetFilter === "all" || questionSetWorkflowStatus(selectedQuestionSet) === questionSetFilter)) return;
        if (selectedQuestionSetId !== null) setSelectedQuestionSetId(null);
    }, [data.question_sets, loading, questionSetFilter, questionSetWorkflowStatus, selectedQuestionSet, selectedQuestionSetId]);

    useEffect(() => {
        const availableIds = new Set(pageCandidateReviewQueue.map(questionSet => Number(questionSet.id)));
        setSelectedPageCandidateIds(current => current.filter(id => availableIds.has(Number(id))));
    }, [pageCandidateReviewQueue]);

    const updateSource = (key, value) => setSource(current => ({ ...current, [key]: value }));
    const uploadWholeBook = async event => {
        event.preventDefault();
        if (!wholeBookFile) return toast.error("請選擇整本 PDF");
        setWorking("whole-book-upload");
        setWholeBookProgress({ phase: "splitting", completed: 0, total: 1 });
        try {
            await uploadWholeBookSource(firebaseUser, wholeBookFile, wholeBook, setWholeBookProgress);
            setWholeBook(emptyWholeBook);
            setWholeBookFile(null);
            setWholeBookProgress(null);
            toast.success("整本教材已安全分批上傳，可開始 OCR");
            await load();
        } catch (error) { toast.error(error.message || "整本教材上傳失敗"); }
        finally { setWorking(""); }
    };
    const processBookChunks = async (document, chunks) => {
        setWorking(`book-${document.id}`);
        let completed = 0;
        setWholeBookProgress({ phase: "ocr", completed, total: chunks.length, documentId: document.id });
        try {
            for (const chunk of chunks) {
                await extractSpeakingBookChunk(firebaseUser, chunk.id);
                completed += 1;
                setWholeBookProgress({ phase: "ocr", completed, total: chunks.length, documentId: document.id });
            }
            toast.success("可處理的教材批次 OCR 已完成，請逐批校正");
        } catch (error) { toast.error(`${error.message || "教材批次 OCR 失敗"}；已完成的批次會保留`); }
        finally { setWorking(""); setWholeBookProgress(null); await load(); }
    };
    const retryBookChunk = async chunk => {
        setWorking(`chunk-${chunk.id}`);
        try { await extractSpeakingBookChunk(firebaseUser, chunk.id); toast.success(`P${chunk.page_from}–P${chunk.page_to} 已重新辨識`); await load(); }
        catch (error) { toast.error(error.message || "教材批次重試失敗"); }
        finally { setWorking(""); }
    };
    const saveSource = async event => {
        event.preventDefault();
        if (sourceFile) {
            if (!SOURCE_TYPES.includes(sourceFile.type) || sourceFile.size > MAX_SOURCE_BYTES) return toast.error("只接受 20MB 以內的 PDF、JPG、PNG 或 WebP");
            setWorking("source");
            try {
                const metadata = { ...source, book_id: Number(source.book_id), source_text: undefined, confirmed: undefined };
                if (pendingDocumentId) await extractSpeakingSourceDocument(firebaseUser, { ...metadata, document_id: pendingDocumentId });
                else await uploadAndExtractSpeakingSource(firebaseUser, sourceFile, metadata);
                setSource(emptySource);
                setSourceFile(null);
                setPendingDocumentId(null);
                toast.success("OCR 已完成，請在下方逐頁校正並核准文字");
                await load();
            } catch (error) { if (error.documentId) setPendingDocumentId(error.documentId); toast.error(error.message); }
            finally { setWorking(""); }
            return;
        }
        if (!source.confirmed) return toast.error("請先確認教材文字與頁碼已人工核對");
        setWorking("source");
        try {
            await saveReviewedSpeakingSource(firebaseUser, { ...source, book_id: Number(source.book_id) });
            setSource(emptySource);
            toast.success("教材文字已保存，可交給 AI 規劃口說題目");
            await load();
        } catch (error) { toast.error(error.message); }
        finally { setWorking(""); }
    };
    const reviewOcr = async (sectionId, reviewed) => {
        setWorking(`review-${sectionId}`);
        try {
            await reviewSpeakingOcrSource(firebaseUser, { source_section_id: sectionId, ...reviewed });
            toast.success("OCR 教材文字已核准，現在可以產生口說題庫");
            await load();
        } catch (error) { toast.error(error.message); }
        finally { setWorking(""); }
    };
    const archiveSourceSection = async section => {
        if (section.questionSets.length > 0) {
            return toast.error("這份來源仍有草稿或已發布關卡，請先到對應區域處理關卡");
        }
        if (!window.confirm(`要封存「${section.book?.name || section.document?.title || "教材來源"} ${section.page_from_label || "未標示頁碼"}${section.page_to_label && section.page_to_label !== section.page_from_label ? `–${section.page_to_label}` : ""} · ${section.topic}」嗎？\n\n封存後會從教材來源清單隱藏，但不會刪除私人原檔、已封存關卡或學生歷史。`)) return;
        setWorking(`archive-source-${section.id}`);
        try {
            await archiveSpeakingSourceSection(firebaseUser, section.id);
            toast.success("舊教材來源已封存並從清單移除");
            await load();
        } catch (error) { toast.error(error.message || "教材來源封存失敗"); }
        finally { setWorking(""); }
    };
    const createWorkbookOneStarter = async () => {
        if (!workbookOne) return toast.error("目前教材清單找不到 Workbook 1");
        setWorking("workbook-1-starter");
        try {
            const result = await createWorkbookOneStarterQuestionSet(firebaseUser, workbookOne.id);
            toast.success(result.reused ? "Workbook 1 範例已存在，已帶您回到題庫草稿" : "Workbook 1 範例草稿已建立，請先預覽與修改再發布");
            await load();
        } catch (error) { toast.error(error.message || "Workbook 1 範例建立失敗"); }
        finally { setWorking(""); }
    };
    const createWorkbookOneFoundation = async starter => {
        if (!workbookOne) return toast.error("目前教材清單找不到 Workbook 1");
        setWorking(starter.action);
        try {
            const result = await createWorkbookOneFoundationQuestionSet(firebaseUser, workbookOne.id, starter.action);
            toast.success(result.reused ? `${starter.title}草稿已存在` : `${starter.title}草稿已建立；請先預覽再發布`);
            await load();
        } catch (error) { toast.error(error.message || `${starter.title}建立失敗`); }
        finally { setWorking(""); }
    };
    const confirmWorkbookOneFoundation = async (starter, questionSet) => {
        if (!window.confirm(`確認已逐題對照 Workbook 1 原頁面，並核對「${starter.title}」的文字與拼字嗎？`)) return;
        setWorking(`confirm-${questionSet.id}`);
        try {
            await confirmWorkbookOneFoundationSource(firebaseUser, questionSet.id);
            toast.success(`${starter.title}內容已核准，現在才可發布`);
            await load();
        } catch (error) { toast.error(error.message || `${starter.title}核准失敗`); }
        finally { setWorking(""); }
    };
    const createWorkbookTwoStarter = async () => {
        if (!workbookTwo) return toast.error("目前教材清單找不到 Workbook 2");
        setWorking("workbook-2-starter");
        try {
            const result = await createWorkbookTwoStarterQuestionSet(firebaseUser, workbookTwo.id);
            toast.success(result.reused ? "Workbook 2 精選關卡已存在，已帶您回到題庫草稿" : "Workbook 2 精選關卡草稿已建立，請先預覽與修改再發布");
            await load();
        } catch (error) { toast.error(error.message || "Workbook 2 精選關卡建立失敗"); }
        finally { setWorking(""); }
    };
    const generate = async section => {
        setWorking(`generate-${section.id}`);
        try {
            const result = await generateSpeakingQuestionSet(firebaseUser, {
                source_section_id: section.id,
                auto_question_count: true,
                request_key: createRequestKey()
            });
            setActiveWorkspace("drafts");
            setQuestionSetFilter("draft");
            setSelectedQuestionSetId(result.question_set_id);
            toast.success(`AI 已依本頁內容自動判斷並建立 ${result.question_count} 題；請逐題對照原頁核准`);
            await load();
        } catch (error) { toast.error(error.message); }
        finally { setWorking(""); }
    };
    const generatePageCandidates = async (section, requestedPages = markedSourcePageLabels(section)) => {
        const retainedPages = markedSourcePageLabels(section);
        const retainedPageSet = new Set(retainedPages);
        const pages = [...new Set(requestedPages)].filter(page => retainedPageSet.has(page));
        if (pages.length < 1 || pages.length > 10) {
            return toast.error("請先勾選 1 至 10 個要建立或重新產生草稿的頁面");
        }
        const existingByPage = new Map(section.questionSets
            .map(questionSet => [questionSetSingleSourcePage(questionSet), questionSet])
            .filter(([page]) => page));
        const publishedPages = pages.filter(page => existingByPage.get(page)?.status === "published");
        if (publishedPages.length > 0) {
            return toast.error(`${publishedPages.join("、")} 已發布，不能由此直接覆蓋；請先到已發布關卡建立新版草稿`);
        }
        const replacedPages = pages.filter(page => existingByPage.get(page)?.status === "draft");
        const replacementNotice = replacedPages.length
            ? `\n\n${replacedPages.join("、")} 已有未發布草稿。新草稿完整建立成功後才會取代舊草稿；若產生失敗，舊草稿會保留。`
            : "";
        if (!window.confirm(`本次只處理 ${pages.length} 頁：${pages.join("、")}。未勾選的頁面不會變更。\n\nAI 會依每頁實際內容自動判斷題數，單頁最多 30 題；OCR 逐字稿會繼續保留。${replacementNotice}`)) return;
        setWorking(`page-candidates-${section.id}`);
        setPageGenerationReport(null);
        let progressRows = pages.map(page => ({ page, status: "pending" }));
        setPageGenerationProgress({
            sectionId: Number(section.id), total: pages.length, completed: 0,
            currentPage: pages[0], rows: progressRows
        });
        const created = [];
        const skipped = [];
        try {
            for (const [pageIndex, page] of pages.entries()) {
                progressRows = progressRows.map(row => row.page === page ? { ...row, status: "processing" } : row);
                setPageGenerationProgress({
                    sectionId: Number(section.id), total: pages.length, completed: pageIndex,
                    currentPage: page, rows: progressRows
                });
                try {
                    const result = await generateSpeakingQuestionSet(firebaseUser, {
                        source_section_id: section.id,
                        source_page_label: page,
                        replace_question_set_id: existingByPage.get(page)?.status === "draft" ? existingByPage.get(page).id : undefined,
                        auto_question_count: true,
                        request_key: createRequestKey()
                    });
                    created.push(result);
                    progressRows = progressRows.map(row => row.page === page ? {
                        page, status: result.requires_manual_authoring ? "manual" : "created",
                        questionCount: Number(result.question_count || 0),
                        rejectedQuestionCount: Number(result.rejected_ai_question_count || 0),
                        generationStrategy: result.generation_strategy || null,
                        reason: result.manual_authoring_reason || null
                    } : row);
                } catch (error) {
                    skipped.push(`${page}：${error.message || "建立失敗"}`);
                    progressRows = progressRows.map(row => row.page === page ? {
                        page, status: "failed", message: error.message || "建立失敗"
                    } : row);
                }
                setPageGenerationProgress({
                    sectionId: Number(section.id), total: pages.length, completed: pageIndex + 1,
                    currentPage: pages[pageIndex + 1] || null, rows: progressRows
                });
            }
            if (created.length) {
                setQuestionSetFilter("draft");
                const firstReviewable = created.find(result => Number(result.question_count) > 0) || created[0];
                setSelectedQuestionSetId(firstReviewable.question_set_id);
                const manualCount = created.filter(result => result.requires_manual_authoring).length;
                toast.success(`已建立 ${created.length}/${pages.length} 個單頁草稿：${created.length - manualCount} 頁由 AI 產生題目、${manualCount} 頁待人工補題。`);
            }
            if (skipped.length) toast.warning(`未建立 ${skipped.length} 頁：${skipped.join("；")}`);
            setPageGenerationReport({
                sectionId: Number(section.id),
                rows: progressRows
            });
            setSelectedSourcePages(current => ({ ...current, [section.id]: [] }));
            await load();
        } finally {
            setPageGenerationProgress(null);
            setWorking("");
        }
    };
    const confirmPageCandidate = async questionSet => {
        const pageLabel = questionSet.generation_metadata?.source_page_label || "這一頁";
        const questionTotal = (questionSet.speaking_questions || []).length;
        if (!window.confirm(`確認已逐題對照 ${pageLabel} 原教材、核對 ${questionTotal} 題的拼字、句型與圖片需求嗎？\n\n核准後才可發布；之後若修改題目，必須重新核准。`)) return;
        setWorking(`confirm-page-${questionSet.id}`);
        try {
            await confirmPageCandidateSpeakingDraft(firebaseUser, questionSet.id);
            toast.success(`${pageLabel} 候選草稿已完成逐題核准，現在可以發布`);
            await load();
        } catch (error) { toast.error(error.message || "逐頁候選核准失敗"); }
        finally { setWorking(""); }
    };
    const togglePageCandidate = questionSetId => {
        setSelectedPageCandidateIds(current => current.includes(questionSetId)
            ? current.filter(id => id !== questionSetId)
            : [...current, questionSetId]);
    };
    const approveSelectedPageCandidates = async () => {
        const selectedCandidates = pageCandidateReviewQueue.filter(questionSet => selectedPageCandidateIds.includes(questionSet.id));
        if (selectedCandidates.length === 0) return toast.error("請先勾選已逐題核對原教材的候選草稿");
        const labels = selectedCandidates.map(questionSet => questionSet.generation_metadata?.source_page_label || questionSet.title);
        if (!window.confirm(`確認已逐題對照原教材、核對拼字、句型與圖片需求，並要批次核准 ${labels.join("、")} 共 ${selectedCandidates.length} 份草稿嗎？\n\n此操作只標記已人工審核的草稿，絕不會發布給學生；之後修改任何題目，仍須重新核准。`)) return;
        setWorking("approve-page-candidates");
        const approvedIds = [];
        const failed = [];
        try {
            for (const questionSet of selectedCandidates) {
                try {
                    await confirmPageCandidateSpeakingDraft(firebaseUser, questionSet.id);
                    approvedIds.push(questionSet.id);
                } catch (error) {
                    failed.push(`${questionSet.generation_metadata?.source_page_label || questionSet.title}：${error.message || "核准失敗"}`);
                }
            }
            if (approvedIds.length) {
                setSelectedPageCandidateIds(current => current.filter(id => !approvedIds.includes(id)));
                toast.success(`已核准 ${approvedIds.length} 份 OCR 候選草稿；仍需由你逐份按「核准並發布」才會提供給學生`);
            }
            if (failed.length) toast.warning(`有 ${failed.length} 份未核准：${failed.join("；")}`);
            await load();
        } finally { setWorking(""); }
    };
    const saveQuestion = async (questionId, question) => {
        setWorking(`question-${questionId}`);
        try { await updateDraftSpeakingQuestion(firebaseUser, { question_id: questionId, question }); toast.success("題目已更新"); await load(); }
        catch (error) { toast.error(error.message); }
        finally { setWorking(""); }
    };
    const createRevision = async questionSet => {
        setWorking(`revision-${questionSet.id}`);
        try {
            const result = await createSpeakingQuestionSetRevision(firebaseUser, questionSet.id);
            setQuestionSetFilter("ready");
            setActiveWorkspace("ready");
            setSelectedQuestionSetId(result.question_set_id);
            toast.success("新版草稿已建立；學生仍會使用目前正式版，直到你核准發布新版");
            await load();
        } catch (error) { toast.error(error.message || "新版草稿建立失敗"); }
        finally { setWorking(""); }
    };
    const archiveSet = async questionSet => {
        const isDraft = questionSet.status === "draft";
        const questionCount = (questionSet.speaking_questions || []).length;
        const confirmation = isDraft
            ? `確定刪除未發布草稿「${questionSet.title}」第 ${questionSet.version} 版嗎？\n\n草稿內的 ${questionCount} 題會一併刪除；已發布版本與學生進度不受影響。已核准 OCR 逐字稿會保留，可用來重新建立 AI 草稿。草稿刪除本身無法復原。`
            : `確定要下架正式關卡「${questionSet.title}」嗎？學生學習紀錄會保留。`;
        if (!window.confirm(confirmation)) return;
        setWorking(`archive-${questionSet.id}`);
        try {
            await archiveSpeakingQuestionSet(firebaseUser, questionSet.id);
            setSelectedQuestionSetId(null);
            toast.success(questionSet.status === "draft" ? "草稿已刪除；OCR 逐字稿仍保留，可重新建立" : "正式關卡已下架，歷史紀錄仍保留");
            await load();
        } catch (error) { toast.error(error.message || "關卡處理失敗"); }
        finally { setWorking(""); }
    };
    const reloadQuestionSet = async questionSetId => {
        setSelectedQuestionSetId(questionSetId);
        await load();
    };
    const openQuestionWorkspace = workspace => {
        const filter = workspace === "ready" ? "ready" : workspace === "published" ? "published" : "draft";
        setActiveWorkspace(workspace);
        setQuestionSetFilter(filter);
        setSelectedQuestionSetId(null);
    };
    const publish = async questionSet => {
        const section = questionSetSection.get(Number(questionSet.id));
        const readiness = draftReadiness(questionSet, section);
        if (!readiness.ready) {
            toast.error(`草稿還有 ${readiness.issues.length} 項需要處理；請查看紅色檢查清單`);
            return;
        }
        const interactionType = String(questionSet.generation_metadata?.interaction_type || "");
        const answerAudioEnabled = interactionType === "text_qa" && questionSet.generation_metadata?.requires_answer_audio === true;
        const pageLabels = questionSetPageLabels(questionSet, section);
        const publishPreparation = interactionType === "text_qa" && !answerAudioEnabled
            ? "這是純文字問答，不會產生或播放示範音檔"
            : "系統會先完成必要語音";
        if (!window.confirm(`即將發布：\n${section?.book?.name || "教材"} · ${pageLabels.join("、") || "未標示頁碼"}\n${questionSet.title} · ${(questionSet.speaking_questions || []).length} 題\n\n${publishPreparation}；發布後學生會立即看到此版本。之後修改請建立新版草稿。`)) return;
        setWorking(`publish-${questionSet.id}`);
        let published = false;
        try {
            if (interactionType === "mixed") {
                const questions = questionSet.speaking_questions || [];
                const hasStandard = questions.some(question => !asOne(question.speaking_question_interactions)?.interaction_type);
                const hasGap = questions.some(question => asOne(question.speaking_question_interactions)?.interaction_type === "picture_gap_sentence");
                const [standardAudio, gapAudio] = await Promise.all([
                    hasStandard ? generateSpeakingQuestionSetAudio(firebaseUser, questionSet.id) : Promise.resolve({ success: true }),
                    hasGap ? generateSpeakingVisibleWordAudio(firebaseUser, questionSet.id) : Promise.resolve({ success: true })
                ]);
                if (standardAudio.success !== true || Number(standardAudio.failed || 0) + Number(standardAudio.pending || 0) > 0) throw new Error("完整句示範語音尚未全部完成，草稿沒有發布");
                if (gapAudio.success !== true || Number(gapAudio.failed || 0) + Number(gapAudio.pending || 0) > 0) throw new Error("看圖補句停頓語音尚未全部完成，草稿沒有發布");
            } else if (interactionType === "picture_gap_sentence") {
                const audio = await generateSpeakingVisibleWordAudio(firebaseUser, questionSet.id);
                if (audio.success !== true || Number(audio.failed || 0) + Number(audio.pending || 0) > 0) throw new Error("停頓整句語音尚未全部完成，草稿沒有發布");
            } else if (answerAudioEnabled || !["picture_qa", "text_qa", "alphabet_round", "letter_spelling"].includes(interactionType)) {
                const audio = await generateSpeakingQuestionSetAudio(firebaseUser, questionSet.id);
                if (audio.success !== true || Number(audio.failed || 0) + Number(audio.pending || 0) > 0) throw new Error("示範語音尚未全部完成，草稿沒有發布");
            }
            await publishSpeakingQuestionSet(firebaseUser, questionSet.id);
            published = true;
            if (["alphabet_round", "letter_spelling", "picture_qa", "picture_gap_sentence", "text_qa"].includes(interactionType)) {
                const successMessage = {
                    alphabet_round: "A–Z 題庫已發布；單一慢速主音檔與 26 個播放區段已確認完成",
                    letter_spelling: "拼讀題庫已發布；學生端不播放答案音檔",
                    picture_qa: "P21 圖片問答已發布；完整答案只由後端核對",
                    picture_gap_sentence: "看圖補句已發布；逐字與空格停 2 秒的整句女聲發音已確認完成",
                    text_qa: answerAudioEnabled ? "文字問答與示範語音已發布" : "純文字問答已發布；不會產生或播放示範音檔"
                }[interactionType];
                toast.success(successMessage);
                await load();
                return;
            }
            toast.success("題庫與示範語音已完成並發布");
            await load();
        }
        catch (error) {
            if (published) toast.warning(`題庫已發布，但示範語音尚未完成：${error.message || "請稍後重試"}`);
            else toast.error(error.message || "題庫發布失敗");
            await load();
        }
        finally { setWorking(""); }
    };
    const generateAudio = async questionSet => {
        setWorking(`audio-${questionSet.id}`);
        try {
            const interactionType = String(questionSet.generation_metadata?.interaction_type || "");
            const audio = interactionType === "picture_gap_sentence"
                ? await generateSpeakingVisibleWordAudio(firebaseUser, questionSet.id)
                : await generateSpeakingQuestionSetAudio(firebaseUser, questionSet.id);
            const incomplete = Number(audio.failed || 0) + Number(audio.pending || 0);
            const firstFailure = (audio.results || []).find(result => result.status === "failed")?.error;
            if (audio.success !== true || incomplete > 0) toast.warning(incomplete > 0
                ? `仍有 ${incomplete} 題語音尚未完成${firstFailure ? `：${firstFailure}` : ""}`
                : "仍有部分語音尚未完成");
            else toast.success(`示範語音已完成（新產生 ${audio.generated}、沿用 ${audio.reused}）`);
        }
        catch (error) { toast.error(error.message || "示範語音產生失敗"); }
        finally { setWorking(""); }
    };
    const prepareAlphabetAudioCandidate = async questionSet => {
        setWorking(`alphabet-candidate-${questionSet.id}`);
        try {
            const result = await prepareSpeakingAlphabetAudioCandidate(firebaseUser, questionSet.id);
            setAlphabetCandidates({ candidates: result.candidates || [], questionSetId: questionSet.id });
            setAlphabetCandidatesListened({});
            toast.success(result.reused ? "已載入三個既有候選音檔，請逐一完整試聽" : "三個自然女聲 A–Z 候選音檔已完成，請逐一試聽");
        } catch (error) { toast.error(error.message || "A–Z 候選音檔產生失敗"); }
        finally { setWorking(""); }
    };
    const activateAlphabetAudioCandidate = async (questionSet, candidate) => {
        if (!candidate?.candidate_id || Number(alphabetCandidates?.questionSetId) !== Number(questionSet.id)) return;
        if (!window.confirm("確認已完整試聽 A 到 Z，包含 I、J、K、L、N、R、S、V、Z，音量與語氣都適合兒童嗎？核准後才會安全切換學生版本。")) return;
        setWorking(`alphabet-activate-${questionSet.id}`);
        try {
            await activateSpeakingAlphabetAudioCandidate(firebaseUser, questionSet.id, candidate.candidate_id);
            setAlphabetCandidates(null);
            toast.success("新版 A–Z 女聲音檔已安全啟用；舊版快照已保留供緊急人工回復");
            await load();
        } catch (error) { toast.error(error.message || "A–Z 候選音檔啟用失敗"); }
        finally { setWorking(""); }
    };

    return <main className="platform-page speaking-content-admin">
        <header className="platform-hero speaking-admin-hero"><div><h1>教材 AI 口說題庫</h1><p>每本教材、每一頁就是一個關卡；從來源、草稿、待發布到正式版本清楚分流。</p></div><button type="button" className="platform-primary speaking-create-shortcut" onClick={() => setActiveWorkspace("create")}><Plus size={18} />建立新關卡</button></header>

        <section className="platform-card speaking-admin-command" aria-labelledby="speaking-admin-command-title">
            <div className="speaking-admin-command__intro">
                <h2 id="speaking-admin-command-title">關卡製作流程</h2>
            </div>
            <nav className="speaking-admin-command__actions" aria-label="口說題庫快速操作">
                <button type="button" className={activeWorkspace === "sources" ? "is-primary" : ""} onClick={() => setActiveWorkspace("sources")}><UploadCloud /><span><strong>1 教材來源</strong><small>{reviewQueueCount} 個項目待核對</small></span></button>
                <button type="button" className={activeWorkspace === "drafts" ? "is-primary" : ""} onClick={() => openQuestionWorkspace("drafts")}><Wrench /><span><strong>2 製作中草稿</strong><small>{questionSetCounts.draft} 份需要處理</small></span></button>
                <button type="button" className={activeWorkspace === "ready" ? "is-primary" : ""} onClick={() => openQuestionWorkspace("ready")}><CheckCircle2 /><span><strong>3 待發布</strong><small>{questionSetCounts.ready} 份已通過內容檢查</small></span></button>
                <button type="button" className={activeWorkspace === "published" ? "is-primary" : ""} onClick={() => openQuestionWorkspace("published")}><FileText /><span><strong>4 已發布</strong><small>{questionSetCounts.published} 個學生版本</small></span></button>
            </nav>
        </section>

        {activeWorkspace === "create" && <>
        <section className="platform-card speaking-starter-card speaking-admin-block--curated" id="speaking-quick-create">
            <div><span className="platform-eyebrow">CURATED STARTER</span><h2>先建立第一個 Workbook 1 小關卡</h2><p>使用已人工規劃的 P18～P20「我的名字與自我介紹」，直接建立四題可編輯草稿；不執行 OCR，也不呼叫付費 AI。</p></div>
            <button type="button" className="platform-primary" disabled={!workbookOne || Boolean(workbookOneStarter) || working === "workbook-1-starter"} onClick={createWorkbookOneStarter}>
                <Sparkles size={17} />{working === "workbook-1-starter" ? "建立草稿中…" : workbookOneStarter ? (workbookOneStarter.status === "published" ? "範例已發布" : "範例草稿已建立") : "建立範例草稿"}
            </button>
            {!workbookOne && !loading && <p className="speaking-starter-card__warning"><AlertTriangle size={16} />目前教材清單找不到 Workbook 1，請先確認教材已啟用。</p>}
        </section>

        <section className="platform-card speaking-starter-card speaking-foundation-starters speaking-admin-block--curated">
            <div><span className="platform-eyebrow">WORKBOOK 1 FOUNDATIONS</span><h2>建立 A–Z 與 P14～P17 基礎口說草稿</h2><p>這些按鈕只建立可預覽草稿，不執行 OCR、不呼叫付費 AI，也不會自動發布。P14～P17 建立時會由後端逐字核對目前已發布的正式頁面來源。</p></div>
            <div className="speaking-foundation-starters__list">{WORKBOOK_ONE_FOUNDATION_STARTERS.map(starter => {
                const existing = workbookOneFoundationSets.get(starter.templateKey);
                const needsReview = existing?.generation_metadata?.requires_content_review === true
                    && !existing?.generation_metadata?.content_reviewed_at;
                return <article key={starter.action}>
                    <div><strong>{starter.title}</strong><small>{starter.note}</small></div>
                    {!existing && <button type="button" className="platform-primary" disabled={!workbookOne || working === starter.action} onClick={() => createWorkbookOneFoundation(starter)}>
                        <Sparkles size={17} />{working === starter.action ? "建立草稿中…" : "建立草稿"}
                    </button>}
                    {existing && needsReview && <button type="button" className="platform-secondary" disabled={working === `confirm-${existing.id}`} onClick={() => confirmWorkbookOneFoundation(starter, existing)}>
                        <CheckCircle2 size={17} />{working === `confirm-${existing.id}` ? "核准中…" : "已對照原頁，核准內容"}
                    </button>}
                    {existing && starter.templateKey === "workbook_1_alphabet_round_v1" && ["draft", "published"].includes(existing.status) && <>
                        <button type="button" className="platform-secondary" disabled={working === `alphabet-candidate-${existing.id}`} onClick={() => prepareAlphabetAudioCandidate(existing)}>
                            <Volume2 size={17} />{working === `alphabet-candidate-${existing.id}` ? "產生女聲候選音檔中…" : "產生／載入新版 A–Z 女聲候選音檔"}
                        </button>
                        {alphabetCandidates?.candidates?.length > 0 && Number(alphabetCandidates.questionSetId) === Number(existing.id) && <div className="speaking-alphabet-candidates">
                            <strong>先逐一完整試聽，再選一個套用</strong>
                            <span>三個 Chirp 3 HD 自然女聲 · 相同兒童友善語速 · Z 固定為美式 zee</span>
                            {alphabetCandidates.candidates.map(candidate => <div className="speaking-alphabet-candidate" key={candidate.candidate_id}>
                                <strong>{candidate.voice_label}</strong>
                                <span>單次連續念完 A–Z，不會拆成 26 次生成。</span>
                                <audio controls preload="metadata" src={candidate.audio_url} aria-label={`${candidate.voice_label} A–Z 女聲候選音檔`}
                                    onEnded={() => setAlphabetCandidatesListened(current => ({ ...current, [candidate.candidate_id]: true }))}
                                    onError={() => setAlphabetCandidatesListened(current => ({ ...current, [candidate.candidate_id]: false }))}
                                    onEmptied={() => setAlphabetCandidatesListened(current => ({ ...current, [candidate.candidate_id]: false }))}>瀏覽器不支援音訊播放。</audio>
                                {candidate.status === "ready" ? <button type="button" className="platform-primary" disabled={!alphabetCandidatesListened[candidate.candidate_id] || working === `alphabet-activate-${existing.id}`} onClick={() => activateAlphabetAudioCandidate(existing, candidate)}>
                                    <CheckCircle2 size={17} />{working === `alphabet-activate-${existing.id}` ? "安全切換中…" : `核准 ${candidate.voice_label} 套用學生版本`}
                                </button> : <span className="speaking-foundation-starters__status"><CheckCircle2 size={17} />這個候選音檔已是學生目前使用版本</span>}
                                {candidate.status === "ready" && !alphabetCandidatesListened[candidate.candidate_id] && <span>完整播放到結尾後，才會開放這個候選的核准按鈕。</span>}
                            </div>)}
                        </div>}
                    </>}
                    {existing && !needsReview && <span className="speaking-foundation-starters__status"><CheckCircle2 size={17} />{existing.status === "published" ? "已發布" : "草稿已建立"}</span>}
                </article>;
            })}</div>
            {!workbookOne && !loading && <p className="speaking-starter-card__warning"><AlertTriangle size={16} />目前教材清單找不到 Workbook 1，請先確認教材已啟用。</p>}
        </section>

        <section className="platform-card speaking-starter-card speaking-foundation-starters speaking-admin-block--curated">
            <div><span className="platform-eyebrow">WORKBOOK 1 · PAGE 26～27</span><h2>依頁碼建立下一關草稿</h2><p>此批只處理 P26～P27 的「完整句與縮寫」。建立後保持草稿，管理員逐題確認文字與答案後才可發布。</p></div>
            <div className="speaking-foundation-starters__list">{WORKBOOK_ONE_PAGE_STARTERS.map(starter => {
                const existing = workbookOnePageSets.get(starter.templateKey);
                const needsReview = existing?.generation_metadata?.requires_content_review === true
                    && !existing?.generation_metadata?.content_reviewed_at;
                return <article key={starter.action}>
                    <div><strong>{starter.title} <small>配合第 {starter.pages.replace("P", "")} 頁</small></strong><small>{starter.note}</small></div>
                    {!existing && <button type="button" className="platform-primary" disabled={!workbookOne || working === starter.action} onClick={() => createWorkbookOneFoundation(starter)}><Sparkles size={17} />{working === starter.action ? "建立草稿中…" : "建立草稿"}</button>}
                    {existing && needsReview && <button type="button" className="platform-secondary" disabled={working === `confirm-${existing.id}`} onClick={() => confirmWorkbookOneFoundation(starter, existing)}><CheckCircle2 size={17} />{working === `confirm-${existing.id}` ? "核准中…" : "已對照 P26～P27，核准內容"}</button>}
                    {existing && !needsReview && <span className="speaking-foundation-starters__status"><CheckCircle2 size={17} />{existing.status === "published" ? "已發布" : "草稿已建立"}</span>}
                </article>;
            })}</div>
        </section>

        <ManualSpeakingDraftAdmin firebaseUser={firebaseUser} books={data.books} onCreated={async questionSetId => {
            await load();
            if (questionSetId) {
                setQuestionSetFilter("draft");
                setSelectedQuestionSetId(questionSetId);
                setActiveWorkspace("drafts");
            }
        }} />

        <WorkbookOnePictureContentAdmin firebaseUser={firebaseUser} workbookOne={workbookOne} onCreated={load} />

        <section className="platform-card speaking-starter-card speaking-admin-block--curated">
            <div><span className="platform-eyebrow">CURATED WORKBOOK 2</span><h2>建立 Workbook 2「我來自哪裡？」</h2><p>依教師版 P56～P58 人工核對內容建立六題，練習 I／he／she／they 與 come from；不執行 OCR，也不呼叫付費 AI。</p></div>
            <button type="button" className="platform-primary" disabled={!workbookTwo || Boolean(workbookTwoStarter) || working === "workbook-2-starter"} onClick={createWorkbookTwoStarter}>
                <Sparkles size={17} />{working === "workbook-2-starter" ? "建立草稿中…" : workbookTwoStarter ? (workbookTwoStarter.status === "published" ? "關卡已發布" : "關卡草稿已建立") : "建立 Workbook 2 草稿"}
            </button>
            {!workbookTwo && !loading && <p className="speaking-starter-card__warning"><AlertTriangle size={16} />目前教材清單找不到 Workbook 2，請先確認教材已啟用。</p>}
        </section>
        </>}

        {activeWorkspace === "sources" && <>
        <nav className="platform-card speaking-source-tabs" aria-label="教材來源分類">
            <button type="button" className={activeSourceTab === "whole-book" ? "is-active" : ""} aria-current={activeSourceTab === "whole-book" ? "page" : undefined} onClick={() => setActiveSourceTab("whole-book")}><BookOpen size={19} /><span><strong>整本教材辨識</strong><small>{wholeBookRows.length} 本進行中</small></span></button>
            <button type="button" className={activeSourceTab === "ocr-review" ? "is-active" : ""} aria-current={activeSourceTab === "ocr-review" ? "page" : undefined} onClick={() => setActiveSourceTab("ocr-review")}><CheckCircle2 size={19} /><span><strong>核對 OCR 批次</strong><small>{pendingOcrSourceRows.length} 批待核對</small></span></button>
            <button type="button" className={activeSourceTab === "single-source" ? "is-active" : ""} aria-current={activeSourceTab === "single-source" ? "page" : undefined} onClick={() => setActiveSourceTab("single-source")}><Plus size={19} /><span><strong>單一範圍或貼入文字</strong><small>新增單一來源</small></span></button>
            <button type="button" className={activeSourceTab === "reviewed" ? "is-active" : ""} aria-current={activeSourceTab === "reviewed" ? "page" : undefined} onClick={() => setActiveSourceTab("reviewed")}><FileText size={19} /><span><strong>已核准教材頁面</strong><small>{reviewedSourceRows.length} 份可使用</small></span></button>
        </nav>

        {activeSourceTab === "whole-book" && <section className="platform-card speaking-whole-book speaking-admin-block--source" id="speaking-source-tools">
            <div className="platform-section-title"><div><span className="platform-eyebrow">WHOLE BOOK OCR</span><h2>整本教材分批辨識</h2><p>一次選擇完整 PDF；瀏覽器會在本機切成每 10 頁一批，私人上傳後可分批辨識、保留進度與單獨重試。</p></div></div>
            <form className="platform-form" onSubmit={uploadWholeBook}>
                <div className="platform-form-grid">
                    <label><span>教材</span><select required value={wholeBook.book_id} onChange={event => setWholeBook(current => ({ ...current, book_id: event.target.value }))}><option value="">請選擇</option>{data.books.map(book => <option value={book.id} key={book.id}>{book.name}</option>)}</select></label>
                    <label><span>大關卡名稱</span><input required value={wholeBook.document_title} onChange={event => setWholeBook(current => ({ ...current, document_title: event.target.value }))} placeholder="例如 Workbook 2 口說大關卡" /></label>
                </div>
                <label className="speaking-file-picker"><span>完整課本 PDF</span><input type="file" required accept=".pdf,application/pdf" onChange={event => setWholeBookFile(event.target.files?.[0] || null)} disabled={working === "whole-book-upload"} /><small>{wholeBookFile ? `${wholeBookFile.name} · ${(wholeBookFile.size / 1024 / 1024).toFixed(1)}MB` : "支援 1～500 頁、500MB 以內；單頁原始掃描可達 200MB。加密或損壞的 PDF 無法處理。"}</small></label>
                {working === "whole-book-upload" && wholeBookProgress && <div className="speaking-upload-progress" role="status"><LoaderCircle className="speaking-spin" /><div><strong>{wholeBookProgress.phase === "optimizing" ? `正在為 P${wholeBookProgress.pageFrom}–P${wholeBookProgress.pageTo} 建立高品質 OCR 副本` : wholeBookProgress.phase === "splitting" ? "正在本機分割 PDF" : wholeBookProgress.phase === "preparing" ? "正在建立私人上傳工作" : "正在上傳私人教材"}</strong><span>{wholeBookProgress.phase === "optimizing" && wholeBookProgress.currentPage ? `正在處理第 ${wholeBookProgress.currentPage} 頁；原始 PDF 不會被降畫質或覆蓋。` : wholeBookProgress.total > 1 ? `${wholeBookProgress.completed}/${wholeBookProgress.total} 個批次` : "請不要關閉這個頁面"}</span></div></div>}
                <button className="platform-primary" disabled={working === "whole-book-upload"}>{working === "whole-book-upload" ? "處理整本 PDF 中…" : "分批並安全上傳"}</button>
            </form>
            {wholeBookRows.length > 0 && <div className="speaking-book-jobs">{wholeBookRows.map(({ document, chunks }) => <WholeBookCard
                key={document.id} document={document} chunks={chunks}
                disabled={working === `book-${document.id}` || working.startsWith("chunk-")}
                onProcess={processBookChunks} onRetry={retryBookChunk}
            />)}</div>}
            {wholeBookState.supersededDocumentIds.size > 0 && <p className="speaking-source-retention-note"><Archive size={16} />已隱藏 {wholeBookState.supersededDocumentIds.size} 份同一本書的較舊整本 OCR 紀錄；來源資料與既有核准內容仍保留。</p>}
            {wholeBookProgress?.phase === "ocr" && <div className="speaking-ocr-floating-progress" role="status"><LoaderCircle className="speaking-spin" /><span>批次 OCR：{wholeBookProgress.completed}/{wholeBookProgress.total}</span></div>}
        </section>}

        {activeSourceTab === "ocr-review" && <section className="platform-card speaking-admin-block--source" aria-labelledby="speaking-ocr-review-title">
            <div className="platform-section-title"><div><span className="platform-eyebrow">OCR REVIEW</span><h2 id="speaking-ocr-review-title">待核對 OCR 批次</h2><p>逐批展開並對照原教材；只保留需要建立關卡頁面的 <code>[[PAGE P頁碼]]</code> 與內容。刪除整頁代表略過該頁，不要求原始範圍每頁都有標記。</p></div><strong>{pendingOcrSourceRows.length} 批</strong></div>
            {hiddenPendingOcrCount > 0 && <p className="speaking-source-retention-note"><Archive size={16} />已排除 {hiddenPendingOcrCount} 批較舊整本 OCR 的重複待核對項目；舊資料沒有刪除。</p>}
            {pendingOcrGroups.length === 0 ? <div className="platform-empty"><CheckCircle2 /><strong>目前沒有待核對 OCR 批次</strong><p>完成整本教材辨識後，批次會依書本名稱出現在這裡。</p></div> : <div className="speaking-ocr-book-groups">{pendingOcrGroups.map(group => <details className="speaking-ocr-book-group" key={group.key}>
                <summary><div><BookOpen size={20} /><span><strong>{group.name}</strong><small>{group.sections.length} 批待核對</small></span></div><ChevronDown size={20} /></summary>
                <div className="speaking-source-list">{group.sections.map(section => <details className="speaking-source-card speaking-ocr-source-card" key={`ocr-review-${section.id}`}>
                    <summary>
                        <div><span>{section.book?.name || section.document?.title || "教材來源"}</span><h3>{section.page_from_label || "未標示頁碼"}{section.page_to_label && section.page_to_label !== section.page_from_label ? `–${section.page_to_label}` : ""} · {section.topic}</h3><p>{section.unit_label || "未標示單元"} · 待人工核准</p></div>
                        <strong>展開核對</strong>
                    </summary>
                    <OcrReviewEditor section={section} disabled={working === `review-${section.id}`} onReview={reviewOcr} />
                </details>)}</div>
            </details>)}</div>}
        </section>}

        {activeSourceTab === "single-source" && <section className="platform-card speaking-admin-block--source">
            <div className="platform-section-title"><div><span className="platform-eyebrow">SINGLE SOURCE</span><h2>單一範圍或貼入文字</h2><p>適合單張課本圖片、單一 Unit 或已人工整理的教材文字。</p></div></div>
            <form className="platform-form" onSubmit={saveSource}>
                <div className="platform-form-grid">
                    <label><span>教材</span><select required value={source.book_id} onChange={event => updateSource("book_id", event.target.value)}><option value="">請選擇</option>{data.books.map(book => <option value={book.id} key={book.id}>{book.name}</option>)}</select></label>
                    <label><span>來源名稱</span><input required value={source.document_title} onChange={event => updateSource("document_title", event.target.value)} placeholder="例如 Workbook 2 Unit 3" /></label>
                    <label><span>Unit／單元</span><input value={source.unit_label} onChange={event => updateSource("unit_label", event.target.value)} placeholder="Unit 3" /></label>
                    <label><span>主題</span><input required value={source.topic} onChange={event => updateSource("topic", event.target.value)} placeholder="Food and breakfast" /></label>
                    <label><span>開始頁</span><input value={source.page_from_label} onChange={event => updateSource("page_from_label", event.target.value)} placeholder="P22" /></label>
                    <label><span>結束頁</span><input value={source.page_to_label} onChange={event => updateSource("page_to_label", event.target.value)} placeholder="P25" /></label>
                    <label><span>程度</span><select value={source.language_level} onChange={event => updateSource("language_level", event.target.value)}><option>國小低年級</option><option>國小中年級</option><option>國小高年級</option></select></label>
                </div>
                <label className="speaking-file-picker"><span>PDF／課本圖片（選填）</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={event => { setSourceFile(event.target.files?.[0] || null); setPendingDocumentId(null); }} disabled={working === "source"} /><small>{pendingDocumentId ? "檔案已安全上傳；上次 OCR 未完成，再按一次只會重試辨識，不會重複上傳。" : sourceFile ? `${sourceFile.name} · ${(sourceFile.size / 1024 / 1024).toFixed(1)}MB` : "單檔上限 20MB；檔案保存在私人 R2，不會產生公開網址。"}</small></label>
                <div className="speaking-source-divider"><span>或直接貼上文字</span></div>
                <label><span>已辨識並人工核對的教材文字</span><textarea required={!sourceFile} minLength="20" rows="12" value={source.source_text} onChange={event => updateSource("source_text", event.target.value)} disabled={Boolean(sourceFile)} placeholder="沒有 PDF／圖片時，可以直接貼入並校對教材文字。" /></label>
                {!sourceFile && <label className="speaking-confirm"><input type="checkbox" checked={source.confirmed} onChange={event => updateSource("confirmed", event.target.checked)} /><span>我已確認這段文字、教材、Unit 與頁碼正確，允許 AI 以此為唯一出題來源。</span></label>}
                <button className="platform-primary" disabled={working === "source"}>{working === "source" ? (sourceFile ? "上傳並辨識中…" : "儲存中…") : (pendingDocumentId ? "重試 OCR" : sourceFile ? "上傳並開始 OCR" : "儲存核准來源")}</button>
            </form>
        </section>}
        {activeSourceTab === "reviewed" && <section className="platform-card speaking-admin-block--source">
            <div className="platform-section-title"><div><span className="platform-eyebrow">REVIEWED PAGE SOURCES</span><h2>已核准教材頁面</h2><p>AI 會依每頁實際可出題內容自動判斷題數（單頁最多 30 題）；草稿建立後會移到「製作中草稿」等待人工核准。</p></div></div>
            {reviewedSourceRows.length === 0 ? <div className="platform-empty"><FileText /><strong>目前沒有已核准教材頁面</strong><p>請先到「核對 OCR 批次」完成校對，或新增已人工核對的文字來源。</p></div> : <div className="speaking-reviewed-book-groups">{reviewedSourceGroups.map(group => <details className="speaking-ocr-book-group speaking-reviewed-book-group" key={group.key}>
                <summary><div><BookOpen size={20} /><span><strong>{group.name}</strong><small>{group.sections.length} 份已核准來源</small></span></div><ChevronDown size={20} /></summary>
                <div className="speaking-source-list">{group.sections.map(section => {
                const pageLabels = sourcePageLabels(section);
                const isSinglePage = pageLabels.length === 1;
                const retainedPageLabels = markedSourcePageLabels(section);
                const canGenerateByPage = !isSinglePage && retainedPageLabels.length > 0 && retainedPageLabels.length <= 10;
                const selectedPages = selectedSourcePages[section.id] || [];
                const questionSetByPage = new Map(section.questionSets
                    .map(questionSet => [questionSetSingleSourcePage(questionSet), questionSet])
                    .filter(([page]) => page));
                const selectablePages = retainedPageLabels.filter(page => questionSetByPage.get(page)?.status !== "published");
                const generationReport = Number(pageGenerationReport?.sectionId) === Number(section.id) ? pageGenerationReport : null;
                const generationProgress = Number(pageGenerationProgress?.sectionId) === Number(section.id) ? pageGenerationProgress : null;
                const progressPercent = generationProgress ? Math.round((generationProgress.completed / generationProgress.total) * 100) : 0;
                return <article className="speaking-source-card" key={`source-${section.id}`}>
                    <header><div><span>{section.book?.name || section.document?.title || "教材來源"}</span><h3>{section.page_from_label || "未標示頁碼"}{section.page_to_label && section.page_to_label !== section.page_from_label ? `–${section.page_to_label}` : ""} · {section.topic}</h3><p>{section.unit_label || "未標示單元"} · 已人工核准{retainedPageLabels.length > 0 ? ` · 逐字稿保留 ${retainedPageLabels.join("、")}` : ""}</p></div><div className="speaking-source-card__actions">{isSinglePage && <button type="button" className="platform-primary" disabled={working === `generate-${section.id}`} onClick={() => generate(section)}><Sparkles size={17} />{working === `generate-${section.id}` ? "AI 產生中…" : "建立本頁 AI 草稿"}</button>}{!isSinglePage && !canGenerateByPage && <span className="speaking-source-card__page-note">核准逐字稿中沒有可用的 <code>[[PAGE P頁碼]]</code>；請保留至少一個要建立關卡的頁碼與內容。</span>}{section.questionSets.length === 0 ? <button type="button" className="platform-danger" disabled={working === `archive-source-${section.id}`} onClick={() => archiveSourceSection(section)}><Archive size={16} />{working === `archive-source-${section.id}` ? "封存中…" : "封存舊來源"}</button> : <span className="speaking-source-card__linked-note">已有 {section.questionSets.length} 個關卡，須先處理關卡才能封存來源。</span>}</div></header>
                    {canGenerateByPage && <section className="speaking-source-page-picker" aria-label={`${section.page_from_label} 到 ${section.page_to_label} 選擇要產生草稿的頁面`}>
                        <header><div><strong>選擇要建立或重新產生的頁面</strong><small>已有未發布草稿的頁面可直接重建；已發布頁面不會被覆蓋。</small></div><div><button type="button" className="platform-secondary" disabled={Boolean(generationProgress)} onClick={() => setSelectedSourcePages(current => ({ ...current, [section.id]: selectablePages }))}>選取可處理頁面</button><button type="button" className="platform-secondary" disabled={Boolean(generationProgress) || selectedPages.length === 0} onClick={() => setSelectedSourcePages(current => ({ ...current, [section.id]: [] }))}>清除</button></div></header>
                        <div className="speaking-source-page-picker__pages">{retainedPageLabels.map(page => {
                            const existing = questionSetByPage.get(page);
                            const published = existing?.status === "published";
                            const checked = selectedPages.includes(page);
                            return <label className={published ? "is-published" : existing?.status === "draft" ? "has-draft" : "is-new"} key={page}><input type="checkbox" aria-label={`選擇 ${page}${published ? "（已發布）" : existing?.status === "draft" ? "（已有草稿，重新產生）" : "（建立新草稿）"}`} checked={checked} disabled={published || Boolean(generationProgress)} onChange={() => setSelectedSourcePages(current => ({ ...current, [section.id]: checked ? selectedPages.filter(value => value !== page) : [...selectedPages, page] }))} /><span><strong>{page}</strong><small>{published ? "已發布，不直接覆蓋" : existing?.status === "draft" ? `已有 ${existing.speaking_questions?.length || 0} 題草稿，可重建` : "尚未建立"}</small></span></label>;
                        })}</div>
                        <button type="button" className="platform-primary speaking-source-page-picker__generate" disabled={Boolean(generationProgress) || selectedPages.length === 0} onClick={() => generatePageCandidates(section, selectedPages)}><Sparkles size={17} />{generationProgress ? `處理中 ${generationProgress.completed}/${generationProgress.total}` : selectedPages.length > 0 ? `建立／重新產生 ${selectedPages.length} 頁草稿` : "請先選擇頁面"}</button>
                    </section>}
                    <details className="speaking-source-transcript"><summary>查看已保留的核准逐字稿</summary><pre>{section.source_text}</pre><small>這份來源不會因建立、刪除或重新建立 AI 草稿而刪除。</small></details>
                    {generationProgress && <div className="speaking-page-generation-progress" role="status" aria-live="polite">
                        <header><strong>正在逐頁建立草稿</strong><span>{generationProgress.completed}/{generationProgress.total} · {progressPercent}%</span></header>
                        <p>{generationProgress.currentPage ? `正在處理 ${generationProgress.currentPage}：AI 分析、重複檢查與草稿儲存。` : "所有頁面已處理，正在重新整理草稿清單。"}</p>
                        <div className="speaking-page-generation-progress__track" role="progressbar" aria-label="逐頁草稿建立進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progressPercent}><span style={{ width: `${progressPercent}%` }} /></div>
                        <ul>{generationProgress.rows.map(row => <li className={`is-${row.status}`} key={row.page}><span>{row.page}</span><small>{pageGenerationStatusLabel(row)}</small></li>)}</ul>
                    </div>}
                    {generationReport && <div className="speaking-page-generation-report" role="status"><strong>本次逐頁建立結果</strong><ul>{generationReport.rows.map(row => <li className={`is-${row.status}`} key={row.page}><span>{row.page}</span><small>{pageGenerationStatusLabel(row)}</small></li>)}</ul></div>}
                </article>;
            })}</div>
            </details>)}</div>}
        </section>}
        </>}

        {["drafts", "ready", "published"].includes(activeWorkspace) &&
        <section className="platform-card speaking-bank-workspace" id="speaking-question-bank">
            <div className="platform-section-title"><div><span className="platform-eyebrow">PAGE-BASED QUESTION BANK</span><h2>{activeWorkspace === "drafts" ? "製作中草稿" : activeWorkspace === "ready" ? "待發布關卡" : "已發布關卡"}</h2><p>{activeWorkspace === "drafts" ? "只顯示仍有缺漏或尚未核准的草稿；展開即可修改。" : activeWorkspace === "ready" ? "內容已通過檢查；按一次即可準備必要語音並安全發布。" : "正式版本保持唯讀；需要修改時先建立新版草稿。"}</p></div><button type="button" className="platform-primary" onClick={() => setActiveWorkspace("create")}><Plus size={17} />新增關卡</button></div>
            <div className="speaking-bank-toolbar">
                <label><Search size={18} /><span className="sr-only">搜尋題庫</span><input value={questionSetSearch} onChange={event => setQuestionSetSearch(event.target.value)} placeholder="搜尋關卡名稱、主題或頁碼" /></label>
                <label><span className="sr-only">依教材篩選</span><select value={bookFilter} onChange={event => setBookFilter(event.target.value)}><option value="all">全部教材</option>{data.books.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}</select></label>
            </div>
            {activeWorkspace === "drafts" && pageCandidateReviewQueue.length > 0 && <section className="speaking-page-review-queue" aria-labelledby="speaking-page-review-queue-title">
                <header><div><span>OCR REVIEW QUEUE</span><h3 id="speaking-page-review-queue-title">逐頁候選待審核</h3><p>先在下方逐份展開檢查原教材，再勾選已核對的草稿。批次核准不會發布學生版本。</p></div><div className="speaking-page-review-queue__actions"><button type="button" className="platform-secondary" onClick={() => setSelectedPageCandidateIds(pageCandidateReviewQueue.filter(questionSet => (questionSet.speaking_questions || []).length > 0).map(questionSet => questionSet.id))}>選取全部已核對</button><button type="button" className="platform-primary" disabled={working === "approve-page-candidates" || selectedPageCandidateIds.length === 0} onClick={approveSelectedPageCandidates}>{working === "approve-page-candidates" ? "批次核准中…" : `批次核准 ${selectedPageCandidateIds.length} 份草稿`}</button></div></header>
                <div className="speaking-page-review-queue__items">{pageCandidateReviewQueue.map(questionSet => {
                    const metadata = questionSet.generation_metadata || {};
                    const pageLabel = metadata.source_page_label || questionSet.title;
                    const duplicateCount = Number(metadata.duplicate_review?.excluded_count || 0);
                    const imageSuggestionCount = Array.isArray(metadata.image_suggestions) ? metadata.image_suggestions.length : 0;
                    const questionCount = (questionSet.speaking_questions || []).length;
                    return <div className="speaking-page-review-queue__item" key={questionSet.id}>
                        <label><input type="checkbox" disabled={questionCount === 0} checked={selectedPageCandidateIds.includes(questionSet.id)} onChange={() => togglePageCandidate(questionSet.id)} aria-label={`已逐題核對 ${pageLabel} 候選草稿`} />
                            <span><strong>{pageLabel}</strong><small>{questionCount > 0 ? `${questionCount} 題${interactionTypeLabel(metadata.interaction_type)}候選` : manualAuthoringReasonLabel(metadata.manual_authoring_reason)}{duplicateCount > 0 ? ` · 已排除 ${duplicateCount} 題重複句` : ""}{imageSuggestionCount > 0 ? ` · ${imageSuggestionCount} 項圖片裁切提醒` : ""}</small></span>
                        </label><button type="button" className="platform-secondary" onClick={() => { setQuestionSetFilter("draft"); setSelectedQuestionSetId(questionSet.id); }}>{questionCount > 0 ? "打開檢查" : "打開補題"}</button>
                    </div>;
                })}</div>
            </section>}
            {loading ? <div className="platform-loading">題庫載入中…</div> : sourceRows.length === 0 ? <div className="platform-empty"><BookOpen /><strong>尚未建立教材來源</strong><p>請先到「教材來源」加入教材。</p></div> : visibleQuestionSetRows.length === 0 ? <div className="platform-empty"><BookOpen /><strong>這個區域目前沒有關卡</strong><p>{activeWorkspace === "ready" ? "完成草稿缺漏後，關卡會自動移到這裡。" : activeWorkspace === "published" ? "目前沒有符合篩選條件的正式關卡。" : "所有草稿都已完成內容檢查。"}</p></div> : <div className="speaking-source-list">{visibleQuestionSetRows.map(section => <article className="speaking-source-card" key={section.displayKey}>
                <header><div><span>{section.book?.name || "教材"}</span><h3>{section.page_from_label || "未標示頁碼"}{!section.isPageCandidateRow && section.page_to_label && section.page_to_label !== section.page_from_label ? `–${section.page_to_label}（舊版跨頁）` : ""} · {section.topic}</h3><p>{section.unit_label || "未標示單元"} · {section.language_level}</p></div></header>
                {section.status === "draft" && section.questionSets.some(questionSet => questionSet.generation_metadata?.requires_content_review)
                    ? <div className="speaking-ocr-review__notice"><strong>精選草稿尚未核准</strong><span>請先逐題對照 Workbook 1 原頁面，再使用上方對應關卡的「已對照原頁，核准內容」。</span></div>
                    : section.status === "draft" && <OcrReviewEditor section={section} disabled={working === `review-${section.id}`} onReview={reviewOcr} />}
                {section.questionSets.length === 0 ? <p className="speaking-source-card__empty">尚未產生題庫。</p> : section.questionSets.map(questionSet => {
                    const interactionType = String(questionSet.generation_metadata?.interaction_type || "");
                    const answerAudioEnabled = interactionType === "text_qa" && questionSet.generation_metadata?.requires_answer_audio === true;
                    const isPictureSet = ["picture_qa", "picture_gap_sentence"].includes(interactionType);
                    const isPageCandidate = ["ocr_page_candidate", "ai_page_auto"].includes(questionSet.generation_metadata?.source);
                    const isManualStandard = interactionType === "standard_sentence"
                        && ["admin_manual_builder", "ocr_page_candidate", "ai_page_auto"].includes(questionSet.generation_metadata?.source);
                    const candidateReviewed = Boolean(questionSet.generation_metadata?.content_reviewed_at);
                    const manualAuthoringReason = questionSet.generation_metadata?.manual_authoring_reason;
                    const duplicateReview = questionSet.generation_metadata?.duplicate_review;
                    const candidateFilter = questionSet.generation_metadata?.candidate_filter;
                    const isSelected = Number(selectedQuestionSetId) === Number(questionSet.id);
                    const readiness = draftReadiness(questionSet, section);
                    const pageLabels = questionSetPageLabels(questionSet, section);
                    const isLockedTemplate = interactionType === "alphabet_round"
                        || Boolean(questionSet.generation_metadata?.approved_source_page_label);
                    return <section className={`speaking-set ${questionSet.status} ${isSelected ? "is-current" : ""}`} key={questionSet.id}>
                        <div className="speaking-set__heading"><button type="button" className="speaking-set__selector" aria-expanded={isSelected} onClick={() => setSelectedQuestionSetId(current => Number(current) === Number(questionSet.id) ? null : questionSet.id)}><span>{questionSet.status === "published" ? "已發布" : readiness.ready ? "待發布" : "製作中"} · 第 {questionSet.version} 版</span><h4>{questionSet.title}</h4><small>{pageLabels.join("、") || "未標示頁碼"} · {questionSetOrigin(questionSet)} · {(questionSet.speaking_questions || []).length} 題 · {isSelected ? "點擊收合" : "點擊展開"}</small><ChevronDown className="speaking-set__chevron" size={18} /></button>{isSelected && <div className="speaking-set__actions">{questionSet.status === "draft" && isPageCandidate && !candidateReviewed && <button type="button" className="platform-secondary" disabled={working === `confirm-page-${questionSet.id}`} onClick={() => confirmPageCandidate(questionSet)}>{working === `confirm-page-${questionSet.id}` ? "核准中…" : "已逐題對照原頁，核准內容"}</button>}{questionSet.status === "draft" && readiness.ready && (["standard_sentence", "picture_gap_sentence"].includes(interactionType) || answerAudioEnabled) && <button type="button" className="platform-secondary" disabled={working === `audio-${questionSet.id}`} onClick={() => generateAudio(questionSet)}>{working === `audio-${questionSet.id}` ? "產生語音中…" : interactionType === "picture_gap_sentence" ? "先產生並試聽停頓語音" : "先產生並試聽示範語音"}</button>}{questionSet.status === "draft" && readiness.ready && <button type="button" className="platform-primary" disabled={working === `publish-${questionSet.id}`} onClick={() => publish(questionSet)}>{working === `publish-${questionSet.id}` ? interactionType === "text_qa" && !answerAudioEnabled ? "正在發布純文字關卡…" : "準備語音並發布中…" : interactionType === "text_qa" && !answerAudioEnabled ? "發布純文字關卡" : "準備語音並發布"}</button>}{questionSet.status === "published" && <a className="platform-secondary" href={`/student/speaking-challenges/${questionSet.id}`} target="_blank" rel="noreferrer"><Eye size={16} />學生版預覽</a>}{questionSet.status === "published" && !isLockedTemplate && <button type="button" className="platform-secondary" disabled={working === `revision-${questionSet.id}`} onClick={() => createRevision(questionSet)}><Pencil size={16} />{working === `revision-${questionSet.id}` ? "建立中…" : "建立新版草稿"}</button>}{questionSet.status === "published" && isLockedTemplate && <span className="speaking-set__locked">固定教材模板請從來源重建</span>}{questionSet.status === "published" && (interactionType !== "text_qa" || answerAudioEnabled) && <button type="button" className="platform-secondary" disabled={working === `audio-${questionSet.id}`} onClick={() => generateAudio(questionSet)}>{working === `audio-${questionSet.id}` ? "檢查語音中…" : interactionType === "picture_gap_sentence" ? "補產生停頓整句發音" : "補產生示範語音"}</button>}<button type="button" className="platform-danger" disabled={working === `archive-${questionSet.id}`} onClick={() => archiveSet(questionSet)}><Archive size={16} />{questionSet.status === "draft" ? "刪除草稿" : "下架"}</button></div>}</div>
                        {isSelected && questionSet.status === "draft" && <DraftReadinessPanel readiness={readiness} interactionType={interactionType} answerAudioEnabled={answerAudioEnabled} />}
                        {isSelected && manualAuthoringReason && <div className="speaking-ocr-review__notice"><strong>本頁已建立單頁草稿，等待人工補題</strong><span>{manualAuthoringReasonLabel(manualAuthoringReason)}</span></div>}
                        {isSelected && isPageCandidate && <div className="speaking-ocr-review__notice"><strong>{candidateReviewed ? "已完成逐題人工核准" : `${candidateFilter?.generation_strategy === "reviewed_numbered_text_qa" ? "核准文字逐頁候選" : "AI 逐頁候選"}草稿尚未核准 · ${interactionTypeLabel(interactionType)}`}</strong><span>{candidateReviewed ? interactionType === "text_qa" ? "可直接發布純文字問答，不會產生示範語音；若修改題目，會要求重新核准。" : "可繼續補產生示範語音或發布；若修改題目，會要求重新核准。" : interactionType === "text_qa" ? "請核對畫面問句、示範回答與其他可接受的完整答案。題目指定 he／his 或 she／her 時只能收相符答案；未指定性別時，男女兩種完整答案都要保留，學生只需回答其中一種。" : "請逐題對照原教材，再按「已逐題對照原頁，核准內容」。圖片只會提供裁切建議，仍須使用 PDF 擷取器自行選取並上傳。"}</span>{candidateFilter && (candidateFilter.generation_strategy === "reviewed_numbered_text_qa" ? <p>原檔共有 {candidateFilter.numbered_question_count ?? (questionSet.speaking_questions || []).length} 個編號題組，已維持一個編號一題；底線改為姓名、年齡或拼字等可變口說欄位，不會因此刪除整題，也不呼叫 AI 猜答案。</p> : <p>自動出題只採用 {candidateFilter.eligible_sentence_count} 句完整英文句，略過 {candidateFilter.discarded_segment_count} 段格線、頁碼、填空、標題或作業指令；原始 OCR 文字仍保留在教材來源卡供核對。</p>)}{candidateFilter?.generation_strategy === "ai_grouped_numbered_text_qa" && <p>已依教材題號與物品線索配對 {candidateFilter.numbered_question_count} 題；請逐題核對 AI 配對與完整答案。</p>}{(candidateFilter?.source_corrections || []).map(correction => <p key={correction.number} role="alert">第 {correction.number} 題：原文「{correction.original}」疑有文法錯字，草稿暫改「{correction.corrected}」；核准前請與原頁確認。</p>)}{Number(duplicateReview?.excluded_count || 0) > 0 && <div className="speaking-page-candidate__duplicates"><strong>已略過 {duplicateReview.excluded_count} 題重複完整句</strong><ul>{(duplicateReview.matches || []).map((match, index) => <li key={`${match.question_set_id || "generated"}-${index}`}>{match.sentence} → {match.source_page_label || match.title}（{match.status === "published" ? "已發布" : "草稿"}）</li>)}</ul></div>}{Array.isArray(questionSet.generation_metadata?.image_suggestions) && questionSet.generation_metadata.image_suggestions.length > 0 && <ul className="speaking-page-candidate__images">{questionSet.generation_metadata.image_suggestions.map((suggestion, index) => <li key={`${suggestion}-${index}`}>建議裁切：{suggestion}</li>)}</ul>}</div>}
                        {isSelected && <StudentQuestionSetPreview questionSet={questionSet} firebaseUser={firebaseUser} />}
                        {isSelected && (isPictureSet
                            ? questionSet.status === "draft"
                                ? <SpeakingPictureQuestionSetEditor firebaseUser={firebaseUser} questionSet={questionSet} onChanged={reloadQuestionSet} />
                                : <div className="speaking-ocr-review__notice"><strong>正式版本保持唯讀</strong><span>按「建立新版草稿」即可修改文字、圖片與順序；新版核准前，學生仍使用目前版本。</span></div>
                            : isManualStandard && questionSet.status === "draft"
                                ? <SpeakingManualStandardEditor firebaseUser={firebaseUser} questionSet={questionSet} onChanged={reloadQuestionSet} />
                                : <div className="speaking-question-list">{(questionSet.speaking_questions || []).sort((a, b) => a.sort_order - b.sort_order).map(question => <QuestionEditor key={question.id} question={question} interactionType={interactionType} disabled={questionSet.status !== "draft" || working === `question-${question.id}`} onSave={saveQuestion} />)}</div>)}
                    </section>;
                })}
            </article>)}</div>}
        </section>}
    </main>;
}
