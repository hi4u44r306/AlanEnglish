import React, { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { useAuth } from "../../auth/AuthContext";
import { markAcademyPasswordChanged } from "../../services/academyStudentService";
import "./css/Platform.scss";

function AccountSecurity() {
    const { firebaseUser, role } = useAuth();
    const [form, setForm] = useState({ currentPassword: "", password: "", confirmPassword: "" });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

    const submit = async event => {
        event.preventDefault();
        setError("");
        setSuccess("");
        if (!firebaseUser?.email) return setError("這個帳號沒有可用的 Email，請聯絡客服。");
        if (form.password.length < 8) return setError("新密碼至少需要 8 個字元。");
        if (form.password !== form.confirmPassword) return setError("兩次輸入的新密碼不一致。");

        setSubmitting(true);
        try {
            const credential = EmailAuthProvider.credential(firebaseUser.email, form.currentPassword);
            await reauthenticateWithCredential(firebaseUser, credential);
            await updatePassword(firebaseUser, form.password);
            if (role === "student") {
                try { await markAcademyPasswordChanged(firebaseUser); } catch (syncError) { console.warn("更新英文班密碼狀態失敗:", syncError); }
            }
            setForm({ currentPassword: "", password: "", confirmPassword: "" });
            setSuccess("密碼已更新，下次登入請使用新密碼。");
        } catch (updateError) {
            if (["auth/invalid-credential", "auth/wrong-password"].includes(updateError?.code)) setError("目前密碼不正確。");
            else if (updateError?.code === "auth/too-many-requests") setError("嘗試次數過多，請稍後再試。");
            else setError(updateError?.message || "密碼更新失敗，請稍後再試。");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="platform-page platform-narrow">
            <header className="platform-hero"><div><span className="platform-eyebrow">ACCOUNT SECURITY</span><h1>帳號與密碼</h1><p>你可以隨時更換自己的密碼；管理員與櫃檯人員不會看到密碼。</p></div></header>
            <section className="platform-card">
                <form className="platform-form" onSubmit={submit}>
                    <label><span>登入 Email</span><input value={firebaseUser?.email || ""} readOnly /></label>
                    <label><span>目前密碼</span><input name="currentPassword" type="password" value={form.currentPassword} onChange={update} autoComplete="current-password" required /></label>
                    <div className="platform-form-grid"><label><span>新密碼</span><input name="password" type="password" value={form.password} onChange={update} minLength="8" autoComplete="new-password" required /></label><label><span>再次輸入新密碼</span><input name="confirmPassword" type="password" value={form.confirmPassword} onChange={update} minLength="8" autoComplete="new-password" required /></label></div>
                    {error && <div className="platform-form-error" role="alert"><strong>無法更新密碼</strong><span>{error}</span></div>}
                    {success && <div className="platform-verification-notice success" role="status">{success}</div>}
                    <button className="platform-primary" type="submit" disabled={submitting}>{submitting ? "更新中…" : "更新密碼"}</button>
                </form>
            </section>
        </main>
    );
}

export default AccountSecurity;
