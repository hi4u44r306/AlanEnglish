import { callEdgeFunction } from "./edgeFunctionClient";

const callGuardianEmail = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("guardian-email", firebaseUser, { action, ...payload })
);

export const getGuardianEmailStatus = firebaseUser => callGuardianEmail(firebaseUser, "status");
export const sendGuardianReport = (firebaseUser, studentId, weekOffset = 0) => callGuardianEmail(firebaseUser, "send_one", { student_id: studentId, week_offset: weekOffset });
export const sendGuardianReportBatch = (firebaseUser, weekOffset = 0) => callGuardianEmail(firebaseUser, "send_batch", { week_offset: weekOffset });
export const sendGuardianNotification = (firebaseUser, notificationId) => callGuardianEmail(firebaseUser, "send_notification", { notification_id: notificationId });
export const resendGuardianNotification = (firebaseUser, notificationId, resendReason, requestId) => callGuardianEmail(firebaseUser, "resend_notification", {
    notification_id: notificationId,
    resend_reason: resendReason,
    request_id: requestId
});
export const previewGuardianNotificationClass = (firebaseUser, classCode) => callGuardianEmail(firebaseUser, "preview_class_notifications", { class_code: classCode });
export const sendGuardianNotificationClass = (firebaseUser, classCode) => callGuardianEmail(firebaseUser, "send_class_notifications", { class_code: classCode });
