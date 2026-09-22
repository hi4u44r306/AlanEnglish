import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import {
    addManualStandardQuestion,
    addPictureDraftQuestion,
    deleteDraftSpeakingQuestion,
    getSpeakingQuestionPicturePreview,
    reorderDraftSpeakingQuestions,
    updateManualStandardQuestion,
    updatePictureDraftQuestion,
    updateSpeakingQuestionSetDraft,
    uploadSpeakingQuestionPicture
} from "../../services/speakingContentService";
import SpeakingPdfImageCropper from "./SpeakingPdfImageCropper";
import SpeakingSelectedImagePreview from "./SpeakingSelectedImagePreview";
import SpeakingVisualAid from "./SpeakingVisualAid";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const asOne = value => Array.isArray(value) ? value[0] : value;
const pageLabelFor = questionSet => `P${Number(questionSet?.generation_metadata?.source_pages?.[0] || 0)}`;
const interactionFor = question => asOne(question?.speaking_question_interactions);
const assetFor = question => asOne(asOne(question?.speaking_question_visual_assets)?.speaking_visual_assets);

const readQuestion = question => {
    const interaction = interactionFor(question);
    const asset = assetFor(question);
    const interactionType = interaction?.interaction_type || "standard_sentence";
    return {
        interaction_type: interactionType,
        full_sentence: interactionType === "standard_sentence" ? question?.model_answer || "" : "",
        prompt_text: interaction?.prompt_text || "",
        answer_text: interaction?.answer_text || "",
        accepted_full_responses: (interaction?.accepted_full_responses || []).join("\n"),
        pronunciation_notes_zh: question?.pronunciation_notes_zh || "",
        alt_zh: asset?.alt_zh || "",
        file: null
    };
};

const emptyQuestion = () => ({
    interaction_type: "picture_gap_sentence", full_sentence: "", prompt_text: "", answer_text: "",
    accepted_full_responses: "", pronunciation_notes_zh: "", alt_zh: "", file: null
});

const typeLabel = type => ({
    standard_sentence: "完整句朗讀",
    picture_qa: "看圖完整問答",
    picture_gap_sentence: "看圖補完整句"
}[type] || "口說題");

