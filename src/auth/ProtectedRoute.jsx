import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { getRoleHome } from "./RoleHomeRedirect";

const ProtectedRoute = ({ children, allowedRoles, requiresActiveMembership = false }) => {
    const { authLoading, isAuthenticated, role, studentProfile } = useAuth();
    const location = useLocation();

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

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        return <Navigate to={getRoleHome(role)} replace />;
    }

    if (
        requiresActiveMembership
        && role === "student"
        && !studentProfile?.membership?.is_active
    ) {
        return <Navigate to="/student/membership" replace state={{ from: location }} />;
    }

    return children;
};

export default ProtectedRoute;
