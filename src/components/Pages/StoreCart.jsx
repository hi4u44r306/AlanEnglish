import React from "react";
import { FiMinus, FiPlus, FiShoppingBag, FiTrash2 } from "react-icons/fi";
import { Link } from "react-router-dom";
import { useStore } from "../../store/StoreContext";
import StoreHeader from "./StoreHeader";
import "./css/Store.scss";

const money = value => `NT$${Number(value || 0).toLocaleString("zh-TW")}`;

export default function StoreCart() {
    const { cart, updateQuantity, removeFromCart, user } = useStore();
    const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    return <><StoreHeader /><main className="store-page"><header className="store-page-title"><span>SHOPPING CART</span><h1>購物車</h1><p>結帳時後端會重新確認售價、庫存與數量，不會直接相信瀏覽器中的金額。</p></header>
        {cart.length === 0 ? <section className="store-empty"><FiShoppingBag /><h2>購物車是空的</h2><Link to="/shop">前往選購教材</Link></section> : <div className="store-cart-layout"><section className="store-cart-list">{cart.map(item => <article key={item.packageId}>
            <div className="store-cart-cover">{item.coverUrl ? <img src={item.coverUrl} alt="" /> : <FiShoppingBag />}</div>
            <div><strong>{item.name}</strong><span>{money(item.price)}／組</span></div>
            <div className="store-quantity" aria-label={`${item.name}數量`}><button aria-label="減少數量" onClick={() => updateQuantity(item.packageId, item.quantity - 1)}><FiMinus /></button><input aria-label="數量" type="number" min="1" max={item.maximum} value={item.quantity} onChange={event => updateQuantity(item.packageId, event.target.value)} /><button aria-label="增加數量" onClick={() => updateQuantity(item.packageId, item.quantity + 1)}><FiPlus /></button></div>
            <strong>{money(item.price * item.quantity)}</strong><button className="store-remove" aria-label={`移除 ${item.name}`} onClick={() => removeFromCart(item.packageId)}><FiTrash2 /></button>
        </article>)}</section><aside className="store-cart-summary"><span>商品小計</span><strong>{money(subtotal)}</strong><p>運費會依結帳頁選擇的配送方式，由後端加入總額。</p><Link to={user ? "/shop/checkout" : "/shop/login?next=/shop/checkout"}>{user ? "填寫寄送資料" : "登入商城後結帳"}</Link><Link className="secondary" to="/shop">繼續購物</Link></aside></div>}
    </main></>;
}
