import { callPublicEdgeFunction } from "./edgeFunctionClient";

// 家長信裡的取消連結。link = { s, e, t }（學生編號、到期時間、簽章），一律由網址讀進來。
export const previewWeeklyUnsubscribe = link => callPublicEdgeFunction("guardian-weekly-unsubscribe", { action: "preview", ...link });

export const confirmWeeklyUnsubscribe = link => callPublicEdgeFunction("guardian-weekly-unsubscribe", { action: "confirm", ...link });
