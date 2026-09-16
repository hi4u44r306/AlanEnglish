import React from "react";
import {
    Link,
    useLocation
} from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import "../assets/scss/AssignmentShortcut.scss";

const AssignmentShortcut = ({
    playerVisible = false,
    compactPlayer = false
}) => {
    const {
        role,
        isAuthenticated
    } = useAuth();

    const location = useLocation();

    if (!isAuthenticated) {
        return null;
    }

    const manager =
        role === "teacher" ||
        role === "admin";

    // 學生從 Navbar／更多進入「我的作業」，不再顯示會遮住
    // 學習內容的浮動捷徑；老師與管理員仍保留發布作業的快捷鈕。
    if (!manager) {
        return null;
    }

    const path = manager
        ? "/teacher/assignments"
        : "/student/assignments";

    const label = manager
        ? "發布作業"
        : "今日作業";

    const alreadyOnAssignmentPage =
        location.pathname === path ||
        location.pathname.startsWith(
            `${path}/`
        );

    if (alreadyOnAssignmentPage) {
        return null;
    }

    const className = [
        "assignment-shortcut",
        playerVisible
            ? "with-player"
            : "",
        compactPlayer
            ? "with-compact-player"
            : ""
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <Link
            className={className}
            to={path}
        >
            <span aria-hidden="true">
                ✎
            </span>

            <strong>{label}</strong>
        </Link>
    );
};

export default AssignmentShortcut;
