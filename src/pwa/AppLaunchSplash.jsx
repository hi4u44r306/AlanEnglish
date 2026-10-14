import React from "react";

// 從主畫面圖示開啟時的讀取畫面：品牌深藍底＋圖示，與 manifest／iOS 啟動畫面一致。
const AppLaunchSplash = () => (
    <div
        role="status"
        aria-live="polite"
        style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "18px",
            background: "#ffffff",
            color: "#073763"
        }}
    >
        <img src="/pwa/maskable-512.png" alt="" width="144" height="144" style={{ display: "block" }} />
        <span style={{ fontSize: "15px", opacity: 0.85 }}>正在確認登入狀態...</span>
    </div>
);

export default AppLaunchSplash;
