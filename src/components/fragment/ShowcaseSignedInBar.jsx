import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getRoleHome } from "../../auth/RoleHomeRedirect";

// 已登入的人打開公開首頁時，頂端顯示一條「你已登入」提示，避免看到「登入」按鈕以為被登出。
// 沒登入時什麼都不顯示。
function ShowcaseSignedInBar() {
    const { isAuthenticated, role } = useAuth();
    if (!isAuthenticated || !role) return null;
    const label = role === "student" ? "回到我的學習" : "回到管理首頁";
    return (
        <div className="showcase-signed-in" role="status">
            <span>你已登入</span>
            <Link to={getRoleHome(role)}>{label}</Link>
        </div>
    );
}

export default ShowcaseSignedInBar;
