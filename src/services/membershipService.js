import { callEdgeFunction } from "./edgeFunctionClient";

const callMembership = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("membership-manager", firebaseUser, { action, ...payload })
);

export const getMembershipProfile = firebaseUser => callMembership(firebaseUser, "profile");
export const updateStudentProfile = (firebaseUser, payload) => callMembership(firebaseUser, "update_student_profile", payload);
export const getStudentNotifications = firebaseUser => callMembership(firebaseUser, "notifications");
export const markStudentNotificationRead = (firebaseUser, notificationId) => (
    callMembership(firebaseUser, "mark_notification_read", { notification_id: notificationId })
);
export const completePublicSignup = (firebaseUser, payload) => callMembership(firebaseUser, "complete_signup", payload);
export const getPublicPlans = firebaseUser => callMembership(firebaseUser, "plans");
export const redeemActivationCode = (firebaseUser, code) => callMembership(firebaseUser, "redeem_code", { code });
export const getManagedAccounts = firebaseUser => callMembership(firebaseUser, "list_accounts");
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
