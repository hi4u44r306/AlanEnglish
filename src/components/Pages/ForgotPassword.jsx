import React, { useState } from "react";
import { Link } from "react-router-dom";
import { sendBrandedPasswordResetEmail } from "../../services/authEmailService";
import { isReceivableEmail, RECEIVABLE_EMAIL_HELP } from "../../utils/emailValidation";
import "./css/Platform.scss";

function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");

    const submit = async event => {
        event.preventDefault();
        setError("");
        const normalizedEmail = email.trim().toLowerCase();
        if (!isReceivableEmail(normalizedEmail)) return setError(RECEIVABLE_EMAIL_HELP);

        setSubmitting(true);
        try {
            await sendBrandedPasswordResetEmail(normalizedEmail);
            setSent(true);
        } catch (sendError) {
            if (sendError?.code === "auth/too-many-requests") setError("寄送次數過多，請稍後再試。");
            else if (sendError?.code === "auth/network-request-failed") setError("網路連線失敗，請稍後再試。");
            else setError("目前無法寄送重設信，請稍後再試或聯絡客服。");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="platform-public">
            <section className="platform-public-card platform-center">
                <div className="platform-icon">🔐</div>
                <span className="platform-eyebrow">PASSWORD RESET</span>
                <h1>忘記密碼</h1>
                {sent ? (
                    <>
                        <p>如果 <strong>{email.trim().toLowerCase()}</strong> 已有帳號，Alan English 會寄出密碼重設信。請同時檢查垃圾郵件。</p>
                        <div className="platform-verification-actions"><Link className="platform-primary" to="/login">回到登入</Link><button className="platform-secondary" type="button" onClick={() => setSent(false)}>重新輸入 Email</button></div>
                    </>
                ) : (
                    <form className="platform-form" onSubmit={submit}>
                        <p>輸入註冊時使用的 Gmail 或其他可收信 Email，我們會寄出安全的密碼重設連結。</p>
                        <label className="platform-center-left"><span>註冊 Email</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@gmail.com" autoComplete="email" required /><small>{RECEIVABLE_EMAIL_HELP}</small></label>
                        {error && <div className="platform-form-error" role="alert"><strong>無法寄送</strong><span>{error}</span></div>}
                        <button className="platform-primary platform-wide" type="submit" disabled={submitting}>{submitting ? "寄送中…" : "寄送密碼重設信"}</button>
                    </form>
                )}
                <div className="platform-verification-notice">
                    <strong>英文班學生使用帳號登入？</strong>
                    <p>不需要收 Email。請使用登入卡上的一次性復原碼設定新的登入密碼。</p>
                    <Link className="platform-secondary" to="/academy/recover">使用復原碼</Link>
                </div>
                <p className="platform-footnote"><Link to="/login">回到登入</Link>　·　<Link to="/support">聯絡客服</Link></p>
            </section>
        </main>
    );
}

export default ForgotPassword;
