import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { browserLocalPersistence, createUserWithEmailAndPassword, sendEmailVerification, setPersistence } from "firebase/auth";
import { toast } from "react-toastify";
import { authentication } from "./firebase-config";
import { completePublicSignup } from "../../services/membershipService";
import { saveStudentSession } from "../../auth/authService";
import "./css/Platform.scss";

const friendlyAuthError = error => {
    if (error?.code === "auth/email-already-in-use") return "這個 Email 已經註冊，請直接登入。";
    if (error?.code === "auth/weak-password") return "密碼至少需要 6 個字元。";
    if (error?.code === "auth/invalid-email") return "Email 格式不正確。";
    if (error?.code === "auth/network-request-failed") return "網路連線失敗，請稍後再試。";
    if (error?.code === "auth/too-many-requests") return "嘗試次數過多，請稍後再試。";
    if (error?.code === "auth/operation-not-allowed") return "目前暫時無法建立帳號，請聯絡管理員。";
    return error?.message || "註冊失敗，請稍後再試。";
};

function FreeTrialSignup() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", guardianName: "", guardianEmail: "" });
    const [submitting, setSubmitting] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [errorField, setErrorField] = useState("");

    const update = event => {
        setForm(current => ({ ...current, [event.target.name]: event.target.value }));
        if (errorMessage) {
            setErrorMessage("");
            setErrorField("");
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
        if (form.password.length < 6) return showFormError("密碼至少需要 6 個字元", "password");
        if (form.password !== form.confirmPassword) return showFormError("兩次輸入的密碼不一致", "confirmPassword");
        setSubmitting(true);
        try {
            await setPersistence(authentication, browserLocalPersistence);
            const credential = await createUserWithEmailAndPassword(authentication, form.email.trim().toLowerCase(), form.password);
            const result = await completePublicSignup(credential.user, {
                name: form.name.trim(),
                guardian_name: form.guardianName.trim() || undefined,
                guardian_email: form.guardianEmail.trim().toLowerCase() || undefined
            });
            saveStudentSession(credential.user, result.profile);
            if (result.email_verification_required) {
                await sendEmailVerification(credential.user, { url: `${window.location.origin}/` });
                setVerificationSent(true);
                toast.success("驗證信已寄出");
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

    if (verificationSent) {
        return <main className="platform-public"><section className="platform-public-card platform-center"><div className="platform-icon">✉️</div><span className="platform-eyebrow">EMAIL VERIFICATION</span><h1>請先驗證 Email</h1><p>驗證信已寄到 <strong>{form.email}</strong>。完成驗證後回到登入頁，即可開始 7 天免費試用。</p><Link className="platform-primary" to="/">回到登入頁</Link></section></main>;
    }

    return (
        <main className="platform-public">
            <section className="platform-public-card">
                <span className="platform-eyebrow">7-DAY FREE TRIAL</span>
                <h1>免費體驗 Alan English</h1>
                <p>建立學生帳號，完成 Email 驗證後立即開始 7 天全方位試用。試用期間每天可產生 5 次 AI 教材。</p>
                <form className="platform-form" onSubmit={submit}>
                    <label><span>學生姓名</span><input name="name" value={form.name} onChange={update} maxLength="80" autoComplete="name" required /></label>
                    <label><span>登入 Email</span><input name="email" type="email" value={form.email} onChange={update} autoComplete="email" aria-invalid={errorField === "email"} aria-describedby={errorMessage ? "free-trial-error" : undefined} required /></label>
                    <div className="platform-form-grid">
                        <label><span>密碼</span><input name="password" type="password" value={form.password} onChange={update} minLength="6" autoComplete="new-password" required /></label>
                        <label><span>再次輸入密碼</span><input name="confirmPassword" type="password" value={form.confirmPassword} onChange={update} minLength="6" autoComplete="new-password" required /></label>
                    </div>
                    <div className="platform-form-grid">
                        <label><span>家長姓名（選填）</span><input name="guardianName" value={form.guardianName} onChange={update} maxLength="80" /></label>
                        <label><span>家長 Email（選填）</span><input name="guardianEmail" type="email" value={form.guardianEmail} onChange={update} /></label>
                    </div>
                    {errorMessage && <div id="free-trial-error" className="platform-form-error" role="alert" aria-live="assertive"><strong>無法建立帳號</strong><span>{errorMessage}</span>{errorMessage.includes("已經註冊") && <Link to="/">前往登入</Link>}</div>}
                    <button className="platform-primary" type="submit" disabled={submitting}>{submitting ? "建立帳號中…" : "開始 7 天免費試用"}</button>
                </form>
                <p className="platform-footnote">已經有帳號？ <Link to="/">回到登入</Link></p>
            </section>
        </main>
    );
}

export default FreeTrialSignup;
