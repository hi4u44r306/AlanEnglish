import React from "react";
import { isRunningAsInstalledApp } from "../utils/installGuide";
import BackButton from "../components/fragment/BackButton";
import "./StandaloneBackLink.scss";

// 從主畫面圖示開啟的 App 沒有瀏覽器返回鍵與網址列，沒有導覽列的公開頁要自己提供出口。
// 一般瀏覽器不顯示，避免改變現有畫面。
// floating：頁面版面是橫向置中（例如登入頁）時，改成固定在左上角，避免被排進版面裡。
// always：公開的介紹頁（試一課、給家長）可能從 LINE 等 App 內建瀏覽器開啟，沒有返回鍵，所以一律顯示。
const StandaloneBackLink = ({ to = "/", children = "回首頁", floating = false, always = false }) => {
    if (!always && !isRunningAsInstalledApp()) return null;
    return <BackButton className={`standalone-back-link${floating ? " standalone-back-link--floating" : ""}`} to={to} label={children} />;
};

export default StandaloneBackLink;
