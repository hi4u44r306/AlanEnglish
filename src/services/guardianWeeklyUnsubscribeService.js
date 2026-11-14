import { callPublicEdgeFunction } from "./edgeFunctionClient";

// 家長信裡的取消連結。link = { s, e, t }（學生編號、到期時間、簽章），一律由網址讀進來。
export const previewWeeklyUnsubscribe = link => callPublicEdgeFunction("guardian-weekly-unsubscribe", { action: "preview", ...link });

export const confirmWeeklyUnsubscribe = link => callPublicEdgeFunction("guardian-weekly-unsubscribe", { action: "confirm", ...link });

// 管理首頁：哪些學生的家長取消了每週週報、以及重新開啟（要登入；老師只能處理自己負責班級的學生）。
export const listWeeklyOptOuts = firebaseUser => callPublicEdgeFunction("guardian-weekly-unsubscribe", { action: "admin_list" }, firebaseUser);

export const reenableWeeklyReport = (firebaseUser, studentId) => callPublicEdgeFunction(
    "guardian-weekly-unsubscribe",
    { action: "admin_reenable", student_id: studentId },
    firebaseUser
);
