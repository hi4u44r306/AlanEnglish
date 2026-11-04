import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    completeGuardianPasswordReset,
    previewGuardianPasswordReset
} from "../../services/academyStudentService";
import BackButton from "../fragment/BackButton";
import "./css/Platform.scss";

const passwordHelp = "密碼至少 6 個字元，可使用小寫英文、數字或符號。";

// 家長信裡的重設連結會開到這一頁。連結裡的 token 讀進來後立刻從網址移除，避免被瀏覽器紀錄或轉介來源帶走。
function AcademyPasswordReset() {
    const location = useLocation();
    const navigate = useNavigate();
    const tokenRef = useRef(new URLSearchParams(location.search).get("token") || "");
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState({ password: "", confirmPassword: "" });

    useEffect(() => {
        if (tokenRef.current && typeof window !== "undefined" && window.history?.replaceState) {
            window.history.replaceState(window.history.state, "", location.pathname);
        }
        let active = true;
        if (!tokenRef.current) {
            setError("重設連結不完整，請重新要求，或改用登入卡上的復原碼。");
            setLoading(false);
            return undefined;
        }
        previewGuardianPasswordReset(tokenRef.current)
            .then(result => { if (active) setPreview(result); })
            .catch(requestError => { if (active) setError(requestError?.message || "重設連結無法使用"); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [location.pathname]);

    const update = event => {
        const { name, value } = event.target;
        setForm(current => ({ ...current, [name]: value }));
        setError("");
    };

    const submit = async event => {
        event.preventDefault();
        if (form.password.length < 6) return setError("密碼至少需要 6 個字元");
        if (form.password !== form.confirmPassword) return setError("兩次輸入的密碼不一致");
        setSubmitting(true);
        try {
            const result = await completeGuardianPasswordReset(tokenRef.current, form.password);
            navigate(`/login?activated=1&username=${encodeURIComponent(result?.username || preview?.username || "")}`, { replace: true });
        } catch (requestError) {
            setError(requestError?.message || "目前無法設定新密碼");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <main className="platform-public"><section className="platform-public-card platform-center"><div className="platform-loading">正在確認重設連結…</div></section></main>;

    if (!preview) return (
        <main className="platform-public">
            <section className="platform-public-card">
                <div className="ae-back-row"><BackButton to="/login" ariaLabel="返回登入" /></div>
                <h1>重設連結無法使用</h1>
                <p role="alert">{error || "重設連結無效或已過期。"}</p>
                <p>連結只有 30 分鐘，而且只能使用一次。可以重新要求一封新的信，或改用登入卡上的復原碼。</p>
                <div className="platform-verification-actions"><Link className="platform-primary" to="/forgot-password">重新要求</Link><Link className="platform-secondary" to="/academy/recover">使用復原碼</Link></div>
            </section>
        </main>
    );

    return (
        <main className="platform-public">
            <section className="platform-public-card">
                <div className="ae-back-row"><BackButton to="/login" ariaLabel="返回登入" /></div>
                <span className="platform-eyebrow">PASSWORD RESET</span>
                <h1>設定新的登入密碼</h1>
                <p>登入帳號：<strong>{preview.username}</strong>。這封信寄到 {preview.sent_to_masked}，請設定孩子之後要用的新密碼。</p>
                <form className="platform-form" onSubmit={submit}>
                    <div className="platform-form-grid">
                        <label><span>新的登入密碼</span><input name="password" type={showPassword ? "text" : "password"} minLength="6" value={form.password} onChange={update} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="new-password" required /></label>
                        <label><span>再輸入一次</span><input name="confirmPassword" type={showPassword ? "text" : "password"} minLength="6" value={form.confirmPassword} onChange={update} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="new-password" required /></label>
                    </div>
                    <button type="button" className="platform-password-toggle" onClick={() => setShowPassword(current => !current)} aria-pressed={showPassword}>{showPassword ? "隱藏密碼" : "顯示密碼"}</button>
                    <small className="platform-password-help">{form.password.length > 0 && form.password.length < 6 ? `還需要 ${6 - form.password.length} 個字元。` : passwordHelp}</small>
                    {error && <div className="platform-verification-notice error" role="alert">{error}</div>}
                    <button className="platform-primary" type="submit" disabled={submitting}>{submitting ? "設定中…" : "設定新密碼"}</button>
                </form>
                <p className="platform-footnote">設定完成後，請用新密碼登入。</p>
            </section>
        </main>
    );
}

export default AcademyPasswordReset;
