export const validCostAlertEmail = (value: unknown) => typeof value === "string"
    && value.length <= 320 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);

export function costAlertMessage(alert: { month: string; level: string; cost_usd: number; monthly_budget_usd: number; warning_percent: number }) {
    const cost = Number(alert.cost_usd).toFixed(4);
    const budget = Number(alert.monthly_budget_usd).toFixed(2);
    const month = alert.month.slice(0, 7);
    const stage = alert.level === "critical" ? "已達月預算" : "已達警戒線";
    return {
        subject: `Alan English 成本提醒：${month} ${stage}`,
        text: `${month} 已追蹤 API 估算成本 US$${cost}，月預算 US$${budget}，警戒線 ${alert.warning_percent}%。\n系統每 5 分鐘提醒一次；登入或開啟頁面不會停止，請進入成本頁面按「我已經看到」。\nhttps://alanenglish.com.tw/admin/api-usage\n估算範圍為成本頁的自動追蹤服務；外部帳單仍須另行核對。`
    };
}

// Injectable I/O permits isolated tests of delivery, acknowledgement and failure paths.
export async function deliverCostAlerts(alerts: any[], io: {
    isPending: (alert: any) => Promise<boolean>;
    recipient: (alert: any) => Promise<string | null>;
    send: (alert: any, email: string, message: ReturnType<typeof costAlertMessage>) => Promise<string>;
    finish: (alert: any, messageId: string | null, errorCode: string | null) => Promise<void>;
}) {
    let sent = 0;
    let failed = 0;
    for (const alert of alerts) {
        let messageId: string | null = null;
        let errorCode: string | null = null;
        try {
            const email = await io.recipient(alert);
            if (!validCostAlertEmail(email)) throw new Error("recipient_unavailable");
            // Check again immediately before sending, including generation/token changes.
            if (!await io.isPending(alert)) continue;
            messageId = await io.send(alert, email!, costAlertMessage(alert));
            sent += 1;
        } catch (error) {
            failed += 1;
            const code = error instanceof Error ? error.message : "delivery_failed";
            errorCode = /^(recipient_unavailable|provider_http_\d{3}|provider_response_invalid)$/.test(code) ? code : "delivery_failed";
        }
        await io.finish(alert, messageId, errorCode);
    }
    return { sent, failed };
}
