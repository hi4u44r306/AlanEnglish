import React from "react";
import { Link } from "react-router-dom";
import { INSTALL_GUIDE_PATH, isRunningAsInstalledApp } from "../../utils/installGuide";
import "../Pages/css/InstallGuide.scss";

// 已經從主畫面圖示開啟時不需要再顯示教學入口。
function InstallEntry({ className = "" }) {
    if (isRunningAsInstalledApp()) return null;

    return (
        <Link className={`install-entry ${className}`.trim()} to={INSTALL_GUIDE_PATH}>
            <img src="/apple-touch-icon-v3.png" alt="" />
            <span>
                <strong>把 Alan English 加到手機桌面</strong>
                <small>3 步完成，像 App 一樣一點就開</small>
            </span>
            <b aria-hidden="true">›</b>
        </Link>
    );
}

export default InstallEntry;
