import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    activateStudentLogin,
    previewStudentActivation,
    recoverStudentLogin
} from "../../services/academyStudentService";
import "./css/Platform.scss";

const passwordHelp = "密碼至少 6 個字元，可使用小寫英文、數字或符號。";

function AcademyStudentSetup({ recoveryOnly = false }) {
    const location = useLocation();
    const navigate = useNavigate();
    const token = new URLSearchParams(location.search).get("token") || "";
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(!recoveryOnly);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState({ username: "", chineseName: "", englishName: "", recoveryCode: "", password: "", confirmPassword: "" });

    useEffect(() => {
        if (recoveryOnly) return;
        if (!token) {
            setError("啟用連結不完整，請重新掃描老師提供的登入卡。");
            setLoading(false);
            return;
        }
        let active = true;
        previewStudentActivation(token)
            .then(result => {
                if (!active) return;
                setPreview(result);
                setForm(current => ({
                    ...current,
                    username: result?.student?.username || "",
                    chineseName: result?.student?.chinese_name || result?.student?.name || "",
                    englishName: result?.student?.english_name || ""
                }));
            })
            .catch(requestError => {
                if (active) setError(requestError?.message || "啟用連結無法使用");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [recoveryOnly, token]);

    const update = event => {
        const { name, value } = event.target;
        setForm(current => ({ ...current, [name]: value }));
        setError("");
    };

    const submit = async event => {
        event.preventDefault();
        if (!recoveryOnly && !form.chineseName.trim()) return setError("請輸入學生中文姓名");
        if (!recoveryOnly && !form.englishName.trim()) return setError("請輸入學生英文姓名");
        if (!recoveryOnly && !/^[A-Za-z][A-Za-z .'-]*$/.test(form.englishName.trim())) return setError("英文姓名請使用英文字母，可包含空格、句點、撇號或連字號");
        if (form.password.length < 6) return setError("密碼至少需要 6 個字元");
        if (form.password !== form.confirmPassword) return setError("兩次輸入的密碼不一致");
        setSubmitting(true);
        try {
            const result = recoveryOnly
                ? await recoverStudentLogin(form.username, form.recoveryCode, form.password)
                : await activateStudentLogin(token, form.password, { chineseName: form.chineseName, englishName: form.englishName });
            navigate(`/login?activated=1&username=${encodeURIComponent(result.username || form.username)}`, { replace: true });
        } catch (requestError) {
            setError(requestError?.message || "目前無法設定登入密碼");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <main className="platform-public"><section className="platform-public-card platform-center"><div className="platform-loading">正在確認登入卡…</div></section></main>;

    return (
        <main className="platform-public">
            <section className="platform-public-card">
                <span className="platform-eyebrow">ACADEMY STUDENT LOGIN</span>
                <h1>{recoveryOnly ? "使用復原碼設定新密碼" : "設定學生登入密碼"}</h1>
                <p>{recoveryOnly
                    ? "輸入登入卡上的帳號與其中一組未使用的復原碼。每組復原碼只能使用一次。"
                    : `${preview?.student?.name || "同學"}，第一次登入前請先設定自己的密碼。`}</p>
                <form className="platform-form" onSubmit={submit}>
                    <label>
                        <span>登入帳號</span>
                        <input name="username" value={form.username} onChange={update} autoComplete="username" readOnly={!recoveryOnly && Boolean(preview)} required />
                    </label>
                    {recoveryOnly && <label>
                        <span>一次性復原碼</span>
                        <input name="recoveryCode" value={form.recoveryCode} onChange={update} placeholder="AE-XXXX-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" required />
                    </label>}
                    {!recoveryOnly && <div className="platform-form-grid">
                        <label><span>中文姓名</span><input name="chineseName" value={form.chineseName} onChange={update} maxLength="100" autoComplete="name" required /></label>
                        <label><span>英文姓名</span><input name="englishName" value={form.englishName} onChange={update} maxLength="100" autoCapitalize="words" autoComplete="off" pattern="^[A-Za-z][A-Za-z .'-]*$" required /></label>
                    </div>}
                    <div className="platform-form-grid">
                        <label><span>新的登入密碼</span><input name="password" type={showPassword ? "text" : "password"} inputMode="text" minLength="6" value={form.password} onChange={update} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="new-password" required /></label>
                        <label><span>再輸入一次</span><input name="confirmPassword" type={showPassword ? "text" : "password"} inputMode="text" minLength="6" value={form.confirmPassword} onChange={update} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="new-password" required /></label>
                    </div>
                    <button type="button" className="platform-password-toggle" onClick={() => setShowPassword(current => !current)} aria-pressed={showPassword}>{showPassword ? "隱藏密碼" : "顯示密碼"}</button>
                    <small className="platform-password-help">{form.password.length > 0 && form.password.length < 6 ? `還需要 ${6 - form.password.length} 個字元。` : passwordHelp}</small>
                    {error && <div className="platform-verification-notice error" role="alert">{error}</div>}
                    <button className="platform-primary" type="submit" disabled={submitting || (!recoveryOnly && !preview)}>{submitting ? "設定中…" : recoveryOnly ? "使用復原碼設定新密碼" : "完成啟用"}</button>
                </form>
                <p className="platform-footnote">{recoveryOnly
                    ? <>復原碼也遺失了？請向授課老師申請新的登入卡。</>
                    : <>已經啟用？ <Link to="/login">回到登入</Link></>}</p>
            </section>
        </main>
    );
}

export default AcademyStudentSetup;
