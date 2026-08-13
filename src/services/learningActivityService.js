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
