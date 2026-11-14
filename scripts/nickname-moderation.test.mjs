import test from "node:test";
import assert from "node:assert/strict";
import { nicknameHasDisallowedTerm, validNicknameText } from "../supabase/functions/_shared/nickname-moderation.ts";
import { shapeLeaderboardRow } from "../supabase/functions/_shared/gamification-leaderboard.ts";

const clean = (value, max) => String(value ?? "").trim().slice(0, max);

test("不雅暱稱與常見變體都會被擋", () => {
    for (const bad of ["性愛", "性爱", "靠北", "靠1北", "性1愛", "靠ㄅㄟ", "ㄎㄠㄅㄟ", "性感寶貝", "干你娘", "鸡巴", "屎尿",
        "s3x", "S3X", "fvck".replace("v", "u"), "kaobei", "Kao Bei", "xingai", "caonima", "sh1t", "b1tch", "ｓｅｘ", "fuck_you"]) {
        assert.equal(validNicknameText(bad, clean), null, `應擋：${bad}`);
    }
});

test("一般暱稱與含有「操」的正常詞不會被誤擋", () => {
    for (const ok of ["Alan Fox", "小狐狸", "體操王", "操場小子", "Rocket", "星星 2024", "Amy_W"]) {
        assert.equal(validNicknameText(ok, clean), ok.replace(/\s+/g, " "), `不該擋：${ok}`);
    }
});

test("舊的不雅暱稱不會在排行榜顯示給同學，本人與老師仍看得到", () => {
    const row = { rank_position: 2, student_id: 2, student_name: "李小美", period_xp: 1, total_xp: 1 };
    const names = { chinese_name: "李小美" };
    const other = shapeLeaderboardRow(row, { isSelf: false, isStaff: false, nickname: "靠北王", names });
    assert.equal(other.nickname, null);
    assert.equal(shapeLeaderboardRow(row, { isSelf: false, isStaff: false, nickname: "小狐狸", names }).nickname, "小狐狸");
    assert.equal(shapeLeaderboardRow(row, { isSelf: true, isStaff: false, nickname: "靠北王", names }).nickname, "靠北王");
    assert.equal(shapeLeaderboardRow(row, { isSelf: false, isStaff: true, nickname: "靠北王", names }).nickname, "靠北王");
    assert.equal(nicknameHasDisallowedTerm("Rocket"), false);
});
