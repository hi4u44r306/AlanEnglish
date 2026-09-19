import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ImagePlus, Plus, Trash2, Volume2, X } from "lucide-react";
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

const TYPE_LABELS = {
    picture_gap_sentence: "看圖補完整句",
    picture_qa: "看圖說完整問答",
    standard_sentence: "完整句朗讀"
};
const acceptedResponses = value => String(value || "").split("\n").map(item => item.trim()).filter(Boolean);
const pictureQaResponseHasQuestionAndAnswer = value => {
    const raw = String(value || "");
    const questionEnd = raw.indexOf("?");
    if (questionEnd < 0) return false;
    const words = text => text.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9'\s]+/g, " ")
        .split(/\s+/).filter(Boolean);
    return words(raw.slice(0, questionEnd)).length >= 2 && words(raw.slice(questionEnd + 1)).length >= 1;
};
const visibleSentenceWords = value => (normalizeGapPrompt(value)
    .match(/_+|[A-Za-z]+(?:['’][A-Za-z]+)?|[^A-Za-z_\s]+/g) || [])
    .map((text, tokenIndex) => ({ text, tokenIndex }))
    .filter(token => /^[A-Za-z]+(?:['’][A-Za-z]+)?$/.test(token.text));
const imageError = file => {
    if (!file) return "請選擇題目圖片";
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) return "圖片只支援 JPG、PNG 或 WebP";
    if (file.size < 1) return "圖片檔案是空的，請重新選擇";
    if (file.size > MAX_IMAGE_BYTES) return "圖片不可超過 10MB";
    return "";
};
const gapPromptError = (prompt, answer) => {
    const normalized = normalizeGapPrompt(prompt).trim();
    if (!normalized) return "請輸入學生看到的題目";
    const parts = normalized.split(/_{2,}/);
    const blankCount = parts.length - 1;
    if (blankCount < 1 || blankCount > 8) return "請使用 1～8 個 ____ 標示挖空";
    if (parts.slice(1, -1).some(part => !part.trim())) {
        return "兩個挖空中間必須保留固定英文；連續答案請合併成同一個 ____（例如 my nose 使用一個挖空）";
    }
    const visibleWords = visibleSentenceWords(normalized);
    if (!visibleWords.length) return "題目需保留至少一個學生看得到的英文單字";
    if (visibleWords.length > 48 || visibleWords.some(token => token.tokenIndex > 63)) return "學生看到的題目過長，請縮短至 48 個英文單字內";
    if (!String(answer || "").trim()) return "請輸入補好答案的完整句子";
    if (/[_＿﹍﹎]/.test(String(answer))) return "完整句子不能保留底線，請填入所有答案";
    if (!gapPromptMatchesAnswer(normalized, answer)) return "完整句子無法依題面固定文字補回；請確認字序、單複數與標點前的英文";
    return "";
};
const validateDraft = (form, rows, pages) => {
    const formErrors = {};
    if (!form.book_id) formErrors.book_id = "請選擇教材";
    if (!normalizedPage(form.page_from_label)) formErrors.page_from_label = "開始頁格式錯誤，請輸入如 P4";
    if (!normalizedPage(form.page_to_label)) formErrors.page_to_label = "結束頁格式錯誤，請輸入如 P4";
    if (normalizedPage(form.page_from_label) && normalizedPage(form.page_to_label) && !pages.length) {
        formErrors.page_to_label = "結束頁不可早於開始頁，且一次最多涵蓋 50 頁";
    }
    if (!form.title.trim()) formErrors.title = "請輸入關卡名稱";
    else if (form.title.trim().length > 200) formErrors.title = "關卡名稱不可超過 200 字";
    if (!form.topic.trim()) formErrors.topic = "請輸入主題";
    else if (form.topic.trim().length > 200) formErrors.topic = "主題不可超過 200 字";

    const rowErrors = rows.map(row => {
        const errors = {};
        if (isPictureType(form.interaction_type) && !pages.includes(normalizedPage(row.page_label))) errors.page_label = "圖片來源頁碼不在本次頁碼範圍內";
        const accepted = acceptedResponses(row.accepted_full_responses);
        if (accepted.length > 12) errors.accepted_full_responses = "其他可接受說法最多 12 項";
        else if (accepted.some(value => value.length > 500)) errors.accepted_full_responses = "每項可接受說法不可超過 500 字";
        if (row.pronunciation_notes_zh.trim().length > 1200) errors.pronunciation_notes_zh = "發音提示不可超過 1200 字";

        if (form.interaction_type === "standard_sentence") {
            if (!row.full_sentence.trim()) errors.full_sentence = "請輸入完整朗讀句子";
            else if (row.full_sentence.trim().length > 500) errors.full_sentence = "完整句子不可超過 500 字";
        } else if (form.interaction_type === "picture_qa") {
            if (!row.prompt_text.trim()) errors.prompt_text = "請輸入完整問句";
            else if (!row.prompt_text.trim().endsWith("?")) errors.prompt_text = "完整問句最後必須是半形問號 ?";
            if (!row.answer_text.trim()) errors.answer_text = "請輸入完整回答";
            if (`${row.prompt_text} ${row.answer_text}`.trim().length > 500) errors.answer_text = "問句與回答合計不可超過 500 字";
            if (!errors.accepted_full_responses && accepted.some(value => !pictureQaResponseHasQuestionAndAnswer(value))) {
                errors.accepted_full_responses = "每項可接受說法都要包含完整問句、半形問號 ? 與回答";
            }
        } else {
            const error = gapPromptError(row.prompt_text, row.answer_text);
            if (error) {
                if (!row.prompt_text.trim() || error.startsWith("請使用") || error.startsWith("兩個挖空") || error.startsWith("題目需") || error.startsWith("學生看到")) errors.prompt_text = error;
                else errors.answer_text = error;
            }
            if (row.answer_text.trim().length > 500) errors.answer_text = "完整句子不可超過 500 字";
            if (!errors.accepted_full_responses && accepted.some(value => !gapPromptMatchesAnswer(row.prompt_text, value))) {
                errors.accepted_full_responses = "每項可接受說法都必須能依題面固定文字補回";
            }
        }
        if (isPictureType(form.interaction_type)) {
            if (!row.alt_zh.trim()) errors.alt_zh = "請輸入圖片替代文字";
            else if (row.alt_zh.trim().length > 240) errors.alt_zh = "圖片替代文字不可超過 240 字";
            const fileError = imageError(row.file);
            if (fileError) errors.file = fileError;
        }
        return errors;
    });
    const summary = [
        ...Object.entries(formErrors).map(([field, message]) => ({ field, message })),
        ...rowErrors.flatMap((errors, index) => Object.entries(errors).map(([field, message]) => ({
            field, rowIndex: index, message: `第 ${index + 1} 題：${message}`
        })))
    ];
    return { formErrors, rowErrors, summary, valid: summary.length === 0 };
};
const FieldError = ({ id, message, visible }) => visible && message
    ? <small id={id} className="speaking-draft-field-error"><AlertCircle size={15} />{message}</small>
    : null;

export default function ManualSpeakingDraftAdmin({ firebaseUser, books, onCreated }) {
    const [form, setForm] = useState({
        book_id: "", page_from_label: "P1", page_to_label: "P1", title: "", topic: "",
        difficulty: "國小低年級", interaction_type: "picture_gap_sentence"
    });
    const [rows, setRows] = useState(() => Array.from({ length: 3 }, () => newRow("P1")));
    const [working, setWorking] = useState(false);
    const [validationRequested, setValidationRequested] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const confirmationRef = useRef(null);
    const pages = useMemo(() => pageOptions(form.page_from_label, form.page_to_label), [form.page_from_label, form.page_to_label]);
    const pictureMode = isPictureType(form.interaction_type);
    const gapMode = form.interaction_type === "picture_gap_sentence";
    const validation = useMemo(() => validateDraft(form, rows, pages), [form, rows, pages]);
    const selectedBook = books.find(book => String(book.id) === String(form.book_id));
    useEffect(() => {
        if (!pages.length) return;
        setRows(current => current.map(row => pages.includes(normalizedPage(row.page_label))
            ? row : { ...row, page_label: pages[0] }));
    }, [pages]);
    useEffect(() => {
        if (!confirmOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        confirmationRef.current?.querySelector("button")?.focus();
        const closeOnEscape = event => {
            if (event.key === "Escape") setConfirmOpen(false);
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [confirmOpen]);
    const updateForm = (key, value) => {
        setConfirmOpen(false);
        setForm(current => ({ ...current, [key]: value }));
    };
    const updateRow = (key, field, value) => {
        setConfirmOpen(false);
        setRows(current => current.map(row => row.key === key ? { ...row, [field]: value } : row));
    };
    const changeType = type => {
        setConfirmOpen(false);
        setForm(current => ({ ...current, interaction_type: type }));
        setRows(current => current.map(row => ({
            ...newRow(row.page_label), key: row.key,
            full_sentence: type === "standard_sentence" ? (row.full_sentence || row.answer_text) : ""
        })));
    };
    const addRow = () => {
        setConfirmOpen(false);
        setRows(current => current.length >= 50 ? current : [...current, newRow(pages[0] || "P1")]);
    };
    const removeRow = key => {
        setConfirmOpen(false);
        setRows(current => current.length <= 1 ? current : current.filter(row => row.key !== key));
    };

    const submit = async event => {
        event.preventDefault();
        setValidationRequested(true);
        if (!validation.valid) {
            toast.error(`還有 ${validation.summary.length} 個項目需要修正，請查看紅框與錯誤說明`);
            return;
        }
        setConfirmOpen(true);
    };

    const createDraft = async () => {
        if (!validation.valid || working) return;
        setConfirmOpen(false);
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
            setValidationRequested(false);
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
        <form className="platform-form" onSubmit={submit} noValidate>
            <div className="platform-form-grid">
                <label className={validationRequested && validation.formErrors.book_id ? "speaking-draft-field--invalid" : ""}><span>教材</span><select required value={form.book_id} onChange={event => updateForm("book_id", event.target.value)} disabled={working} aria-invalid={Boolean(validationRequested && validation.formErrors.book_id)} aria-describedby="manual-book-error"><option value="">請選擇教材</option>{books.filter(book => book.enabled !== false).map(book => <option key={book.id} value={book.id}>{book.name}</option>)}</select><FieldError id="manual-book-error" message={validation.formErrors.book_id} visible={validationRequested} /></label>
                <label className={validationRequested && validation.formErrors.page_from_label ? "speaking-draft-field--invalid" : ""}><span>開始頁</span><input required value={form.page_from_label} onChange={event => updateForm("page_from_label", event.target.value)} placeholder="P28" disabled={working} aria-invalid={Boolean(validationRequested && validation.formErrors.page_from_label)} aria-describedby="manual-page-from-error" /><FieldError id="manual-page-from-error" message={validation.formErrors.page_from_label} visible={validationRequested} /></label>
                <label className={validationRequested && validation.formErrors.page_to_label ? "speaking-draft-field--invalid" : ""}><span>結束頁</span><input required value={form.page_to_label} onChange={event => updateForm("page_to_label", event.target.value)} placeholder="P29" disabled={working} aria-invalid={Boolean(validationRequested && validation.formErrors.page_to_label)} aria-describedby="manual-page-to-error" /><FieldError id="manual-page-to-error" message={validation.formErrors.page_to_label} visible={validationRequested} /></label>
                <label><span>活動類型</span><select value={form.interaction_type} onChange={event => changeType(event.target.value)} disabled={working}><option value="picture_gap_sentence">看圖補完整句</option><option value="picture_qa">看圖說完整問答</option><option value="standard_sentence">完整句朗讀</option></select></label>
                <label className={validationRequested && validation.formErrors.title ? "speaking-draft-field--invalid" : ""}><span>關卡名稱</span><input required value={form.title} onChange={event => updateForm("title", event.target.value)} disabled={working} aria-invalid={Boolean(validationRequested && validation.formErrors.title)} aria-describedby="manual-title-error" /><FieldError id="manual-title-error" message={validation.formErrors.title} visible={validationRequested} /></label>
                <label className={validationRequested && validation.formErrors.topic ? "speaking-draft-field--invalid" : ""}><span>主題</span><input required value={form.topic} onChange={event => updateForm("topic", event.target.value)} disabled={working} aria-invalid={Boolean(validationRequested && validation.formErrors.topic)} aria-describedby="manual-topic-error" /><FieldError id="manual-topic-error" message={validation.formErrors.topic} visible={validationRequested} /></label>
                <label><span>程度</span><select value={form.difficulty} onChange={event => updateForm("difficulty", event.target.value)} disabled={working}><option>國小低年級</option><option>國小中年級</option><option>國小高年級</option></select></label>
            </div>
            {validationRequested && !validation.valid && <div className="speaking-draft-validation-summary" role="alert">
                <strong><AlertCircle size={18} />目前無法建立草稿，請修正以下項目：</strong>
                <ul>{validation.summary.map((error, index) => <li key={`${error.rowIndex ?? "form"}-${error.field}-${index}`}>{error.message}</li>)}</ul>
            </div>}
            {form.book_id && <p className="speaking-picture-authoring__catalog-note">
                這本教材的第一個關卡發布後，學生端會自動建立「{books.find(book => String(book.id) === String(form.book_id))?.name || "此教材"}」口說大挑戰；小關卡會依學生版頁碼排序。草稿不會顯示給學生。
            </p>}
            <div className="speaking-picture-authoring__notice"><Volume2 size={18} /><span>{gapMode ? "直接輸入學生看到的題目，用 ____ 標示 1～8 個挖空；語音會在每個挖空處停頓 2 秒。" : form.interaction_type === "standard_sentence" ? "系統會朗讀完整句，不插入挖空停頓。" : "學生會看圖片，並在同一次錄音說出完整問句與回答。"}</span></div>
            <div className="speaking-picture-authoring__rows">{rows.map((row, index) => {
                const errors = validation.rowErrors[index] || {};
                const visibleError = field => validationRequested && errors[field];
                const errorId = field => `manual-row-${index}-${field}-error`;
                return <article key={row.key} className={validationRequested && Object.keys(errors).length ? "speaking-draft-row--invalid" : ""}>
                    <header><strong>第 {index + 1} 題</strong><button type="button" className="platform-danger" disabled={working || rows.length <= 1} onClick={() => removeRow(row.key)}><Trash2 size={16} />刪除</button></header>
                    <div className="platform-form">
                        {pages.length > 1 && pictureMode && <label className={visibleError("page_label") ? "speaking-draft-field--invalid" : ""}><span>圖片來源頁碼</span><select value={row.page_label} onChange={event => updateRow(row.key, "page_label", event.target.value)} disabled={working} aria-invalid={Boolean(visibleError("page_label"))} aria-describedby={errorId("page_label")}>{pages.map(page => <option key={page}>{page}</option>)}</select><FieldError id={errorId("page_label")} message={errors.page_label} visible={validationRequested} /></label>}
                        {gapMode && <>
                            <label className={visibleError("prompt_text") ? "speaking-draft-field--invalid" : ""}><span>學生看到的題目（用 ____ 標示挖空）</span><input required value={row.prompt_text} onChange={event => updateRow(row.key, "prompt_text", event.target.value)} placeholder="They ____ her ____." disabled={working} aria-invalid={Boolean(visibleError("prompt_text"))} aria-describedby={errorId("prompt_text")} /><FieldError id={errorId("prompt_text")} message={errors.prompt_text} visible={validationRequested} /></label>
                            <label className={visibleError("answer_text") ? "speaking-draft-field--invalid" : ""}><span>補好答案的完整句子</span><input required value={row.answer_text} onChange={event => updateRow(row.key, "answer_text", event.target.value)} placeholder="They are her eyes." disabled={working} aria-invalid={Boolean(visibleError("answer_text"))} aria-describedby={errorId("answer_text")} /><FieldError id={errorId("answer_text")} message={errors.answer_text} visible={validationRequested} /></label>
                            <p className="speaking-picture-authoring__preview"><strong>學生看到：</strong>{row.prompt_text.trim() || "請輸入含有 ____ 的題目；每個挖空都要能由完整句子補回"}</p>
                        </>}
                        {form.interaction_type === "picture_qa" && <>
                            <label className={visibleError("prompt_text") ? "speaking-draft-field--invalid" : ""}><span>完整問句</span><input required value={row.prompt_text} onChange={event => updateRow(row.key, "prompt_text", event.target.value)} placeholder="What is that?" disabled={working} aria-invalid={Boolean(visibleError("prompt_text"))} aria-describedby={errorId("prompt_text")} /><FieldError id={errorId("prompt_text")} message={errors.prompt_text} visible={validationRequested} /></label>
                            <label className={visibleError("answer_text") ? "speaking-draft-field--invalid" : ""}><span>完整回答</span><input required value={row.answer_text} onChange={event => updateRow(row.key, "answer_text", event.target.value)} placeholder="It is a pencil." disabled={working} aria-invalid={Boolean(visibleError("answer_text"))} aria-describedby={errorId("answer_text")} /><FieldError id={errorId("answer_text")} message={errors.answer_text} visible={validationRequested} /></label>
                        </>}
                        {form.interaction_type === "standard_sentence" && <label className={visibleError("full_sentence") ? "speaking-draft-field--invalid" : ""}><span>完整朗讀句子</span><input required value={row.full_sentence} onChange={event => updateRow(row.key, "full_sentence", event.target.value)} placeholder="This is a pencil." disabled={working} aria-invalid={Boolean(visibleError("full_sentence"))} aria-describedby={errorId("full_sentence")} /><FieldError id={errorId("full_sentence")} message={errors.full_sentence} visible={validationRequested} /></label>}
                        <label className={visibleError("accepted_full_responses") ? "speaking-draft-field--invalid" : ""}><span>其他可接受的完整說法（選填，每行一項）</span><textarea rows="2" value={row.accepted_full_responses} onChange={event => updateRow(row.key, "accepted_full_responses", event.target.value)} disabled={working} aria-invalid={Boolean(visibleError("accepted_full_responses"))} aria-describedby={errorId("accepted_full_responses")} /><FieldError id={errorId("accepted_full_responses")} message={errors.accepted_full_responses} visible={validationRequested} /></label>
                        <label className={visibleError("pronunciation_notes_zh") ? "speaking-draft-field--invalid" : ""}><span>發音提示（選填）</span><input value={row.pronunciation_notes_zh} onChange={event => updateRow(row.key, "pronunciation_notes_zh", event.target.value)} disabled={working} aria-invalid={Boolean(visibleError("pronunciation_notes_zh"))} aria-describedby={errorId("pronunciation_notes_zh")} /><FieldError id={errorId("pronunciation_notes_zh")} message={errors.pronunciation_notes_zh} visible={validationRequested} /></label>
                        {pictureMode && <><div className="platform-form-grid">
                            <label className={visibleError("alt_zh") ? "speaking-draft-field--invalid" : ""}><span>圖片替代文字</span><input required value={row.alt_zh} onChange={event => updateRow(row.key, "alt_zh", event.target.value)} placeholder="描述圖片，不提示答案" disabled={working} aria-invalid={Boolean(visibleError("alt_zh"))} aria-describedby={errorId("alt_zh")} /><FieldError id={errorId("alt_zh")} message={errors.alt_zh} visible={validationRequested} /></label>
                            <label className={`speaking-file-picker${visibleError("file") ? " speaking-draft-field--invalid" : ""}`}><span><ImagePlus size={16} />題目圖片</span><input required type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={event => updateRow(row.key, "file", event.target.files?.[0] || null)} disabled={working} aria-invalid={Boolean(visibleError("file"))} aria-describedby={errorId("file")} /><small>{row.file ? `${row.file.name} · ${(row.file.size / 1024 / 1024).toFixed(1)}MB` : "JPG、PNG 或 WebP，10MB 內"}</small><FieldError id={errorId("file")} message={errors.file} visible={validationRequested} /></label>
                        </div><SpeakingSelectedImagePreview file={row.file} alt={row.alt_zh} /></>}
                    </div>
                </article>;
            })}</div>
            <button type="button" className="platform-secondary" disabled={working || rows.length >= 50} onClick={addRow}><Plus size={17} />新增一題</button>
            {rows.length < 3 && <p className="speaking-picture-editor__warning">草稿可以先保存，但發布前至少需要 3 題。</p>}
            <button className="platform-primary" disabled={working}>{working ? "正在建立草稿與語音…" : "建立未發布草稿"}</button>
        </form>
        {confirmOpen && <div className="speaking-draft-confirmation-backdrop" role="presentation" onMouseDown={event => {
            if (event.target === event.currentTarget) setConfirmOpen(false);
        }}>
            <section ref={confirmationRef} className="speaking-draft-confirmation" role="dialog" aria-modal="true" aria-labelledby="speaking-draft-confirmation-title">
                <header><div><span className="platform-eyebrow">FINAL CHECK</span><h3 id="speaking-draft-confirmation-title">確認建立未發布草稿</h3></div><button type="button" aria-label="關閉確認視窗" onClick={() => setConfirmOpen(false)}><X size={20} /></button></header>
                <p className="speaking-draft-confirmation__notice"><AlertCircle size={18} />這一步只會建立未發布草稿，學生不會看到；之後仍須在題庫管理核准發布。</p>
                <dl className="speaking-draft-confirmation__meta">
                    <div><dt>教材</dt><dd>{selectedBook?.name || "未選擇"}</dd></div>
                    <div><dt>頁碼</dt><dd>{normalizedPage(form.page_from_label)}{normalizedPage(form.page_to_label) !== normalizedPage(form.page_from_label) ? `～${normalizedPage(form.page_to_label)}` : ""}</dd></div>
                    <div><dt>關卡</dt><dd>{form.title.trim()}</dd></div>
                    <div><dt>主題</dt><dd>{form.topic.trim()}</dd></div>
                    <div><dt>活動</dt><dd>{TYPE_LABELS[form.interaction_type]}</dd></div>
                    <div><dt>程度／題數</dt><dd>{form.difficulty}／{rows.length} 題</dd></div>
                </dl>
                <div className="speaking-draft-confirmation__outline"><strong>草稿大綱</strong>{rows.map((row, index) => <article key={row.key}>
                    <span>第 {index + 1} 題{pictureMode ? `・${normalizedPage(row.page_label)}` : ""}</span>
                    <b>{form.interaction_type === "standard_sentence" ? row.full_sentence.trim() : normalizeGapPrompt(row.prompt_text).trim()}</b>
                    {form.interaction_type !== "standard_sentence" && <small>{form.interaction_type === "picture_qa" ? "回答" : "完整句"}：{row.answer_text.trim()}</small>}
                    {pictureMode && <small>圖片：{row.file?.name}</small>}
                </article>)}</div>
                <footer><button type="button" className="platform-secondary" onClick={() => setConfirmOpen(false)}>返回修改</button><button type="button" className="platform-primary" onClick={createDraft}>確認建立未發布草稿</button></footer>
            </section>
        </div>}
    </section>;
}
