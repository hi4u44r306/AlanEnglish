const DISALLOWED_NICKNAME_TERMS = [
    "色情", "性愛", "性交", "裸照", "裸體", "成人片", "援交", "約炮", "性奴", "強姦",
    "雞巴", "陰莖", "乳房", "屌", "屄", "幹", "操", "婊", "賤", "白痴", "智障",
    "porn", "sex", "nude", "naked", "fuck", "shit", "bitch", "dick", "pussy", "asshole"
];

export const normalizeNicknameForModeration = value => String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\s_-]+/g, "");

export const validatePublicNickname = value => {
    const nickname = String(value || "").trim().replace(/\s+/g, " ");
    if (!/^[\p{L}\p{N}][\p{L}\p{N} _-]{1,19}$/u.test(nickname)) {
        return "暱稱需為 2～20 個中英文字、數字、空格、底線或連字號";
    }
    const normalized = normalizeNicknameForModeration(nickname);
    if (DISALLOWED_NICKNAME_TERMS.some(term => normalized.includes(term))) {
        return "暱稱包含不適合公開顯示的內容，請換一個";
    }
    return "";
};
