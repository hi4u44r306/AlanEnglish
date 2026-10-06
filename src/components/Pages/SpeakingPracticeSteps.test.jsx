import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SpeakingPracticeSteps, { answerPatternForLearner, extractAnswerSlots } from "./SpeakingPracticeSteps";

jest.mock("./SpeakingPronunciationRecorder", () => function Recorder({ onScored, onPhaseChange, onRetry, onListenAgain }) {
    return <div>
        <span>可以直接錄音</span>
        <button type="button" onClick={() => onScored({ answer_match: true, recognized_text: "My name is Amy.", scores: { pronunciation: 82 } })}>模擬正確回答</button>
        <button type="button" onClick={() => onScored({ answer_match: false, recognized_text: "Amy.", scores: { pronunciation: 82 } })}>模擬不完整回答</button>
        <button type="button" onClick={() => onPhaseChange("recording")}>模擬錄音中</button>
        <button type="button" onClick={() => { onRetry(); onPhaseChange("ready"); }}>模擬重新練習</button>
        {onListenAgain && <button type="button" onClick={onListenAgain}>模擬回聽示範</button>}
    </div>;
});

const question = {
    id: 9,
    question_text: "What's your name?",
    hint_zh: "說出自己的名字",
    keywords: ["my", "name", "is"],
    simple_answer: "My name is Amy.",
    model_answer: "My name is [你的名字].",
    model_audio_url: "https://example.test/model.wav",
    pronunciation_notes_zh: "把 name 說清楚。",
    progress_status: "opened"
};

