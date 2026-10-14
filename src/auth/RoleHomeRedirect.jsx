import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import AppLaunchSplash from "../pwa/AppLaunchSplash";

const getRoleHome = (role) => {
    if (role === "admin") return "/admin/dashboard";
    if (role === "teacher") return "/teacher/dashboard";
    return "/student/dashboard";
};

const RoleHomeRedirect = () => {
    const { authLoading, isAuthenticated, role, studentProfile } = useAuth();
    const { search } = useLocation();

    if (authLoading) return <AppLaunchSplash />;

    // 從主畫面圖示開啟且未登入：停在公開首頁；其他入口維持導向登入頁。
    if (!isAuthenticated) return <Navigate to={new URLSearchParams(search).get("source") === "pwa" ? "/" : "/login"} replace />;

    if (role === "student" && !studentProfile?.membership?.is_active) {
        return <Navigate to="/student/membership" replace />;
    }

    return <Navigate to={getRoleHome(role)} replace />;
};

export { getRoleHome };
export default RoleHomeRedirect;
