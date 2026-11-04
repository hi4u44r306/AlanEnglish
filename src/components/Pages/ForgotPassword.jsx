import React, { useState } from "react";
import { Link } from "react-router-dom";
import { sendBrandedPasswordResetEmail } from "../../services/authEmailService";
import { requestGuardianPasswordReset } from "../../services/academyStudentService";
import { isReceivableEmail, RECEIVABLE_EMAIL_HELP } from "../../utils/emailValidation";
import BackButton from "../fragment/BackButton";
import RecoveryCodeCardHint from "../fragment/RecoveryCodeCardHint";
import "./css/Platform.scss";

// 目前沒有對外開放購買，學生都是英文班帳號：預設提供「寄重設連結到家長 Email」與「登入卡復原碼」兩條路。
// 老師／管理員若用 Email 登入，仍可從頁面底部的小連結寄送重設信，不然會被鎖在外面。
function ForgotPassword() {
    const [staffMode, setStaffMode] = useState(false);
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");

    const [guardianUsername, setGuardianUsername] = useState("");
    const [guardianSubmitting, setGuardianSubmitting] = useState(false);
    const [guardianMessage, setGuardianMessage] = useState("");
    const [guardianError, setGuardianError] = useState("");

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

    const submitGuardian = async event => {
        event.preventDefault();
        setGuardianError("");
        setGuardianMessage("");
        const username = guardianUsername.trim().toLowerCase();
        if (!/^[a-z][a-z0-9]{2,31}$/.test(username)) {
            return setGuardianError("請輸入登入卡上的帳號（英文字母和數字）。");
        }
        setGuardianSubmitting(true);
        try {
            const result = await requestGuardianPasswordReset(username);
            setGuardianMessage(result?.message || "如果這個帳號已設定並驗證家長 Email，重設連結已寄出。");
        } catch (requestError) {
            setGuardianError(requestError?.message || "目前無法寄送，請稍後再試，或改用登入卡復原碼。");
        } finally {
            setGuardianSubmitting(false);
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
                        <section className="platform-reset-option" aria-labelledby="reset-guardian-title">
                            <h2 id="reset-guardian-title">方法一：寄重設連結到家長 Email</h2>
                            {guardianMessage ? (
                                <div className="platform-verification-notice" role="status">{guardianMessage}<br />信件在垃圾郵件匣的話，也請看一下。連結 30 分鐘內有效。</div>
                            ) : (
                                <form className="platform-form" onSubmit={submitGuardian}>
                                    <p>輸入登入卡上的帳號，我們會寄一封信到你第一次登入時驗證過的家長 Email。</p>
                                    <label className="platform-center-left"><span>登入帳號</span><input value={guardianUsername} onChange={event => { setGuardianUsername(event.target.value); setGuardianError(""); }} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" placeholder="例如 xiaoming" required /></label>
                                    {guardianError && <div className="platform-form-error" role="alert"><strong>無法寄送</strong><span>{guardianError}</span></div>}
                                    <button className="platform-primary platform-wide" type="submit" disabled={guardianSubmitting}>{guardianSubmitting ? "寄送中…" : "寄送到家長 Email"}</button>
                                </form>
                            )}
                        </section>
                        <section className="platform-reset-option" aria-labelledby="reset-code-title">
                            <h2 id="reset-code-title">方法二：用登入卡上的復原碼</h2>
                            <p>不用收 Email，請用<strong>登入卡上的復原碼</strong>設定新的密碼。</p>
                            <RecoveryCodeCardHint />
                            <div className="platform-verification-actions">
                                <Link className="platform-primary" to="/academy/recover">使用復原碼</Link>
                            </div>
                        </section>
                        <p className="platform-footnote">兩個方法都用不了，請聯絡老師。</p>
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
                        <button type="button" className="platform-link-button" onClick={backToStudent}>回到學生的忘記密碼</button>
                    </>
                )}
                <p className="platform-footnote"><Link to="/login">回到登入</Link>　·　<Link to="/support">聯絡客服</Link></p>
            </section>
        </main>
    );
}

export default ForgotPassword;
