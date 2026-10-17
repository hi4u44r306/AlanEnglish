import React from "react";
import { useAuth } from "../auth/AuthContext";
import { ThemeRoleSync } from "./ThemeContext";

// 把登入角色交給外觀設定：只有管理員能換深色，其他人固定淺色。
export default function ThemeRoleBridge() {
    const { role, authLoading } = useAuth();
    return <ThemeRoleSync role={role} authLoading={authLoading} />;
}
