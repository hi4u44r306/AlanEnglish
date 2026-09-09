import React from "react";
import { FiClock, FiHome } from "react-icons/fi";
import { Link } from "react-router-dom";
import StoreHeader from "./StoreHeader";
import "./css/Store.scss";

export default function StoreSalesPaused() {
    return <><StoreHeader /><main className="store-page"><section className="store-empty"><FiClock /><h1>教材包暫未開放販售</h1><p>教材內容與購買流程正在整理；目前無法加入購物車或結帳。既有訂單仍可查詢。</p><Link to="/shop/orders">查詢既有訂單</Link><Link to="/"><FiHome />回到網站首頁</Link></section></main></>;
}
