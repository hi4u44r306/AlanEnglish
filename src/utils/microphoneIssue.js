export const microphoneIssue = (cause, phase = "opening") => {
    if (phase === "interrupted") return { kind: "interrupted", title: "錄音中斷了", message: "請重新錄製這一題。目前題目與已完成的進度會保留。", retry: "重新錄製" };
    if (phase === "paused") return { kind: "paused", title: "麥克風已暫停", message: "離開頁面時已暫停收音；重新開啟後繼續目前這一題。", retry: "重新開啟麥克風" };
    if (["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(cause?.name)) return {
        kind: "permission", title: "尚未允許使用麥克風", message: "請在瀏覽器的網站權限中允許麥克風，再按重新檢查。", retry: "重新檢查"
    };
    if (["NotFoundError", "DevicesNotFoundError"].includes(cause?.name)) return {
        kind: "missing", title: "找不到麥克風", message: "目前找不到可用的麥克風，請確認麥克風或耳機已連接。", retry: "重新檢查"
    };
    if (cause?.name === "NotSupportedError") return {
        kind: "unsupported", title: "這個瀏覽器無法錄音", message: "請用新版 Chrome 或 Safari 開啟練習。", retry: null
    };
    return { kind: "unavailable", title: "麥克風無法啟動", message: "請確認麥克風連線，並關閉可能正在使用麥克風的其他程式，再試一次。", retry: "重新檢查" };
};
