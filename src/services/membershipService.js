import { invalidateStaffPageCache } from "./staffPageCache";
import { callEdgeFunction } from "./edgeFunctionClient";

const STAFF_DISPLAY_WRITES = new Set(["update_account", "archive_account", "restore_account", "admin_correct_birth_date", "admin_update_plan", "admin_grant_access", "admin_set_membership_status", "update_student_profile"]);
const callMembership = async (firebaseUser, action, payload = {}) => {
    const result = await callEdgeFunction("membership-manager", firebaseUser, { action, ...payload });
    if (STAFF_DISPLAY_WRITES.has(action)) invalidateStaffPageCache(firebaseUser?.uid);
    return result;
};

export const getMembershipProfile = firebaseUser => callMembership(firebaseUser, "profile");
export const updateStudentProfile = (firebaseUser, payload) => callMembership(firebaseUser, "update_student_profile", payload);
export const requestGuardianEmailVerification = (firebaseUser, guardianEmail) => callMembership(
    firebaseUser,
    "request_guardian_email_verification",
    { guardian_email: guardianEmail }
);
export const confirmGuardianEmailVerification = (firebaseUser, requestId, code) => callMembership(
    firebaseUser,
    "confirm_guardian_email_verification",
    { request_id: requestId, code }
);
export const getStudentNotifications = (firebaseUser, payload = {}) => callMembership(firebaseUser, "notifications", payload);
export const markStudentNotificationRead = (firebaseUser, notificationId) => (
    callMembership(firebaseUser, "mark_notification_read", { notification_id: notificationId })
);
export const markAllStudentNotificationsRead = firebaseUser => (
    callEdgeFunction("notification-manager", firebaseUser, { action: "mark_all_read" })
);
export const completePublicSignup = (firebaseUser, payload) => callMembership(firebaseUser, "complete_signup", payload);
export const getPublicPlans = firebaseUser => callMembership(firebaseUser, "plans");
export const redeemActivationCode = (firebaseUser, code) => callMembership(firebaseUser, "redeem_code", { code });
export const getManagedAccounts = firebaseUser => callMembership(firebaseUser, "list_accounts");
export const getManagedNicknameHistory = (firebaseUser, studentId) => callMembership(
    firebaseUser,
    "nickname_history",
    { student_id: studentId }
);
export const getManagedBirthDateHistory = (firebaseUser, studentId) => callMembership(
    firebaseUser, "admin_birth_date_history", { student_id: studentId }
);
export const correctManagedBirthDate = (firebaseUser, payload) => callMembership(
    firebaseUser, "admin_correct_birth_date", payload
);
export const updateManagedAccount = (firebaseUser, account) => callMembership(firebaseUser, "update_account", account);
export const archiveManagedAccount = (firebaseUser, accountId, reason = "") => callMembership(
    firebaseUser,
    "archive_account",
    { id: accountId, reason }
);
export const restoreManagedAccount = (firebaseUser, accountId) => callMembership(
    firebaseUser,
    "restore_account",
    { id: accountId }
);
export const getMembershipAdminDashboard = firebaseUser => callMembership(firebaseUser, "admin_dashboard");
export const updateSubscriptionPlan = (firebaseUser, plan) => callMembership(firebaseUser, "admin_update_plan", plan);
export const generateActivationCodes = (firebaseUser, payload) => callMembership(firebaseUser, "admin_generate_codes", payload);
export const grantMembershipAccess = (firebaseUser, payload) => callMembership(firebaseUser, "admin_grant_access", payload);
export const setMembershipStatus = (firebaseUser, payload) => callMembership(firebaseUser, "admin_set_membership_status", payload);
export const updateGuardianEmailSettings = (firebaseUser, payload) => callMembership(firebaseUser, "admin_update_email_settings", payload);
