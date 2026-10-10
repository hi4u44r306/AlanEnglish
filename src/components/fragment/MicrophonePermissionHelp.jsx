import React from "react";

export default function MicrophonePermissionHelp({ issue }) {
    if (issue?.kind !== "permission") return null;
    return <details className="microphone-permission-help"><summary>如何允許麥克風？</summary><p>電腦：開啟網址列旁的網站資訊或權限設定，將「麥克風」設為允許，再回來按「重新檢查」。</p><p>iPhone Safari：開啟網址列的頁面選單，進入網站設定，將「麥克風」設為允許。若仍無法使用，請家長協助檢查裝置的麥克風限制。</p></details>;
}
