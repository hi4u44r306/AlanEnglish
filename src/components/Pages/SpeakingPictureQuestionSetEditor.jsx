import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, ImagePlus, Plus, Save, Trash2, Volume2 } from "lucide-react";
import { toast } from "react-toastify";
import {
    addPictureDraftQuestion,
    deleteDraftSpeakingQuestion,
    generateSpeakingVisibleWordAudio,
    getPictureGapTheAudioCandidates,
    getSpeakingQuestionAudioPreview,
    getSpeakingQuestionPicturePreview,
    reorderDraftSpeakingQuestions,
    updatePictureDraftQuestion,
    updateSpeakingQuestionSetDraft,
    uploadSpeakingQuestionPicture
} from "../../services/speakingContentService";
import SpeakingVisualAid from "./SpeakingVisualAid";

const EXPECTED_COUNTS = {
    workbook_1_p21_picture_qa_v1: 9,
    workbook_1_p22_picture_gap_v1: 9,
    workbook_1_p23_picture_gap_v1: 9,
    workbook_1_p24_picture_gap_v1: 8
};
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const asOne = value => Array.isArray(value) ? value[0] : value;
const pageLabelFor = questionSet => {
    const sourcePages = questionSet?.generation_metadata?.source_pages || [];
    if (!sourcePages.length) return "";
    return sourcePages.length === 1 ? `P${sourcePages[0]}` : `P${sourcePages[0]}～P${sourcePages[sourcePages.length - 1]}`;
};
const pageLabelsFor = questionSet => (questionSet?.generation_metadata?.source_pages || []).map(page => `P${page}`);
const readQuestion = question => {
    const interaction = asOne(question?.speaking_question_interactions) || {};
    const visualLink = asOne(question?.speaking_question_visual_assets) || {};
    const asset = asOne(visualLink?.speaking_visual_assets) || {};
    return {
        prompt_text: interaction.prompt_text || question?.question_text || "",
        answer_text: interaction.answer_text || question?.model_answer || "",
        accepted_full_responses: (interaction.accepted_full_responses || []).join("\n"),
        pronunciation_notes_zh: question?.pronunciation_notes_zh || "",
        alt_zh: asset.alt_zh || "", source_page_label: asset.source_page_label || "",
        file: null
    };
};
const emptyQuestion = pageLabel => ({
    prompt_text: "", answer_text: "", accepted_full_responses: "",
    pronunciation_notes_zh: "", alt_zh: "", source_page_label: pageLabel || "", file: null
});

