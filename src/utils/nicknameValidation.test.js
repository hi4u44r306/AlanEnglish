import { validatePublicNickname } from "./nicknameValidation";

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
