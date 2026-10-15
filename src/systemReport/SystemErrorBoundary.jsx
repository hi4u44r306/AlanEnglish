import React from "react";
import { handleChunkFailure, isChunkError } from "./globalHandlers";
import { newReportId } from "./reportClient";
import { showSystemReport } from "./reportBus";

// 不使用 useAuth、Router、Theme 等 context，才能在它們自己出錯時也能顯示。
// resetKey 改變（例如換頁）時自動清除錯誤，讓使用者可以離開壞掉的頁面。
export default class SystemErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        if (isChunkError(error)) {
            handleChunkFailure(error);
            return;
        }
        showSystemReport({
            id: newReportId(),
            kind: "render_crash",
            signature: `render_crash:${error?.name || "Error"}:${String(error?.message || "").replace(/\d+/g, "#").slice(0, 60)}`,
            error_name: error?.name || "Error",
            error_message: error?.message || "",
            stack: error?.stack || info?.componentStack || ""
        });
    }

    componentDidUpdate(previousProps) {
        if (this.state.error && previousProps.resetKey !== this.props.resetKey) this.setState({ error: null });
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div role="alert" style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", color: "var(--ae-text, #17365d)", fontFamily: "sans-serif" }}>
                <div>
                    <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>這一頁暫時無法顯示</h1>
                    <p style={{ margin: "0 0 16px", color: "var(--ae-text-muted, #526780)" }}>已經通知後台，你可以先回到首頁。</p>
                    <a href="/" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 20px", borderRadius: 12, background: "#17365d", color: "#fff", fontWeight: 700, textDecoration: "none" }}>回首頁</a>
                </div>
            </div>
        );
    }
}
