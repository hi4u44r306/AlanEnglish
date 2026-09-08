import React, { useEffect, useState } from "react";
import { FiCheckCircle, FiClock } from "react-icons/fi";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useStore } from "../../store/StoreContext";
import { syncStoreCheckout } from "../../services/storeService";
import StoreHeader from "./StoreHeader";
import "./css/Store.scss";

export default function StorePaymentResult() {
    const { session, authLoading, clearCart } = useStore();
    const location = useLocation();
    const id = new URLSearchParams(location.search).get("session_id");
    const [result, setResult] = useState(null); const [error, setError] = useState("");
    useEffect(() => {
        if (!session || !id) return;
        syncStoreCheckout(session, id).then(next => { setResult(next); if (next.payment_status === "paid") clearCart(); }).catch(reason => setError(reason.message));
    }, [session, id, clearCart]);
    if (!authLoading && !session) return <Navigate to={`/shop/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />;
    return <><StoreHeader /><main className="store-page"><section className="store-result-card">
        {error ? <><FiClock /><h1>付款確認遇到問題</h1><p>{error}</p></> : !result ? <><FiClock /><h1>正在確認付款</h1><p>請不要重複付款，系統正在核對訂單。</p></> : result.payment_status === "paid" ? <><FiCheckCircle /><h1>付款完成，訂單準備中</h1><p>我們確認收到款項後才會開始備貨。訂單編號：<strong>{result.order_number}</strong></p>{result.learning_access_status === "claimed" ? <section className="store-learning-access is-claimed"><FiCheckCircle /><div><strong>教材與 90 天平台權限已帶入</strong><span>登入學習平台即可開始使用。</span></div><Link to="/login?next=/student/membership">前往學習平台</Link></section> : <section className="store-learning-access"><FiClock /><div><strong>還差一步：開通學習帳號</strong><span>用商城相同 Email 建立並驗證學習帳號，系統才會安全帶入教材與 90 天權限。</span></div><Link to="/shop/activate-learning">立即開通</Link></section>}</> : <><FiClock /><h1>付款仍在確認中</h1><p>請稍後到歷史訂單重新查看，未付款的訂單不會出貨。</p></>}
        <div><Link to="/shop/orders">查看我的訂單</Link><Link className="secondary" to="/shop">回到教材商城</Link></div>
    </section></main></>;
}