export default function SpeakingPictureQuestionSetEditor({ firebaseUser, questionSet, onChanged }) {
    const questions = useMemo(() => [...(questionSet?.speaking_questions || [])]
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order)), [questionSet]);
    const [selectedId, setSelectedId] = useState(questions[0]?.id || null);
    const [form, setForm] = useState(() => readQuestion(questions[0]));
    const [setFormState, setSetFormState] = useState({ title: questionSet?.title || "", topic: questionSet?.topic || "" });
    const [adding, setAdding] = useState(false);
    const [working, setWorking] = useState("");
    const [preview, setPreview] = useState(null);
    const [audioUrl, setAudioUrl] = useState("");
    const [theAudioCandidates, setTheAudioCandidates] = useState([]);
    const interactionType = String(questionSet?.generation_metadata?.interaction_type || "");
    const isGap = interactionType === "picture_gap_sentence";
    const templateKey = String(questionSet?.generation_metadata?.template_key || "");
    const expectedCount = EXPECTED_COUNTS[templateKey] || null;
    const pageLabel = pageLabelFor(questionSet);
    const pageLabels = pageLabelsFor(questionSet);
    const selectedIndex = questions.findIndex(question => Number(question.id) === Number(selectedId));
    const selectedQuestion = selectedIndex >= 0 ? questions[selectedIndex] : questions[0];

    useEffect(() => {
        const next = questions.find(question => Number(question.id) === Number(selectedId)) || questions[0];
        if (next && !adding) {
            setSelectedId(next.id);
            setForm(readQuestion(next));
            setPreview(null);
            setAudioUrl("");
            setTheAudioCandidates([]);
        }
    }, [questionSet?.id, questionSet?.updated_at, questions, selectedId, adding]);
    useEffect(() => {
        setSetFormState({ title: questionSet?.title || "", topic: questionSet?.topic || "" });
    }, [questionSet?.id, questionSet?.title, questionSet?.topic]);

    const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
    const normalized = () => ({
        prompt_text: form.prompt_text,
        answer_text: form.answer_text,
        accepted_full_responses: form.accepted_full_responses.split("\n").map(value => value.trim()).filter(Boolean),
        pronunciation_notes_zh: form.pronunciation_notes_zh,
        alt_zh: form.alt_zh
    });
    const fileValid = !form.file || (ALLOWED_IMAGE_TYPES.has(form.file.type) && form.file.size >= 1 && form.file.size <= MAX_IMAGE_BYTES);

    const saveSet = async () => {
        setWorking("set");
        try {
            await updateSpeakingQuestionSetDraft(firebaseUser, {
                question_set_id: questionSet.id, title: setFormState.title, topic: setFormState.topic
            });
            toast.success("關卡名稱與主題已儲存");
            await onChanged?.(questionSet.id);
        } catch (error) { toast.error(error.message || "關卡資訊儲存失敗"); }
        finally { setWorking(""); }
    };
    const saveQuestion = async () => {
        if (!fileValid) return toast.error("圖片必須是 10MB 內的 JPG、PNG 或 WebP");
        if (adding && !form.file) return toast.error("新增題目時必須選擇圖片");
        setWorking("question");
        let questionId = selectedQuestion?.id;
        try {
            if (adding) {
                const created = await addPictureDraftQuestion(firebaseUser, {
                    question_set_id: questionSet.id, question: normalized()
                });
                questionId = created.question_id;
            } else {
                await updatePictureDraftQuestion(firebaseUser, {
                    question_set_id: questionSet.id, question_id: questionId, question: normalized()
                });
            }
            if (form.file) {
                await uploadSpeakingQuestionPicture(firebaseUser, Number(questionId), form.source_page_label || pageLabels[0], form.alt_zh, form.file);
            }
            toast.success(adding ? "新題目與圖片已加入草稿" : "題目內容已儲存");
            setAdding(false);
            setSelectedId(questionId);
            await onChanged?.(questionSet.id);
        } catch (error) { toast.error(error.message || "題目儲存失敗"); }
        finally { setWorking(""); }
    };
    const move = async direction => {
        const nextIndex = selectedIndex + direction;
        if (selectedIndex < 0 || nextIndex < 0 || nextIndex >= questions.length) return;
        const ids = questions.map(question => question.id);
        [ids[selectedIndex], ids[nextIndex]] = [ids[nextIndex], ids[selectedIndex]];
        setWorking("order");
        try {
            await reorderDraftSpeakingQuestions(firebaseUser, questionSet.id, ids);
            await onChanged?.(questionSet.id);
        } catch (error) { toast.error(error.message || "題目排序失敗"); }
        finally { setWorking(""); }
    };
    const remove = async () => {
        if (!selectedQuestion || !window.confirm(`確定刪除第 ${selectedIndex + 1} 題嗎？${expectedCount ? "草稿發布前仍須補回固定題數。" : "草稿至少必須保留一題。"}`)) return;
        setWorking("delete");
        try {
            await deleteDraftSpeakingQuestion(firebaseUser, questionSet.id, selectedQuestion.id);
            toast.success("題目已從草稿刪除");
            setSelectedId(null);
            await onChanged?.(questionSet.id);
        } catch (error) { toast.error(error.message || "題目刪除失敗"); }
        finally { setWorking(""); }
    };
    const loadPreview = async () => {
        if (!selectedQuestion) return;
        setWorking("preview");
        try { setPreview(await getSpeakingQuestionPicturePreview(firebaseUser, selectedQuestion.id)); }
        catch (error) { toast.error(error.message || "圖片預覽載入失敗"); }
        finally { setWorking(""); }
    };
    const prepareAudio = async () => {
        setWorking("audio");
        try {
            const result = await generateSpeakingVisibleWordAudio(firebaseUser, questionSet.id);
            const incomplete = Number(result.failed || 0) + Number(result.pending || 0);
            if (result.success !== true || incomplete > 0) toast.warning(`仍有 ${incomplete || "部分"} 項語音尚未完成`);
            else toast.success(`逐字與整句女聲已準備完成（新產生 ${result.generated}、沿用 ${result.reused}）`);
            setAudioUrl("");
            await onChanged?.(questionSet.id);
        } catch (error) { toast.error(error.message || "語音準備失敗"); }
        finally { setWorking(""); }
    };
    const previewAudio = async () => {
        if (!selectedQuestion) return;
        setWorking("audio-preview");
        try {
            const result = await getSpeakingQuestionAudioPreview(firebaseUser, questionSet.id, selectedQuestion.id);
            setAudioUrl(result.audio_url || "");
        } catch (error) { toast.error(error.message || "請先產生停頓語音"); }
        finally { setWorking(""); }
    };
    const previewTheCandidates = async () => {
        if (!selectedQuestion) return;
        setWorking("the-audio-candidates");
        try {
            const result = await getPictureGapTheAudioCandidates(firebaseUser, questionSet.id, selectedQuestion.id);
            setTheAudioCandidates(result.candidates || []);
        } catch (error) { toast.error(error.message || "The 弱讀候選載入失敗"); }
        finally { setWorking(""); }
    };
    const startAdd = () => {
        if (expectedCount && questions.length >= expectedCount) return toast.info(`本頁固定 ${expectedCount} 題；請先刪除要替換的題目`);
        if (!expectedCount && questions.length >= 50) return toast.info("自訂草稿最多 50 題");
        setAdding(true);
        setSelectedId(null);
        setForm(emptyQuestion(pageLabels[0]));
        setPreview(null);
        setTheAudioCandidates([]);
    };

    return <div className="speaking-picture-editor">
        <section className="speaking-picture-editor__set platform-form">
            <div className="platform-form-grid">
                <label><span>關卡名稱</span><input value={setFormState.title} onChange={event => setSetFormState(current => ({ ...current, title: event.target.value }))} /></label>
                <label><span>主題分類</span><input value={setFormState.topic} onChange={event => setSetFormState(current => ({ ...current, topic: event.target.value }))} /></label>
            </div>
            <button type="button" className="platform-secondary" disabled={working === "set" || !setFormState.title.trim() || !setFormState.topic.trim()} onClick={saveSet}><Save size={17} />儲存關卡資訊</button>
        </section>
        <div className="speaking-picture-editor__workspace">
            <aside className="speaking-picture-editor__navigator" aria-label="題目清單">
                <header><strong>{pageLabel} 題目</strong><span>{questions.length}{expectedCount ? `/${expectedCount}` : ""}</span></header>
                <div>{questions.map((question, index) => <button type="button" key={question.id} className={!adding && Number(question.id) === Number(selectedQuestion?.id) ? "active" : ""} onClick={() => { setAdding(false); setSelectedId(question.id); setForm(readQuestion(question)); setPreview(null); setTheAudioCandidates([]); }}>
                    <strong>{index + 1}</strong><span>{asOne(question.speaking_question_interactions)?.prompt_text || question.question_text}</span>
                </button>)}</div>
                <button type="button" className="speaking-picture-editor__add" disabled={expectedCount ? questions.length >= expectedCount : questions.length >= 50} onClick={startAdd}><Plus size={17} />新增一題</button>
            </aside>
            <section className="speaking-picture-editor__detail">
                <header><div><span>{adding ? "新增題目" : `第 ${selectedIndex + 1} 題`}</span><h5>{isGap ? "看圖補完整句" : "看圖說完整問答"}</h5></div>{!adding && <div className="speaking-picture-editor__order"><button type="button" disabled={selectedIndex <= 0 || working === "order"} onClick={() => move(-1)} aria-label="題目往前移"><ArrowUp /></button><button type="button" disabled={selectedIndex >= questions.length - 1 || working === "order"} onClick={() => move(1)} aria-label="題目往後移"><ArrowDown /></button></div>}</header>
                <div className="platform-form">
                    <label><span>{isGap ? "挖空句型（保留一個空格）" : "完整問句（結尾需有 ?）"}</span><input value={form.prompt_text} onChange={event => update("prompt_text", event.target.value)} placeholder={isGap ? "The ____ is in the race." : "What is that?"} /></label>
                    <label><span>{isGap ? "補好答案的完整句子" : "完整回答"}</span><input value={form.answer_text} onChange={event => update("answer_text", event.target.value)} placeholder={isGap ? "The horse is in the race." : "It is a horse."} /></label>
                    {pageLabels.length > 1 && <label><span>圖片來源頁碼{!adding && !form.file ? "（更換圖片時可修改）" : ""}</span><select value={form.source_page_label || pageLabels[0]} disabled={!adding && !form.file} onChange={event => update("source_page_label", event.target.value)}>{pageLabels.map(page => <option key={page}>{page}</option>)}</select></label>}
                    <label><span>其他可接受的完整說法（每行一項）</span><textarea rows="3" value={form.accepted_full_responses} onChange={event => update("accepted_full_responses", event.target.value)} /></label>
                    <label><span>發音提示（選填）</span><input value={form.pronunciation_notes_zh} onChange={event => update("pronunciation_notes_zh", event.target.value)} /></label>
                    <label className="speaking-file-picker"><span><ImagePlus size={16} />{adding ? "題目圖片" : "更換圖片（不選則保留目前圖片）"}</span><input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={event => update("file", event.target.files?.[0] || null)} /><small>{form.file ? `${form.file.name} · ${(form.file.size / 1024 / 1024).toFixed(1)}MB` : "JPG、PNG 或 WebP，單檔 10MB 內"}</small></label>
                    <label><span>圖片替代文字{!adding && !form.file ? "（更換圖片時可修改）" : ""}</span><input value={form.alt_zh} disabled={!adding && !form.file} onChange={event => update("alt_zh", event.target.value)} placeholder="簡短描述圖片，不提示答案" /></label>
                    {!fileValid && <p className="speaking-picture-editor__error">圖片格式或大小不符合規定。</p>}
                    {!adding && <button type="button" className="platform-secondary" disabled={working === "preview"} onClick={loadPreview}><Eye size={17} />查看目前圖片</button>}
                    {preview?.image_url && <SpeakingVisualAid aid={{ kind: "private-image", image_url: preview.image_url, alt_zh: preview.alt_zh }} />}
                    {!adding && isGap && <button type="button" className="platform-secondary" disabled={working === "audio-preview"} onClick={previewAudio}><Volume2 size={17} />試聽空格停 2 秒的整句</button>}
                    {audioUrl && <audio controls autoPlay src={audioUrl}>瀏覽器不支援音訊播放。</audio>}
                    {!adding && isGap && /^The\s+_+/i.test(asOne(selectedQuestion?.speaking_question_interactions)?.prompt_text || "") && <section className="speaking-picture-editor__voice-candidates" aria-label="The 弱讀候選">
                        <button type="button" className="platform-secondary" disabled={working === "the-audio-candidates"} onClick={previewTheCandidates}><Volume2 size={17} />{working === "the-audio-candidates" ? "產生候選中…" : "比較 The 弱讀候選"}</button>
                        {theAudioCandidates.length > 0 && <div>
                            <p>這些只供管理員試聽，不會替換學生目前的音檔。</p>
                            {theAudioCandidates.map(candidate => <label key={candidate.id}><span>{candidate.label}</span><audio controls preload="none" src={candidate.audio_url}>瀏覽器不支援音訊播放。</audio></label>)}
                        </div>}
                    </section>}
                    <div className="speaking-picture-editor__actions">
                        <button type="button" className="platform-primary" disabled={working === "question" || !form.prompt_text.trim() || !form.answer_text.trim() || !form.alt_zh.trim() || !fileValid} onClick={saveQuestion}><Save size={17} />{working === "question" ? "儲存中…" : adding ? "新增並上傳圖片" : "儲存這一題"}</button>
                        {!adding && <button type="button" className="platform-danger" disabled={working === "delete" || questions.length <= 1} onClick={remove}><Trash2 size={17} />刪除這一題</button>}
                        {adding && <button type="button" className="platform-secondary" onClick={() => { setAdding(false); setSelectedId(questions[0]?.id || null); setForm(readQuestion(questions[0])); }}>取消新增</button>}
                    </div>
                </div>
            </section>
        </div>
        {isGap && <button type="button" className="platform-secondary speaking-picture-editor__audio" disabled={working === "audio" || (expectedCount ? questions.length !== expectedCount : questions.length < 1)} onClick={prepareAudio}><Volume2 size={17} />{working === "audio" ? "準備女聲中…" : "更新逐字與整句女聲"}</button>}
        {expectedCount && questions.length !== expectedCount && <p className="speaking-picture-editor__warning">發布前必須補齊 {expectedCount} 題；目前有 {questions.length} 題。</p>}
        {!expectedCount && questions.length < 3 && <p className="speaking-picture-editor__warning">發布前至少需要 3 題；目前有 {questions.length} 題。</p>}
    </div>;
}
