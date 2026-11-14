// Public nickname moderation, shared by `student-social` (when a nickname is saved) and
// `gamification` (so an old nickname that no longer passes is never shown to classmates).
// Pure functions only, so they can be unit-tested with node.

export const DISALLOWED_NICKNAME_TERMS = [
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

// Ordinary words that contain a blocked character; removed before checking so
// "體操王" or "操場" are not rejected.
const SAFE_PHRASES = ["體操", "体操", "操場", "操场", "早操", "晨操", "健康操", "體操服", "操作", "操練", "操练", "出操", "柔軟操", "尿布", "干貝", "干果", "干淨", "干净"];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g" };

const base = (value: string) => value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\s_-]+/g, "");

// A nickname is rejected if any of these spellings contains a blocked term:
// as typed, digits swapped for look-alike letters (s3x -> sex), and digits removed (靠1北 -> 靠北).
export const nicknameModerationForms = (value: string) => {
    let text = base(value);
    for (const phrase of SAFE_PHRASES) text = text.split(phrase).join("");
    return [
        text,
        text.replace(/[0-9]/g, digit => LEET[digit] || digit),
        text.replace(/[0-9]/g, "")
    ];
};

export const nicknameHasDisallowedTerm = (value: unknown) => {
    const forms = nicknameModerationForms(String(value ?? ""));
    // "87" and "g8" are only meant for the typed form; digit-stripped forms cannot contain them.
    return DISALLOWED_NICKNAME_TERMS.some(term => forms.some(form => form.includes(term)));
};

export const validNicknameText = (value: unknown, cleanText: (v: unknown, n: number) => string) => {
    const nickname = cleanText(value, 20).replace(/\s+/g, " ");
    if (!/^[\p{L}\p{N}][\p{L}\p{N} _-]{1,19}$/u.test(nickname)) return null;
    if (nicknameHasDisallowedTerm(nickname)) return null;
    return nickname;
};
