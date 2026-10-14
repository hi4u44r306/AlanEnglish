import React from "react";

// 從主畫面圖示開啟時的讀取畫面：白底＋獅頭與品牌字樣。
// 版面必須和 index.html 的 #boot-splash 完全相同（fixed、inset 0、置中），兩個畫面交接時 logo 才不會上下跳動。
const AppLaunchSplash = () => (
    <div
        role="status"
        aria-label="正在確認登入狀態"
        style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff"
        }}
    >
        <img className="ae-launch-logo" src="/pwa/launch-logo.png" alt="" />
    </div>
);

export default AppLaunchSplash;
