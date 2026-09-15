import React, { useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, ImagePlus } from "lucide-react";
import { toast } from "react-toastify";
import {
    createWorkbookOnePictureDraft,
    discardWorkbookOnePictureDraft,
    generateSpeakingVisibleWordAudio,
    getWorkbookOnePictureReviewCandidates,
    uploadSpeakingQuestionPicture
} from "../../services/speakingContentService";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const imageIsValid = file => Boolean(file && ALLOWED_IMAGE_TYPES.has(file.type) && file.size >= 1 && file.size <= MAX_IMAGE_BYTES);
const PICTURE_PAGE_OPTIONS = [
    { pageLabel: "P21", interactionType: "picture_qa", title: "看圖問答", questionCount: 9 },
    { pageLabel: "P22", interactionType: "picture_gap_sentence", title: "看圖補句", questionCount: 9 },
    { pageLabel: "P23", interactionType: "picture_gap_sentence", title: "看圖補句", questionCount: 9 },
    { pageLabel: "P24", interactionType: "picture_gap_sentence", title: "看圖補句", questionCount: 8 }
];
let localRowId = 0;
const makeRow = (seed = {}) => ({
    key: `picture-row-${Date.now()}-${localRowId += 1}`, prompt_text: "", answer_text: "",
    accepted_full_responses: "", pronunciation_notes_zh: "", alt_zh: "", file: null, reviewed: false,
    ...seed
});
const makeRows = count => Array.from({ length: count }, () => makeRow());