describe("SpeakingPracticeSteps", () => {
    it("錄音中停用提示與示範，不打斷作答", () => {
        render(<SpeakingPracticeSteps question={question} readAloud />);
        fireEvent.click(screen.getByRole("button", { name: "模擬錄音中" }));
        expect(screen.getByRole("button", { name: "聽示範發音" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "不知道怎麼說？" })).toBeDisabled();
    });
    it("不允許模型音檔的挑戰題不提供結果示範入口", () => {
        render(<SpeakingPracticeSteps question={question} challengeMode="challenge" allowModelAudio={false} />);
        expect(screen.queryByRole("button", { name: "模擬回聽示範" })).not.toBeInTheDocument();
        expect(screen.getByText("看清楚題目")).toBeInTheDocument();
    });
    it("重新練習只清除本次畫面結果，不自動提交完成紀錄", async () => {
        const onCompleted = jest.fn().mockResolvedValue(true);
        render(<SpeakingPracticeSteps question={question} onCompleted={onCompleted} />);
        fireEvent.click(screen.getByRole("button", { name: "模擬正確回答" }));
        await screen.findByText(/本題已完成/);
        fireEvent.click(screen.getByRole("button", { name: "模擬重新練習" }));
        expect(screen.queryByText(/本題已完成/)).not.toBeInTheDocument();
        expect(onCompleted).toHaveBeenCalledTimes(1);
        expect(screen.getByText("看題目、聽示範").closest("li")).toHaveAttribute("aria-current", "step");
    });
    it("儲存等待期間不提前宣布本題完成", async () => {
        let resolveSave;
        render(<SpeakingPracticeSteps question={question} onCompleted={() => new Promise(resolve => { resolveSave = resolve; })} />);
        fireEvent.click(screen.getByRole("button", { name: "模擬正確回答" }));
        expect(screen.getByRole("status")).toHaveTextContent("正在儲存本題進度");
        expect(screen.queryByText(/本題已完成/)).not.toBeInTheDocument();
        await act(async () => resolveSave(true));
        expect(screen.getByRole("status")).toHaveTextContent("本題已完成");
    });
    it("儲存失敗可以保存同一評分結果重試，不回報答錯", async () => {
        const onCompleted = jest.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue(true);
        const onIncorrect = jest.fn();
        render(<SpeakingPracticeSteps question={question} onCompleted={onCompleted} onIncorrect={onIncorrect} />);
        fireEvent.click(screen.getByRole("button", { name: "模擬正確回答" }));
        fireEvent.click(await screen.findByRole("button", { name: "重試儲存" }));
        expect(await screen.findByText(/本題已完成/)).toBeInTheDocument();
        expect(onCompleted).toHaveBeenCalledTimes(2);
        expect(onCompleted.mock.calls[1][0].recognized_text).toBe("My name is Amy.");
        expect(onIncorrect).not.toHaveBeenCalled();
    });
    it("照念類提供現有示範發音，沒有音檔時不顯示無作用按鈕", () => {
        const play = jest.fn();
        const { rerender } = render(<SpeakingPracticeSteps question={question} readAloud hideHelp onPlayAudio={play} />);
        fireEvent.click(screen.getByRole("button", { name: "聽示範發音" }));
        expect(play).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("button", { name: /提示/ })).not.toBeInTheDocument();
        rerender(<SpeakingPracticeSteps question={{ ...question, model_audio_url: null }} readAloud hideHelp />);
        expect(screen.queryByRole("button", { name: "聽示範發音" })).not.toBeInTheDocument();
    });
    it("把個人答案欄位顯示成句型空格，不要求學生打字", () => {
        expect(extractAnswerSlots("My name is [你的名字]. [你的名字]!")).toEqual(["你的名字"]);
        expect(answerPatternForLearner(question.model_answer)).toBe("My name is _____.");

        render(<SpeakingPracticeSteps firebaseUser={{}} question={question} onPlayAudio={jest.fn()} />);
        expect(screen.getByText("可以直接錄音")).toBeInTheDocument();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(screen.queryByText("My name is Amy.")).not.toBeInTheDocument();
    });

    it("求助時才顯示句型、自然示範與發音提醒", () => {
        const onPlayAudio = jest.fn();
        render(<SpeakingPracticeSteps firebaseUser={{}} question={question} onPlayAudio={onPlayAudio} />);
        fireEvent.click(screen.getByRole("button", { name: "不知道怎麼說？" }));

        expect(screen.getByText("My name is _____.")).toBeInTheDocument();
        expect(screen.getByText("示範：My name is Amy.")).toBeInTheDocument();
        expect(screen.getByText("發音提醒：把 name 說清楚。")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "聽回答範例" }));
        expect(onPlayAudio).toHaveBeenCalledTimes(1);
    });

    it("中翻英在第一次回答前不顯示英文答案提示", () => {
        render(<SpeakingPracticeSteps firebaseUser={{}} question={{ ...question, model_answer: "Do you exercise every day?" }} deferAnswerHelp />);
        expect(screen.queryByRole("button", { name: "不知道怎麼說？" })).not.toBeInTheDocument();
        expect(screen.queryByText("Do you exercise every day?")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "模擬不完整回答" }));
        fireEvent.click(screen.getByRole("button", { name: "不知道怎麼說？" }));
        expect(screen.getByText("Do you exercise every day?")).toBeInTheDocument();
    });

    it("只有完整句型回答且儲存成功才完成小關卡", async () => {
        const onCompleted = jest.fn();
        render(<SpeakingPracticeSteps firebaseUser={{}} question={question} onCompleted={onCompleted} />);

        fireEvent.click(screen.getByRole("button", { name: "模擬不完整回答" }));
        expect(onCompleted).not.toHaveBeenCalled();
        expect(screen.getByText("先用提示中的完整句型回答，再送出一次。")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "模擬正確回答" }));
        expect(onCompleted).toHaveBeenCalledTimes(1);
        expect(await screen.findByText("本題已完成！你可以繼續挑戰或再練一次。")).toBeInTheDocument();
    });

    it("伺服器拒絕通關時仍可重試，且不顯示已完成", async () => {
        const onIncorrect = jest.fn();
        render(<SpeakingPracticeSteps firebaseUser={{}} question={question} onCompleted={jest.fn().mockResolvedValue(false)} onIncorrect={onIncorrect} />);
        fireEvent.click(screen.getByRole("button", { name: "模擬正確回答" }));
        expect(await screen.findByText("回答已評分，通關紀錄尚未儲存。")).toBeInTheDocument();
        expect(screen.queryByText("本題已完成！你可以繼續挑戰或再練一次。")).not.toBeInTheDocument();
        expect(onIncorrect).not.toHaveBeenCalled();
    });

    it("基礎拼讀模式隱藏答案提示並把錯誤交回關卡流程", () => {
        const onIncorrect = jest.fn();
        render(<SpeakingPracticeSteps
            firebaseUser={{}}
            question={question}
            interactionType="letter_spelling"
            hideHelp
            disabledReason="先聽提示音"
            onIncorrect={onIncorrect}
        />);

        expect(screen.queryByRole("button", { name: "不知道怎麼說？" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "模擬不完整回答" }));
        expect(onIncorrect).toHaveBeenCalledTimes(1);
        expect(screen.getByText("請慢慢逐字母再試一次。")).toBeInTheDocument();
    });

    it("簡單模式直接顯示答案；挑戰模式的提示先由伺服器登記", async () => {
        const { unmount } = render(<SpeakingPracticeSteps firebaseUser={{}} question={question} showAnswerByDefault />);
        expect(screen.getByLabelText("簡單模式參考答案")).toHaveTextContent("My name is _____.");
        unmount();

        const onRevealHint = jest.fn().mockResolvedValue({ model_answer: "My name is [你的名字].", hint_zh: "說出自己的名字" });
        const challengeQuestion = { ...question, model_answer: "", hint_zh: "" };
        const { rerender } = render(<SpeakingPracticeSteps firebaseUser={{}} question={challengeQuestion}
            challengeMode="challenge" challengeSessionId="round-1" onRevealHint={onRevealHint} />);
        expect(screen.queryByText("My name is _____.")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "看提示（本輪此題不計通關）" }));
        await waitFor(() => expect(onRevealHint).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }), "round-1"));
        expect(await screen.findByText("My name is _____.")).toBeInTheDocument();
        rerender(<SpeakingPracticeSteps firebaseUser={{}} question={challengeQuestion}
            challengeMode="challenge" challengeSessionId="round-2" onRevealHint={onRevealHint} />);
        await waitFor(() => expect(screen.queryByText("My name is _____.")).not.toBeInTheDocument());
    });

    it("挑戰模式看過提示後即使評分回傳正確，也不標記本輪通關", async () => {
        const onCompleted = jest.fn();
        const onIncorrect = jest.fn();
        render(<SpeakingPracticeSteps firebaseUser={{}} question={question} challengeMode="challenge"
            challengeSessionId="demo-round" onRevealHint={jest.fn().mockResolvedValue({ model_answer: question.model_answer })}
            onCompleted={onCompleted} onIncorrect={onIncorrect} />);
        fireEvent.click(screen.getByRole("button", { name: "看提示（本輪此題不計通關）" }));
        await screen.findByText("My name is _____.");
        fireEvent.click(screen.getByRole("button", { name: "模擬正確回答" }));
        expect(onCompleted).not.toHaveBeenCalled();
        expect(onIncorrect).toHaveBeenCalledWith(expect.objectContaining({ hint_used: true }));
        expect(screen.getByText("這題先練習，稍後不用提示再試一次。")).toBeInTheDocument();
    });
    it("提示成功開啟後立即提醒，收起也保留，新回合清除提醒且能通關", async () => {
        const onCompleted = jest.fn().mockResolvedValue(true);
        const onRevealHint = jest.fn().mockResolvedValue({ model_answer: question.model_answer });
        const props = { question, challengeMode: "challenge", onCompleted, onRevealHint };
        const { rerender } = render(<SpeakingPracticeSteps {...props} challengeSessionId="round-1" />);
        fireEvent.click(screen.getByRole("button", { name: "看提示（本輪此題不計通關）" }));
        expect(await screen.findByText("這題先練習，稍後不用提示再試一次。")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "收起回答提示" }));
        expect(screen.getByRole("status")).toHaveTextContent("本輪這題不計通關");
        fireEvent.click(screen.getByRole("button", { name: "模擬正確回答" }));
        expect(onCompleted).not.toHaveBeenCalled();
        rerender(<SpeakingPracticeSteps {...props} challengeSessionId="round-2" />);
        expect(screen.queryByText("這題先練習，稍後不用提示再試一次。")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "模擬正確回答" }));
        expect(await screen.findByText("本題已完成！你可以繼續挑戰或再練一次。")).toBeInTheDocument();
        expect(onCompleted).toHaveBeenCalledTimes(1);
    });
    it("提示載入失敗不顯示已使用提示，仍可重試", async () => {
        const onRevealHint = jest.fn().mockRejectedValueOnce(new Error("提示載入失敗")).mockResolvedValue({ model_answer: question.model_answer });
        render(<SpeakingPracticeSteps question={question} challengeMode="challenge" onRevealHint={onRevealHint} />);
        fireEvent.click(screen.getByRole("button", { name: "看提示（本輪此題不計通關）" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("提示載入失敗");
        expect(screen.queryByText("這題先練習，稍後不用提示再試一次。")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "看提示（本輪此題不計通關）" }));
        expect(await screen.findByText("這題先練習，稍後不用提示再試一次。")).toBeInTheDocument();
    });
    it("舊回合遲到的提示不能重新打開新回合答案", async () => {
        let resolve;
        const onRevealHint = jest.fn(() => new Promise(done => { resolve = done; }));
        const props = { question, challengeMode: "challenge", onRevealHint };
        const { rerender } = render(<SpeakingPracticeSteps {...props} challengeSessionId="round-1" />);
        fireEvent.click(screen.getByRole("button", { name: "看提示（本輪此題不計通關）" }));
        rerender(<SpeakingPracticeSteps {...props} challengeSessionId="round-2" />);
        await act(async () => resolve({ model_answer: question.model_answer }));
        expect(screen.queryByText("My name is _____.")).not.toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "看提示（本輪此題不計通關）" })).toBeEnabled();
    });
});
