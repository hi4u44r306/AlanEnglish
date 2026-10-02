export const assessmentBudgetError = (reservation: any) => {
    const code = String(reservation?.code || "rate_limited");
    const messages: Record<string, string> = {
        speaking_monthly_quota_reached: "本月 AI 評分額度不足，仍可錄音回聽；額度於台灣時間下月 1 日恢復。",
        speaking_global_budget_reached: "本月 AI 評分總額度暫已用完，仍可錄音回聽；下月 1 日恢復。",
        speaking_daily_limit_reached: "今天已開始 5 輪口說大挑戰，明天再繼續冒險吧！",
        rate_limited: "短時間練習次數較多，請休息一下再繼續。"
    };
    return Object.assign(new Error(messages[code] || messages.rate_limited), {
        status: 429, code, assessment_usage: reservation?.assessment_usage || null
    });
};

// Only called with the duration obtained by parsing the WAV on the server.
export const assessmentAudioSeconds = (duration: number) => {
    if (!Number.isFinite(duration) || duration < 0.35 || duration > 12) throw new Error("Invalid validated WAV duration");
    return Math.ceil(duration);
};
