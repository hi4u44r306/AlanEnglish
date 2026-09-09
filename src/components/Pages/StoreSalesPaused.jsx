import React from "react";
import { FiClock, FiHome } from "react-icons/fi";
import { Link } from "react-router-dom";
import StoreHeader from "./StoreHeader";
import "./css/Store.scss";

export default function StoreSalesPaused() {
    return <><StoreHeader salesPaused /><main className="store-page"><section className="store-empty"><FiClock /><h1>教材包暫未開放販售</h1><p>我們正在整理教材內容與購買流程。目前無法加入購物車或結帳；已成立的訂單仍可查詢。</p><div className="store-empty-actions"><Link to="/shop">查看公告</Link><Link className="secondary" to="/"><FiHome />回到網站首頁</Link></div></section></main></>;
}
