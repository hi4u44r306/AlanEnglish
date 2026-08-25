import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    deleteUser,
    setPersistence
} from "firebase/auth";
import { authentication } from "./firebase-config";
import {
    activateAcademyInvitation,
    claimAcademyInvitation,
    previewAcademyInvitation
} from "../../services/academyStudentService";
import { useAuth } from "../../auth/AuthContext";
import { sendBrandedVerificationEmail } from "../../services/authEmailService";
import {
    isReceivableEmail,
    RECEIVABLE_EMAIL_HELP
} from "../../utils/emailValidation";
import "./css/Platform.scss";

const RESEND_SECONDS = 60;

const friendlyError = error => {
    if (error?.code === "auth/email-already-in-use") return "這個 Email 已經有帳號，請先登入後再開啟邀請連結。";
    if (error?.code === "auth/weak-password") return "密碼強度不足，請至少輸入 8 個字元。";
    if (error?.code === "auth/network-request-failed") return "網路連線失敗，請稍後再試。";
    return error?.message || "無法完成邀請，請聯絡客服。";
};

function AcademyInviteSignup({ manualEntry = false }) {
    const [params] = useSearchParams();
    const tokenFromUrl = params.get("token") || "";
    const { firebaseUser, logout } = useAuth();
    const [token, setToken] = useState(tokenFromUrl);
    const [invitation, setInvitation] = useState(null);
    const [loading, setLoading] = useState(Boolean(tokenFromUrl));
    const [submitting, setSubmitting] = useState(false);
    const [sending, setSending] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [claimedUser, setClaimedUser] = useState(null);
    const [lookup, setLookup] = useState({ email: "", code: "" });
    const [form, setForm] = useState({ email: "", password: "", confirmPassword: "", emailConfirmed: false });

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const result = await previewAcademyInvitation(token);
                if (cancelled) return;
                setInvitation(result.invitation);
                setForm(current => ({ ...current, email: result.invitation?.invited_email || "" }));
            } catch (previewError) {
                if (!cancelled) setError(previewError?.message || "邀請連結已失效。");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [token]);

    const lookupInvitation = async event => {
        event.preventDefault();
        setError("");
        setNotice("");

        const email = lookup.email.trim().toLowerCase();
        const code = lookup.code.trim().toUpperCase();
        if (!isReceivableEmail(email)) return setError(RECEIVABLE_EMAIL_HELP);
        if (!code) return setError("請輸入英文班提供的一次性開通碼。");

        setLoading(true);
        try {
            const result = await previewAcademyInvitation(code, email);
            setInvitation(result.invitation);
            setForm(current => ({ ...current, email: result.invitation?.invited_email || email }));
            setToken(code);
        } catch (lookupError) {
            setError(lookupError?.message || "帳號或開通碼不正確，請重新確認。");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (
            firebaseUser &&
            invitation?.status === "claimed" &&
            firebaseUser.email?.toLowerCase() === invitation.invited_email
        ) {
            setClaimedUser(firebaseUser);
        }
    }, [firebaseUser, invitation]);

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const timer = window.setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
        return () => window.clearInterval(timer);
    }, [cooldown]);

    const sendVerification = async user => {
        if (!user || user.emailVerified) return;
        setSending(true);
        setError("");
        try {
            await sendBrandedVerificationEmail(user, `/academy/invite?token=${encodeURIComponent(token)}`);
            setCooldown(RESEND_SECONDS);
            setNotice("驗證信已寄出，請檢查收件匣、垃圾郵件與促銷內容。");
        } catch (sendError) {
            setError(friendlyError(sendError));
        } finally {
            setSending(false);
        }
    };

    const submit = async event => {
        event.preventDefault();
        setError("");
        setNotice("");

        const email = form.email.trim().toLowerCase();
        if (!isReceivableEmail(email)) return setError(RECEIVABLE_EMAIL_HELP);
        if (email !== invitation?.invited_email) return setError("請使用邀請指定的 Email 註冊。");
        if (!form.emailConfirmed) return setError("請先確認這個 Email 可以正常收信。");
        if (form.password.length < 8) return setError("密碼至少需要 8 個字元。");
        if (form.password !== form.confirmPassword) return setError("兩次輸入的密碼不一致。");

        setSubmitting(true);
        let createdUser = null;
        let claimed = false;
        try {
            await setPersistence(authentication, browserLocalPersistence);
            const credential = await createUserWithEmailAndPassword(authentication, email, form.password);
            createdUser = credential.user;
            await claimAcademyInvitation(createdUser, token);
            claimed = true;
            setClaimedUser(createdUser);
            await sendVerification(createdUser);
        } catch (submitError) {
            if (createdUser && !claimed) {
                try { await deleteUser(createdUser); } catch (cleanupError) { console.warn("清理未完成邀請的帳號失敗:", cleanupError); }
            }
            setError(friendlyError(submitError));
        } finally {
            setSubmitting(false);
        }
    };

    const activate = async () => {
        const user = claimedUser || authentication.currentUser;
        if (!user) return setError("請使用剛才建立的帳號登入後再確認驗證。");
        setSubmitting(true);
        setError("");
        try {
            await user.reload();
            if (!user.emailVerified) {
                setError("尚未偵測到 Email 驗證，請完成信件中的驗證後再按一次。");
                return;
            }
            await user.getIdToken(true);
            await activateAcademyInvitation(user, token);
            await logout();
            window.location.assign("/login?activated=1");
        } catch (activateError) {
            setError(friendlyError(activateError));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <main className="platform-public"><section className="platform-public-card platform-center"><p>正在確認邀請⋯</p></section></main>;

    if (manualEntry && !invitation && !token) {
        return (
            <main className="platform-public">
                <section className="platform-public-card">
                    <span className="platform-eyebrow">ACADEMY ACCOUNT ACTIVATION</span>
                    <h1>開通英文班帳號</h1>
                    <p>輸入櫃檯提供的登入 Email 與一次性開通碼，接著就能自行設定密碼。</p>
                    <form className="platform-form" onSubmit={lookupInvitation}>
                        <label>
                            <span>登入與收信 Email</span>
                            <input
                                type="email"
                                value={lookup.email}
                                onChange={event => setLookup(current => ({ ...current, email: event.target.value }))}
                                placeholder="name@gmail.com"
                                autoComplete="email"
                                required
                            />
                            <small>{RECEIVABLE_EMAIL_HELP}</small>
                        </label>
                        <label>
                            <span>一次性開通碼</span>
                            <input
                                className="platform-activation-code"
                                type="text"
                                value={lookup.code}
                                onChange={event => setLookup(current => ({ ...current, code: event.target.value.toUpperCase() }))}
                                placeholder="AE-XXXX-XXXX-XXXX"
                                autoComplete="one-time-code"
                                autoCapitalize="characters"
                                spellCheck="false"
                                required
                            />
                        </label>
                        {error && <div className="platform-form-error" role="alert"><strong>無法確認開通資料</strong><span>{error}</span></div>}
                        <button className="platform-primary platform-wide" type="submit">確認帳號並設定密碼</button>
                    </form>
                    <p className="platform-footnote">已經開通？ <Link to="/login">返回登入</Link>　·　<Link to="/support">聯絡客服</Link></p>
                </section>
            </main>
        );
    }

    if (!invitation) return <main className="platform-public"><section className="platform-public-card platform-center"><div className="platform-icon">⚠️</div><h1>無法使用這份邀請</h1><p>{error || "邀請連結不完整，請向英文班索取新的邀請連結或開通碼。"}</p><Link className="platform-secondary" to="/support">聯絡客服</Link></section></main>;

    if (claimedUser || invitation.status === "claimed") {
        const inviteSessionUser = claimedUser || (firebaseUser?.email?.toLowerCase() === invitation.invited_email ? firebaseUser : null);
        return <main className="platform-public"><section className="platform-public-card platform-center"><div className="platform-icon">✉️</div><span className="platform-eyebrow">EMAIL VERIFICATION</span><h1>最後一步：驗證 Email</h1><p>驗證信已寄到 <strong>{invitation.invited_email}</strong>。驗證完成後才會啟用英文班權限。</p>{firebaseUser && !inviteSessionUser && <div className="platform-verification-notice error" role="alert">目前登入的帳號與邀請 Email 不同，請先切換帳號。</div>}{notice && <div className="platform-verification-notice success">{notice}</div>}{error && <div className="platform-verification-notice error" role="alert">{error}</div>}<div className="platform-verification-actions">{inviteSessionUser ? <><button className="platform-primary" type="button" onClick={activate} disabled={submitting}>{submitting ? "確認中…" : "我已完成 Email 驗證"}</button><button className="platform-secondary" type="button" onClick={() => sendVerification(inviteSessionUser)} disabled={sending || cooldown > 0}>{sending ? "寄送中…" : cooldown > 0 ? `${cooldown} 秒後可重寄` : "重新寄送驗證信"}</button></> : firebaseUser ? <button className="platform-primary" type="button" onClick={logout}>切換到受邀帳號</button> : <Link className="platform-primary" to="/login" state={{ from: { pathname: "/academy/invite", search: `?token=${encodeURIComponent(token)}` } }}>登入後確認驗證</Link>}</div><p className="platform-footnote">仍未收到？請檢查垃圾郵件，或 <Link to="/support">聯絡客服</Link>。</p></section></main>;
    }

    return (
        <main className="platform-public">
            <section className="platform-public-card">
                <span className="platform-eyebrow">ACADEMY INVITATION</span>
                <h1>設定你的英文班帳號</h1>
                <p>{invitation.chinese_name}，你受邀加入 {invitation.class_code} 班。請自行設定密碼，櫃檯與老師都看不到你的密碼。</p>
                <form className="platform-form" onSubmit={submit}>
                    <label><span>登入與收信 Email</span><input type="email" value={form.email} readOnly autoComplete="email" /><small>{RECEIVABLE_EMAIL_HELP}</small></label>
                    <div className="platform-form-grid">
                        <label><span>設定密碼</span><input type="password" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} minLength="8" autoComplete="new-password" required /></label>
                        <label><span>再次輸入密碼</span><input type="password" value={form.confirmPassword} onChange={event => setForm(current => ({ ...current, confirmPassword: event.target.value }))} minLength="8" autoComplete="new-password" required /></label>
                    </div>
                    <label className="platform-check"><input type="checkbox" checked={form.emailConfirmed} onChange={event => setForm(current => ({ ...current, emailConfirmed: event.target.checked }))} required /><span>我確認可以登入這個信箱並收取驗證信與密碼重設信。</span></label>
                    {error && <div className="platform-form-error" role="alert"><strong>無法完成註冊</strong><span>{error}</span></div>}
                    <button className="platform-primary platform-wide" type="submit" disabled={submitting}>{submitting ? "建立帳號中…" : "設定密碼並寄送驗證信"}</button>
                </form>
                <p className="platform-footnote">已經有帳號？ <Link to="/login">前往登入</Link>　·　<Link to="/support">聯絡客服</Link></p>
            </section>
        </main>
    );
}

export default AcademyInviteSignup;
