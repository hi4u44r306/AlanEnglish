import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
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
    question_audio_url: "https://example.test/question.wav",
    model_audio_url: "https://example.test/model.wav",
    pronunciation_notes_zh: "把 name 說清楚。",
    progress_status: "opened"
};

describe("SpeakingPracticeSteps", () => {
    it("把個人答案欄位顯示成句型空格，不要求學生打字", () => {
        expect(extractAnswerSlots("My name is [你的名字]. [你的名字]!")).toEqual(["你的名字"]);
        expect(answerPatternForLearner(question.model_answer)).toBe("My name is _____.");

        render(<SpeakingPracticeSteps firebaseUser={{}} question={question} onPlayQuestionAudio={jest.fn()} onPlayAnswerAudio={jest.fn()} />);
        expect(screen.getByText("可以直接錄音")).toBeInTheDocument();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(screen.queryByText("My name is Amy.")).not.toBeInTheDocument();
    });

    it("求助時才顯示句型、自然示範與發音提醒", () => {
        const onPlayAnswerAudio = jest.fn();
        render(<SpeakingPracticeSteps firebaseUser={{}} question={question} onPlayQuestionAudio={jest.fn()} onPlayAnswerAudio={onPlayAnswerAudio} />);
        fireEvent.click(screen.getByRole("button", { name: "不知道怎麼說？" }));

        expect(screen.getByText("My name is _____.")).toBeInTheDocument();
        expect(screen.getByText("示範：My name is Amy.")).toBeInTheDocument();
        expect(screen.getByText("發音提醒：把 name 說清楚。")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "聽回答範例" }));
        expect(onPlayAnswerAudio).toHaveBeenCalledTimes(1);
    });

    it("先播放問題，播放結束後才啟動五秒回答倒數", () => {
        const onPlayQuestionAudio = jest.fn();
        render(<SpeakingPracticeSteps firebaseUser={{}} question={question} onPlayQuestionAudio={onPlayQuestionAudio} onPlayAnswerAudio={jest.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: /聽問題並回答/ }));
        expect(onPlayQuestionAudio).toHaveBeenCalledTimes(1);
        expect(typeof onPlayQuestionAudio.mock.calls[0][0]).toBe("function");
    });

    it("只有完整句型回答才完成小關卡", () => {
        const onCompleted = jest.fn();
        render(<SpeakingPracticeSteps firebaseUser={{}} question={question} onCompleted={onCompleted} />);

        fireEvent.click(screen.getByRole("button", { name: "模擬不完整回答" }));
        expect(onCompleted).not.toHaveBeenCalled();
        expect(screen.getByText("先用提示中的完整句型回答，再送出一次。")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "模擬正確回答" }));
        expect(onCompleted).toHaveBeenCalledTimes(1);
        expect(screen.getByText("本題已完成，可以前往下一題或再練一次。")).toBeInTheDocument();
    });
});
