import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

const callLearningActivity = async (firebaseUser, body = {}) => {
    if (!firebaseUser) throw new Error("尚未登入");

    const firebaseToken = await firebaseUser.getIdToken();
    const response = await fetch(`${supabaseUrl}/functions/v1/learning-activity`, {
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
        throw new Error(result?.error || "learning-activity 執行失敗");
    }

    return result;
};

export const recordLoginActivity = firebaseUser => callLearningActivity(firebaseUser, {
    action: "login"
});

export const recordHeartbeat = firebaseUser => callLearningActivity(firebaseUser, {
    action: "heartbeat"
});

// 播放器記錄「放著不動沒回應」(idle)、「切換頁面暫停」(hidden)，每週報告用來算專注度。只記學生本人，失敗不影響播放。
export const recordListeningPause = (firebaseUser, { reason, track_id: trackId } = {}) => callLearningActivity(firebaseUser, {
    action: "listening_pause",
    reason,
    track_id: trackId
});

// 口說大挑戰的專注度：hidden（關卡進行中切換頁面）、idle（90 秒沒有操作）、left_prep（想離開先聽本關教材被帶回）。
// 只記學生本人，失敗不影響練習。
export const recordSpeakingAttention = (firebaseUser, { reason, question_set_id: questionSetId, mode } = {}) => callLearningActivity(firebaseUser, {
    action: "speaking_attention",
    reason,
    question_set_id: questionSetId,
    mode
});

export const getConversationProgress = (firebaseUser, scenarioKey = "meet-a-foreigner") => callLearningActivity(firebaseUser, {
    action: "conversation_get",
    scenario_key: scenarioKey
});

export const saveConversationProgress = (firebaseUser, payload) => callLearningActivity(firebaseUser, {
    action: "conversation_save",
    ...payload
});

export const getTeacherStudentActivity = firebaseUser => callLearningActivity(firebaseUser, {
    action: "teacher_dashboard"
});

export const upsertGuardianContact = (firebaseUser, payload) => callLearningActivity(firebaseUser, {
    action: "guardian_upsert",
    ...payload
});

export const createGuardianNotificationDraft = (firebaseUser, studentId) => callLearningActivity(firebaseUser, {
    action: "notification_draft",
    student_id: studentId
});

export const markGuardianNotificationSent = (firebaseUser, notificationId) => callLearningActivity(firebaseUser, {
    action: "notification_mark_sent",
    notification_id: notificationId
});
