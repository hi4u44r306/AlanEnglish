import React, { useEffect, useMemo, useState } from "react";
import { FiCreditCard, FiMapPin, FiShield, FiTruck } from "react-icons/fi";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useStore } from "../../store/StoreContext";
import { createStoreCheckout, loadStoreConfig } from "../../services/storeService";
import StoreHeader from "./StoreHeader";
import "./css/Store.scss";

const money = value => `NT$${Number(value || 0).toLocaleString("zh-TW")}`;
const EMPTY = { recipient_name: "", recipient_phone: "", postal_code: "", city: "", district: "", address_line1: "", address_line2: "", delivery_note: "", shipping_method_code: "" };

export default function StoreCheckout() {
    const { session, user, authLoading, cart } = useStore();
    const location = useLocation();
    const [form, setForm] = useState(EMPTY);
    const [methods, setMethods] = useState([]);
    const [busy, setBusy] = useState(false);
    const [checkoutRequestId, setCheckoutRequestId] = useState(() => window.crypto.randomUUID());
    useEffect(() => { loadStoreConfig().then(result => {
        const next = result.shipping_methods || []; setMethods(next);
        setForm(current => ({ ...current, shipping_method_code: current.shipping_method_code || next[0]?.code || "" }));
    }).catch(error => toast.error(error.message)); }, []);
    useEffect(() => { if (user) setForm(current => ({ ...current, recipient_name: current.recipient_name || user.user_metadata?.display_name || "" })); }, [user]);
    const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
    const selectedMethod = methods.find(item => item.code === form.shipping_method_code);
    if (!authLoading && !session) return <Navigate to="/shop/login?next=/shop/checkout" replace />;
    if (!authLoading && cart.length === 0) return <Navigate to="/shop/cart" replace />;

    const submit = async event => {
        event.preventDefault(); setBusy(true);
        try {
            const result = await createStoreCheckout(session, {
                checkout_request_id: checkoutRequestId,
                items: cart.map(item => ({ package_id: item.packageId, quantity: item.quantity })), shipping: form
            });
            if (!result.url) throw new Error("Stripe 結帳網址建立失敗");
            window.location.assign(result.url);
        } catch (error) { toast.error(error.message || "目前無法結帳"); setCheckoutRequestId(window.crypto.randomUUID()); setBusy(false); }
    };

    return <><StoreHeader /><main className="store-page"><header className="store-page-title"><span>DELIVERY & PAYMENT</span><h1>寄送資料與結帳</h1><p>付款會前往 Stripe 安全頁面；只有 Stripe 確認收到款項後，訂單才會進入準備中。</p></header>
        {new URLSearchParams(location.search).get("cancelled") && <div className="store-notice">你已取消付款，購物車與寄送資料不會因此出貨。</div>}
        <form className="store-checkout-layout" onSubmit={submit}><section className="store-checkout-form"><header><FiMapPin /><h2>收件基本資料</h2></header>
            <div className="store-form-grid"><label><span>收件人姓名</span><input required autoComplete="name" maxLength="80" value={form.recipient_name} onChange={e => setForm({ ...form, recipient_name: e.target.value })} /></label><label><span>手機或聯絡電話</span><input required inputMode="tel" autoComplete="tel" pattern="[0-9+() -]{8,20}" value={form.recipient_phone} onChange={e => setForm({ ...form, recipient_phone: e.target.value })} /></label><label><span>郵遞區號</span><input required inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{3,6}" value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} /></label><label><span>縣市</span><input required autoComplete="address-level1" maxLength="40" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></label><label><span>鄉鎮市區</span><input required autoComplete="address-level2" maxLength="40" value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} /></label><label className="wide"><span>路名、巷弄、門牌</span><input required autoComplete="address-line1" maxLength="160" value={form.address_line1} onChange={e => setForm({ ...form, address_line1: e.target.value })} /></label><label className="wide"><span>樓層、公司或社區名稱（選填）</span><input autoComplete="address-line2" maxLength="120" value={form.address_line2} onChange={e => setForm({ ...form, address_line2: e.target.value })} /></label><label className="wide"><span>配送備註（選填，請勿填寫付款資料）</span><textarea maxLength="300" value={form.delivery_note} onChange={e => setForm({ ...form, delivery_note: e.target.value })} /></label></div>
            <header><FiTruck /><h2>配送方式</h2></header><div className="store-shipping-methods">{methods.map(method => <label key={method.code}><input type="radio" name="shipping" required checked={form.shipping_method_code === method.code} onChange={() => setForm({ ...form, shipping_method_code: method.code })} /><span><strong>{method.name}</strong><small>{method.fee_twd ? money(method.fee_twd) : "免運"}</small></span></label>)}</div>
        </section><aside className="store-cart-summary"><FiShield /><h2>付款摘要</h2><div><span>商品小計</span><strong>{money(subtotal)}</strong></div><div><span>運費</span><strong>{selectedMethod?.fee_twd ? money(selectedMethod.fee_twd) : "免運"}</strong></div><div className="total"><span>合計</span><strong>{money(subtotal + Number(selectedMethod?.fee_twd || 0))}</strong></div><p>實際金額、商品與庫存會由後端再次核對。完成付款不代表已出貨，你可以在「我的訂單」查看進度。</p><button disabled={busy || !selectedMethod}><FiCreditCard />{busy ? "正在建立安全結帳…" : "前往 Stripe 付款"}</button></aside></form>
    </main></>;
}
