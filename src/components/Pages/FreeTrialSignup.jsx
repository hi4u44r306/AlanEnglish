import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { browserLocalPersistence, createUserWithEmailAndPassword, sendEmailVerification, setPersistence } from "firebase/auth";
import { toast } from "react-toastify";
import { authentication } from "./firebase-config";
import { completePublicSignup } from "../../services/membershipService";
import { saveStudentSession } from "../../auth/authService";
import { useAuth } from "../../auth/AuthContext";
import { isReceivableEmail, RECEIVABLE_EMAIL_HELP } from "../../utils/emailValidation";
import "./css/Platform.scss";

const RESEND_COOLDOWN_SECONDS = 60;

const friendlyAuthError = error => {
    if (error?.code === "auth/email-already-in-use") return "這個 Email 已經註冊，請直接登入。";
    if (error?.code === "auth/weak-password") return "密碼至少需要 8 個字元。";
    if (error?.code === "auth/invalid-email") return "Email 格式不正確。";
    if (error?.code === "auth/network-request-failed") return "網路連線失敗，請稍後再試。";
    if (error?.code === "auth/too-many-requests") return "嘗試次數過多，請稍後再試。";
    if (error?.code === "auth/operation-not-allowed") return "目前暫時無法建立帳號，請聯絡管理員。";
    return error?.message || "註冊失敗，請稍後再試。";
};

const friendlyVerificationError = error => {
    if (error?.code === "auth/too-many-requests") return "寄送次數過多，請稍候幾分鐘再試。";
    if (error?.code === "auth/network-request-failed") return "網路連線失敗，請確認連線後重新寄送。";
    if (error?.code === "auth/unauthorized-continue-uri") return "網站驗證網址尚未授權，請聯絡管理員。";
    return "驗證信寄送失敗，請稍後重新寄送。";
};

