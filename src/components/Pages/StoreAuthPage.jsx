import React, { useEffect, useState } from "react";
import { FiLock, FiMail, FiUser } from "react-icons/fi";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useStore } from "../../store/StoreContext";
import { storeSupabase } from "../../store/storeSupabase";
import StoreHeader from "./StoreHeader";
import "./css/Store.scss";

export default function StoreAuthPage({ register = false }) {
    const { user, authLoading } = useStore();
    const navigate = useNavigate();
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const next = params.get("next")?.startsWith("/shop") ? params.get("next") : "/shop";
    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const [busy, setBusy] = useState(false);
    const [resending, setResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [verificationNotice, setVerificationNotice] = useState("");
    const verificationRedirect = `${window.location.origin}/shop/verified?next=${encodeURIComponent(next)}`;

    useEffect(() => {
        if (resendCooldown <= 0) return undefined;
        const timer = window.setTimeout(() => setResendCooldown(current => Math.max(0, current - 1)), 1000);
        return () => window.clearTimeout(timer);
    }, [resendCooldown]);

    if (!authLoading && user) return <Navigate to={next} replace />;

    const submit = async event => {
        event.preventDefault();
        if (form.password.length < 8) return toast.info("商城密碼至少需要 8 個字元");
        setBusy(true);
        try {
            if (register) {
                const { data, error } = await storeSupabase.auth.signUp({
                    email: form.email.trim().toLowerCase(), password: form.password,
                    options: {
                        data: { display_name: form.name.trim() },
                        emailRedirectTo: verificationRedirect
                    }
                });
                if (error) throw error;
                if (!data.session) {
                    setVerificationNotice("註冊成功，請到信箱完成商城 Email 驗證。若原本的連結已失效，可在下方重新寄送。");
                    toast.success("註冊成功，請先到信箱完成商城 Email 驗證");
                }
                else navigate(next, { replace: true });
            } else {
                const { error } = await storeSupabase.auth.signInWithPassword({ email: form.email.trim().toLowerCase(), password: form.password });
                if (error) throw error;
                navigate(next, { replace: true });
            }
        } catch (error) { toast.error(error.message || "商城帳號操作失敗"); }
        finally { setBusy(false); }
    };

    const resendVerification = async () => {
        const email = form.email.trim().toLowerCase();
        if (!email) return toast.info("請先輸入要驗證的商城 Email");
        setResending(true);
        setVerificationNotice("");
        try {
            const { error } = await storeSupabase.auth.resend({
                type: "signup",
                email,
                options: {
                    emailRedirectTo: verificationRedirect
                }
            });
            if (error) throw error;
            setResendCooldown(60);
            setVerificationNotice("已送出重新寄送請求。若這個帳號尚未完成驗證，請檢查收件匣、垃圾郵件與促銷內容；若已經驗證完成，系統不會再寄送，請直接登入。");
            toast.success("已送出商城驗證信請求");
        } catch (error) {
            const rateLimited = /rate limit|security purposes|seconds/i.test(error?.message || "");
            toast.error(rateLimited ? "寄送次數過多，請稍後再試" : "驗證信寄送失敗，請稍後再試");
        } finally {
            setResending(false);
        }
    };

    return <><StoreHeader /><main className="store-page store-auth-page"><section className="store-auth-card">
        <span>STORE ACCOUNT</span><h1>{register ? "建立商城帳號" : "登入教材商城"}</h1>
        <p>商城帳號和聽力平台帳號完全分開。同一個 Email 可以兩邊各自註冊，密碼及登入狀態不會互相影響。</p>
        <form onSubmit={submit}>
            {register && <label><span><FiUser />收件人姓名</span><input required autoComplete="name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></label>}
            <label><span><FiMail />Email</span><input required type="email" autoComplete="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></label>
            <label><span><FiLock />商城密碼</span><input required minLength="8" type="password" autoComplete={register ? "new-password" : "current-password"} value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} /><small>至少 8 個字元；請勿重複使用重要帳號的密碼。</small></label>
            <button disabled={busy}>{busy ? "處理中…" : register ? "建立商城帳號" : "登入商城"}</button>
        </form>
        {register && <section className="store-verification-resend" aria-label="商城 Email 驗證">
            <h2>已註冊但尚未完成驗證？</h2>
            <p>在上方輸入註冊時使用的 Email，即可取得新的驗證連結，不需要再次輸入或送出密碼。</p>
            {verificationNotice && <div className="store-verification-notice" role="status" aria-live="polite">{verificationNotice}</div>}
            <button type="button" onClick={resendVerification} disabled={resending || resendCooldown > 0 || !form.email.trim()}>
                {resending ? "寄送中…" : resendCooldown > 0 ? `${resendCooldown} 秒後可重新寄送` : "重新寄送驗證信"}
            </button>
        </section>}
        <footer>{register ? "已經有商城帳號？" : "還沒有商城帳號？"}<Link to={`${register ? "/shop/login" : "/shop/register"}?next=${encodeURIComponent(next)}`}>{register ? "登入" : "免費註冊"}</Link></footer>
        {!register && <Link className="store-learning-login" to="/shop/forgot-password">忘記商城密碼</Link>}
        <Link className="store-learning-login" to="/login">要登入聽力平台？前往學生／老師登入</Link>
    </section></main></>;
}
