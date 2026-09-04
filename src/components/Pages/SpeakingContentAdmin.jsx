import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { AlertTriangle, BookOpen, CheckCircle2, Eye, FileText, LoaderCircle, RefreshCcw, Sparkles, UploadCloud } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
    createWorkbookOneStarterQuestionSet,
    generateSpeakingQuestionSet,
    getSpeakingContentBootstrap,
    extractSpeakingSourceDocument,
    extractSpeakingBookChunk,
    generateSpeakingQuestionSetAudio,
    publishSpeakingQuestionSet,
    reviewSpeakingOcrSource,
    saveReviewedSpeakingSource,
    uploadAndExtractSpeakingSource,
    uploadWholeBookSource,
    updateDraftSpeakingQuestion
} from "../../services/speakingContentService";
import "./css/Platform.scss";
import "./css/SpeakingContentAdmin.scss";

const emptySource = {
    book_id: "", document_title: "", unit_label: "", page_from_label: "", page_to_label: "",
    topic: "", language_level: "國小中年級", source_text: "", confirmed: false
};
const SOURCE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const emptyWholeBook = { book_id: "", document_title: "" };

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
        <header><div><span>整本教材 · {document.page_count} 頁</span><h3>{document.title}</h3><p>{finished}/{chunks.length} 批已辨識 · {reviewed}/{chunks.length} 批已核准</p></div><strong>{percent}%</strong></header>
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
    return <div className="speaking-ocr-review">
        <div className="speaking-ocr-review__notice"><strong>AI 已完成文字辨識，尚未核准</strong><span>請對照原課本校正錯字、頁碼與題目順序；確認前不能交給 AI 出題。</span></div>
        <div className="platform-form">
            <div className="platform-form-grid">
                <label><span>Unit／單元</span><input value={form.unit_label} onChange={event => update("unit_label", event.target.value)} disabled={disabled} /></label>
                <label><span>主題</span><input required value={form.topic} onChange={event => update("topic", event.target.value)} disabled={disabled} /></label>
                <label><span>開始頁</span><input value={form.page_from_label} onChange={event => update("page_from_label", event.target.value)} disabled={disabled} /></label>
                <label><span>結束頁</span><input value={form.page_to_label} onChange={event => update("page_to_label", event.target.value)} disabled={disabled} /></label>
                <label><span>程度</span><select value={form.language_level} onChange={event => update("language_level", event.target.value)} disabled={disabled}><option>國小低年級</option><option>國小中年級</option><option>國小高年級</option></select></label>
            </div>
            <label><span>OCR 辨識文字</span><textarea rows="14" minLength="20" value={form.source_text} onChange={event => update("source_text", event.target.value)} disabled={disabled} /></label>
            <label className="speaking-confirm"><input type="checkbox" checked={form.confirmed} onChange={event => update("confirmed", event.target.checked)} disabled={disabled} /><span>我已逐頁對照原教材，確認文字、Unit、頁碼與主題正確。</span></label>
            <button type="button" className="platform-primary" disabled={disabled || !form.confirmed || form.source_text.trim().length < 20 || !form.topic.trim()} onClick={() => onReview(section.id, form)}>核准 OCR 教材文字</button>
        </div>
    </div>;
};

const StudentQuestionSetPreview = ({ questionSet }) => {
    const questions = [...(questionSet.speaking_questions || [])].sort((a, b) => a.sort_order - b.sort_order);
    return <details className="speaking-student-preview">
        <summary><Eye size={17} />預覽學生畫面</summary>
        <div className="speaking-student-preview__screen">
            <header><span>Workbook 1 口說大挑戰</span><h5>{questionSet.title}</h5><p>學生會先聽問題，自行回答；需要時才展開提示與示範句。</p></header>
            <div className="speaking-student-preview__questions">{questions.map((question, index) => <article key={question.id}>
                <span>第 {index + 1} 題</span><strong>{question.question_text}</strong>
                <details><summary>學生需要提示時顯示</summary><p>{question.hint_zh}</p><em>{question.simple_answer}</em></details>
                <small>{question.pronunciation_notes_zh || "完成錄音後顯示發音回饋。"}</small>
            </article>)}</div>
            <p className="speaking-student-preview__note">這是管理員內容預覽；錄音、AI 朗讀與逐字發音評分會在學生練習頁階段接上。</p>
        </div>
    </details>;
};

