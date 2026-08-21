import { callEdgeFunction } from "./edgeFunctionClient";

const callLearningProgress = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("learning-progress", firebaseUser, { action, ...payload })
);

export const getLearningDashboard = firebaseUser => callLearningProgress(firebaseUser, "dashboard");
export const getLeaderboard = (firebaseUser, period = "week") => callLearningProgress(firebaseUser, "leaderboard", { period });
export const getPromotionExam = (firebaseUser, examId) => callLearningProgress(firebaseUser, "exam", { exam_id: examId });
export const submitPromotionExam = (firebaseUser, examId, answers) => callLearningProgress(firebaseUser, "submit_exam", { exam_id: examId, answers });
export const getLevelAdminCatalog = firebaseUser => callLearningProgress(firebaseUser, "admin_catalog");
export const updateBookLevel = (firebaseUser, bookId, levelId) => callLearningProgress(firebaseUser, "admin_update_book_level", { book_id: bookId, level_id: levelId });
export const setStudentLevel = (firebaseUser, studentId, levelId) => callLearningProgress(firebaseUser, "admin_set_student_level", { student_id: studentId, level_id: levelId });
export const updatePromotionExam = (firebaseUser, payload) => callLearningProgress(firebaseUser, "admin_update_exam", payload);
