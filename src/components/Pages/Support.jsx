import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { submitSupportTicket } from "../../services/supportService";
import { isReceivableEmail, RECEIVABLE_EMAIL_HELP } from "../../utils/emailValidation";
import "./css/Platform.scss";

const CATEGORIES = [
    ["account", "帳號／登入"],
    ["password", "密碼／收不到信"],
    ["payment", "付款／訂閱"],
    ["activation_code", "教材兌換碼"],
    ["ai_material", "AI 教材"],
    ["course", "課程／英文班"],
    ["other", "其他問題"]
];

function Support() {
    const { firebaseUser, studentProfile } = useAuth();
    const [form, setForm] = useState({ name: studentProfile?.name || "", email: firebaseUser?.email || "", category: "account", subject: "", message: "", website: "" });
    const [submitting, setSubmitting] = useState(false);
    const [ticket, setTicket] = useState(null);
    const [error, setError] = useState("");
    const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

    useEffect(() => {
        setForm(current => ({
            ...current,
            name: current.name || studentProfile?.name || "",
            email: current.email || firebaseUser?.email || ""
        }));
    }, [firebaseUser, studentProfile]);

    const submit = async event => {
        event.preventDefault();
        setError("");
        if (!isReceivableEmail(form.email)) return setError(RECEIVABLE_EMAIL_HELP);
        if (form.subject.trim().length < 3 || form.message.trim().length < 10) return setError("請簡要填寫主旨，並至少用 10 個字描述問題。");
        setSubmitting(true);
        try {
            const result = await submitSupportTicket(firebaseUser, form);
            setTicket(result.ticket);
        } catch (submitError) {
            setError(submitError?.message || "客服案件送出失敗，請稍後再試。");
        } finally {
            setSubmitting(false);
        }
    };

    if (ticket) return <main className="platform-public"><section className="platform-public-card platform-center"><div className="platform-icon">✅</div><span className="platform-eyebrow">SUPPORT REQUEST</span><h1>問題已送出</h1><p>案件編號 <strong>#{ticket.id}</strong>。客服回覆時會使用你填寫的 Email，請留意收件匣。</p><div className="platform-verification-actions"><Link className="platform-primary" to={firebaseUser ? "/userinfo" : "/login"}>返回 Alan English</Link><button className="platform-secondary" type="button" onClick={() => { setTicket(null); setForm(current => ({ ...current, subject: "", message: "" })); }}>回報另一個問題</button></div></section></main>;

    return (
        <main className="platform-public">
            <section className="platform-public-card">
                <span className="platform-eyebrow">CUSTOMER SUPPORT</span>
                <h1>聯絡客服</h1>
                <p>帳號、密碼、付款、兌換碼或教材使用遇到問題，都可以在這裡留言。請勿填寫密碼或信用卡完整號碼。</p>
                <form className="platform-form" onSubmit={submit}>
                    <div className="platform-form-grid"><label><span>姓名</span><input name="name" value={form.name} onChange={update} maxLength="100" autoComplete="name" required /></label><label><span>可收信 Email</span><input name="email" type="email" value={form.email} onChange={update} placeholder="name@gmail.com" autoComplete="email" required /></label></div>
                    <small>{RECEIVABLE_EMAIL_HELP}</small>
                    <label><span>問題類別</span><select name="category" value={form.category} onChange={update}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <label><span>主旨</span><input name="subject" value={form.subject} onChange={update} maxLength="160" placeholder="例如：收不到密碼重設信" required /></label>
                    <label><span>問題內容</span><textarea name="message" value={form.message} onChange={update} maxLength="4000" rows="7" placeholder="請描述發生的步驟、時間與畫面訊息。請勿提供密碼或完整卡號。" required /></label>
                    <label className="platform-honeypot" aria-hidden="true"><span>網站</span><input name="website" value={form.website} onChange={update} tabIndex="-1" autoComplete="off" /></label>
                    {error && <div className="platform-form-error" role="alert"><strong>無法送出</strong><span>{error}</span></div>}
                    <button className="platform-primary platform-wide" type="submit" disabled={submitting}>{submitting ? "送出中…" : "送出客服案件"}</button>
                </form>
                <p className="platform-footnote"><Link to={firebaseUser ? "/userinfo" : "/login"}>返回</Link></p>
            </section>
        </main>
    );
}

export default Support;
