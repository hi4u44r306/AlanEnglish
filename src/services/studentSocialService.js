import { callEdgeFunction } from "./edgeFunctionClient";

const callSocial = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("student-social", firebaseUser, { action, ...payload })
);

export const getSocialOverview = firebaseUser => callSocial(firebaseUser, "overview");
export const updateSocialProfile = (firebaseUser, profile) => callSocial(firebaseUser, "update_profile", profile);
export const searchStudents = (firebaseUser, query) => callSocial(firebaseUser, "search", { query });
export const sendFriendRequest = (firebaseUser, studentId) => callSocial(firebaseUser, "send_request", { student_id: studentId });
export const respondFriendRequest = (firebaseUser, requestId, decision) => callSocial(firebaseUser, "respond_request", { request_id: requestId, decision });
export const removeFriend = (firebaseUser, studentId) => callSocial(firebaseUser, "remove_friend", { student_id: studentId });
export const blockStudent = (firebaseUser, studentId) => callSocial(firebaseUser, "block", { student_id: studentId });
export const unblockStudent = (firebaseUser, studentId) => callSocial(firebaseUser, "unblock", { student_id: studentId });
export const reportStudent = (firebaseUser, studentId, category, details = "") => callSocial(firebaseUser, "report", { student_id: studentId, category, details });
export const sendSocialHeartbeat = firebaseUser => callSocial(firebaseUser, "heartbeat");
