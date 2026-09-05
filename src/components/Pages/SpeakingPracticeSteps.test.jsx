import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import SpeakingPracticeSteps, { extractAnswerSlots, fillAnswerSlots } from "./SpeakingPracticeSteps";

jest.mock("./SpeakingPronunciationRecorder", () => function Recorder({ disabledReason, onScored, slotValues }) {
    return <div>
        <span>{disabledReason || "可以錄音"}</span>
        <span data-testid="slot-value">{slotValues?.["你的名字"] || ""}</span>
        <button type="button" disabled={Boolean(disabledReason)} onClick={() => onScored({ scores: { pronunciation: 82 } })}>模擬評分</button>
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
    progress_status: "opened"
};

describe("SpeakingPracticeSteps", () => {
    it("辨識並代換教材中的個人化欄位", () => {
        expect(extractAnswerSlots("My name is [你的名字]. [你的名字]!")).toEqual(["你的名字"]);
        expect(fillAnswerSlots(question.model_answer, { "你的名字": "Amy" })).toBe("My name is Amy.");
    });

    it("要求先填英文並依序完成三段練習", () => {
        render(<SpeakingPracticeSteps firebaseUser={{}} question={question} onPlayAudio={jest.fn()} />);

        expect(screen.getByRole("button", { name: "看提示說（請先完成前一步）" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "自己說（請先完成前一步）" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "模擬評分" })).toBeDisabled();

        fireEvent.change(screen.getByLabelText("你的名字"), { target: { value: "Amy" } });
        expect(screen.getByTestId("slot-value")).toHaveTextContent("Amy");
        fireEvent.click(screen.getByRole("button", { name: "模擬評分" }));
        fireEvent.click(screen.getByRole("button", { name: "下一步：看提示說" }));

        expect(screen.queryByText("My name is Amy.")).not.toBeInTheDocument();
        expect(screen.getByText("my")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "模擬評分" }));
        fireEvent.click(screen.getByRole("button", { name: "下一步：自己說" }));

        expect(screen.getByText("不看提示，完成整句")).toBeInTheDocument();
        expect(screen.queryByText("關鍵字：my、name、is")).not.toBeInTheDocument();
    });
});
