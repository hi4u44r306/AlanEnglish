import React from "react";

// 從主畫面圖示開啟時的讀取畫面：白底＋獅頭，大小與位置和 iOS 啟動圖、index.html 開機畫面一致（樣式在 index.html）。
const AppLaunchSplash = () => (
    <div
        role="status"
        aria-label="正在確認登入狀態"
        style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff"
        }}
    >
        <img className="ae-launch-logo" src="/pwa/lion.png" alt="" />
    </div>
);

export default AppLaunchSplash;
