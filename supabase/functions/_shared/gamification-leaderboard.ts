import { nicknameHasDisallowedTerm } from "./nickname-moderation.ts";

const cleanClass = (value: unknown) => String(value || "").trim().slice(0, 30) || null;

type NameFields = { chinese_name?: unknown; english_name?: unknown; name?: unknown };

const clean = (value: unknown) => String(value ?? "").trim().slice(0, 80);

// Full name used by staff: Chinese name first, then English name, then the legacy `name`
// column (last, because web-signup students type it themselves).
export const leaderboardNameSource = (names: NameFields | null | undefined, fallback?: unknown) =>
    clean(names?.chinese_name) || clean(names?.english_name) || clean(names?.name) || clean(fallback);

// One "〇" in the middle, never revealing how many characters the name has:
// 王小明 -> 王〇明, 王明 -> 王〇, Kevin -> K〇n. Only Han characters (or only letters when
// there are none) are kept, so "王小明 Kevin" -> 王〇明 and digits/emoji are dropped.
export const maskLeaderboardName = (value: unknown) => {
    const text = clean(value).normalize("NFKC").replace(/[\p{C}]/gu, "");
    const han = Array.from(text).filter(char => /\p{Script=Han}/u.test(char));
    const chars = han.length ? han : Array.from(text).filter(char => /\p{L}/u.test(char));
    if (!chars.length) return "同學";
    const first = han.length ? chars[0] : chars[0].toLocaleUpperCase("en-US");
    if (chars.length <= 2) return `${first}〇`;
    return `${first}〇${chars[chars.length - 1]}`;
};

// Students never receive a real name for anyone, themselves included: only the masked
// `display_name` (and the same text in `student_name` for older front ends). Other
// students' rows are an allow-list, so no class, points, avatar path or full name.
// Staff keep the full name. Another student's avatar is shown only when it is one of the
// approved system avatars (decided in the Edge Function via `_show_avatar`).
export const shapeLeaderboardRow = (
    row: any,
    { isSelf, isStaff, nickname, names }: { isSelf: boolean; isStaff: boolean; nickname: string | null; names?: NameFields | null }
) => {
    const fullName = leaderboardNameSource(names, row.student_name);
    if (isStaff) return { ...row, student_name: fullName, display_name: fullName, nickname, _show_avatar: true };
    const masked = maskLeaderboardName(fullName);
    // Classmates never see a nickname that no longer passes moderation (older nicknames
    // were saved under weaker rules); the owner and staff still see it.
    const publicNickname = nickname && !nicknameHasDisallowedTerm(nickname) ? nickname : null;
    if (isSelf) return { ...row, student_name: masked, display_name: masked, nickname, _show_avatar: true };
    return {
        rank_position: row.rank_position,
        student_id: row.student_id,
        student_name: masked,
        display_name: masked,
        class_name: null,
        period_xp: row.period_xp,
        total_xp: row.total_xp,
        nickname: publicNickname,
        _show_avatar: false
    };
};

export const resolveLeaderboardScope = ({
    role,
    ownClass,
    requestedScope,
    requestedClass
}: {
    role: unknown;
    ownClass: unknown;
    requestedScope: unknown;
    requestedClass: unknown;
}) => {
    const scope = String(requestedScope || "class").trim() === "overall" ? "overall" : "class";
    if (scope === "overall") return { scope, classCode: null };

    const normalizedRole = String(role || "").trim();
    const classCode = normalizedRole === "student"
        ? cleanClass(ownClass)
        : cleanClass(requestedClass);
    return { scope, classCode };
};
