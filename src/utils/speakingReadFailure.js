export const speakingReadFailure = error => {
    const status = Number(error?.status), code = String(error?.code || "");
    if (status === 401) return { title: "請重新登入", detail: "登入狀態需要重新確認，登入後再回來開啟教材。", link: "/login", action: "回到登入", retry: false };
    if (code === "speaking_challenge_locked") return { title: "這一關還沒解鎖", detail: "先完成前面的關卡，再回來挑戰。", link: "/student/speaking-challenges", action: "回到教材關卡", retry: false };
    if (code === "pronunciation_access_required") return { title: "目前帳號尚未開通口說練習", detail: "請家長或老師協助確認已開通的功能。", link: "/student/membership", action: "查看我的教材與功能", retry: false };
    if (status === 403) return { title: "目前帳號不能開啟這份教材", detail: "請老師確認班級教材或帳號的使用權限。", link: "/student/speaking-challenges", action: "回到可用教材", retry: false };
    if (status === 404 || ["picture_content_incomplete", "picture_audio_incomplete"].includes(code)) return { title: "這份教材暫時還不能開啟", detail: "教材可能尚未完成發布，請老師協助確認。", link: "/student/speaking-challenges", action: "回到教材列表", retry: false };
    return { title: "教材暫時無法讀取", detail: "請確認網路後再試一次，不需要重新完成學習。", link: "/student/speaking-challenges", action: "回到教材列表", retry: true };
};
