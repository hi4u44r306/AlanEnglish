import React, { useEffect, useMemo, useState } from "react";
import { ImagePlus, Plus, Trash2, Volume2 } from "lucide-react";
import { toast } from "react-toastify";
import {
    createManualSpeakingDraft,
    discardWorkbookOnePictureDraft,
    generateSpeakingQuestionSetAudio,
    generateSpeakingVisibleWordAudio,
    uploadSpeakingQuestionPicture
} from "../../services/speakingContentService";
import SpeakingSelectedImagePreview from "./SpeakingSelectedImagePreview";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const isPictureType = type => ["picture_qa", "picture_gap_sentence"].includes(type);
const imageIsValid = file => Boolean(file && ALLOWED_IMAGE_TYPES.has(file.type) && file.size >= 1 && file.size <= MAX_IMAGE_BYTES);
let rowSequence = 0;
const newRow = (pageLabel = "P1") => ({
    key: `manual-speaking-${Date.now()}-${rowSequence += 1}`,
    page_label: pageLabel, full_sentence: "", prompt_text: "", answer_text: "",
    accepted_full_responses: "", pronunciation_notes_zh: "", alt_zh: "", file: null
});
const normalizedPage = value => {
    const match = String(value || "").trim().toUpperCase().match(/^P?([1-9][0-9]{0,3})$/);
    return match ? `P${Number(match[1])}` : "";
};
const pageOptions = (fromValue, toValue) => {
    const from = Number(normalizedPage(fromValue).slice(1));
    const to = Number(normalizedPage(toValue || fromValue).slice(1));
    if (!from || !to || from > to || to - from > 49) return [];
    return Array.from({ length: to - from + 1 }, (_, index) => `P${from + index}`);
};
const normalizeGapPrompt = value => String(value || "")
    .replace(/[_＿﹍﹎]{2,}/g, "____");
