import fs from "fs";
import path from "path";

const read = file => fs.readFileSync(path.join(__dirname, file), "utf8");
const levelSource = read("LearningLevel.jsx");
const leaderboardSource = read("LearningLeaderboard.jsx");
const rewardsSource = read("Rewards.jsx");
const styleSource = read(path.join("css", "Gamification.scss"));

describe("student outcome pages child-friendly UI contract", () => {
    test("uses short student-facing headings", () => {
        expect(levelSource).toContain("我的等級");
        expect(leaderboardSource).toContain("看看我排第幾");
        expect(rewardsSource).toContain("選獎品");
    });

    test("keeps staff leaderboard copy on its own branch", () => {
        expect(leaderboardSource).toContain("gamification-page--staff-ranking");
        expect(leaderboardSource).toContain("完成聽力、作業與遊戲都能累積 XP");
    });

    test("keeps mobile outcome controls and balance cards compact", () => {
        expect(styleSource).toMatch(/gamification-page--student-ranking[\s\S]*?gamification-segment button[\s\S]*?min-height:\s*44px/);
        expect(styleSource).toMatch(/gamification-page--rewards[\s\S]*?gamification-balance-grid[\s\S]*?repeat\(3/);
    });
});
