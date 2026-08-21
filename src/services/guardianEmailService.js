import { callEdgeFunction } from "./edgeFunctionClient";

const callGuardianEmail = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("guardian-email", firebaseUser, { action, ...payload })
);

export const getGuardianEmailStatus = firebaseUser => callGuardianEmail(firebaseUser, "status");
export const sendGuardianReport = (firebaseUser, studentId, weekOffset = 0) => callGuardianEmail(firebaseUser, "send_one", { student_id: studentId, week_offset: weekOffset });
export const sendGuardianReportBatch = (firebaseUser, weekOffset = 0) => callGuardianEmail(firebaseUser, "send_batch", { week_offset: weekOffset });
