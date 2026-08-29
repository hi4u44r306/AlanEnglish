import React, { useEffect, useState } from "react";
import {
    FiBookOpen,
    FiHome,
    FiLogIn,
    FiLogOut,
    FiMenu,
    FiPackage,
    FiShoppingCart,
    FiUser,
    FiUserPlus,
    FiX,
} from "react-icons/fi";
import { Link, useLocation } from "react-router-dom";
import Brand from "../fragment/Brand";
import { useStore } from "../../store/StoreContext";
import "./css/Commerce.scss";
import "./css/Store.scss";

const routeIsActive = (pathname, route, exact = false) => (
    exact ? pathname === route : pathname === route || pathname.startsWith(`${route}/`)
);

export default function StoreHeader() {
    const { user, authLoading, cartCount, signOut } = useStore();
    const { pathname } = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    const browseActive = routeIsActive(pathname, "/shop", true);
    const cartActive = routeIsActive(pathname, "/shop/cart");
    const ordersActive = routeIsActive(pathname, "/shop/orders") || routeIsActive(pathname, "/shop/payment");
    const accountActive = ["/shop/login", "/shop/register", "/shop/forgot-password", "/shop/reset-password", "/shop/verified"]
        .some((route) => routeIsActive(pathname, route));

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!mobileOpen || typeof document === "undefined") return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const closeOnEscape = (event) => {
            if (event.key === "Escape") setMobileOpen(false);
        };
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [mobileOpen]);

    const handleSignOut = () => {
        setMobileOpen(false);
        signOut();
    };

    const activeProps = (active) => active ? { className: "is-active", "aria-current": "page" } : {};
    const cartLabel = cartCount > 0 ? `購物車，目前有 ${cartCount} 件商品` : "購物車";

    return <>
        <header className="commerce-site-header store-header">
            <div className="store-brand-lockup">
                <Link className="commerce-site-brand" to="/" aria-label="返回 Alan English 網站首頁"><Brand /></Link>
                <Link className="store-brand-context" to="/shop" aria-label="回到教材商城">教材商城</Link>
            </div>

            <nav className="store-desktop-nav" aria-label="教材商城主要導覽">
                <Link to="/shop" {...activeProps(browseActive)}><FiBookOpen /><span>逛教材</span></Link>
                <Link to="/shop/cart" aria-label={cartLabel} {...activeProps(cartActive)}>
                    <FiShoppingCart /><span>購物車</span>{cartCount > 0 && <b>{cartCount}</b>}
                </Link>
                <Link to="/shop/orders" {...activeProps(ordersActive)}><FiPackage /><span>我的訂單</span></Link>
                <Link to="/userinfo" className="store-cross-site"><FiBookOpen /><span>聽力學習平台</span></Link>
                {!authLoading && (user
                    ? <details className="store-account-menu">
                        <summary><FiUser /><span>我的帳號</span></summary>
                        <div>
                            <Link to="/shop/orders"><FiPackage />查看訂單</Link>
                            <button type="button" onClick={handleSignOut} aria-label="商城登出"><FiLogOut />商城登出</button>
                        </div>
                    </details>
                    : <Link to="/shop/login" {...activeProps(accountActive)}><FiLogIn /><span>登入／註冊</span></Link>)}
            </nav>

            <div className="store-mobile-actions">
                <Link to="/shop/cart" aria-label={cartLabel} {...activeProps(cartActive)}>
                    <FiShoppingCart />{cartCount > 0 && <b>{cartCount}</b>}
                </Link>
                <button type="button" onClick={() => setMobileOpen(true)} aria-label="開啟商城選單" aria-expanded={mobileOpen}>
                    <FiMenu />
                </button>
            </div>
        </header>

        {mobileOpen && <>
            <button className="store-mobile-backdrop" type="button" onClick={() => setMobileOpen(false)} aria-label="關閉商城選單" />
            <aside className="store-mobile-menu" role="dialog" aria-modal="true" aria-label="教材商城選單">
                <header>
                    <div><strong>教材商城</strong><span>選教材、結帳、查訂單</span></div>
                    <button type="button" onClick={() => setMobileOpen(false)} aria-label="關閉商城選單"><FiX /></button>
                </header>
                <nav aria-label="手機版教材商城導覽">
                    <section>
                        <h2>商城功能</h2>
                        <Link to="/shop" {...activeProps(browseActive)}><FiBookOpen /><span>逛教材<small>瀏覽所有教材商品</small></span></Link>
                        <Link to="/shop/cart" {...activeProps(cartActive)}><FiShoppingCart /><span>購物車<small>{cartCount > 0 ? `目前有 ${cartCount} 件商品` : "查看準備結帳的商品"}</small></span>{cartCount > 0 && <b>{cartCount}</b>}</Link>
                        <Link to="/shop/orders" {...activeProps(ordersActive)}><FiPackage /><span>我的訂單<small>查看付款與出貨進度</small></span></Link>
                    </section>
                    {!authLoading && <section>
                        <h2>商城帳號</h2>
                        {user
                            ? <button type="button" onClick={handleSignOut}><FiLogOut /><span>商城登出<small>登出目前的商城帳號</small></span></button>
                            : <>
                                <Link to="/shop/login" {...activeProps(accountActive)}><FiLogIn /><span>登入商城<small>查看訂單或繼續結帳</small></span></Link>
                                <Link to="/shop/register"><FiUserPlus /><span>免費註冊<small>建立獨立的商城帳號</small></span></Link>
                            </>}
                    </section>}
                    <section>
                        <h2>其他服務</h2>
                        <Link to="/userinfo"><FiBookOpen /><span>聽力學習平台<small>前往學生教材與聽力功能</small></span></Link>
                        <Link to="/"><FiHome /><span>Alan English 網站首頁<small>回到公開網站</small></span></Link>
                    </section>
                </nav>
            </aside>
        </>}
    </>;
}
