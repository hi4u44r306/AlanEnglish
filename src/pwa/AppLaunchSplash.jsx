import React, { useEffect } from "react";

// 從主畫面圖示開啟時的讀取畫面。畫面本身就是 index.html 的 #boot-splash（白底＋獅頭＋品牌字樣，已內嵌，
// 與 iOS 啟動圖大小與位置一致），這裡不再另外畫一個 logo，避免兩層交接時閃一下。
// 這個元件離開畫面（確認完登入、要跳去首頁）時才移除 #boot-splash。
const AppLaunchSplash = () => {
    useEffect(() => () => document.getElementById("boot-splash")?.remove(), []);

    return (
        <div
            role="status"
            aria-label="正在確認登入狀態"
            style={{ position: "fixed", inset: 0, background: "#ffffff" }}
        />
    );
};

export default AppLaunchSplash;