const gapPromptMatchesAnswer = (prompt, completeAnswer) => {
    const rawPieces = normalizeGapPrompt(prompt).trim().split(/_{2,}/);
    const blankCount = rawPieces.length - 1;
    if (blankCount < 1 || blankCount > 8) return false;
    const normalize = value => String(value || "").toLowerCase().replace(/[’]/g, "'")
        .replace(/[^a-z0-9'\s]+/g, " ").replace(/\s+/g, " ").trim();
    const pieces = rawPieces.map(piece => normalize(piece).split(" ").filter(Boolean));
    if (pieces.slice(1, -1).some(piece => piece.length === 0)) return false;
    const answer = normalize(completeAnswer).split(" ").filter(Boolean);
    if (!answer.length || !pieces.some(piece => piece.length)) return false;
    const matchesAt = (piece, start) => piece.every((token, offset) => answer[start + offset] === token);
    if (pieces[0].length && !matchesAt(pieces[0], 0)) return false;
    const matchRemaining = (pieceIndex, cursor) => {
        if (pieceIndex >= pieces.length) return cursor === answer.length;
        const piece = pieces[pieceIndex];
        const isLast = pieceIndex === pieces.length - 1;
        if (!piece.length) return isLast && cursor < answer.length;
        for (let start = cursor + 1; start + piece.length <= answer.length; start += 1) {
            if (!matchesAt(piece, start)) continue;
            const nextCursor = start + piece.length;
            if (isLast ? nextCursor === answer.length : matchRemaining(pieceIndex + 1, nextCursor)) return true;
        }
        return false;
    };
    return matchRemaining(1, pieces[0].length);
};

export default function ManualSpeakingDraftAdmin({ firebaseUser, books, onCreated }) {
    const [form, setForm] = useState({
        book_id: "", page_from_label: "P1", page_to_label: "P1", title: "", topic: "",
        difficulty: "國小低年級", interaction_type: "picture_gap_sentence"
    });
    const [rows, setRows] = useState(() => Array.from({ length: 3 }, () => newRow("P1")));
    const [working, setWorking] = useState(false);
    const pages = useMemo(() => pageOptions(form.page_from_label, form.page_to_label), [form.page_from_label, form.page_to_label]);
    const pictureMode = isPictureType(form.interaction_type);
    const gapMode = form.interaction_type === "picture_gap_sentence";
    useEffect(() => {
        if (!pages.length) return;
        setRows(current => current.map(row => pages.includes(normalizedPage(row.page_label))
            ? row : { ...row, page_label: pages[0] }));
    }, [pages]);
    const updateForm = (key, value) => {
        setForm(current => ({ ...current, [key]: value }));
    };
    const updateRow = (key, field, value) => {
        setRows(current => current.map(row => row.key === key ? { ...row, [field]: value } : row));
    };
    const changeType = type => {
        setForm(current => ({ ...current, interaction_type: type }));
        setRows(current => current.map(row => ({
            ...newRow(row.page_label), key: row.key,
            full_sentence: type === "standard_sentence" ? (row.full_sentence || row.answer_text) : ""
        })));
    };
    const addRow = () => setRows(current => current.length >= 50 ? current : [...current, newRow(pages[0] || "P1")]);
    const removeRow = key => setRows(current => current.length <= 1 ? current : current.filter(row => row.key !== key));
    const rowReady = row => {
        if (form.interaction_type === "standard_sentence") return Boolean(row.full_sentence.trim());
        if (gapMode) return Boolean(gapPromptMatchesAnswer(row.prompt_text, row.answer_text) && row.alt_zh.trim() && imageIsValid(row.file));
        return Boolean(row.prompt_text.trim().endsWith("?") && row.answer_text.trim() && row.alt_zh.trim() && imageIsValid(row.file));
    };
    const allReady = pages.length > 0 && rows.length > 0 && rows.every(row => pages.includes(normalizedPage(row.page_label)) && rowReady(row));

    const submit = async event => {
        event.preventDefault();
        if (!allReady) return toast.error("請完成頁碼與題目內容");
        setWorking(true);
        let draftId = null;
        let draftReadyForAudioRetry = false;
        try {
            const questions = rows.map(row => gapMode ? {
                prompt_text: normalizeGapPrompt(row.prompt_text), answer_text: row.answer_text,
                accepted_full_responses: row.accepted_full_responses.split("\n").map(value => value.trim()).filter(Boolean),
                pronunciation_notes_zh: row.pronunciation_notes_zh
            } : form.interaction_type === "picture_qa" ? {
                prompt_text: row.prompt_text, answer_text: row.answer_text,
                accepted_full_responses: row.accepted_full_responses.split("\n").map(value => value.trim()).filter(Boolean),
                pronunciation_notes_zh: row.pronunciation_notes_zh
            } : {
                full_sentence: row.full_sentence,
                accepted_full_responses: row.accepted_full_responses.split("\n").map(value => value.trim()).filter(Boolean),
                pronunciation_notes_zh: row.pronunciation_notes_zh
            });
            const draft = await createManualSpeakingDraft(firebaseUser, {
                ...form, book_id: Number(form.book_id), confirmed: true, questions
            });
            draftId = Number(draft.question_set_id);
            const createdQuestions = [...(draft.questions || [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
            if (createdQuestions.length !== rows.length) throw new Error("草稿題數與輸入題數不一致");
            if (pictureMode) {
                for (let index = 0; index < rows.length; index += 1) {
                    await uploadSpeakingQuestionPicture(
                        firebaseUser, Number(createdQuestions[index].id), normalizedPage(rows[index].page_label),
                        rows[index].alt_zh, rows[index].file
                    );
                }
            }
            draftReadyForAudioRetry = true;
            if (gapMode) {
                const audio = await generateSpeakingVisibleWordAudio(firebaseUser, draftId);
                if (audio.success !== true) throw new Error("部分停頓整句語音尚未完成");
            } else if (form.interaction_type === "standard_sentence") {
                const audio = await generateSpeakingQuestionSetAudio(firebaseUser, draftId);
                if (audio.success !== true) throw new Error("部分示範語音尚未完成");
            }
            toast.success(`草稿已建立：${rows.length} 題${gapMode ? "，停頓語音已完成" : form.interaction_type === "standard_sentence" ? "，示範語音已完成" : ""}`);
            setRows(Array.from({ length: 3 }, () => newRow(pages[0] || "P1")));
            await onCreated?.(draftId);
        } catch (error) {
            if (draftId && draftReadyForAudioRetry) {
                toast.warning(`${error.message || "語音尚未完成"}；草稿與圖片已保留，請在題庫管理展開此草稿後重試語音。`);
                await onCreated?.(draftId);
                return;
            }
            let rolledBack = false;
            if (draftId) {
                try { await discardWorkbookOnePictureDraft(firebaseUser, draftId); rolledBack = true; }
                catch { rolledBack = false; }
            }
            toast.error(draftId && rolledBack
                ? `${error.message || "草稿建立失敗"}；未完成內容已安全回復。`
                : error.message || "草稿建立失敗");
            await onCreated?.();
        } finally { setWorking(false); }
    };

    return <section className="platform-card speaking-picture-authoring speaking-admin-block--curated">
        <div className="platform-section-title"><div>
            <span className="platform-eyebrow">MANUAL CHALLENGE BUILDER</span>
            <h2>從頭建立自訂口說草稿</h2>
            <p>自行選教材與頁碼、輸入句子並上傳私人圖片；未按核准發布前，學生不會看到。</p>
        </div></div>
        <form className="platform-form" onSubmit={submit}>
            <div className="platform-form-grid">
                <label><span>教材</span><select required value={form.book_id} onChange={event => updateForm("book_id", event.target.value)} disabled={working}><option value="">請選擇教材</option>{books.filter(book => book.enabled !== false).map(book => <option key={book.id} value={book.id}>{book.name}</option>)}</select></label>
                <label><span>開始頁</span><input required value={form.page_from_label} onChange={event => updateForm("page_from_label", event.target.value)} placeholder="P28" disabled={working} /></label>
                <label><span>結束頁</span><input required value={form.page_to_label} onChange={event => updateForm("page_to_label", event.target.value)} placeholder="P29" disabled={working} /></label>
                <label><span>活動類型</span><select value={form.interaction_type} onChange={event => changeType(event.target.value)} disabled={working}><option value="picture_gap_sentence">看圖補完整句</option><option value="picture_qa">看圖說完整問答</option><option value="standard_sentence">完整句朗讀</option></select></label>
                <label><span>關卡名稱</span><input required value={form.title} onChange={event => updateForm("title", event.target.value)} disabled={working} /></label>
                <label><span>主題</span><input required value={form.topic} onChange={event => updateForm("topic", event.target.value)} disabled={working} /></label>
                <label><span>程度</span><select value={form.difficulty} onChange={event => updateForm("difficulty", event.target.value)} disabled={working}><option>國小低年級</option><option>國小中年級</option><option>國小高年級</option></select></label>
            </div>
            {form.book_id && <p className="speaking-picture-authoring__catalog-note">
                這本教材的第一個關卡發布後，學生端會自動建立「{books.find(book => String(book.id) === String(form.book_id))?.name || "此教材"}」口說大挑戰；小關卡會依學生版頁碼排序。草稿不會顯示給學生。
            </p>}
            <div className="speaking-picture-authoring__notice"><Volume2 size={18} /><span>{gapMode ? "直接輸入學生看到的題目，用 ____ 標示 1～8 個挖空；語音會在每個挖空處停頓 2 秒。" : form.interaction_type === "standard_sentence" ? "系統會朗讀完整句，不插入挖空停頓。" : "學生會看圖片，並在同一次錄音說出完整問句與回答。"}</span></div>
            <div className="speaking-picture-authoring__rows">{rows.map((row, index) => {
                return <article key={row.key}>
                    <header><strong>第 {index + 1} 題</strong><button type="button" className="platform-danger" disabled={working || rows.length <= 1} onClick={() => removeRow(row.key)}><Trash2 size={16} />刪除</button></header>
                    <div className="platform-form">
                        {pages.length > 1 && pictureMode && <label><span>圖片來源頁碼</span><select value={row.page_label} onChange={event => updateRow(row.key, "page_label", event.target.value)} disabled={working}>{pages.map(page => <option key={page}>{page}</option>)}</select></label>}
                        {gapMode && <><label><span>學生看到的題目（用 ____ 標示挖空）</span><input required value={row.prompt_text} onChange={event => updateRow(row.key, "prompt_text", event.target.value)} placeholder="They ____ her ____." disabled={working} /></label><label><span>補好答案的完整句子</span><input required value={row.answer_text} onChange={event => updateRow(row.key, "answer_text", event.target.value)} placeholder="They are her eyes." disabled={working} /></label><p className="speaking-picture-authoring__preview"><strong>學生看到：</strong>{row.prompt_text.trim() || "請輸入含有 ____ 的題目；每個挖空都要能由完整句子補回"}</p>{row.prompt_text.trim() && row.answer_text.trim() && !gapPromptMatchesAnswer(row.prompt_text, row.answer_text) && <p className="speaking-picture-editor__warning">請使用 1～8 個 ____（半形或全形底線都可以），並確認每個挖空都能由完整句子依序補回。</p>}</>}
                        {form.interaction_type === "picture_qa" && <><label><span>完整問句</span><input required value={row.prompt_text} onChange={event => updateRow(row.key, "prompt_text", event.target.value)} placeholder="What is that?" disabled={working} /></label><label><span>完整回答</span><input required value={row.answer_text} onChange={event => updateRow(row.key, "answer_text", event.target.value)} placeholder="It is a pencil." disabled={working} /></label></>}
                        {form.interaction_type === "standard_sentence" && <label><span>完整朗讀句子</span><input required value={row.full_sentence} onChange={event => updateRow(row.key, "full_sentence", event.target.value)} placeholder="This is a pencil." disabled={working} /></label>}
                        <label><span>其他可接受的完整說法（選填，每行一項）</span><textarea rows="2" value={row.accepted_full_responses} onChange={event => updateRow(row.key, "accepted_full_responses", event.target.value)} disabled={working} /></label>
                        <label><span>發音提示（選填）</span><input value={row.pronunciation_notes_zh} onChange={event => updateRow(row.key, "pronunciation_notes_zh", event.target.value)} disabled={working} /></label>
                        {pictureMode && <><div className="platform-form-grid"><label><span>圖片替代文字</span><input required value={row.alt_zh} onChange={event => updateRow(row.key, "alt_zh", event.target.value)} placeholder="描述圖片，不提示答案" disabled={working} /></label><label className="speaking-file-picker"><span><ImagePlus size={16} />題目圖片</span><input required type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={event => updateRow(row.key, "file", event.target.files?.[0] || null)} disabled={working} /><small>{row.file ? `${row.file.name} · ${(row.file.size / 1024 / 1024).toFixed(1)}MB` : "JPG、PNG 或 WebP，10MB 內"}</small></label></div><SpeakingSelectedImagePreview file={row.file} alt={row.alt_zh} /></>}
                    </div>
                </article>;
            })}</div>
            <button type="button" className="platform-secondary" disabled={working || rows.length >= 50} onClick={addRow}><Plus size={17} />新增一題</button>
            {rows.length < 3 && <p className="speaking-picture-editor__warning">草稿可以先保存，但發布前至少需要 3 題。</p>}
            <button className="platform-primary" disabled={working || !allReady || !form.book_id || !form.title.trim() || !form.topic.trim()}>{working ? "正在建立草稿與語音…" : "建立未發布草稿"}</button>
        </form>
    </section>;
}
