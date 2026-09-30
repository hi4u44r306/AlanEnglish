import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SpeakingPracticeSteps, { answerPatternForLearner, extractAnswerSlots } from "./SpeakingPracticeSteps";

jest.mock("./SpeakingPronunciationRecorder", () => function Recorder({ onScored }) {
    return <div>
        <span>可以直接錄音</span>
        <button type="button" onClick={() => onScored({ answer_match: true, recognized_text: "My name is Amy.", scores: { pronunciation: 82 } })}>模擬正確回答</button>
        <button type="button" onClick={() => onScored({ answer_match: false, recognized_text: "Amy.", scores: { pronunciation: 82 } })}>模擬不完整回答</button>
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
        expect(await screen.findByText("這次回答尚未記錄為通關，請重新錄音再試一次。")).toBeInTheDocument();
        expect(screen.queryByText("本題已完成！你可以繼續挑戰或再練一次。")).not.toBeInTheDocument();
        expect(onIncorrect).toHaveBeenCalledWith(expect.objectContaining({ save_failed: true }));
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
        expect(screen.getByText("你已看過提示，本輪這題不計通關；稍後只需重試這題。")).toBeInTheDocument();
    });
});
