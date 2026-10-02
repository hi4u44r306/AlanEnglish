export const ASSESSMENT_QUOTA_CODES = new Set(["speaking_monthly_quota_reached", "speaking_global_budget_reached"]);
export const assessmentTimeLabel = seconds => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(total / 60)} 分 ${total % 60} 秒`;
};
export const assessmentResetLabel = value => {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
        ? new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric" }).format(date)
        : "下月 1 日";
};
export const assessmentBlockedMessage = usage => usage?.global_available === false
    ? `本月 AI 評分總額度暫已用完，${assessmentResetLabel(usage.reset_at)}恢復。仍可錄音回聽。`
    : usage?.can_assess === false
        ? `本月 AI 評分額度已用完，${assessmentResetLabel(usage.reset_at)}恢復。仍可錄音回聽。`
        : "";
