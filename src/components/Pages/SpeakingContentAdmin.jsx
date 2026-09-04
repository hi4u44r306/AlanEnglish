import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { BookOpen, FileText, Sparkles, UploadCloud } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
    generateSpeakingQuestionSet,
    getSpeakingContentBootstrap,
    extractSpeakingSourceDocument,
    publishSpeakingQuestionSet,
    reviewSpeakingOcrSource,
    saveReviewedSpeakingSource,
    uploadAndExtractSpeakingSource,
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
    const [data, setData] = useState({ books: [], documents: [], sections: [], question_sets: [] });
    const [source, setSource] = useState(emptySource);
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

    const updateSource = (key, value) => setSource(current => ({ ...current, [key]: value }));
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
        try { await publishSpeakingQuestionSet(firebaseUser, questionSet.id); toast.success("口說題庫已發布"); await load(); }
        catch (error) { toast.error(error.message); }
        finally { setWorking(""); }
    };

    return <main className="platform-page speaking-content-admin">
        <header className="platform-hero"><div><span className="platform-eyebrow">TEXTBOOK TO SPEAKING</span><h1>教材 AI 口說題庫</h1><p>上傳 PDF／課本圖片或貼入文字，先人工核對 OCR 結果，再讓 AI 根據教材主題規劃問題、提示與示範回答。</p></div></header>

        <section className="platform-card speaking-workflow" aria-label="製作流程">
            <div><UploadCloud /><strong>1. 上傳與 OCR</strong><span>私人保存 PDF／圖片</span></div><div><FileText /><strong>2. 人工核對</strong><span>校正文字與頁碼</span></div><div><Sparkles /><strong>3. AI 題庫</strong><span>逐題修改後發布</span></div>
        </section>

        <section className="platform-card">
            <div className="platform-section-title"><div><span className="platform-eyebrow">PRIVATE SOURCE</span><h2>上傳或貼入教材來源</h2><p>建議每次上傳一個 Unit 或指定頁數，降低 OCR 成本並方便人工校對。</p></div></div>
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
                    <div className="speaking-set__heading"><div><span>第 {questionSet.version} 版 · {questionSet.status === "published" ? "已發布" : "草稿"}</span><h4>{questionSet.title}</h4></div>{questionSet.status === "draft" && <button type="button" className="platform-secondary" disabled={working === `publish-${questionSet.id}`} onClick={() => publish(questionSet)}>{working === `publish-${questionSet.id}` ? "發布中…" : "核准並發布"}</button>}</div>
                    <div className="speaking-question-list">{(questionSet.speaking_questions || []).sort((a, b) => a.sort_order - b.sort_order).map(question => <QuestionEditor key={question.id} question={question} disabled={questionSet.status !== "draft" || working === `question-${question.id}`} onSave={saveQuestion} />)}</div>
                </section>)}
            </article>)}</div>}
        </section>
    </main>;
}
