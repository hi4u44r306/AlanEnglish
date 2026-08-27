import React, { useState } from "react";
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
                        emailRedirectTo: `${window.location.origin}/shop/login?next=${encodeURIComponent(next)}`
                    }
                });
                if (error) throw error;
                if (!data.session) toast.success("註冊成功，請先到信箱完成商城 Email 驗證");
                else navigate(next, { replace: true });
            } else {
                const { error } = await storeSupabase.auth.signInWithPassword({ email: form.email.trim().toLowerCase(), password: form.password });
                if (error) throw error;
                navigate(next, { replace: true });
            }
        } catch (error) { toast.error(error.message || "商城帳號操作失敗"); }
        finally { setBusy(false); }
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
        <footer>{register ? "已經有商城帳號？" : "還沒有商城帳號？"}<Link to={`${register ? "/shop/login" : "/shop/register"}?next=${encodeURIComponent(next)}`}>{register ? "登入" : "免費註冊"}</Link></footer>
        {!register && <Link className="store-learning-login" to="/shop/forgot-password">忘記商城密碼</Link>}
        <Link className="store-learning-login" to="/login">要登入聽力平台？前往學生／老師登入</Link>
    </section></main></>;
}
