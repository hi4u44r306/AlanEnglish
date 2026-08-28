import React from "react";
import { FiBookOpen, FiHome, FiLogIn, FiLogOut, FiPackage, FiShoppingCart } from "react-icons/fi";
import { Link } from "react-router-dom";
import Brand from "../fragment/Brand";
import { useStore } from "../../store/StoreContext";

export default function StoreHeader() {
    const { user, authLoading, cartCount, signOut } = useStore();
    return <header className="commerce-site-header store-header">
        <Link className="commerce-site-brand" to="/shop" aria-label="回到教材商城"><Brand /></Link>
        <nav aria-label="教材商城導覽">
            <Link to="/" className="store-header-home" aria-label="網站首頁"><FiHome /><span>網站首頁</span></Link>
            <Link to="/userinfo" className="store-header-learning" aria-label="學習平台"><FiBookOpen /><span>學習平台</span></Link>
            <Link to="/shop/cart" aria-label={cartCount > 0 ? `購物車，目前有 ${cartCount} 件商品` : "購物車"}><FiShoppingCart /><span>購物車</span>{cartCount > 0 && <b>{cartCount}</b>}</Link>
            {!authLoading && (user
                ? <><Link to="/shop/orders" aria-label="我的訂單"><FiPackage /><span>我的訂單</span></Link><button type="button" onClick={signOut} aria-label="商城登出"><FiLogOut /><span>商城登出</span></button></>
                : <Link to="/shop/login" aria-label="商城登入"><FiLogIn /><span>商城登入</span></Link>)}
        </nav>
    </header>;
}
