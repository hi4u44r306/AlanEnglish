import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SpeakingPracticeSteps from "./SpeakingPracticeSteps";

jest.mock("./SpeakingPronunciationRecorder", () => function Recorder() {
    return <div>麥克風</div>;
});

const gapQuestion = {
    id: 265,
    model_answer: "It is an eye.",
    interaction_type: "picture_gap_sentence",
    picture_interaction: { type: "picture_gap_sentence", sentence_pattern: "It is an ____." },
    progress_status: "opened"
};
const clip = { type: "audio", url: "https://r2.example/p4.mp3", start_ms: 6280, end_ms: 11580 };

const spell = word => word.split("").forEach(letter => {
    const tile = screen.getAllByRole("button", { name: `字母 ${letter}` }).find(button => !button.disabled);
    fireEvent.click(tile);
});

describe("跟著念三步（聽→拼→念）", () => {
    beforeEach(() => {
        jest.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    it("先聽、再拼、最後才看到句子與麥克風", () => {
        const onStep = jest.fn();
        render(<SpeakingPracticeSteps question={{ ...gapQuestion, clip }} challengeMode="easy" showAnswerByDefault onGuidedStepChange={onStep} />);
        expect(screen.getByRole("list", { name: "這題的步驟" })).toHaveTextContent("1聽2拼3念");
        expect(screen.getByRole("button", { name: "聽這題" })).toBeInTheDocument();
        expect(screen.queryByText("麥克風")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /下一步：拼單字/ }));
        expect(onStep).toHaveBeenLastCalledWith("spell");
        expect(screen.getByText("拼出空格裡的單字")).toBeInTheDocument();
        expect(screen.queryByText("麥克風")).not.toBeInTheDocument();

        spell("eye");
        expect(screen.getByText("拼對了！")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /下一步：看著句子念/ }));
        expect(onStep).toHaveBeenLastCalledWith("speak");
        expect(screen.getByText("麥克風")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "再聽一次" })).toBeInTheDocument();
    });

    it("拼錯會標紅，可以刪掉重拼；鍵盤也能拼", () => {
        render(<SpeakingPracticeSteps question={gapQuestion} challengeMode="easy" showAnswerByDefault />);
        expect(screen.getByText("拼出空格裡的單字")).toBeInTheDocument();
        act(() => { ["e", "e", "y"].forEach(key => window.dispatchEvent(new KeyboardEvent("keydown", { key }))); });
        expect(screen.getByText(/紅色的字母不對/)).toBeInTheDocument();
        act(() => { ["Backspace", "Backspace", "y", "e"].forEach(key => window.dispatchEvent(new KeyboardEvent("keydown", { key }))); });
        expect(screen.getByText("拼對了！")).toBeInTheDocument();
    });

    it("自己說不出現三步，直接念", () => {
        render(<SpeakingPracticeSteps question={{ ...gapQuestion, clip }} challengeMode="challenge" />);
        expect(screen.queryByRole("list", { name: "這題的步驟" })).not.toBeInTheDocument();
        expect(screen.getByText("麥克風")).toBeInTheDocument();
    });

    it("沒有挖空的題目：有片段就先聽再念", () => {
        render(<SpeakingPracticeSteps question={{ id: 1, model_answer: "Hello.", clip }} challengeMode="easy" />);
        expect(screen.getByRole("list", { name: "這題的步驟" })).toHaveTextContent("1聽2念");
        fireEvent.click(screen.getByRole("button", { name: /下一步：看著句子念/ }));
        expect(screen.getByText("麥克風")).toBeInTheDocument();
    });
});