const QuestionEditor = ({ question, disabled, onSave }) => {
    const [form, setForm] = useState({
        question_text: question.question_text || "", hint_zh: question.hint_zh || "",
        keywords: (question.keywords || []).join("、"), simple_answer: question.simple_answer || "",
        model_answer: question.model_answer || "", follow_up_question: question.follow_up_question || "",
        pronunciation_notes_zh: question.pronunciation_notes_zh || "",
        accepted_intents: (question.accepted_intents || []).join("\n")
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
                <label><span>可接受回答意思（每行一項）</span><textarea rows="3" value={form.accepted_intents} onChange={event => update("accepted_intents", event.target.value)} disabled={disabled} /></label>
            </div>
            {!disabled && <button type="button" className="platform-secondary" onClick={() => onSave(question.id, {
                ...form,
                keywords: form.keywords.split(/[、,，]/).map(item => item.trim()).filter(Boolean),
                accepted_intents: form.accepted_intents.split("\n").map(item => item.trim()).filter(Boolean)
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
    const [questionCount, setQuestionCount] = useState(5);
    const [sourceFile, setSourceFile] = useState(null);
    const [pendingDocumentId, setPendingDocumentId] = useState(null);
    const [working, setWorking] = useState("");
    const [loading, setLoading] = useState(true);

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
        questionSets: data.question_sets.filter(questionSet => questionSet.source_section_id === section.id)
    })), [data]);
    const wholeBookRows = useMemo(() => data.documents.filter(document => Number(document.chunk_count) > 0).map(document => ({
        document,
        chunks: data.chunks.filter(chunk => chunk.document_id === document.id).sort((a, b) => a.chunk_index - b.chunk_index)
    })), [data.documents, data.chunks]);
    const workbookOne = useMemo(() => data.books.find(book => String(book.code || book.name || "").toLowerCase().replace(/[^a-z0-9]/g, "") === "workbook1"), [data.books]);
    const workbookOneStarter = useMemo(() => data.question_sets.find(questionSet => questionSet.generation_metadata?.template_key === "workbook_1_name_intro_v1"), [data.question_sets]);

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
    const generate = async section => {
        setWorking(`generate-${section.id}`);
        try {
            await generateSpeakingQuestionSet(firebaseUser, {
                source_section_id: section.id,
                question_count: Number(questionCount),
                request_key: window.crypto.randomUUID()
            });
            toast.success("AI 題庫草稿已產生，請逐題核對後再發布");
            await load();
        } catch (error) { toast.error(error.message); }
        finally { setWorking(""); }
    };
    const saveQuestion = async (questionId, question) => {
        setWorking(`question-${questionId}`);
        try { await updateDraftSpeakingQuestion(firebaseUser, { question_id: questionId, question }); toast.success("題目已更新"); await load(); }
        catch (error) { toast.error(error.message); }
        finally { setWorking(""); }
    };
    const publish = async questionSet => {
        if (!window.confirm(`確定發布「${questionSet.title}」嗎？發布後不能直接修改，修正時要建立新版本。`)) return;
        setWorking(`publish-${questionSet.id}`);
        let published = false;
        try {
            await publishSpeakingQuestionSet(firebaseUser, questionSet.id);
            published = true;
            const audio = await generateSpeakingQuestionSetAudio(firebaseUser, questionSet.id);
            if (audio.failed > 0) toast.warning(`題庫已發布，但有 ${audio.failed} 題語音尚未完成`);
            else toast.success(`題庫已發布，示範語音已完成（新產生 ${audio.generated}、沿用 ${audio.reused}）`);
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
            const audio = await generateSpeakingQuestionSetAudio(firebaseUser, questionSet.id);
            if (audio.failed > 0) toast.warning(`仍有 ${audio.failed} 題語音尚未完成`);
            else toast.success(`示範語音已完成（新產生 ${audio.generated}、沿用 ${audio.reused}）`);
        }
        catch (error) { toast.error(error.message || "示範語音產生失敗"); }
        finally { setWorking(""); }
    };

    return <main className="platform-page speaking-content-admin">
        <header className="platform-hero"><div><span className="platform-eyebrow">TEXTBOOK TO SPEAKING</span><h1>教材 AI 口說題庫</h1><p>上傳 PDF／課本圖片或貼入文字，先人工核對 OCR 結果，再讓 AI 根據教材主題規劃問題、提示與示範回答。</p></div></header>

        <section className="platform-card speaking-workflow" aria-label="製作流程">
            <div><UploadCloud /><strong>1. 上傳與 OCR</strong><span>私人保存 PDF／圖片</span></div><div><FileText /><strong>2. 人工核對</strong><span>校正文字與頁碼</span></div><div><Sparkles /><strong>3. AI 題庫</strong><span>逐題修改後發布</span></div>
        </section>

        <section className="platform-card speaking-starter-card">
            <div><span className="platform-eyebrow">CURATED STARTER</span><h2>先建立第一個 Workbook 1 小關卡</h2><p>使用已人工規劃的 P18～P20「我的名字與自我介紹」，直接建立四題可編輯草稿；不執行 OCR，也不呼叫付費 AI。</p></div>
            <button type="button" className="platform-primary" disabled={!workbookOne || Boolean(workbookOneStarter) || working === "workbook-1-starter"} onClick={createWorkbookOneStarter}>
                <Sparkles size={17} />{working === "workbook-1-starter" ? "建立草稿中…" : workbookOneStarter ? (workbookOneStarter.status === "published" ? "範例已發布" : "範例草稿已建立") : "建立範例草稿"}
            </button>
            {!workbookOne && !loading && <p className="speaking-starter-card__warning"><AlertTriangle size={16} />目前教材清單找不到 Workbook 1，請先確認教材已啟用。</p>}
        </section>

        <section className="platform-card speaking-whole-book">
            <div className="platform-section-title"><div><span className="platform-eyebrow">WHOLE BOOK OCR</span><h2>整本教材分批辨識</h2><p>一次選擇完整 PDF；瀏覽器會在本機切成每 10 頁一批，私人上傳後可分批辨識、保留進度與單獨重試。</p></div></div>
            <form className="platform-form" onSubmit={uploadWholeBook}>
                <div className="platform-form-grid">
                    <label><span>教材</span><select required value={wholeBook.book_id} onChange={event => setWholeBook(current => ({ ...current, book_id: event.target.value }))}><option value="">請選擇</option>{data.books.map(book => <option value={book.id} key={book.id}>{book.name}</option>)}</select></label>
                    <label><span>大關卡名稱</span><input required value={wholeBook.document_title} onChange={event => setWholeBook(current => ({ ...current, document_title: event.target.value }))} placeholder="例如 Workbook 2 口說大關卡" /></label>
                </div>
                <label className="speaking-file-picker"><span>完整課本 PDF</span><input type="file" required accept=".pdf,application/pdf" onChange={event => setWholeBookFile(event.target.files?.[0] || null)} disabled={working === "whole-book-upload"} /><small>{wholeBookFile ? `${wholeBookFile.name} · ${(wholeBookFile.size / 1024 / 1024).toFixed(1)}MB` : "支援 1～500 頁、100MB 以內；加密或損壞的 PDF 無法處理。"}</small></label>
                {working === "whole-book-upload" && wholeBookProgress && <div className="speaking-upload-progress" role="status"><LoaderCircle className="speaking-spin" /><div><strong>{wholeBookProgress.phase === "splitting" ? "正在本機分割 PDF" : wholeBookProgress.phase === "preparing" ? "正在建立私人上傳工作" : "正在上傳私人教材"}</strong><span>{wholeBookProgress.total > 1 ? `${wholeBookProgress.completed}/${wholeBookProgress.total} 個檔案` : "請不要關閉這個頁面"}</span></div></div>}
                <button className="platform-primary" disabled={working === "whole-book-upload"}>{working === "whole-book-upload" ? "處理整本 PDF 中…" : "分批並安全上傳"}</button>
            </form>
            {wholeBookRows.length > 0 && <div className="speaking-book-jobs">{wholeBookRows.map(({ document, chunks }) => <WholeBookCard
                key={document.id} document={document} chunks={chunks}
                disabled={working === `book-${document.id}` || working.startsWith("chunk-")}
                onProcess={processBookChunks} onRetry={retryBookChunk}
            />)}</div>}
            {wholeBookProgress?.phase === "ocr" && <div className="speaking-ocr-floating-progress" role="status"><LoaderCircle className="speaking-spin" /><span>批次 OCR：{wholeBookProgress.completed}/{wholeBookProgress.total}</span></div>}
        </section>

        <section className="platform-card">
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
        </section>

        <section className="platform-card">
            <div className="platform-section-title"><div><span className="platform-eyebrow">QUESTION BANKS</span><h2>來源與題庫草稿</h2></div><label className="speaking-count"><span>每次題數</span><select value={questionCount} onChange={event => setQuestionCount(Number(event.target.value))}>{[3, 5, 8, 10, 12].map(count => <option key={count}>{count}</option>)}</select></label></div>
            {loading ? <div className="platform-loading">題庫載入中…</div> : sourceRows.length === 0 ? <div className="platform-empty"><BookOpen /><strong>尚未建立教材來源</strong><p>先在上方貼入並核對第一個教材單元。</p></div> : <div className="speaking-source-list">{sourceRows.map(section => <article className="speaking-source-card" key={section.id}>
                <header><div><span>{section.document?.title || "教材來源"}{section.document?.original_filename ? ` · ${section.document.original_filename}` : ""}</span><h3>{section.topic}</h3><p>{section.unit_label || "未標示單元"} · {section.page_from_label || "未標示頁碼"}{section.page_to_label ? `–${section.page_to_label}` : ""} · {section.language_level}</p></div>{section.status === "reviewed" && <button type="button" className="platform-primary" disabled={working === `generate-${section.id}`} onClick={() => generate(section)}><Sparkles size={17} />{working === `generate-${section.id}` ? "AI 產生中…" : "產生新版草稿"}</button>}</header>
                {section.status === "draft" && <OcrReviewEditor section={section} disabled={working === `review-${section.id}`} onReview={reviewOcr} />}
                {section.questionSets.length === 0 ? <p className="speaking-source-card__empty">尚未產生題庫。</p> : section.questionSets.map(questionSet => <section className={`speaking-set ${questionSet.status}`} key={questionSet.id}>
                    <div className="speaking-set__heading"><div><span>第 {questionSet.version} 版 · {questionSet.status === "published" ? "已發布" : "草稿"}</span><h4>{questionSet.title}</h4></div>{questionSet.status === "draft" && <button type="button" className="platform-secondary" disabled={working === `publish-${questionSet.id}`} onClick={() => publish(questionSet)}>{working === `publish-${questionSet.id}` ? "發布與產生語音中…" : "核准、發布並產生語音"}</button>}{questionSet.status === "published" && <button type="button" className="platform-secondary" disabled={working === `audio-${questionSet.id}`} onClick={() => generateAudio(questionSet)}>{working === `audio-${questionSet.id}` ? "檢查語音中…" : "補產生示範語音"}</button>}</div>
                    <StudentQuestionSetPreview questionSet={questionSet} />
                    <div className="speaking-question-list">{(questionSet.speaking_questions || []).sort((a, b) => a.sort_order - b.sort_order).map(question => <QuestionEditor key={question.id} question={question} disabled={questionSet.status !== "draft" || working === `question-${question.id}`} onSave={saveQuestion} />)}</div>
                </section>)}
            </article>)}</div>}
        </section>
    </main>;
}