export default function WorkbookOnePictureContentAdmin({ firebaseUser, workbookOne, onCreated }) {
    const [pageLabel, setPageLabel] = useState("P21");
    const [title, setTitle] = useState("P21 看圖問答");
    const [topic, setTopic] = useState("P21 看圖問答");
    const [rows, setRows] = useState(() => makeRows(PICTURE_PAGE_OPTIONS[0].questionCount));
    const [confirmed, setConfirmed] = useState(false);
    const [working, setWorking] = useState(false);
    const [loadingCandidates, setLoadingCandidates] = useState(false);
    const pageConfig = PICTURE_PAGE_OPTIONS.find(option => option.pageLabel === pageLabel) || PICTURE_PAGE_OPTIONS[0];
    const interactionType = pageConfig.interactionType;
    const isGap = interactionType === "picture_gap_sentence";
    const invalidImage = useMemo(() => rows.find(row => !imageIsValid(row.file)), [rows]);
    const allRowsReviewed = rows.length === pageConfig.questionCount && rows.every(row => row.reviewed === true);

    const updateRow = (key, field, value) => {
        setRows(current => current.map(row => row.key === key
            ? { ...row, [field]: value, ...(field === "reviewed" ? {} : { reviewed: false }) }
            : row));
        if (field !== "reviewed") setConfirmed(false);
    };
    const loadReviewCandidates = async () => {
        setLoadingCandidates(true);
        try {
            const result = await getWorkbookOnePictureReviewCandidates(firebaseUser, pageLabel);
            if (result?.page_label !== pageLabel || result?.interaction_type !== interactionType
                || Number(result?.question_count) !== pageConfig.questionCount
                || !Array.isArray(result?.candidates) || result.candidates.length !== pageConfig.questionCount) {
                throw new Error("審閱候選題數或來源頁不一致");
            }
            setRows(result.candidates.map(item => makeRow({
                prompt_text: item.prompt_text || "",
                answer_text: item.answer_text || "",
                accepted_full_responses: (item.accepted_full_responses || []).join("\n"),
                pronunciation_notes_zh: item.pronunciation_notes_zh || "",
                alt_zh: item.alt_zh || ""
            })));
            setConfirmed(false);
            toast.success(`${pageLabel} 候選文字已載入；請逐題對照原頁並選擇核准圖片`);
        } catch (error) {
            toast.error(error.message || "無法載入逐頁核對候選文字");
        } finally {
            setLoadingCandidates(false);
        }
    };
    const changePage = value => {
        const next = PICTURE_PAGE_OPTIONS.find(option => option.pageLabel === value) || PICTURE_PAGE_OPTIONS[0];
        setPageLabel(next.pageLabel);
        setTitle(`${next.pageLabel} ${next.title}`);
        setTopic(`${next.pageLabel} ${next.title}`);
        setRows(makeRows(next.questionCount));
        setConfirmed(false);
    };

    const submit = async event => {
        event.preventDefault();
        if (!workbookOne) return toast.error("目前找不到已啟用的 Workbook 1");
        if (invalidImage) return toast.error("每題都要選擇 10MB 內的 JPG、PNG 或 WebP 圖片");
        if (!allRowsReviewed) return toast.error("請先逐題確認文字與圖片");
        if (!confirmed) return toast.error("請先確認文字與圖片都已逐題對照原教材");
        setWorking(true);
        let draftId = null;
        try {
            const draft = await createWorkbookOnePictureDraft(firebaseUser, {
                book_id: Number(workbookOne.id), interaction_type: interactionType,
                page_label: pageLabel, title, topic, confirmed: true,
                questions: rows.map(row => ({
                    prompt_text: row.prompt_text,
                    answer_text: row.answer_text,
                    accepted_full_responses: row.accepted_full_responses.split("\n").map(item => item.trim()).filter(Boolean),
                    pronunciation_notes_zh: row.pronunciation_notes_zh
                }))
            });
            draftId = draft.question_set_id;
            const createdQuestions = [...(draft.questions || [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
            if (createdQuestions.length !== rows.length) throw new Error("草稿題數與上傳圖片數量不一致");
            for (let index = 0; index < rows.length; index += 1) {
                await uploadSpeakingQuestionPicture(
                    firebaseUser, Number(createdQuestions[index].id), pageLabel, rows[index].alt_zh, rows[index].file
                );
            }
            if (isGap) {
                const audio = await generateSpeakingVisibleWordAudio(firebaseUser, draft.question_set_id);
                if (audio.success !== true) {
                    const incomplete = Number(audio.failed || 0) + Number(audio.pending || 0);
                    throw new Error(incomplete > 0
                        ? `仍有 ${incomplete} 個可見單字發音尚未完成`
                        : "仍有部分可見單字發音尚未完成");
                }
            }
            toast.success(`${pageLabel} 圖片草稿、私人圖片${isGap ? "與逐字發音" : ""}已準備完成，請預覽後再發布`);
            setRows(makeRows(pageConfig.questionCount));
            setConfirmed(false);
            await onCreated?.();
        } catch (error) {
            let rollbackSucceeded = false;
            if (draftId) {
                try {
                    await discardWorkbookOnePictureDraft(firebaseUser, draftId);
                    rollbackSucceeded = true;
                } catch {
                    rollbackSucceeded = false;
                }
            }
            toast.error(draftId
                ? rollbackSucceeded
                    ? `${error.message || "圖片準備失敗"}；未完成草稿已安全回復，可以重新建立。`
                    : `${error.message || "圖片準備失敗"}；草稿無法自動回復，請勿重複建立並交由管理員檢查。`
                : error.message || "圖片題庫草稿建立失敗");
            await onCreated?.();
        } finally {
            setWorking(false);
        }
    };

    return <section className="platform-card speaking-picture-authoring">
        <div className="platform-section-title"><div>
            <span className="platform-eyebrow">WORKBOOK 1 PICTURE CHALLENGES</span>
            <h2>P21～P24 人工內容與私人圖片</h2>
            <p>只輸入已對照原頁的文字與圖片。系統不會從空格猜答案，也不會自動發布。</p>
        </div></div>
        <form className="platform-form" onSubmit={submit}>
            <div className="platform-form-grid">
                <label><span>活動類型</span><select value={pageLabel} onChange={event => changePage(event.target.value)} disabled={working}>{PICTURE_PAGE_OPTIONS.map(option => <option key={option.pageLabel} value={option.pageLabel}>{option.pageLabel} {option.interactionType === "picture_qa" ? "看圖說完整問答" : "看圖補完整句"}</option>)}</select></label>
                <label><span>關卡名稱</span><input required value={title} onChange={event => setTitle(event.target.value)} disabled={working} /></label>
                <label><span>主題</span><input required value={topic} onChange={event => setTopic(event.target.value)} disabled={working} /></label>
            </div>
            <div className="speaking-picture-authoring__notice"><AlertTriangle size={18} /><span>本頁固定 {pageConfig.questionCount} 題。{isGap ? "句型只能有一個底線空格；完整答案欄要填入已補好圖片答案的整句。" : "問句必須完整並以 ? 結尾；回答欄要填入同一張圖片的完整回答。"}</span></div>
            <button type="button" className="platform-secondary speaking-picture-authoring__load" onClick={loadReviewCandidates} disabled={working || loadingCandidates}>
                <ClipboardCheck size={17} />{loadingCandidates ? "載入候選中…" : `載入 ${pageLabel} 逐頁核對候選文字`}
            </button>
            <div className="speaking-picture-authoring__rows">{rows.map((row, index) => <article key={row.key}>
                <header><strong>{pageLabel} 第 {index + 1}／{pageConfig.questionCount} 題</strong><label className="speaking-picture-authoring__row-check"><input type="checkbox" checked={row.reviewed} onChange={event => updateRow(row.key, "reviewed", event.target.checked)} disabled={working || !row.prompt_text.trim() || !row.answer_text.trim() || !row.alt_zh.trim() || !imageIsValid(row.file)} /><span>本題內容與圖片已核對</span></label></header>
                <div className="platform-form">
                    <label><span>{isGap ? "挖空句型" : "完整問句"}</span><input required value={row.prompt_text} onChange={event => updateRow(row.key, "prompt_text", event.target.value)} disabled={working} placeholder={isGap ? "The ____ is in the tree." : "What is that?"} /></label>
                    <label><span>{isGap ? "補好答案的完整句子" : "完整回答"}</span><input required value={row.answer_text} onChange={event => updateRow(row.key, "answer_text", event.target.value)} disabled={working} placeholder={isGap ? "The apple is in the tree." : "It is an apple."} /></label>
                    <label><span>{isGap ? "其他可接受的完整句子（選填，每行一項）" : "其他可接受的完整問句＋回答（選填，每行一項）"}</span><textarea rows="2" value={row.accepted_full_responses} onChange={event => updateRow(row.key, "accepted_full_responses", event.target.value)} disabled={working} /></label>
                    <label><span>發音提示（選填，不可寫出圖片答案）</span><input value={row.pronunciation_notes_zh} onChange={event => updateRow(row.key, "pronunciation_notes_zh", event.target.value)} disabled={working} /></label>
                    <div className="platform-form-grid">
                        <label><span>圖片替代文字（繁體中文）</span><input required value={row.alt_zh} onChange={event => updateRow(row.key, "alt_zh", event.target.value)} disabled={working} placeholder="只描述圖片，不加入作答提示" /></label>
                        <label className="speaking-file-picker"><span><ImagePlus size={16} />經核准圖片</span><input required type="file" aria-label="經核准圖片" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={event => updateRow(row.key, "file", event.target.files?.[0] || null)} disabled={working} /><small>{row.file ? `${row.file.name} · ${(row.file.size / 1024 / 1024).toFixed(1)}MB` : "JPG、PNG 或 WebP，單檔 10MB 內"}</small></label>
                    </div>
                </div>
            </article>)}</div>
            <label className="speaking-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={working || !allRowsReviewed} /><span>我已逐題對照 Workbook 1 {pageLabel}，確認圖片、問句／句型、完整回答、冠詞、所有權答案與替代文字正確，且圖片可用於本教材。</span></label>
            <button className="platform-primary" disabled={working || !confirmed || !allRowsReviewed || Boolean(invalidImage)}>{working ? "正在建立安全草稿…" : `建立 ${pageLabel} 草稿並上傳私人圖片`}</button>
        </form>
    </section>;
}
