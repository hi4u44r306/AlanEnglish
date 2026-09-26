export const isAllowedPushEndpoint = (value: unknown) => {
    if (typeof value !== "string" || value.length < 30 || value.length > 2048) return false;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password && !url.port && url.pathname.length > 1
            && ["fcm.googleapis.com", "web.push.apple.com", "updates.push.services.mozilla.com"].includes(url.hostname);
    } catch { return false; }
};

export const isValidPushKey = (value: unknown, expectedBytes: number) => {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
    try {
        const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
        const bytes = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
        return bytes.length === expectedBytes && (expectedBytes !== 65 || bytes.charCodeAt(0) === 4);
    } catch { return false; }
};

export const isWebPushQuietHour = (date = new Date()) => {
    const hour = Number(new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Taipei", hour: "2-digit", hourCycle: "h23"
    }).format(date));
    return hour >= 21 || hour < 8;
};

export const getWebPushMessage = (notice: {
    id: number; notification_type: string; metadata?: { event_type?: string } | null;
}) => {
    const assignment = notice.notification_type === "assignment";
    const expiry = notice.notification_type === "membership" && notice.metadata?.event_type === "material_access_expiring";
    if (!assignment && !expiry) return null;
    return {
        title: assignment ? "有新的班級作業" : "教材使用期限將近",
        body: "請登入 Alan English 查看通知。",
        path: assignment ? "/student/assignments" : "/student/membership",
        notification_id: notice.id
    };
};

export const getWebPushTestMessage = (notificationId: number) => ({
    title: "Alan English 推播測試",
    body: "這部裝置已收到測試通知。",
    path: "/student/notifications",
    notification_id: notificationId
});
