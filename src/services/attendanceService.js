import { callEdgeFunction } from "./edgeFunctionClient";

const callAttendance = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("attendance-manager", firebaseUser, { action, ...payload })
);

export const ATTENDANCE_STATUS_OPTIONS = [
    { value: "present", label: "出席" },
    { value: "late", label: "遲到" },
    { value: "leave", label: "請假" },
    { value: "absent", label: "缺席" }
];

export const needsMakeup = status => status === "absent" || status === "leave";

export const getAttendanceBootstrap = firebaseUser => callAttendance(firebaseUser, "teacher_bootstrap");
export const getClassSession = (firebaseUser, classCode, sessionDate) => (
    callAttendance(firebaseUser, "teacher_session", { class_code: classCode, session_date: sessionDate })
);
export const saveClassSession = (firebaseUser, payload) => callAttendance(firebaseUser, "save_session", payload);
export const getMakeupOverview = (firebaseUser, classCode) => (
    callAttendance(firebaseUser, "teacher_makeup_overview", { class_code: classCode })
);
export const getClassSchedule = (firebaseUser, classCode, weekStart) => (
    callAttendance(firebaseUser, "class_schedule", { class_code: classCode, week_start: weekStart })
);
export const saveVideoSegment =(firebaseUser, payload) => callAttendance(firebaseUser, "save_video_segment", payload);
export const deleteVideoSegment = (firebaseUser, id) => callAttendance(firebaseUser, "delete_video_segment", { id });
export const getStudentMakeups = firebaseUser => callAttendance(firebaseUser, "student_makeups");
export const completeMakeupItem = (firebaseUser, itemId) => callAttendance(firebaseUser, "complete_makeup_item", { item_id: itemId });
