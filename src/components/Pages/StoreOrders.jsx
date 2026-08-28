import React, { useCallback, useEffect, useState } from "react";
import { FiCheckCircle, FiClock, FiPackage, FiTruck, FiXCircle } from "react-icons/fi";
import { Link, Navigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useStore } from "../../store/StoreContext";
import { cancelStoreCheckout, loadStoreOrder, loadStoreOrders } from "../../services/storeService";
import StoreHeader from "./StoreHeader";
import "./css/Store.scss";

const PAYMENT = { pending: "等待付款", paid: "付款完成", failed: "付款失敗", expired: "付款逾時", refunded: "已退款", cancelled: "已取消付款" };
const FULFILLMENT = { awaiting_payment: "等待付款", preparing: "準備中", shipping: "運送中", completed: "已完成", cancelled: "已取消" };
const money = value => `NT$${Number(value || 0).toLocaleString("zh-TW")}`;
const StepIcon = ({ status }) => status === "completed" ? <FiCheckCircle /> : status === "shipping" ? <FiTruck /> : status === "preparing" ? <FiPackage /> : status === "cancelled" ? <FiXCircle /> : <FiClock />;

export default function StoreOrders() {
    const { session, authLoading } = useStore();
    const { orderNumber } = useParams();
    const [orders, setOrders] = useState([]); const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState("");
    const load = useCallback(async () => { if (!session) return; setLoading(true); try { const result = orderNumber ? await loadStoreOrder(session, orderNumber) : await loadStoreOrders(session); setOrders(orderNumber ? [result.order] : result.orders || []); } catch (error) { toast.error(error.message); } finally { setLoading(false); } }, [session, orderNumber]);
    useEffect(() => { load(); }, [load]);
    const cancelPayment = async order => {
        if (!window.confirm(`確定取消訂單 ${order.order_number} 的付款嗎？取消後原本的 Stripe 付款頁將無法再使用。`)) return;
        setCancelling(order.order_number);
        try { await cancelStoreCheckout(session, order.order_number); toast.success("已取消付款，這筆訂單不會出貨"); await load(); }
        catch (error) { toast.error(error.message || "目前無法取消付款"); }
        finally { setCancelling(""); }
    };
    if (!authLoading && !session) return <Navigate to={`/shop/login?next=${encodeURIComponent(orderNumber ? `/shop/orders/${orderNumber}` : "/shop/orders")}`} replace />;
    return <><StoreHeader /><main className="store-page"><header className="store-page-title"><span>ORDER HISTORY</span><h1>{orderNumber ? `訂單 ${orderNumber}` : "我的歷史訂單"}</h1><p>付款狀態與出貨進度分開顯示；付款完成後才會進入準備中。</p></header>
        {loading ? <section className="store-empty"><p>讀取訂單中…</p></section> : orders.length === 0 ? <section className="store-empty"><FiPackage /><h2>目前沒有訂單</h2><Link to="/shop">前往選購教材</Link></section> : <section className="store-order-list">{orders.map(order => <article key={order.id}>
            <header><div><span>{new Date(order.created_at).toLocaleString("zh-TW")}</span><h2>{order.order_number}</h2></div><div><span className={`store-status payment-${order.payment_status}`}>{PAYMENT[order.payment_status] || order.payment_status}</span><span className={`store-status fulfillment-${order.fulfillment_status}`}>{FULFILLMENT[order.fulfillment_status] || order.fulfillment_status}</span></div></header>
            <div className={`store-order-progress${order.fulfillment_status === "cancelled" ? " is-cancelled" : ""}`}><StepIcon status={order.fulfillment_status} /><div><strong>{order.fulfillment_status === "cancelled" ? "已取消付款" : FULFILLMENT[order.fulfillment_status]}</strong><p>{order.fulfillment_status === "preparing" ? "我們已收到款項，正在整理教材。" : order.fulfillment_status === "shipping" ? "教材已交由物流配送。" : order.fulfillment_status === "completed" ? "這筆訂單已完成。" : order.fulfillment_status === "cancelled" ? "這筆付款已取消，訂單不會出貨。" : "尚未收到 Stripe 的付款確認。"}</p></div></div>
            <div className="store-order-items">{(order.store_order_items || []).map(item => <div key={item.id}><span>{item.package_name} × {item.quantity}</span><strong>{money(item.line_total_twd)}</strong></div>)}</div>
            <footer><div><span>收件人</span><strong>{order.recipient_name} · {order.recipient_phone}</strong><small>{order.postal_code} {order.city}{order.district}{order.address_line1}{order.address_line2 || ""}</small></div>{order.tracking_number && <div><span>{order.carrier || "物流"}</span><strong>{order.tracking_number}</strong>{order.tracking_url && <a href={order.tracking_url} target="_blank" rel="noreferrer">開啟物流查詢</a>}</div>}<div><span>訂單總額</span><strong>{money(order.total_twd)}</strong><small>商品 {money(order.subtotal_twd)}＋運費 {money(order.shipping_fee_twd)}</small></div>{order.payment_status === "pending" && order.fulfillment_status === "awaiting_payment" ? <button className="store-cancel-payment" type="button" disabled={cancelling === order.order_number} onClick={() => cancelPayment(order)}>{cancelling === order.order_number ? "取消中…" : "取消這筆付款"}</button> : !orderNumber && <Link to={`/shop/orders/${order.order_number}`}>查看完整訂單</Link>}</footer>
            {orderNumber && <div className="store-order-history">{(order.store_order_status_history || []).map(row => <div key={row.id}><time>{new Date(row.created_at).toLocaleString("zh-TW")}</time><strong>{FULFILLMENT[row.fulfillment_status] || row.fulfillment_status}</strong><span>{row.note || "狀態已更新"}</span></div>)}</div>}
        </article>)}</section>}
    </main></>;
}
