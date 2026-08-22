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
