import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

const callAssignmentFunction = async (firebaseUser, body = {}) => {
    if (!firebaseUser) throw new Error("請先登入 Alan English");
    const firebaseToken = await firebaseUser.getIdToken();
    const response = await fetch(`${supabaseUrl}/functions/v1/assignment-manager`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${firebaseToken}`,
            apikey: supabaseKey
        },
        body: JSON.stringify(body)
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error || "作業服務暫時無法使用");
    return result;
};

export const getTeacherAssignmentBootstrap = firebaseUser => callAssignmentFunction(firebaseUser, { action: "teacher_bootstrap" });
export const createAssignment = (firebaseUser, payload) => callAssignmentFunction(firebaseUser, { action: "create_assignment", ...payload });
export const deleteAssignment = (firebaseUser, assignmentId) => callAssignmentFunction(firebaseUser, { action: "delete_assignment", assignment_id: assignmentId });
export const getTeacherAssignments = firebaseUser => callAssignmentFunction(firebaseUser, { action: "teacher_assignments" });
export const getAssignmentResults = (firebaseUser, assignmentId) => callAssignmentFunction(firebaseUser, { action: "assignment_results", assignment_id: assignmentId });
export const getStudentAssignments = firebaseUser => callAssignmentFunction(firebaseUser, { action: "student_assignments" });
export const submitAssignment = (firebaseUser, assignmentId, answers) => callAssignmentFunction(firebaseUser, { action: "submit_assignment", assignment_id: assignmentId, answers });