export default function SpeakingMixedPageQuestionSetEditor({ firebaseUser, questionSet, onChanged }) {
    const questions = useMemo(() => [...(questionSet?.speaking_questions || [])]
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order)), [questionSet]);
    const [selectedId, setSelectedId] = useState(questions[0]?.id || null);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState(() => readQuestion(questions[0]));
    const [setDetails, setSetDetails] = useState({ title: questionSet?.title || "", topic: questionSet?.topic || "" });
    const [working, setWorking] = useState("");
    const [preview, setPreview] = useState(null);
    const [showCropper, setShowCropper] = useState(false);
    const selectedIndex = questions.findIndex(question => Number(question.id) === Number(selectedId));
    const selectedQuestion = selectedIndex >= 0 ? questions[selectedIndex] : questions[0];
    const isPicture = form.interaction_type !== "standard_sentence";
    const hasExistingImage = Boolean(assetFor(selectedQuestion)?.status === "ready");
    const fileValid = !form.file || (ALLOWED_IMAGE_TYPES.has(form.file.type) && form.file.size >= 1 && form.file.size <= MAX_IMAGE_BYTES);
    const cropHint = (questionSet?.generation_metadata?.image_crop_hints || [])
        .find(hint => Number(hint.question_id) === Number(selectedQuestion?.id));

    useEffect(() => {
        if (adding) return;
        const next = questions.find(question => Number(question.id) === Number(selectedId)) || questions[0];
        if (next) {
            setSelectedId(next.id);
            setForm(readQuestion(next));
            setPreview(null);
            setShowCropper(false);
        }
    }, [adding, questionSet?.id, questionSet?.updated_at, questions, selectedId]);
    useEffect(() => setSetDetails({ title: questionSet?.title || "", topic: questionSet?.topic || "" }), [questionSet?.id, questionSet?.title, questionSet?.topic]);

    const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
    const reload = async questionId => {
        setAdding(false);
        setSelectedId(questionId || selectedId);
        setPreview(null);
        setShowCropper(false);
        await onChanged?.(questionSet.id);
    };
    const saveSet = async () => {
        setWorking("set");
        try {
            await updateSpeakingQuestionSetDraft(firebaseUser, { question_set_id: questionSet.id, title: setDetails.title, topic: setDetails.topic });
            toast.success("關卡名稱與主題已儲存");
            await reload();
        } catch (error) { toast.error(error.message || "關卡資訊儲存失敗"); }
        finally { setWorking(""); }
    };
    const saveQuestion = async () => {
        setWorking("question");
        try {
            let questionId = selectedQuestion?.id;
            if (form.interaction_type === "standard_sentence") {
                const payload = { full_sentence: form.full_sentence, accepted_full_responses: form.accepted_full_responses.split("\n").map(value => value.trim()).filter(Boolean), pronunciation_notes_zh: form.pronunciation_notes_zh };
                const result = adding
                    ? await addManualStandardQuestion(firebaseUser, { question_set_id: questionSet.id, question: payload })
                    : await updateManualStandardQuestion(firebaseUser, { question_id: questionId, question: payload });
                questionId = result.question_id || questionId;
            } else {
                const payload = {
                    interaction_type: form.interaction_type,
                    prompt_text: form.prompt_text,
                    answer_text: form.answer_text,
                    accepted_full_responses: form.accepted_full_responses.split("\n").map(value => value.trim()).filter(Boolean),
                    pronunciation_notes_zh: form.pronunciation_notes_zh,
                    alt_zh: form.alt_zh
                };
                if (adding && !form.file) throw new Error("新增看圖題時必須選擇或裁切一張原始教材圖片");
                const result = adding
                    ? await addPictureDraftQuestion(firebaseUser, { question_set_id: questionSet.id, question: payload })
                    : await updatePictureDraftQuestion(firebaseUser, { question_id: questionId, question: payload });
                questionId = result.question_id || questionId;
                if (form.file) await uploadSpeakingQuestionPicture(firebaseUser, questionId, pageLabelFor(questionSet), form.alt_zh, form.file);
            }
            toast.success(adding ? "題目已新增" : "題目已更新；請重新核准本頁內容");
            await reload(questionId);
        } catch (error) { toast.error(error.message || "題目儲存失敗"); }
        finally { setWorking(""); }
    };
    const remove = async () => {
        if (!window.confirm("確定刪除這一題嗎？其他題目會自動重新排序。")) return;
        setWorking("delete");
        try {
            await deleteDraftSpeakingQuestion(firebaseUser, questionSet.id, selectedQuestion.id);
            toast.success("題目已刪除");
            setSelectedId(null);
            await reload();
        } catch (error) { toast.error(error.message || "題目刪除失敗"); }
        finally { setWorking(""); }
    };
    const move = async direction => {
        const target = selectedIndex + direction;
        if (target < 0 || target >= questions.length) return;
        const ids = questions.map(question => question.id);
        [ids[selectedIndex], ids[target]] = [ids[target], ids[selectedIndex]];
        setWorking("order");
        try { await reorderDraftSpeakingQuestions(firebaseUser, questionSet.id, ids); await reload(selectedId); }
        catch (error) { toast.error(error.message || "題目排序失敗"); }
        finally { setWorking(""); }
    };
    const loadPreview = async () => {
        setWorking("preview");
        try { setPreview(await getSpeakingQuestionPicturePreview(firebaseUser, selectedQuestion.id)); }
        catch (error) { toast.error(error.message || "圖片預覽失敗"); }
        finally { setWorking(""); }
    };
    const valid = form.interaction_type === "standard_sentence"
        ? Boolean(form.full_sentence.trim())
        : Boolean(form.prompt_text.trim() && form.answer_text.trim() && form.alt_zh.trim() && fileValid && (!adding || form.file));

    return <div className="speaking-picture-editor speaking-mixed-page-editor">
        <section className="speaking-picture-editor__set platform-form">
            <div className="platform-form-grid"><label><span>關卡名稱</span><input value={setDetails.title} onChange={event => setSetDetails(current => ({ ...current, title: event.target.value }))} /></label><label><span>主題分類</span><input value={setDetails.topic} onChange={event => setSetDetails(current => ({ ...current, topic: event.target.value }))} /></label></div>
            <button type="button" className="platform-secondary" disabled={working === "set" || !setDetails.title.trim() || !setDetails.topic.trim()} onClick={saveSet}><Save size={17} />儲存關卡資訊</button>
        </section>
        <div className="speaking-picture-editor__workspace">
            <aside className="speaking-picture-editor__navigator" aria-label="題目清單"><header><strong>{pageLabelFor(questionSet)} 題目</strong><span>{questions.length}</span></header><div>{questions.map((question, index) => <button type="button" key={question.id} className={!adding && Number(question.id) === Number(selectedQuestion?.id) ? "active" : ""} onClick={() => { setAdding(false); setSelectedId(question.id); setForm(readQuestion(question)); setPreview(null); }}><strong>{index + 1}</strong><span>{typeLabel(interactionFor(question)?.interaction_type || "standard_sentence")} · {interactionFor(question)?.prompt_text || question.model_answer}</span></button>)}</div><button type="button" className="speaking-picture-editor__add" disabled={questions.length >= 50} onClick={() => { setAdding(true); setSelectedId(null); setForm(emptyQuestion()); setPreview(null); }}><Plus size={17} />新增一題</button></aside>
            <section className="speaking-picture-editor__detail"><header><div><span>{adding ? "新增題目" : `第 ${selectedIndex + 1} 題`}</span><h5>{typeLabel(form.interaction_type)}</h5></div>{!adding && <div className="speaking-picture-editor__order"><button type="button" disabled={selectedIndex <= 0 || working === "order"} onClick={() => move(-1)} aria-label="題目往前移"><ArrowUp /></button><button type="button" disabled={selectedIndex >= questions.length - 1 || working === "order"} onClick={() => move(1)} aria-label="題目往後移"><ArrowDown /></button></div>}</header>
                <div className="platform-form">
                    <label><span>題型</span><select value={form.interaction_type} disabled={!adding} onChange={event => update("interaction_type", event.target.value)}><option value="picture_gap_sentence">看圖補完整句</option><option value="picture_qa">看圖完整問答</option><option value="standard_sentence">完整句朗讀</option></select>{!adding && <small>既有題目要更換題型時，請刪除此題後重新新增，避免圖片與評分規則錯置。</small>}</label>
                    {form.interaction_type === "standard_sentence" ? <label><span>學生要朗讀的完整句</span><input value={form.full_sentence} onChange={event => update("full_sentence", event.target.value)} /></label> : <><label><span>{form.interaction_type === "picture_qa" ? "完整問句（需以 ? 結尾）" : "學生看到的題目（用 ____ 表示挖空）"}</span><input value={form.prompt_text} onChange={event => update("prompt_text", event.target.value)} /></label><label><span>補完後的完整答案</span><input value={form.answer_text} onChange={event => update("answer_text", event.target.value)} /></label></>}
                    <label><span>其他可接受的完整說法（每行一項）</span><textarea rows="3" value={form.accepted_full_responses} onChange={event => update("accepted_full_responses", event.target.value)} /></label>
                    <label><span>發音提示（選填）</span><input value={form.pronunciation_notes_zh} onChange={event => update("pronunciation_notes_zh", event.target.value)} /></label>
                    {isPicture && <><label><span>圖片替代文字</span><input value={form.alt_zh} onChange={event => update("alt_zh", event.target.value)} /></label><label className="speaking-file-picker"><span><ImagePlus size={16} />{adding ? "題目圖片" : "更換圖片（不選則保留）"}</span><input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={event => update("file", event.target.files?.[0] || null)} /><small>{form.file ? `${form.file.name} · ${(form.file.size / 1024 / 1024).toFixed(1)}MB` : "圖片必須來自原始教材 PDF；可使用下方裁切工具"}</small></label><button type="button" className="platform-secondary" onClick={() => setShowCropper(current => !current)}><ImagePlus size={17} />{showCropper ? "關閉 PDF 裁切" : "從原始 PDF 高解析裁切"}</button>{showCropper && <SpeakingPdfImageCropper onClose={() => setShowCropper(false)} onUseCrop={file => { update("file", file); setShowCropper(false); }} />}{form.file && <SpeakingSelectedImagePreview file={form.file} alt={form.alt_zh} />}{!adding && hasExistingImage && !form.file && <button type="button" className="platform-secondary" disabled={working === "preview"} onClick={loadPreview}><Eye size={17} />查看目前圖片</button>}{preview?.image_url && !form.file && <SpeakingVisualAid variant="admin" aid={{ kind: "private-image", image_url: preview.image_url, alt_zh: preview.alt_zh }} />}{cropHint && <p className={`speaking-picture-editor__warning${cropHint.confidence === "low" ? " is-error" : ""}`}>原始 PDF 自動框選信心：{cropHint.confidence === "high" ? "高" : cropHint.confidence === "medium" ? "中" : "低，請手動重新裁切"}</p>}</>}
                    {!fileValid && <p className="speaking-picture-editor__error">圖片格式或大小不符合規定。</p>}
                    <div className="speaking-picture-editor__actions"><button type="button" className="platform-primary" disabled={working === "question" || !valid} onClick={saveQuestion}><Save size={17} />{working === "question" ? "儲存中…" : adding ? "新增這一題" : "儲存這一題"}</button>{!adding && <button type="button" className="platform-danger" disabled={working === "delete" || questions.length <= 1} onClick={remove}><Trash2 size={17} />刪除這一題</button>}{adding && <button type="button" className="platform-secondary" onClick={() => { setAdding(false); setSelectedId(questions[0]?.id || null); setForm(readQuestion(questions[0])); }}>取消新增</button>}</div>
                </div>
            </section>
        </div>
    </div>;
}
