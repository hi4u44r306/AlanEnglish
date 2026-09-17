import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, Plus, Save, Trash2, Volume2 } from "lucide-react";
import { toast } from "react-toastify";
import {
    addManualStandardQuestion,
    deleteDraftSpeakingQuestion,
    generateSpeakingQuestionSetAudio,
    getSpeakingQuestionAudioPreview,
    reorderDraftSpeakingQuestions,
    updateManualStandardQuestion,
    updateSpeakingQuestionSetDraft
} from "../../services/speakingContentService";

const readQuestion = question => ({
    full_sentence: question?.model_answer || question?.question_text || "",
    accepted_full_responses: (question?.accepted_intents || []).join("\n"),
    pronunciation_notes_zh: question?.pronunciation_notes_zh || ""
});
const emptyQuestion = () => ({ full_sentence: "", accepted_full_responses: "", pronunciation_notes_zh: "" });

export default function SpeakingManualStandardEditor({ firebaseUser, questionSet, onChanged }) {
    const questions = useMemo(() => [...(questionSet?.speaking_questions || [])]
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order)), [questionSet]);
    const [selectedId, setSelectedId] = useState(questions[0]?.id || null);
    const [form, setForm] = useState(() => readQuestion(questions[0]));
    const [setFormState, setSetFormState] = useState({ title: questionSet?.title || "", topic: questionSet?.topic || "" });
    const [adding, setAdding] = useState(false);
    const [working, setWorking] = useState("");
    const [audioUrl, setAudioUrl] = useState("");
    const selectedIndex = questions.findIndex(question => Number(question.id) === Number(selectedId));
    const selectedQuestion = selectedIndex >= 0 ? questions[selectedIndex] : questions[0];

    useEffect(() => {
        const next = questions.find(question => Number(question.id) === Number(selectedId)) || questions[0];
        if (next && !adding) {
            setSelectedId(next.id);
            setForm(readQuestion(next));
            setAudioUrl("");
        }
    }, [questionSet?.id, questionSet?.updated_at, questions, selectedId, adding]);
    useEffect(() => setSetFormState({ title: questionSet?.title || "", topic: questionSet?.topic || "" }), [questionSet?.id, questionSet?.title, questionSet?.topic]);
    const payload = () => ({
        full_sentence: form.full_sentence,
        accepted_full_responses: form.accepted_full_responses.split("\n").map(value => value.trim()).filter(Boolean),
        pronunciation_notes_zh: form.pronunciation_notes_zh
    });
    const saveSet = async () => {
        setWorking("set");
        try {
            await updateSpeakingQuestionSetDraft(firebaseUser, { question_set_id: questionSet.id, ...setFormState });
            toast.success("關卡名稱與主題已儲存");
            await onChanged?.(questionSet.id);
        } catch (error) { toast.error(error.message || "關卡資訊儲存失敗"); }
        finally { setWorking(""); }
    };
    const saveQuestion = async () => {
        setWorking("question");
        try {
            const result = adding
                ? await addManualStandardQuestion(firebaseUser, { question_set_id: questionSet.id, question: payload() })
                : await updateManualStandardQuestion(firebaseUser, { question_set_id: questionSet.id, question_id: selectedQuestion.id, question: payload() });
            setAdding(false);
            setSelectedId(result.question_id || selectedQuestion.id);
            toast.success(adding ? "新句子已加入草稿" : "句子已更新；文字變更時舊語音會自動作廢");
            await onChanged?.(questionSet.id);
        } catch (error) { toast.error(error.message || "句子儲存失敗"); }
        finally { setWorking(""); }
    };
    const move = async direction => {
        const nextIndex = selectedIndex + direction;
        if (selectedIndex < 0 || nextIndex < 0 || nextIndex >= questions.length) return;
        const ids = questions.map(question => question.id);
        [ids[selectedIndex], ids[nextIndex]] = [ids[nextIndex], ids[selectedIndex]];
        setWorking("order");
        try { await reorderDraftSpeakingQuestions(firebaseUser, questionSet.id, ids); await onChanged?.(questionSet.id); }
        catch (error) { toast.error(error.message || "題目排序失敗"); }
        finally { setWorking(""); }
    };
    const remove = async () => {
        if (!selectedQuestion || !window.confirm(`確定刪除第 ${selectedIndex + 1} 題嗎？`)) return;
        setWorking("delete");
        try {
            await deleteDraftSpeakingQuestion(firebaseUser, questionSet.id, selectedQuestion.id);
            setSelectedId(null);
            toast.success("句子已刪除");
            await onChanged?.(questionSet.id);
        } catch (error) { toast.error(error.message || "句子刪除失敗"); }
        finally { setWorking(""); }
    };
    const prepareAudio = async () => {
        setWorking("audio");
        try {
            const result = await generateSpeakingQuestionSetAudio(firebaseUser, questionSet.id);
            const incomplete = Number(result.failed || 0) + Number(result.pending || 0);
            if (result.success !== true || incomplete > 0) toast.warning(`仍有 ${incomplete || "部分"} 題語音尚未完成`);
            else toast.success(`示範語音完成（新產生 ${result.generated}、沿用 ${result.reused}）`);
            setAudioUrl("");
        } catch (error) { toast.error(error.message || "示範語音產生失敗"); }
        finally { setWorking(""); }
    };
    const previewAudio = async () => {
        if (!selectedQuestion) return;
        setWorking("preview");
        try {
            const result = await getSpeakingQuestionAudioPreview(firebaseUser, questionSet.id, selectedQuestion.id);
            setAudioUrl(result.audio_url || "");
        } catch (error) { toast.error(error.message || "請先產生示範語音"); }
        finally { setWorking(""); }
    };

    return <div className="speaking-picture-editor">
        <section className="speaking-picture-editor__set platform-form"><div className="platform-form-grid"><label><span>關卡名稱</span><input value={setFormState.title} onChange={event => setSetFormState(current => ({ ...current, title: event.target.value }))} /></label><label><span>主題分類</span><input value={setFormState.topic} onChange={event => setSetFormState(current => ({ ...current, topic: event.target.value }))} /></label></div><button type="button" className="platform-secondary" disabled={working === "set" || !setFormState.title.trim() || !setFormState.topic.trim()} onClick={saveSet}><Save size={17} />儲存關卡資訊</button></section>
        <div className="speaking-picture-editor__workspace">
            <aside className="speaking-picture-editor__navigator" aria-label="句子清單"><header><strong>朗讀句子</strong><span>{questions.length}</span></header><div>{questions.map((question, index) => <button type="button" key={question.id} className={!adding && Number(question.id) === Number(selectedQuestion?.id) ? "active" : ""} onClick={() => { setAdding(false); setSelectedId(question.id); setForm(readQuestion(question)); setAudioUrl(""); }}><strong>{index + 1}</strong><span>{question.model_answer}</span></button>)}</div><button type="button" className="speaking-picture-editor__add" disabled={questions.length >= 50} onClick={() => { setAdding(true); setSelectedId(null); setForm(emptyQuestion()); setAudioUrl(""); }}><Plus size={17} />新增一題</button></aside>
            <section className="speaking-picture-editor__detail"><header><div><span>{adding ? "新增題目" : `第 ${selectedIndex + 1} 題`}</span><h5>完整句朗讀</h5></div>{!adding && <div className="speaking-picture-editor__order"><button type="button" disabled={selectedIndex <= 0 || working === "order"} onClick={() => move(-1)} aria-label="題目往前移"><ArrowUp /></button><button type="button" disabled={selectedIndex >= questions.length - 1 || working === "order"} onClick={() => move(1)} aria-label="題目往後移"><ArrowDown /></button></div>}</header><div className="platform-form"><label><span>完整朗讀句子</span><input value={form.full_sentence} onChange={event => setForm(current => ({ ...current, full_sentence: event.target.value }))} /></label><label><span>其他可接受的完整說法（每行一項）</span><textarea rows="3" value={form.accepted_full_responses} onChange={event => setForm(current => ({ ...current, accepted_full_responses: event.target.value }))} /></label><label><span>發音提示（選填）</span><input value={form.pronunciation_notes_zh} onChange={event => setForm(current => ({ ...current, pronunciation_notes_zh: event.target.value }))} /></label><div className="speaking-picture-editor__actions"><button type="button" className="platform-primary" disabled={working === "question" || !form.full_sentence.trim()} onClick={saveQuestion}><Save size={17} />{adding ? "新增句子" : "儲存這一題"}</button>{!adding && <button type="button" className="platform-danger" disabled={working === "delete" || questions.length <= 1} onClick={remove}><Trash2 size={17} />刪除這一題</button>}</div>{!adding && <button type="button" className="platform-secondary" disabled={working === "preview"} onClick={previewAudio}><Eye size={17} />試聽這一題</button>}{audioUrl && <audio controls autoPlay src={audioUrl}>瀏覽器不支援音訊播放。</audio>}</div></section>
        </div>
        <button type="button" className="platform-secondary speaking-picture-editor__audio" disabled={working === "audio" || !questions.length} onClick={prepareAudio}><Volume2 size={17} />{working === "audio" ? "準備語音中…" : "產生／更新全部示範語音"}</button>
        {questions.length < 3 && <p className="speaking-picture-editor__warning">發布前至少需要 3 題；目前有 {questions.length} 題。</p>}
    </div>;
}
