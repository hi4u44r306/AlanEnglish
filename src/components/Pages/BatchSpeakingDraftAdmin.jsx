import React, { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileJson, LoaderCircle } from "lucide-react";
import { toast } from "react-toastify";
import { createManualPageSpeakingDraft } from "../../services/speakingContentService";
import { grammarCuePromptIsComplete, textQaPromptIsComplete, zhToEnAnswerIsComplete, zhToEnPromptIsComplete } from "../../utils/textQaPrompt";

const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const bookNumber = value => Number(String(value || "").match(/(?:workbook|work[_ -]?book)[_ -]?(\d+)/i)?.[1] || 0);
const readFileText = file => typeof file?.text === "function" ? file.text() : new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("無法讀取檔案"));
    reader.readAsText(file, "UTF-8");
});

const validateManifest = (value, books) => {
    if (!Array.isArray(value) || !value.length) throw new Error("JSON 必須是至少包含一頁的陣列。");
    const activeBooks = new Map();
    books.filter(book => book?.enabled !== false && !book?.archived_at).forEach(book => {
        const number = bookNumber(`${book.name || ""} ${book.code || ""}`);
        if (number) activeBooks.set(number, book);
    });
    const seen = new Set();
    const pages = value.map((page, pageIndex) => {
        const workbook = Number(page?.workbook);
        const pageNumber = Number(page?.page);
        const key = `${workbook}:${pageNumber}`;
        const book = activeBooks.get(workbook);
        if (!book) throw new Error(`第 ${pageIndex + 1} 筆找不到已啟用的 Workbook ${workbook}。`);
        if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 9999 || seen.has(key)) {
            throw new Error(`第 ${pageIndex + 1} 筆的 Workbook／頁碼無效或重複。`);
        }
        seen.add(key);
        if (!Array.isArray(page.questions) || page.questions.length < 1 || page.questions.length > 50) {
            throw new Error(`Workbook ${workbook} P${pageNumber} 題數必須介於 1～50。`);
        }
        const questions = page.questions.map((question, questionIndex) => {
            const mode = clean(question?.prompt_mode) || "english_qa";
            const prompt = clean(question?.prompt_text);
            const answer = clean(question?.answer_text);
            const alternatives = Array.isArray(question?.accepted_full_responses)
                ? question.accepted_full_responses.map(clean).filter(Boolean) : [];
            const answersComplete = zhToEnAnswerIsComplete(answer) && alternatives.every(zhToEnAnswerIsComplete);
            const promptValid = mode === "english_qa" ? textQaPromptIsComplete(prompt)
                : mode === "zh_to_en" ? zhToEnPromptIsComplete(prompt)
                    : mode === "grammar_cue" ? grammarCuePromptIsComplete(prompt) : false;
            if (!promptValid || (mode !== "english_qa" && !answersComplete) || !answer) {
                throw new Error(`Workbook ${workbook} P${pageNumber} 第 ${questionIndex + 1} 題的題型、題面或完整英文答案不符合規則。`);
            }
            return {
                interaction_type: "text_qa",
                prompt_mode: mode,
                prompt_text: prompt,
                answer_text: answer,
                accepted_full_responses: alternatives,
                pronunciation_notes_zh: clean(question?.pronunciation_notes_zh)
            };
        });
        return {
            book_id: Number(book.id),
            page_label: `P${pageNumber}`,
            title: clean(page.title) || `Workbook ${workbook} P${pageNumber} 口說大挑戰`,
            topic: clean(page.topic) || `Workbook ${workbook} P${pageNumber}`,
            difficulty: clean(page.difficulty) || "國小",
            questions,
            confirmed: true,
            workbook,
            page: pageNumber
        };
    });
    return pages;
};

export default function BatchSpeakingDraftAdmin({ firebaseUser, books, onCreated }) {
    const [pages, setPages] = useState([]);
    const [error, setError] = useState("");
    const [working, setWorking] = useState(false);
    const [results, setResults] = useState([]);
    const questionCount = useMemo(() => pages.reduce((sum, page) => sum + page.questions.length, 0), [pages]);

    const chooseFile = async event => {
        const file = event.target.files?.[0];
        setPages([]);
        setResults([]);
        setError("");
        if (!file) return;
        try {
            const parsed = JSON.parse(await readFileText(file));
            setPages(validateManifest(parsed, books));
        } catch (fileError) {
            setError(fileError.message || "無法讀取批次草稿 JSON。");
        } finally {
            event.target.value = "";
        }
    };

    const createAll = async () => {
        if (!pages.length || working) return;
        setWorking(true);
        setResults([]);
        const nextResults = [];
        let lastId = null;
        for (const page of pages) {
            try {
                const response = await createManualPageSpeakingDraft(firebaseUser, page);
                lastId = response.question_set_id;
                nextResults.push({ workbook: page.workbook, page: page.page, count: page.questions.length, id: response.question_set_id, status: "created" });
            } catch (createError) {
                nextResults.push({ workbook: page.workbook, page: page.page, count: page.questions.length, status: "failed", message: createError.message || "建立失敗" });
            }
            setResults([...nextResults]);
        }
        setWorking(false);
        const failures = nextResults.filter(row => row.status === "failed");
        if (failures.length) toast.error(`批次完成，但有 ${failures.length} 頁建立失敗。`);
        else toast.success(`已建立 ${nextResults.length} 份未發布草稿。`);
        await onCreated?.(lastId);
    };

    const created = results.filter(row => row.status === "created");
    const failed = results.filter(row => row.status === "failed");
    return <section className="platform-card speaking-starter-card speaking-admin-block--curated">
        <div className="platform-section-title"><div><span className="platform-eyebrow">REVIEWED BATCH DRAFTS</span><h2>匯入已核對的逐頁草稿</h2><p>只接受本機 JSON；逐頁建立未發布草稿，不會核准或發布學生題庫。</p></div></div>
        <label className="platform-secondary"><FileJson size={18} />選擇已核對 JSON<input aria-label="選擇已核對 JSON" type="file" accept="application/json,.json" onChange={chooseFile} disabled={working} hidden /></label>
        {error && <p className="speaking-starter-card__warning" role="alert"><AlertCircle size={16} />{error}</p>}
        {pages.length > 0 && <div>
            <p><strong>{pages.length} 頁／{questionCount} 題</strong>，Workbook {[...new Set(pages.map(page => page.workbook))].join("、")}。</p>
            <button type="button" className="platform-primary" onClick={createAll} disabled={working}>
                {working ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}
                {working ? `建立中 ${results.length}/${pages.length}` : `建立 ${pages.length} 份未發布草稿`}
            </button>
        </div>}
        {results.length > 0 && <div role="status">
            <p>成功 {created.length} 頁／失敗 {failed.length} 頁。</p>
            {failed.length > 0 && <ul>{failed.map(row => <li key={`${row.workbook}-${row.page}`}>Workbook {row.workbook} P{row.page}：{row.message}</li>)}</ul>}
        </div>}
    </section>;
}
