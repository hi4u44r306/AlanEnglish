import React, { useState } from "react";
import { FiLock, FiMail } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { storeSupabase } from "../../store/storeSupabase";
import StoreHeader from "./StoreHeader";
import "./css/Store.scss";

export default function StorePasswordPage({ update = false }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async event => {
        event.preventDefault();
        setBusy(true);
        try {
            if (update) {
                if (password.length < 8) throw new Error("商城密碼至少需要 8 個字元");
                if (password !== confirm) throw new Error("兩次輸入的商城密碼不一致");
                const { error } = await storeSupabase.auth.updateUser({ password });
                if (error) throw error;
                await storeSupabase.auth.signOut();
                toast.success("商城密碼已更新，請重新登入");
                navigate("/shop/login", { replace: true });
            } else {
                const { error } = await storeSupabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
                    redirectTo: `${window.location.origin}/shop/reset-password`
                });
                if (error) throw error;
                toast.success("若此 Email 有商城帳號，重設信已寄出");
            }
        } catch (error) { toast.error(error.message || "商城密碼操作失敗"); }
        finally { setBusy(false); }
    };

    return <><StoreHeader /><main className="store-page store-auth-page"><section className="store-auth-card">
        <span>STORE PASSWORD</span><h1>{update ? "設定新的商城密碼" : "忘記商城密碼"}</h1>
        <p>這裡只處理教材商城密碼，不會更改聽力平台的學生／老師密碼。</p>
        <form onSubmit={submit}>
            {update ? <>
                <label><span><FiLock />新的商城密碼</span><input required minLength="8" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
                <label><span><FiLock />再次輸入</span><input required minLength="8" type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} /></label>
            </> : <label><span><FiMail />商城帳號 Email</span><input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>}
            <button disabled={busy}>{busy ? "處理中…" : update ? "更新商城密碼" : "寄送商城重設信"}</button>
        </form>
        <footer><Link to="/shop/login">返回商城登入</Link></footer>
    </section></main></>;
}
