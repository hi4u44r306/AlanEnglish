import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

const callWeeklyReportFunction = async (firebaseUser, body = {}) => {
    if (!firebaseUser) throw new Error("請先登入 Alan English");

    const firebaseToken = await firebaseUser.getIdToken();
    const response = await fetch(`${supabaseUrl}/functions/v1/weekly-report`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${firebaseToken}`,
            apikey: supabaseKey
        },
        body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(result?.error || "每週學習報告暫時無法使用");
        error.status = response.status;
        throw error;
    }

    return result;
};

export const getWeeklyReport = (firebaseUser, { studentId, weekOffset = 0 } = {}) => (
    callWeeklyReportFunction(firebaseUser, {
        action: "report",
        student_id: studentId || undefined,
        week_offset: weekOffset
    })
);

export const createWeeklyReportGuardianDraft = (firebaseUser, { studentId, weekOffset = 0 }) => (
    callWeeklyReportFunction(firebaseUser, {
        action: "guardian_draft",
        student_id: studentId,
        week_offset: weekOffset
    })
);
