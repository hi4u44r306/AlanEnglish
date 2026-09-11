import React, { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, Headphones, Layers3, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { createSpiralReview, getSpiralTeacherBootstrap, previewSpiralReviewCards } from "../../services/spiralReviewService";
import { normalizeGeneratedCards } from "./spiralReviewParsing";
import "./css/SpiralReview.scss";

const todayTaiwan = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

const initialForm = {
    book_id: "", target_class: "", title: "", unit_label: "", page_start: "", page_end: "",
    assigned_date: todayTaiwan(), range_mode: "single"
};

const TeacherSpiralReview = () => {
    const { firebaseUser } = useAuth();
    const [bootstrap, setBootstrap] = useState({ classes: [], books: [], book_ids_by_class: {}, source_pages_by_book: {} });
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [form, setForm] = useState(initialForm);
    const [cards, setCards] = useState([]);

    useEffect(() => {
        let active = true;
        getSpiralTeacherBootstrap(firebaseUser).then(result => {
            if (!active) return;
            setBootstrap({
                classes: result.classes || [], books: result.books || [],
                book_ids_by_class: result.book_ids_by_class || {}, source_pages_by_book: result.source_pages_by_book || {}
            });
            const firstClass = String(result.classes?.[0] || "");
            const firstAllowedBookId = result.book_ids_by_class?.[firstClass]?.[0];
            setForm(current => ({
                ...current,
                book_id: current.book_id || String(firstAllowedBookId || ""),
                target_class: current.target_class || firstClass
            }));
        }).catch(error => active && setMessage(error.message)).finally(() => active && setLoading(false));
        return () => { active = false; };
    }, [firebaseUser]);

    const availableBooks = useMemo(() => {
        const allowedIds = new Set((bootstrap.book_ids_by_class?.[form.target_class] || []).map(Number));
        return bootstrap.books.filter(book => allowedIds.has(Number(book.id)));
    }, [bootstrap, form.target_class]);
    const selectedBook = availableBooks.find(book => Number(book.id) === Number(form.book_id));
    const availableSourcePages = bootstrap.source_pages_by_book?.[String(form.book_id)] || [];

    const clearGeneratedCards = () => {
        setCards([]);
        setMessage("");
    };
    const update = event => {
        const { name, value } = event.target;
        setForm(current => {
            if (name === "target_class") {
                const firstBookId = bootstrap.book_ids_by_class?.[value]?.[0];
                return { ...current, target_class: value, book_id: String(firstBookId || "") };
            }
            if (name === "range_mode") {
                return { ...current, range_mode: value, page_end: value === "single" ? current.page_start : current.page_end };
            }
            if (name === "page_start" && current.range_mode === "single") {
                return { ...current, page_start: value, page_end: value };
            }
            return { ...current, [name]: value };
        });
        if (["target_class", "book_id", "range_mode", "page_start", "page_end"].includes(name)) clearGeneratedCards();
    };

    const generatePreview = async () => {
        setMessage("");
        const pageStart = Number(form.page_start);
        const pageEnd = form.range_mode === "single" ? pageStart : Number(form.page_end);
        if (!form.target_class || !form.book_id || !pageStart || !pageEnd || pageEnd < pageStart) {
            setMessage("請先選擇班級、教材與正確的頁碼。");
            return;
        }
        setGenerating(true);
        try {
            const result = await previewSpiralReviewCards(firebaseUser, {
                target_class: form.target_class, book_id: Number(form.book_id), page_start: pageStart, page_end: pageEnd
            });
            const generated = normalizeGeneratedCards(result.cards);
            setCards(generated);
            setForm(current => ({
                ...current,
                page_end: String(pageEnd),
                title: current.title || `${selectedBook?.name || "教材"} P${pageStart}${pageEnd > pageStart ? `–P${pageEnd}` : ""}`
            }));
            setMessage(`已依 P${pageStart}${pageEnd > pageStart ? `–P${pageEnd}` : ""} 自動準備 ${generated.length} 張字卡，請確認後再發布。`);
        } catch (error) {
            setCards([]);
            setMessage(error.message);
        } finally {
            setGenerating(false);
        }
    };

    const updateCard = (index, field, value) => setCards(current => current.map((card, cardIndex) => (
        cardIndex === index ? { ...card, [field]: value } : card
    )));
    const removeCard = index => setCards(current => current.filter((_, cardIndex) => cardIndex !== index));

    const submit = async event => {
        event.preventDefault();
        setMessage("");
        const validCards = normalizeGeneratedCards(cards);
        if (validCards.length < 6) {
            setMessage("至少保留 6 張字卡，學生端才能出現 5–6 張選項卡。");
            return;
        }
        setSaving(true);
        try {
            const result = await createSpiralReview(firebaseUser, {
                ...form,
                book_id: Number(form.book_id), page_start: Number(form.page_start), page_end: Number(form.page_end), cards: validCards
            });
            setMessage(`已發布給 ${form.target_class}，共 ${result.card_count} 張複習卡。`);
            setForm(current => ({ ...initialForm, book_id: current.book_id, target_class: current.target_class }));
            setCards([]);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="spiral-page spiral-teacher-page">
            <header className="spiral-hero">
                <div><span>SPIRAL REVIEW · STAGE 1</span><h1>教材頁碼螺旋複習</h1><p>只要選教材與單頁或頁碼範圍，系統就會自動準備聽音選字卡。</p></div>
                <div className="spiral-hero-badge"><Layers3 /><strong>Day 1</strong><small>錯題自動回來</small></div>
            </header>
            {message && <div className="spiral-message" role="status">{message}</div>}
            {loading ? <div className="spiral-loading">正在準備教材與班級…</div> : (
                <form className="spiral-editor" onSubmit={submit}>
                    <section className="spiral-panel">
                        <div className="spiral-panel-title"><BookOpenCheck /><div><strong>1. 指定教材頁碼</strong><span>系統只會使用管理員已核准的逐頁教材文字</span></div></div>
                        <fieldset className="spiral-range-mode">
                            <legend>出題範圍</legend>
                            <label><input type="radio" name="range_mode" value="single" checked={form.range_mode === "single"} onChange={update} />單一頁</label>
                            <label><input type="radio" name="range_mode" value="range" checked={form.range_mode === "range"} onChange={update} />頁碼範圍</label>
                        </fieldset>
                        <div className="spiral-form-grid">
                            <label>班級<select name="target_class" value={form.target_class} onChange={update} required>{bootstrap.classes.map(code => <option key={code}>{code}</option>)}</select></label>
                            <label>教材<select name="book_id" value={form.book_id} onChange={update} required><option value="">請選擇</option>{availableBooks.map(book => <option value={book.id} key={book.id}>{book.name}</option>)}</select></label>
                            <label>{form.range_mode === "single" ? "頁碼" : "開始頁"}<input name="page_start" type="number" min="1" max="999" value={form.page_start} onChange={update} required /></label>
                            {form.range_mode === "range" && <label>結束頁<input name="page_end" type="number" min={form.page_start || "1"} max="999" value={form.page_end} onChange={update} required /></label>}
                            <label className="wide">複習名稱<input name="title" value={form.title} onChange={update} maxLength="160" placeholder="自動帶入後仍可修改" required /></label>
                            <label>單元（可不填）<input name="unit_label" value={form.unit_label} onChange={update} maxLength="80" placeholder="Unit 2" /></label>
                            <label>開始日期<input name="assigned_date" type="date" value={form.assigned_date} onChange={update} required /></label>
                        </div>
                        <div className={`spiral-source-note ${availableSourcePages.length ? "is-ready" : "is-missing"}`}>
                            <strong>{selectedBook?.name || "所選教材"}</strong>
                            {availableSourcePages.length
                                ? <span>目前有 {availableSourcePages.length} 頁已核准，可用頁碼：P{availableSourcePages.slice(0, 20).join("、P")}{availableSourcePages.length > 20 ? "…" : ""}</span>
                                : <span>目前沒有已核准的逐頁教材文字，需先由管理員核對教材內容。</span>}
                        </div>
                    </section>
                    <section className="spiral-panel">
                        <div className="spiral-panel-title"><Headphones /><div><strong>2. 自動準備字卡</strong><span>只使用人工核准清單；寫字頁、空格、歌曲與未確認圖片題會被排除</span></div><b>{cards.length} 張</b></div>
                        <button className="spiral-generate" type="button" onClick={generatePreview} disabled={generating || !form.book_id}>
                            <Sparkles />{generating ? "正在讀取教材…" : "依頁碼自動準備字卡"}
                        </button>
                        {cards.length > 0 ? (
                            <div className="spiral-card-editor" aria-label="自動產生字卡預覽">
                                {cards.map((card, index) => (
                                    <article key={`${card.prompt_en}-${index}`}>
                                        <span>{String(index + 1).padStart(2, "0")}</span>
                                        <label>英文<input value={card.prompt_en} onChange={event => updateCard(index, "prompt_en", event.target.value)} maxLength="240" /></label>
                                        <label>中文（可不填）<input value={card.meaning_zh} onChange={event => updateCard(index, "meaning_zh", event.target.value)} maxLength="240" /></label>
                                        <button type="button" onClick={() => removeCard(index)} aria-label={`刪除第 ${index + 1} 張字卡`}><Trash2 /></button>
                                    </article>
                                ))}
                            </div>
                        ) : <div className="spiral-empty-preview">選好頁碼後按上方按鈕，字卡會先出現在這裡供您確認，不會直接發布給學生。</div>}
                    </section>
                    <button className="spiral-primary" type="submit" disabled={saving || cards.length < 6}><CheckCircle2 />{saving ? "發布中…" : "確認並發布螺旋複習"}</button>
                </form>
            )}
        </main>
    );
};

export default TeacherSpiralReview;
