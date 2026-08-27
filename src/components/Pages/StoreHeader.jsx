import React from "react";
import { FiHome, FiLogIn, FiLogOut, FiPackage, FiShoppingCart } from "react-icons/fi";
import { Link } from "react-router-dom";
import Brand from "../fragment/Brand";
import { useStore } from "../../store/StoreContext";

export default function StoreHeader() {
    const { user, authLoading, cartCount, signOut } = useStore();
    return <header className="commerce-site-header store-header">
        <Link className="commerce-site-brand" to="/shop" aria-label="回到教材商城"><Brand /></Link>
        <nav aria-label="教材商城導覽">
            <Link to="/" className="store-header-home"><FiHome />網站首頁</Link>
            <Link to="/shop/cart"><FiShoppingCart />購物車{cartCount > 0 && <b>{cartCount}</b>}</Link>
            {!authLoading && (user
                ? <><Link to="/shop/orders"><FiPackage />我的訂單</Link><button type="button" onClick={signOut}><FiLogOut />商城登出</button></>
                : <Link to="/shop/login"><FiLogIn />商城登入</Link>)}
        </nav>
    </header>;
}
