import React from "react";
import { useLocation } from "react-router-dom";
import SystemErrorBoundary from "./SystemErrorBoundary";

// 包住路由：換頁時自動清除錯誤，不會卡在壞掉的畫面。
export default function RouteErrorBoundary({ children }) {
    const location = useLocation();
    return <SystemErrorBoundary resetKey={location.pathname}>{children}</SystemErrorBoundary>;
}
