import React, { useState } from "react";
import { Link } from "react-router-dom";
import { sendBrandedPasswordResetEmail } from "../../services/authEmailService";
import { isReceivableEmail, RECEIVABLE_EMAIL_HELP } from "../../utils/emailValidation";
import BackButton from "../fragment/BackButton";
import RecoveryCodeCardHint from "../fragment/RecoveryCodeCardHint";
import "./css/Platform.scss";

// 目前沒有對外開放購買，學生都是英文班帳號，所以預設只顯示登入卡的復原碼。
// 老師／管理員若用 Email 登入，仍可從頁面底部的小連結寄送重設信，不然會被鎖在外面。
function ForgotPassword() {
    const [staffMode, setStaffMode] = useState(false);
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

    const backToStudent = () => { setStaffMode(false); setSent(false); setError(""); };

    return (
        <main className="platform-public">
            <section className="platform-public-card platform-center">
                <div className="ae-back-row"><BackButton to="/login" ariaLabel="返回登入" /></div>
                <div className="platform-icon">🔐</div>
                <span className="platform-eyebrow">PASSWORD RESET</span>
                <h1>忘記密碼</h1>
                {!staffMode ? (
                    <>
                        <p>不用收 Email。請用<strong>登入卡上的復原碼</strong>，設定一個新的密碼。</p>
                        <RecoveryCodeCardHint />
                        <div className="platform-verification-actions">
                            <Link className="platform-primary" to="/academy/recover">使用復原碼</Link>
                        </div>
                        <p className="platform-footnote">復原碼用完或不見了，請聯絡老師。</p>
                        <button type="button" className="platform-link-button" onClick={() => setStaffMode(true)}>老師／管理員（Email 帳號）</button>
                    </>
                ) : sent ? (
                    <>
                        <p>如果 <strong>{email.trim().toLowerCase()}</strong> 已有帳號，Alan English 會寄出密碼重設信。請同時檢查垃圾郵件。</p>
                        <div className="platform-verification-actions"><Link className="platform-primary" to="/login">回到登入</Link><button className="platform-secondary" type="button" onClick={() => setSent(false)}>重新輸入 Email</button></div>
                    </>
                ) : (
                    <>
                        <form className="platform-form" onSubmit={submit}>
                            <p>老師與管理員請輸入註冊時使用的 Email，我們會寄出安全的密碼重設連結。</p>
                            <label className="platform-center-left"><span>註冊 Email</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@gmail.com" autoComplete="email" required /><small>{RECEIVABLE_EMAIL_HELP}</small></label>
                            {error && <div className="platform-form-error" role="alert"><strong>無法寄送</strong><span>{error}</span></div>}
                            <button className="platform-primary platform-wide" type="submit" disabled={submitting}>{submitting ? "寄送中…" : "寄送密碼重設信"}</button>
                        </form>
                        <button type="button" className="platform-link-button" onClick={backToStudent}>回到學生的復原碼</button>
                    </>
                )}
                <p className="platform-footnote"><Link to="/login">回到登入</Link>　·　<Link to="/support">聯絡客服</Link></p>
            </section>
        </main>
    );
}

export default ForgotPassword;
