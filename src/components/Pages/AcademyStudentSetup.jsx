import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    activateStudentLogin,
    previewStudentActivation,
    recoverStudentLogin
} from "../../services/academyStudentService";
import "./css/Platform.scss";

const weakPinHelp = "請設定 6 位數字，不能使用 123456、連號或六個相同數字。";

function AcademyStudentSetup({ recoveryOnly = false }) {
    const location = useLocation();
    const navigate = useNavigate();
    const token = new URLSearchParams(location.search).get("token") || "";
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(!recoveryOnly);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({ username: "", recoveryCode: "", pin: "", confirmPin: "" });

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
                setForm(current => ({ ...current, username: result?.student?.username || "" }));
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
        if (!/^\d{6}$/.test(form.pin)) return setError(weakPinHelp);
        if (form.pin !== form.confirmPin) return setError("兩次輸入的 6 位數字不一致");
        setSubmitting(true);
        try {
            const result = recoveryOnly
                ? await recoverStudentLogin(form.username, form.recoveryCode, form.pin)
                : await activateStudentLogin(token, form.pin);
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
                    : `${preview?.student?.name || "同學"}，第一次登入前請先設定自己的 6 位數字。`}</p>
                <form className="platform-form" onSubmit={submit}>
                    <label>
                        <span>登入帳號</span>
                        <input name="username" value={form.username} onChange={update} autoComplete="username" readOnly={!recoveryOnly && Boolean(preview)} required />
                    </label>
                    {recoveryOnly && <label>
                        <span>一次性復原碼</span>
                        <input name="recoveryCode" value={form.recoveryCode} onChange={update} placeholder="AE-XXXX-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" required />
                    </label>}
                    <div className="platform-form-grid">
                        <label><span>新的 6 位數字</span><input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={form.pin} onChange={update} autoComplete="new-password" required /></label>
                        <label><span>再輸入一次</span><input name="confirmPin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={form.confirmPin} onChange={update} autoComplete="new-password" required /></label>
                    </div>
                    <small className="platform-footnote">{weakPinHelp}</small>
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
