import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { getRoleHome } from "./RoleHomeRedirect";

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { authLoading, isAuthenticated, role } = useAuth();
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
        return <Navigate to="/" replace state={{ from: location }} />;
    }

    if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        return <Navigate to={getRoleHome(role)} replace />;
    }

    return children;
};

export default ProtectedRoute;