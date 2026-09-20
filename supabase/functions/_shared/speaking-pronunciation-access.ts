export const authorizeSpeakingPronunciation = async (
    user: any,
    loadAccess: (studentId: number) => Promise<any>
) => {
    if (user?.role === "admin") {
        return { adminDemo: true, effectiveAccess: null };
    }
    if (user?.role !== "student") {
        throw Object.assign(new Error("只有學生或管理員可以送出發音評分"), { status: 403 });
    }

    const effectiveAccess = await loadAccess(Number(user.id));
    if (!effectiveAccess?.is_active || !effectiveAccess?.features?.pronunciation) {
        throw Object.assign(new Error("目前帳號不包含 AI 發音練習"), {
            status: 403,
            code: "pronunciation_access_required"
        });
    }
    return { adminDemo: false, effectiveAccess };
};
