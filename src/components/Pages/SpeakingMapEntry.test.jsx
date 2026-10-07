import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChallengePreviewDialog, speakingEntryAction, speakingLessonTopic, SpeakingMapGoal } from "./SpeakingMapEntry";

it("今日通關入口改回聽，簡單與挑戰不提供第二次正式挑戰", () => {
    const onEnter=jest.fn();
    render(<ChallengePreviewDialog item={{id:1,title:"Hello",question_count:2,completed_count:2,is_completed:true,completed_today:true}} section="textbook" sectionCopy={{label:"課本",eyebrow:"課本練習"}} onEnter={onEnter} onClose={()=>{}} />);
    fireEvent.click(screen.getByRole("button",{name:/今天已完成，錄音回聽/}));
    expect(onEnter).toHaveBeenCalledWith("easy");
    expect(screen.queryByRole("button",{name:/挑戰 · 看題目回答/})).not.toBeInTheDocument();
});

it("摘要依兩種模式各自的完成數顯示繼續或重玩，按鈕仍進入原模式", () => {
    const onEnter = jest.fn();
    render(<ChallengePreviewDialog item={{ title: "P15 問候", topic: "認識新朋友", question_count: 7, completed_count: 7, challenge_completed_count: 2, is_completed: true }} pages="P.15" section="textbook" sectionCopy={{ label: "課本練習", eyebrow: "依教材頁序完成", badge: "課本" }} onEnter={onEnter} />);
    fireEvent.click(screen.getByRole("button", { name: /再練一次 · 簡單/ }));
    expect(onEnter).toHaveBeenLastCalledWith("easy");
    fireEvent.click(screen.getByRole("button", { name: /繼續挑戰 · 挑戰/ }));
    expect(onEnter).toHaveBeenLastCalledWith("challenge");
});

it("只有頁碼的主題使用教材標題，缺少主題與標題時保留清楚的分類", () => {
    expect(speakingLessonTopic({ topic: "P.15", title: "P15 認識新朋友" }, "P.15")).toBe("認識新朋友");
    expect(speakingLessonTopic({ title: "P26～27" }, "P.26～27", "課本練習")).toBe("課本練習");
    expect(speakingEntryAction(0, 0, false)).toBe("開始練習");
    expect(speakingEntryAction(2, 7, false)).toBe("繼續練習");
    expect(speakingEntryAction(7, 7, false, "challenge")).toBe("再次挑戰");
});

it("工作人員明示預覽，沒有推薦目標時不產生可開始的假入口", () => {
    const first = render(<SpeakingMapGoal target={{ item: { title: "P15 問候", completed_count: 0, question_count: 7 } }} pages="P.15" staffPreview completed={0} total={25} />);
    expect(screen.getByText("關卡預覽")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看這一關" })).toBeInTheDocument();
    first.unmount();
    render(<SpeakingMapGoal completed={2} total={25} />);
    expect(screen.getByText("目前沒有可開始的關卡")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
