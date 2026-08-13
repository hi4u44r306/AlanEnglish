import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import "../assets/scss/AssignmentShortcut.scss";

const AssignmentShortcut = () => {
    const { role, isAuthenticated } = useAuth();
    if (!isAuthenticated) return null;

    const manager = role === "teacher" || role === "admin";
    const path = manager ? "/teacher/assignments" : "/student/assignments";
    const label = manager ? "發布作業" : "今日作業";

    return (
        <Link className="assignment-shortcut" to={path}>
            <span>✎</span>
            <strong>{label}</strong>
        </Link>
    );
};

export default AssignmentShortcut;
