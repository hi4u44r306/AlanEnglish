import React, { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, Headphones, Layers3 } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { createSpiralReview, getSpiralTeacherBootstrap } from "../../services/spiralReviewService";
import { parseReviewCards } from "./spiralReviewParsing";
import "./css/SpiralReview.scss";

const todayTaiwan = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

const TeacherSpiralReview = () => {
    const { firebaseUser } = useAuth();
    const [bootstrap, setBootstrap] = useState({ classes: [], books: [], book_ids_by_class: {} });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [form, setForm] = useState({
        book_id: "", target_class: "", title: "", unit_label: "", page_start: "", page_end: "",
        assigned_date: todayTaiwan(), cards_text: ""
    });
    const cards = useMemo(() => parseReviewCards(form.cards_text), [form.cards_text]);

    useEffect(() => {
        let active = true;
        getSpiralTeacherBootstrap(firebaseUser).then(result => {
            if (!active) return;
            setBootstrap({ classes: result.classes || [], books: result.books || [], book_ids_by_class: result.book_ids_by_class || {} });
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
    const update = event => setForm(current => {
        if (event.target.name !== "target_class") return { ...current, [event.target.name]: event.target.value };
        const nextClass = event.target.value;
        const firstBookId = bootstrap.book_ids_by_class?.[nextClass]?.[0];
        return { ...current, target_class: nextClass, book_id: String(firstBookId || "") };
    });
    const submit = async event => {
        event.preventDefault();
        setMessage("");
        if (cards.length < 6) {
            setMessage("至少輸入 6 行，學生端才能出現 5–6 張選項卡。");
            return;
        }
        setSaving(true);
        try {
            const result = await createSpiralReview(firebaseUser, {
                ...form,
                book_id: Number(form.book_id), page_start: Number(form.page_start), page_end: Number(form.page_end), cards
            });
            setMessage(`已發布給 ${form.target_class}，共 ${result.card_count} 張複習卡。`);
            setForm(current => ({ ...current, title: "", unit_label: "", page_start: "", page_end: "", cards_text: "" }));
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="spiral-page spiral-teacher-page">
            <header className="spiral-hero">
                <div><span>SPIRAL REVIEW · STAGE 1</span><h1>教材頁碼螺旋複習</h1><p>選教材與頁碼，建立聽音選字卡；答錯內容會在隔天再次出現。</p></div>
                <div className="spiral-hero-badge"><Layers3 /><strong>Day 1</strong><small>錯題自動回來</small></div>
            </header>
            {message && <div className="spiral-message" role="status">{message}</div>}
            {loading ? <div className="spiral-loading">正在準備教材與班級…</div> : (
                <form className="spiral-editor" onSubmit={submit}>
                    <section className="spiral-panel">
                        <div className="spiral-panel-title"><BookOpenCheck /><div><strong>1. 指定教材範圍</strong><span>班級、教材與實際課本頁碼</span></div></div>
                        <div className="spiral-form-grid">
                            <label>班級<select name="target_class" value={form.target_class} onChange={update} required>{bootstrap.classes.map(code => <option key={code}>{code}</option>)}</select></label>
                            <label>教材<select name="book_id" value={form.book_id} onChange={update} required><option value="">請選擇</option>{availableBooks.map(book => <option value={book.id} key={book.id}>{book.name}</option>)}</select></label>
                            <label>開始頁<input name="page_start" type="number" min="1" max="999" value={form.page_start} onChange={update} required /></label>
                            <label>結束頁<input name="page_end" type="number" min="1" max="999" value={form.page_end} onChange={update} required /></label>
                            <label className="wide">複習名稱<input name="title" value={form.title} onChange={update} maxLength="160" placeholder="例如 Unit 2 動物與顏色" required /></label>
                            <label>單元（可不填）<input name="unit_label" value={form.unit_label} onChange={update} maxLength="80" placeholder="Unit 2" /></label>
                            <label>開始日期<input name="assigned_date" type="date" value={form.assigned_date} onChange={update} required /></label>
                        </div>
                    </section>
                    <section className="spiral-panel">
                        <div className="spiral-panel-title"><Headphones /><div><strong>2. 貼上複習清單</strong><span>每行：英文｜中文｜例句（例句可省略）</span></div><b>{cards.length} 張</b></div>
                        <textarea name="cards_text" value={form.cards_text} onChange={update} rows="10" placeholder={"apple｜蘋果｜I see a red apple.\nbanana｜香蕉｜The banana is yellow.\norange｜柳橙\ngrape｜葡萄\nlemon｜檸檬\nwatermelon｜西瓜"} required />
                        <div className="spiral-preview" aria-label="字卡預覽">
                            {cards.slice(0, 8).map((card, index) => <span key={`${card.prompt_en}-${index}`}><strong>{card.prompt_en}</strong>{card.meaning_zh && <small>{card.meaning_zh}</small>}</span>)}
                            {cards.length > 8 && <span>還有 {cards.length - 8} 張</span>}
                        </div>
                    </section>
                    <button className="spiral-primary" type="submit" disabled={saving || cards.length < 6}><CheckCircle2 />{saving ? "發布中…" : "發布螺旋複習"}</button>
                </form>
            )}
        </main>
    );
};

export default TeacherSpiralReview;
