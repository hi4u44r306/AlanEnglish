import React, { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { useAuth } from "../../auth/AuthContext";
import { markAcademyPasswordChanged, reissueOwnAcademyRecoveryCodes } from "../../services/academyStudentService";
import "./css/Platform.scss";

function AccountSecurity() {
    const { firebaseUser, role, studentProfile } = useAuth();
    const usesStudentPin = studentProfile?.authentication_method === "academy_username";
    const [form, setForm] = useState({ currentPassword: "", password: "", confirmPassword: "" });
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [recoveryPassword, setRecoveryPassword] = useState("");
    const [recoverySubmitting, setRecoverySubmitting] = useState(false);
    const [recoveryError, setRecoveryError] = useState("");
    const [recoveryCodes, setRecoveryCodes] = useState(null);

    const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

    const submit = async event => {
        event.preventDefault();
        setError("");
        setSuccess("");
        if (!firebaseUser?.email) return setError("這個帳號目前無法更新登入資料，請聯絡客服。");
        if (usesStudentPin && form.password.length < 6) return setError("新密碼至少需要 6 個字元。");
        if (!usesStudentPin && form.password.length < 8) return setError("新密碼至少需要 8 個字元。");
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

    const reissueRecoveryCodes = async event => {
        event.preventDefault();
        setRecoveryError("");
        if (!firebaseUser?.email) return setRecoveryError("這個帳號目前無法更新復原碼，請聯絡老師。");
        if (!recoveryPassword) return setRecoveryError("請輸入目前密碼確認身分。");

        setRecoverySubmitting(true);
        try {
            const credential = EmailAuthProvider.credential(firebaseUser.email, recoveryPassword);
            await reauthenticateWithCredential(firebaseUser, credential);
            const result = await reissueOwnAcademyRecoveryCodes(firebaseUser);
            setRecoveryCodes(result.credentials?.recovery_codes || null);
            setRecoveryPassword("");
        } catch (reissueError) {
            if (["auth/invalid-credential", "auth/wrong-password"].includes(reissueError?.code)) setRecoveryError("目前密碼不正確。");
            else setRecoveryError(reissueError?.message || "目前無法產生新的復原碼，請稍後再試。");
        } finally {
            setRecoverySubmitting(false);
        }
    };

    return (
        <main className="platform-page platform-narrow">
            <header className="platform-hero"><div><span className="platform-eyebrow">ACCOUNT SECURITY</span><h1>帳號與密碼</h1><p>你可以隨時更換自己的密碼；管理員與櫃檯人員不會看到密碼。</p></div></header>
            <section className="platform-card">
                <form className="platform-form" onSubmit={submit}>
                    <label><span>{usesStudentPin ? "登入帳號" : "登入 Email"}</span><input value={usesStudentPin ? studentProfile?.login_username || "" : firebaseUser?.email || ""} readOnly /></label>
                    <label><span>目前密碼</span><input name="currentPassword" type={showPassword ? "text" : "password"} value={form.currentPassword} onChange={update} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="current-password" required /></label>
                    <div className="platform-form-grid"><label><span>新密碼</span><input name="password" type={showPassword ? "text" : "password"} inputMode="text" value={form.password} onChange={update} minLength={usesStudentPin ? 6 : 8} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="new-password" required /></label><label><span>再次輸入新密碼</span><input name="confirmPassword" type={showPassword ? "text" : "password"} inputMode="text" value={form.confirmPassword} onChange={update} minLength={usesStudentPin ? 6 : 8} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="new-password" required /></label></div>
                    <button type="button" className="platform-password-toggle" onClick={() => setShowPassword(current => !current)} aria-pressed={showPassword}>{showPassword ? "隱藏密碼" : "顯示密碼"}</button>
                    {usesStudentPin && <small className="platform-password-help">英文班帳號的密碼至少 6 個字元，可使用小寫英文、數字或符號。</small>}
                    {error && <div className="platform-form-error" role="alert"><strong>無法更新密碼</strong><span>{error}</span></div>}
                    {success && <div className="platform-verification-notice success" role="status">{success}</div>}
                    <button className="platform-primary" type="submit" disabled={submitting}>{submitting ? "更新中…" : "更新密碼"}</button>
                </form>
            </section>
            {usesStudentPin && <section className="platform-card platform-recovery-card">
                <span className="platform-eyebrow">RECOVERY CODES</span>
                <h2>更新一次性復原碼</h2>
                {recoveryCodes ? <div className="platform-verification-notice success" role="status">
                    <strong>請立即抄下或交給家長保存</strong>
                    <p className="platform-recovery-codes" aria-label="新的兩組一次性復原碼">{recoveryCodes.join("　　")}</p>
                    <span>這兩組 6 位數復原碼只顯示這一次；原本所有未使用的復原碼已立即失效。不要貼到公開群組。</span>
                </div> : <form className="platform-form" onSubmit={reissueRecoveryCodes}>
                    <p>重新輸入目前密碼後，系統會產生兩組新的 6 位數復原碼，並讓舊碼立即失效。</p>
                    <label><span>目前密碼</span><input type={showPassword ? "text" : "password"} value={recoveryPassword} onChange={event => setRecoveryPassword(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="current-password" required /></label>
                    {recoveryError && <div className="platform-form-error" role="alert"><strong>無法更新復原碼</strong><span>{recoveryError}</span></div>}
                    <button className="platform-secondary platform-wide" type="submit" disabled={recoverySubmitting}>{recoverySubmitting ? "產生中…" : "重新產生我的復原碼"}</button>
                </form>}
            </section>}
        </main>
    );
}

export default AccountSecurity;
