import React, { useEffect, useState } from "react";
import { FiAlertCircle, FiCheckCircle } from "react-icons/fi";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { storeSupabase } from "../../store/storeSupabase";
import StoreHeader from "./StoreHeader";
import "./css/Store.scss";

const safeNextPath = search => {
    const requested = new URLSearchParams(search).get("next");
    return requested?.startsWith("/shop") ? requested : "/shop";
};

export default function StoreVerificationPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const [status, setStatus] = useState("checking");
    const [countdown, setCountdown] = useState(5);
    const next = safeNextPath(location.search);
    const loginPath = `/shop/login?next=${encodeURIComponent(next)}&verified=1`;

    useEffect(() => {
        let active = true;
        const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
        const queryParams = new URLSearchParams(location.search);
        const authError = hashParams.get("error_description") || queryParams.get("error_description");
        if (authError) {
            setStatus("error");
            return () => { active = false; };
        }

        storeSupabase.auth.getSession().then(async ({ data, error }) => {
            if (!active) return;
            if (error || !data.session?.user?.email_confirmed_at) {
                setStatus("error");
                return;
            }
            const { error: signOutError } = await storeSupabase.auth.signOut({ scope: "local" });
            if (!active) return;
            setStatus(signOutError ? "error" : "success");
        }).catch(() => { if (active) setStatus("error"); });

        return () => { active = false; };
    }, [location.hash, location.search]);

    useEffect(() => {
        if (status !== "success") return undefined;
        if (countdown <= 0) {
            navigate(loginPath, { replace: true });
            return undefined;
        }
        const timer = window.setTimeout(() => setCountdown(current => current - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [countdown, loginPath, navigate, status]);

    return <><StoreHeader /><main className="store-page store-auth-page"><section className={`store-result-card store-verification-result ${status}`} aria-live="polite">
        {status === "checking" && <><div className="store-verification-spinner" aria-hidden="true" /><h1>正在確認 Email 驗證</h1><p>請稍候，我們正在確認商城帳號狀態。</p></>}
        {status === "success" && <><FiCheckCircle /><h1>謝謝，已完成驗證</h1><p>商城 Email 已驗證完成，{countdown} 秒後會前往登入頁。</p><Link to={loginPath}>立即前往商城登入</Link></>}
        {status === "error" && <><FiAlertCircle /><h1>驗證連結無效或已使用</h1><p>若你已完成驗證，請直接登入；若仍無法登入，請回到註冊頁重新寄送驗證信。</p><div><Link to={loginPath}>前往商城登入</Link><Link className="secondary" to={`/shop/register?next=${encodeURIComponent(next)}`}>重新寄送驗證信</Link></div></>}
    </section></main></>;
}
