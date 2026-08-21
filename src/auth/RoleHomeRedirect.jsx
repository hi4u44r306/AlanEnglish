import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const getRoleHome = (role) => {
    if (role === "admin") return "/admin/dashboard";
    if (role === "teacher") return "/teacher/dashboard";
    return "/student/dashboard";
};

const RoleHomeRedirect = () => {
    const { authLoading, isAuthenticated, role, studentProfile } = useAuth();

    if (authLoading) {
        return (
            <div style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px"
            }}>
                正在確認登入狀態...
            </div>
        );
    }

    if (!isAuthenticated) return <Navigate to="/" replace />;

    if (role === "student" && !studentProfile?.membership?.is_active) {
        return <Navigate to="/student/membership" replace />;
    }

    return <Navigate to={getRoleHome(role)} replace />;
};

export { getRoleHome };
export default RoleHomeRedirect;
