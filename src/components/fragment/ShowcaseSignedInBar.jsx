import React, { useLayoutEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getRoleHome } from "../../auth/RoleHomeRedirect";

// 已登入的人打開公開首頁時，頂端顯示一條「你已登入」提示，避免看到「登入」按鈕以為被登出。
// 沒登入時什麼都不顯示。
function ShowcaseSignedInBar() {
    const { isAuthenticated, role } = useAuth();
    const signedIn = Boolean(isAuthenticated && role);
    const [navHeight, setNavHeight] = useState(null);

    // 導覽列固定在最上面，手機上 logo 與按鈕會換行，高度不固定：量實際高度，提示條才不會被蓋住。
    useLayoutEffect(() => {
        if (!signedIn) return undefined;
        const nav = document.querySelector(".showcase-navbar");
        if (!nav) return undefined;
        const measure = () => setNavHeight(Math.ceil(nav.getBoundingClientRect().height));
        measure();
        if (typeof ResizeObserver === "function") {
            const observer = new ResizeObserver(measure);
            observer.observe(nav);
            return () => observer.disconnect();
        }
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [signedIn]);

    if (!signedIn) return null;
    const label = role === "student" ? "回到我的學習" : "回到管理首頁";
    return (
        <div className="showcase-signed-in" role="status" style={navHeight ? { marginTop: navHeight } : undefined}>
            <span>你已登入</span>
            <Link to={getRoleHome(role)}>{label}</Link>
        </div>
    );
}

export default ShowcaseSignedInBar;
