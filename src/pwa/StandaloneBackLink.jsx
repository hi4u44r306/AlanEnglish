import React from "react";
import { isRunningAsInstalledApp } from "../utils/installGuide";
import BackButton from "../components/fragment/BackButton";
import "./StandaloneBackLink.scss";

// 從主畫面圖示開啟的 App 沒有瀏覽器返回鍵與網址列，沒有導覽列的公開頁要自己提供出口。
// 一般瀏覽器不顯示，避免改變現有畫面。
// floating：頁面版面是橫向置中（例如登入頁）時，改成固定在左上角，避免被排進版面裡。
const StandaloneBackLink = ({ to = "/", children = "回首頁", floating = false }) => {
    if (!isRunningAsInstalledApp()) return null;
    return <BackButton className={`standalone-back-link${floating ? " standalone-back-link--floating" : ""}`} to={to} label={children} />;
};

export default StandaloneBackLink;
