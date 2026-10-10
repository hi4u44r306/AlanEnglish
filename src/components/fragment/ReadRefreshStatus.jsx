import React from "react";
import "./ReadRefreshStatus.scss";
export default function ReadRefreshStatus({ query, label }) {
    if (query.error) return <div className="management-read-status is-error" role="status">
        <div><strong>{query.data ? `目前顯示上次${label}，最新資料暫時無法同步。` : `${label}暫時無法讀取。`}</strong>
            <p>{[401, 403].includes(Number(query.error.status)) ? "請確認目前登入帳號的使用權限；舊資料已移除。" : "請確認網路後重新讀取，未送出的內容仍保留在本頁。"}</p></div>
        <button type="button" onClick={() => query.refresh()} disabled={query.refreshing}>{query.refreshing ? "重新讀取中…" : "重新讀取"}</button>
    </div>;
    if (query.refreshing && query.data) return <p className="management-read-status" role="status">正在更新{label}，你可以繼續查看。</p>;
    return null;
}