function FreeTrialSignup() {
    const navigate = useNavigate();
    const { firebaseUser } = useAuth();
    const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", guardianName: "", guardianEmail: "", emailConfirmed: false });
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [errorField, setErrorField] = useState("");
    const [verificationUser, setVerificationUser] = useState(null);
    const [sendingVerification, setSendingVerification] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [verificationNotice, setVerificationNotice] = useState(null);

    useEffect(() => {
        if (firebaseUser && !firebaseUser.emailVerified) setVerificationUser(firebaseUser);
    }, [firebaseUser]);

    useEffect(() => {
        if (resendCooldown <= 0) return undefined;
        const timer = window.setInterval(() => {
            setResendCooldown(current => Math.max(0, current - 1));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [resendCooldown]);

    const update = event => {
        const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
        setForm(current => ({ ...current, [event.target.name]: value }));
        if (errorMessage) {
            setErrorMessage("");
            setErrorField("");
        }
    };

    const sendVerification = async user => {
        if (!user || user.emailVerified) return;
        setSendingVerification(true);
        setVerificationNotice(null);
        try {
            authentication.languageCode = "zh-TW";
            await sendEmailVerification(user, { url: `${window.location.origin}/student/membership` });
            setResendCooldown(RESEND_COOLDOWN_SECONDS);
            setVerificationNotice({ type: "success", text: "驗證信已寄出，請檢查收件匣、垃圾郵件與促銷內容。" });
            toast.success("驗證信已寄出");
        } catch (error) {
            console.error("Email 驗證信寄送失敗:", error);
            const message = friendlyVerificationError(error);
            setVerificationNotice({ type: "error", text: message });
            toast.error(message);
        } finally {
            setSendingVerification(false);
        }
    };

    const submit = async event => {
        event.preventDefault();
        setErrorMessage("");
        setErrorField("");
        const showFormError = (message, field = "") => {
            setErrorMessage(message);
            setErrorField(field);
            toast.error(message);
        };
        if (!form.name.trim()) return showFormError("請輸入學生姓名", "name");
        if (!isReceivableEmail(form.email)) return showFormError(RECEIVABLE_EMAIL_HELP, "email");
        if (!form.emailConfirmed) return showFormError("請先確認這個 Email 可以正常收信", "email");
        if (form.password.length < 8) return showFormError("密碼至少需要 8 個字元", "password");
        if (form.password !== form.confirmPassword) return showFormError("兩次輸入的密碼不一致", "confirmPassword");
        setSubmitting(true);
        try {
            await setPersistence(authentication, browserLocalPersistence);
            const credential = await createUserWithEmailAndPassword(authentication, form.email.trim().toLowerCase(), form.password);
            setVerificationUser(credential.user);
            const result = await completePublicSignup(credential.user, {
                name: form.name.trim(),
                guardian_name: form.guardianName.trim() || undefined,
                guardian_email: form.guardianEmail.trim().toLowerCase() || undefined
            });
            saveStudentSession(credential.user, result.profile);
            if (result.email_verification_required) {
                await sendVerification(credential.user);
            } else {
                navigate("/student/dashboard", { replace: true });
            }
        } catch (error) {
            console.error("免費試用註冊失敗:", error);
            const field = ["auth/email-already-in-use", "auth/invalid-email"].includes(error?.code) ? "email" : "";
            showFormError(friendlyAuthError(error), field);
        } finally {
            setSubmitting(false);
        }
    };

    if (verificationUser && !verificationUser.emailVerified) {
        const resendLabel = sendingVerification
            ? "寄送中…"
            : resendCooldown > 0
                ? `${resendCooldown} 秒後可重新寄送`
                : "重新寄送驗證信";
        return <main className="platform-public"><section className="platform-public-card platform-center"><div className="platform-icon">✉️</div><span className="platform-eyebrow">EMAIL VERIFICATION</span><h1>請先驗證 Email</h1><p>驗證信會寄到 <strong>{verificationUser.email || form.email}</strong>。完成驗證後，7 天免費試用才會開始計時。</p>{verificationNotice && <div className={`platform-verification-notice ${verificationNotice.type}`} role="status" aria-live="polite">{verificationNotice.text}</div>}<div className="platform-verification-actions"><button className="platform-primary" type="button" onClick={() => sendVerification(verificationUser)} disabled={sendingVerification || resendCooldown > 0}>{resendLabel}</button><Link className="platform-secondary" to="/student/membership">前往會員中心</Link></div><p className="platform-footnote">仍未收到時，請搜尋寄件者包含 <strong>noreply</strong> 的郵件，並檢查垃圾郵件或促銷內容。</p></section></main>;
    }

    return (
        <main className="platform-public">
            <section className="platform-public-card">
                <span className="platform-eyebrow">7-DAY FREE TRIAL</span>
                <h1>免費體驗 Alan English</h1>
                <p>建立學生帳號，完成 Email 驗證後立即開始 7 天全方位試用。網路購買教材的讀者也可先在這裡註冊，再到會員中心輸入教材兌換碼。</p>
                <form className="platform-form" onSubmit={submit}>
                    <label><span>學生姓名</span><input name="name" value={form.name} onChange={update} maxLength="80" autoComplete="name" required /></label>
                    <label><span>登入與收信 Email</span><input name="email" type="email" value={form.email} onChange={update} placeholder="name@gmail.com" autoComplete="email" aria-label="登入與收信 Email" aria-invalid={errorField === "email"} aria-describedby="free-trial-email-help" required /><small id="free-trial-email-help">{RECEIVABLE_EMAIL_HELP}</small></label>
                    <div className="platform-form-grid">
                        <label><span>密碼</span><input name="password" type="password" value={form.password} onChange={update} minLength="8" autoComplete="new-password" required /></label>
                        <label><span>再次輸入密碼</span><input name="confirmPassword" type="password" value={form.confirmPassword} onChange={update} minLength="8" autoComplete="new-password" required /></label>
                    </div>
                    <label className="platform-check"><input name="emailConfirmed" type="checkbox" checked={form.emailConfirmed} onChange={update} required /><span>我確認可以登入這個信箱，並能收到驗證與密碼重設信。</span></label>
                    <div className="platform-form-grid">
                        <label><span>家長姓名（選填）</span><input name="guardianName" value={form.guardianName} onChange={update} maxLength="80" /></label>
                        <label><span>家長 Email（選填）</span><input name="guardianEmail" type="email" value={form.guardianEmail} onChange={update} /></label>
                    </div>
                    {errorMessage && <div id="free-trial-error" className="platform-form-error" role="alert" aria-live="assertive"><strong>無法建立帳號</strong><span>{errorMessage}</span>{errorMessage.includes("已經註冊") && <Link to="/login">前往登入</Link>}</div>}
                    <button className="platform-primary" type="submit" disabled={submitting}>{submitting ? "建立帳號中…" : "開始 7 天免費試用"}</button>
                </form>
                <p className="platform-footnote">已經有帳號？ <Link to="/login">回到登入</Link></p>
            </section>
        </main>
    );
}

export default FreeTrialSignup;
