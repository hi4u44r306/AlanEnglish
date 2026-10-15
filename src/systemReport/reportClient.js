import { authentication } from "../components/Pages/firebase-config";
import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

export const getBuildId = () => {
    const script = [...document.scripts].map(item => item.src || "").find(src => /\/static\/js\/main\.[\w-]+\.js/.test(src));
    return script ? (script.match(/main\.([\w-]+)\.js/) || [])[1] || "unknown" : "dev";
};

export const newReportId = () => {
    const random = typeof window.crypto?.randomUUID === "function" ? window.crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return random.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 36).padEnd(8, "0");
};

export const buildPayload = (report, userNote = "") => ({
    action: "system_report",
    kind: report.kind,
    report_id: report.id,
    error_name: String(report.error_name || "Error").slice(0, 60),
    error_message: String(report.error_message || "").slice(0, 300),
    stack: String(report.stack || "").slice(0, 1500),
    path: window.location.pathname,
    user_note: String(userNote || "").slice(0, 200),
    build: getBuildId(),
    user_agent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    online: navigator.onLine
});

// 不強制更新 token（網路有問題時會丟出例外）；取不到就當匿名送，後端只會當成未登入訪客。
const currentToken = async () => {
    try { return (await authentication.currentUser?.getIdToken()) || null; } catch (error) { return null; }
};

// 最多等 4 秒；回報失敗不能擋住使用者重新整理。回傳 true 代表後端已收到（含「已收到過」）。
export const sendSystemReport = async (payload, timeoutMs = 4000) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        const token = await currentToken();
        const response = await fetch(`${supabaseUrl}/functions/v1/support-manager`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: supabaseKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        return response.ok || response.status === 429;
    } catch (error) {
        return false;
    } finally {
        window.clearTimeout(timer);
    }
};
