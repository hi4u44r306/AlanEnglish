import { readFileSync } from "fs";
import { nicknameHasDisallowedTerm, validatePublicNickname } from "./nicknameValidation";

describe("validatePublicNickname", () => {
    it.each([
        "幹你娘",
        "我 肏 你",
        "機掰小孩",
        "雞歪",
        "靠北同學",
        "靠 邀",
        "北七",
        "G8玩家"
    ])("rejects a Taiwanese profanity or common variant: %s", nickname => {
        expect(validatePublicNickname(nickname)).toContain("不適合公開顯示");
    });

    it.each(["勇敢貓咪", "Alan Owl", "E5 學習者"])("keeps an ordinary nickname valid: %s", nickname => {
        expect(validatePublicNickname(nickname)).toBe("");
    });
});

describe("nickname moderation stays in step with the server list", () => {
    const source = readFileSync("supabase/functions/_shared/nickname-moderation.ts", "utf8");
    const termsOf = text => [...text.slice(text.indexOf("DISALLOWED_NICKNAME_TERMS = ["), text.indexOf("];", text.indexOf("DISALLOWED_NICKNAME_TERMS"))).matchAll(/"([^"]+)"/g)].map(match => match[1]);

    it("uses exactly the same blocked terms as the Edge Function", () => {
        const mine = termsOf(readFileSync("src/utils/nicknameValidation.js", "utf8"));
        expect(mine.length).toBeGreaterThan(50);
        expect(mine).toEqual(termsOf(source));
    });

    it.each(["性爱", "靠1北", "s3x", "kaobei", "靠ㄅㄟ", "性感寶貝"])("rejects a variant: %s", nickname => {
        expect(nicknameHasDisallowedTerm(nickname)).toBe(true);
    });

    it("does not reject ordinary words that contain a blocked character", () => {
        expect(nicknameHasDisallowedTerm("體操王")).toBe(false);
    });
});
