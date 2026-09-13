import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import WorkbookOneFoundationChallenge from "./WorkbookOneFoundationChallenge";

jest.mock("./SpeakingPracticeSteps", () => function Practice({ disabledReason, onCompleted, onIncorrect }) {
    return <div>
        {disabledReason && <span>{disabledReason}</span>}
        <button type="button" disabled={Boolean(disabledReason)} onClick={() => onCompleted({ answer_match: true })}>模擬答對</button>
        <button type="button" disabled={Boolean(disabledReason)} onClick={() => onIncorrect({ answer_match: false })}>模擬答錯</button>
    </div>;
});

const alphabetQuestions = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter, index) => ({
    id: index + 1,
    sort_order: index,
    question_text: letter,
    model_answer: letter,
    model_audio_url: `https://audio.test/${letter}.wav`
}));

describe("WorkbookOneFoundationChallenge", () => {
    const originalAudio = global.Audio;
    beforeEach(() => {
        jest.useFakeTimers();
        global.Audio = jest.fn().mockImplementation(() => ({
            onended: null,
            onerror: null,
            pause: jest.fn(),
            play() {
                window.setTimeout(() => this.onended?.(), 0);
                return Promise.resolve();
            }
        }));
    });
    afterEach(() => {
        global.Audio = originalAudio;
        jest.useRealTimers();
    });

    it("字母關必須先聽完 A–Z，倒數三秒後才能錄音，答錯整輪歸零", async () => {
        const onComplete = jest.fn().mockResolvedValue(true);
        render(<WorkbookOneFoundationChallenge
            challenge={{ id: 1, title: "A–Z 大小寫挑戰", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: alphabetQuestions }}
            firebaseUser={{ uid: "student" }}
            onComplete={onComplete}
            onExit={jest.fn()}
        />);

        expect(screen.getByRole("button", { name: "開始挑戰" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());
        expect(screen.getByRole("button", { name: "開始挑戰" })).toBeEnabled();

        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        expect(screen.getByText("3")).toBeInTheDocument();
        expect(screen.getByLabelText(/^字母 /)).toHaveFocus();
        expect(screen.getByRole("button", { name: "模擬答錯" })).toBeDisabled();
        await act(async () => jest.advanceTimersByTime(3000));
        await act(async () => jest.runOnlyPendingTimers());
        expect(screen.getByRole("button", { name: "模擬答錯" })).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: "模擬答錯" }));

        expect(screen.getByRole("heading", { name: "沒關係，我們從第一題再來！" })).toHaveFocus();
        expect(screen.getByRole("button", { name: /重新聽 A–Z/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /直接再玩一次/ })).toBeInTheDocument();
        expect(onComplete).not.toHaveBeenCalled();
    });

    it("字母教學會依 A 到 Z 各播放一次標準音", async () => {
        render(<WorkbookOneFoundationChallenge
            challenge={{ id: 1, title: "A–Z 大小寫挑戰", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: alphabetQuestions }}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn().mockResolvedValue(true)}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());

        expect(global.Audio.mock.calls.map(([url]) => url)).toEqual(
            alphabetQuestions.map(question => question.model_audio_url)
        );
        expect(screen.getByRole("button", { name: "開始挑戰" })).toBeEnabled();
    });

    it("中途答錯後直接重玩會回到新一輪第一題", async () => {
        render(<WorkbookOneFoundationChallenge
            challenge={{ id: 1, title: "A–Z 大小寫挑戰", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: alphabetQuestions }}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn().mockResolvedValue(true)}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());
        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        await act(async () => jest.advanceTimersByTime(3000));
        await act(async () => jest.runOnlyPendingTimers());
        fireEvent.click(screen.getByRole("button", { name: "模擬答對" }));
        expect(await screen.findByText("第 2 題，共 26 題")).toBeInTheDocument();
        await act(async () => jest.advanceTimersByTime(3000));
        await act(async () => jest.runOnlyPendingTimers());
        fireEvent.click(screen.getByRole("button", { name: "模擬答錯" }));

        fireEvent.click(screen.getByRole("button", { name: /直接再玩一次/ }));
        expect(screen.getByText("第 1 題，共 26 題")).toBeInTheDocument();
        expect(screen.getByRole("timer")).toHaveTextContent("3先看清楚");
    });

    it("缺少任一字母標準音時不能開始教學或挑戰", () => {
        const incompleteQuestions = alphabetQuestions.map(question => (
            question.question_text === "Z" ? { ...question, model_audio_url: null } : question
        ));
        render(<WorkbookOneFoundationChallenge
            challenge={{ id: 1, title: "A–Z 大小寫挑戰", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: incompleteQuestions }}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn()}
            onExit={jest.fn()}
        />);

        expect(screen.getByRole("alert")).toHaveTextContent("26 個標準發音尚未全部準備完成");
        expect(screen.getByRole("button", { name: "開始聽 A–Z" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "開始挑戰" })).toBeDisabled();
    });

    it("拼讀關只顯示單字，不在提示中洩漏字母答案", async () => {
        const onComplete = jest.fn().mockResolvedValue(true);
        render(<WorkbookOneFoundationChallenge
            challenge={{
                id: 2,
                title: "P14 看字拼讀",
                generation_metadata: { interaction_type: "letter_spelling" },
                speaking_questions: [{ id: 20, sort_order: 0, question_text: "apple", model_answer: "A P P L E" }]
            }}
            firebaseUser={{ uid: "student" }}
            onComplete={onComplete}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始拼讀" }));
        expect(screen.getByText("apple")).toBeInTheDocument();
        expect(screen.queryByText("A P P L E")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "模擬答對" }));

        expect(await screen.findByRole("heading", { name: "太棒了，全部完成！" })).toBeInTheDocument();
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 20 }), { answer_match: true });
    });
});
