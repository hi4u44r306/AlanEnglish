import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import AppLaunchSplash from "../pwa/AppLaunchSplash";

const getRoleHome = (role) => {
    if (role === "admin") return "/admin/dashboard";
    if (role === "teacher") return "/teacher/dashboard";
    return "/student/dashboard";
};

const RoleHomeRedirect = () => {
    const { authLoading, isAuthenticated, role, studentProfile } = useAuth();

    if (authLoading) return <AppLaunchSplash />;

    if (!isAuthenticated) return <Navigate to="/login" replace />;

    if (role === "student" && !studentProfile?.membership?.is_active) {
        return <Navigate to="/student/membership" replace />;
    }

    return <Navigate to={getRoleHome(role)} replace />;
};

export { getRoleHome };
export default RoleHomeRedirect;
