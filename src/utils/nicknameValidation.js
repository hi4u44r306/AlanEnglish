// Mirror of supabase/functions/_shared/nickname-moderation.ts (the server is the real gate;
// this only gives instant feedback). nicknameValidation.test.js checks the two lists match.
const DISALLOWED_NICKNAME_TERMS = [
    "色情", "性愛", "性爱", "性交", "性感", "裸照", "裸體", "裸体", "成人片", "援交", "約炮", "约炮", "性奴", "強姦", "强奸",
    "雞巴", "鸡巴", "陰莖", "阴茎", "乳房", "屌", "屄", "幹", "干你", "干您", "肏", "操", "婊", "賤", "贱", "白痴", "智障", "低能", "白目", "北七", "87", "屎", "尿",
    "幹你", "幹你娘", "幹您娘", "幹拎娘", "幹林娘", "姦恁娘", "姦你娘", "肏你", "肏你媽",
    "機掰", "雞掰", "機歪", "雞歪", "機八", "雞八", "机掰", "鸡掰", "机歪", "鸡歪", "臭機掰", "臭雞掰",
    "靠北", "靠邀", "靠夭", "靠母", "靠腰", "靠杯", "靠悲", "靠盃", "g8", "gy",
    "porn", "sex", "nude", "naked", "fuck", "shit", "bitch", "dick", "pussy", "asshole",
    // Pinyin and Bopomofo spellings of the same words.
    "kaobei", "kaobe", "kaobai", "xingai", "caonima", "jiba", "jiaoji", "ganni", "fakyou",
    "靠ㄅ", "ㄎㄠㄅㄟ", "ㄍㄢ", "ㄐㄧㄅㄚ", "ㄒㄧㄥㄞ"
];

const SAFE_PHRASES = ["體操", "体操", "操場", "操场", "早操", "晨操", "健康操", "體操服", "操作", "操練", "操练", "出操", "柔軟操", "尿布", "干貝", "干果", "干淨", "干净"];

const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g" };

export const normalizeNicknameForModeration = value => String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\s_-]+/g, "");

export const nicknameHasDisallowedTerm = value => {
    let text = normalizeNicknameForModeration(value);
    for (const phrase of SAFE_PHRASES) text = text.split(phrase).join("");
    const forms = [text, text.replace(/[0-9]/g, digit => LEET[digit] || digit), text.replace(/[0-9]/g, "")];
    return DISALLOWED_NICKNAME_TERMS.some(term => forms.some(form => form.includes(term)));
};

export const validatePublicNickname = value => {
    const nickname = String(value || "").trim().replace(/\s+/g, " ");
    if (!/^[\p{L}\p{N}][\p{L}\p{N} _-]{1,19}$/u.test(nickname)) {
        return "暱稱需為 2～20 個中英文字、數字、空格、底線或連字號";
    }
    if (nicknameHasDisallowedTerm(nickname)) {
        return "暱稱包含不適合公開顯示的內容，請換一個";
    }
    return "";
};
