// 專注度只顯示整十的數字（95→100、63→60、28→30），家長與孩子一看就懂；
// 等級也用四捨五入後的數字判斷，避免「80% 卻顯示普通」這種對不起來的情況。
export const roundFocusRate = rate => {
    if (typeof rate !== "number" || !Number.isFinite(rate)) return null;
    return Math.min(100, Math.max(0, Math.round(rate / 10) * 10));
};

export const focusLevel = roundedRate => {
    if (roundedRate === null || roundedRate === undefined) return null;
    if (roundedRate >= 80) return "focused";
    if (roundedRate >= 60) return "ok";
    return "needs_reminder";
};
