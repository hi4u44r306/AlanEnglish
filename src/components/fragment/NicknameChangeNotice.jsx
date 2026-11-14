import React from "react";
import { Link } from "react-router-dom";
import { FiAlertCircle } from "react-icons/fi";
import "./css/NicknameChangeNotice.scss";

// Shown at the top of the leaderboard and the settings page when the student's saved
// nickname no longer passes moderation. Changing it is allowed at once (no 7-day wait).
function NicknameChangeNotice({ linkToSettings = false }) {
    return (
        <div className="nickname-change-notice" role="alert">
            <FiAlertCircle aria-hidden="true" />
            <div>
                <strong>你的暱稱需要更換</strong>
                <span>目前的暱稱不適合公開顯示，其他同學已經看不到它。請改成新的暱稱，不用等 7 天。</span>
            </div>
            {linkToSettings && <Link to="/student/settings">去修改暱稱</Link>}
        </div>
    );
}

export default NicknameChangeNotice;
