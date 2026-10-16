// 口說大挑戰的兩個等級（之後的第三級預定叫「聽了說」）。程式與資料庫仍沿用 easy／challenge 兩個值（資料庫有 CHECK 限制，舊紀錄相容），這裡只決定學生看到的名稱。
export const SPEAKING_LEVELS = {
    easy: { label: "跟著念", short: "跟著念", how: "看著句子念" },
    challenge: { label: "自己說", short: "自己說", how: "看圖或問題回答" }
};

export const speakingLevelLabel = mode => (SPEAKING_LEVELS[mode] || SPEAKING_LEVELS.easy).label;
