import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import WorkbookOneFoundationChallenge from "./WorkbookOneFoundationChallenge";

let mockFoundationScoreCalls = 0;

jest.mock("./SpeakingPracticeSteps", () => function Practice({ question, disabledReason, onCompleted, onIncorrect, onRoundInvalid, foundationRoundId }) {
    return <div>
        {foundationRoundId && <span data-testid="round-id">{foundationRoundId}</span>}
        {question?.id && <span data-testid="practice-question-id">{question.id}</span>}
        {disabledReason && <span>{disabledReason}</span>}
        <button type="button" disabled={Boolean(disabledReason)} onClick={() => {
            if (foundationRoundId) mockFoundationScoreCalls += 1;
            onCompleted({
                answer_match: true,
                foundation_round: foundationRoundId ? { status: mockFoundationScoreCalls === 26 ? "completed" : "open" } : null
            });
        }}>模擬答對</button>
        <button type="button" disabled={Boolean(disabledReason)} onClick={() => onIncorrect({ answer_match: false, foundation_round: { status: "failed" } })}>模擬答錯</button>
        <button type="button" disabled={Boolean(disabledReason)} onClick={() => onRoundInvalid?.({ code: "foundation_round_invalid" })}>模擬回合失效</button>
    </div>;
});

const alphabetQuestions = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter, index) => ({
    id: index + 1,
    sort_order: index,
    question_text: letter,
    model_answer: letter,
    model_audio_url: `https://audio.test/${letter}.wav`
}));
const alphabetRoundResponse = {
    round: {
        round_id: "11111111-1111-4111-8111-111111111111",
        questions: [...alphabetQuestions].reverse().map((question, index) => ({
            question_id: question.id,
            display_text: index % 2 ? question.question_text.toLowerCase() : question.question_text
        }))
    }
};
const startAlphabetRound = jest.fn();

describe("WorkbookOneFoundationChallenge", () => {
    const originalAudio = global.Audio;
    beforeEach(() => {
        jest.useFakeTimers();
        mockFoundationScoreCalls = 0;
        startAlphabetRound.mockReset().mockResolvedValue(alphabetRoundResponse);
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
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it("字母關必須先聽完 A–Z，倒數三秒後才能錄音，答錯整輪歸零", async () => {
        const onComplete = jest.fn().mockResolvedValue(true);
        render(<WorkbookOneFoundationChallenge
            challenge={{ id: 1, title: "A–Z 大小寫挑戰", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: alphabetQuestions }}
            firebaseUser={{ uid: "student" }}
            onComplete={onComplete}
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        expect(screen.getByRole("button", { name: "開始挑戰" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());
        expect(screen.getByRole("button", { name: "開始挑戰" })).toBeEnabled();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
            await Promise.resolve();
            await Promise.resolve();
        });
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
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());

        expect(global.Audio.mock.calls.map(([url]) => url)).toEqual(
            alphabetQuestions.map(question => question.model_audio_url)
        );
        expect(screen.getByRole("button", { name: "開始挑戰" })).toBeEnabled();
    });

    it("字母提示音播放失敗後必須重試並聽完才解鎖錄音", async () => {
        render(<WorkbookOneFoundationChallenge
            challenge={{ id: 1, title: "A–Z 大小寫挑戰", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: alphabetQuestions }}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn()}
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());
        const blockedAudio = {
            onended: null,
            onerror: null,
            pause: jest.fn(),
            play: jest.fn().mockRejectedValue(new Error("blocked"))
        };
        const retryAudio = {
            onended: null,
            onerror: null,
            pause: jest.fn(),
            play: jest.fn().mockResolvedValue(undefined)
        };
        global.Audio
            .mockImplementationOnce(() => blockedAudio)
            .mockImplementationOnce(() => retryAudio);

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
            await Promise.resolve();
            await Promise.resolve();
        });
        await act(async () => {
            jest.advanceTimersByTime(3000);
            await Promise.resolve();
        });

        expect(screen.getByRole("alert")).toHaveTextContent("標準發音");
        expect(screen.getByRole("button", { name: "模擬答對" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "播放提示音" }));
        expect(screen.getByRole("button", { name: "模擬答對" })).toBeDisabled();
        act(() => retryAudio.onended());
        expect(screen.getByRole("button", { name: "模擬答對" })).toBeEnabled();
    });

    it("字母答錯後選擇重新聽，會再次依 A 到 Z 播完 26 個標準音", async () => {
        render(<WorkbookOneFoundationChallenge
            challenge={{ id: 1, title: "A–Z 大小寫挑戰", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: alphabetQuestions }}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn()}
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
            await Promise.resolve();
            await Promise.resolve();
        });
        await act(async () => jest.advanceTimersByTime(3000));
        await act(async () => jest.runOnlyPendingTimers());
        fireEvent.click(screen.getByRole("button", { name: "模擬答錯" }));

        global.Audio.mockClear();
        fireEvent.click(screen.getByRole("button", { name: /重新聽 A–Z/ }));
        expect(screen.getByRole("button", { name: "開始挑戰" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());

        expect(global.Audio.mock.calls.map(([url]) => url)).toEqual(
            alphabetQuestions.map(question => question.model_audio_url)
        );
        expect(screen.getByRole("button", { name: "開始挑戰" })).toBeEnabled();
    });

    it("中途答錯後直接重玩會回到新一輪第一題", async () => {
        const onComplete = jest.fn().mockResolvedValue(true);
        render(<WorkbookOneFoundationChallenge
            challenge={{ id: 1, title: "A–Z 大小寫挑戰", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: alphabetQuestions }}
            firebaseUser={{ uid: "student" }}
            onComplete={onComplete}
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
            await Promise.resolve();
            await Promise.resolve();
        });
        await act(async () => jest.advanceTimersByTime(3000));
        await act(async () => jest.runOnlyPendingTimers());
        fireEvent.click(screen.getByRole("button", { name: "模擬答對" }));
        expect(await screen.findByText("第 2 題，共 26 題")).toBeInTheDocument();
        expect(onComplete).not.toHaveBeenCalled();
        await act(async () => jest.advanceTimersByTime(3000));
        await act(async () => jest.runOnlyPendingTimers());
        fireEvent.click(screen.getByRole("button", { name: "模擬答錯" }));

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /直接再玩一次/ }));
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(await screen.findByText("第 1 題，共 26 題")).toBeInTheDocument();
        expect(screen.getByRole("timer")).toHaveTextContent("3先看清楚");
        expect(startAlphabetRound).toHaveBeenCalledTimes(2);
    });

    it("後端回報上一題仍在評分時留在原畫面並允許稍後重試", async () => {
        startAlphabetRound.mockRejectedValueOnce(Object.assign(
            new Error("上一題正在評分，請稍候再開始新回合"),
            { code: "foundation_round_busy" }
        ));
        render(<WorkbookOneFoundationChallenge
            challenge={{ id: 1, title: "A–Z 大小寫挑戰", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: alphabetQuestions }}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn()}
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(screen.getByRole("alert")).toHaveTextContent("上一題正在評分");
        expect(screen.getByRole("button", { name: "開始挑戰" })).toBeEnabled();
        expect(screen.queryByText("口說大挑戰暫時無法開啟")).not.toBeInTheDocument();
    });

    it("建立回合期間重複點擊只送出一次請求", async () => {
        let resolveRound;
        startAlphabetRound.mockImplementationOnce(() => new Promise(resolve => { resolveRound = resolve; }));
        render(<WorkbookOneFoundationChallenge
            challenge={{ id: 1, title: "A–Z 大小寫挑戰", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: alphabetQuestions }}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn()}
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());
        const startButton = screen.getByRole("button", { name: "開始挑戰" });
        fireEvent.click(startButton);
        fireEvent.click(startButton);
        expect(startAlphabetRound).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolveRound(alphabetRoundResponse);
            await Promise.resolve();
        });
        expect(await screen.findByText("第 1 題，共 26 題")).toBeInTheDocument();
    });

    it("後端判定回合失效時立即歸零並要求建立新回合", async () => {
        render(<WorkbookOneFoundationChallenge
            challenge={{ id: 1, title: "A–Z 大小寫挑戰", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: alphabetQuestions }}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn()}
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
            await Promise.resolve();
            await Promise.resolve();
        });
        await act(async () => jest.advanceTimersByTime(3000));
        await act(async () => jest.runOnlyPendingTimers());
        fireEvent.click(screen.getByRole("button", { name: "模擬回合失效" }));

        expect(screen.getByRole("heading", { name: "沒關係，我們從第一題再來！" })).toBeInTheDocument();
        expect(screen.queryByTestId("round-id")).not.toBeInTheDocument();
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /直接再玩一次/ }));
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(startAlphabetRound).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId("round-id")).toHaveTextContent("11111111-1111-4111-8111-111111111111");
    });

    it("完整 26 題只沿用同一個後端 round，最後一題確認完成後才顯示結果", async () => {
        const onComplete = jest.fn();
        render(<WorkbookOneFoundationChallenge
            challenge={{ id: 1, title: "A–Z 大小寫挑戰", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: alphabetQuestions }}
            firebaseUser={{ uid: "student" }}
            onComplete={onComplete}
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
            await Promise.resolve();
            await Promise.resolve();
        });

        const seenQuestionIds = [];
        for (let index = 0; index < 26; index += 1) {
            expect(screen.getByTestId("round-id")).toHaveTextContent("11111111-1111-4111-8111-111111111111");
            seenQuestionIds.push(Number(screen.getByTestId("practice-question-id").textContent));
            await act(async () => jest.advanceTimersByTime(3000));
            await act(async () => jest.runOnlyPendingTimers());
            fireEvent.click(screen.getByRole("button", { name: "模擬答對" }));
            if (index < 25) expect(await screen.findByText(`第 ${index + 2} 題，共 26 題`)).toBeInTheDocument();
        }

        expect(await screen.findByRole("heading", { name: "太棒了，全部完成！" })).toBeInTheDocument();
        expect(startAlphabetRound).toHaveBeenCalledTimes(1);
        expect(onComplete).not.toHaveBeenCalled();
        expect(seenQuestionIds).toEqual([...alphabetQuestions].reverse().map(question => question.id));
        expect(new Set(seenQuestionIds).size).toBe(26);
    });

    it("缺少任一字母標準音時不能開始教學或挑戰", () => {
        const incompleteQuestions = alphabetQuestions.map(question => (
            question.question_text === "Z" ? { ...question, model_audio_url: null } : question
        ));
        render(<WorkbookOneFoundationChallenge
            challenge={{ id: 1, title: "A–Z 大小寫挑戰", generation_metadata: { interaction_type: "alphabet_round" }, speaking_questions: incompleteQuestions }}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn()}
            onStartRound={startAlphabetRound}
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
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 20 }), expect.objectContaining({ answer_match: true }));
    });

    it("拼讀答錯或完成紀錄保存失敗時留在同一題", async () => {
        const onComplete = jest.fn()
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);
        render(<WorkbookOneFoundationChallenge
            challenge={{
                id: 2,
                title: "P14 看字拼讀",
                generation_metadata: { interaction_type: "letter_spelling" },
                speaking_questions: [
                    { id: 20, sort_order: 0, question_text: "apple", model_answer: "A P P L E" },
                    { id: 21, sort_order: 1, question_text: "book", model_answer: "B O O K" }
                ]
            }}
            firebaseUser={{ uid: "student" }}
            onComplete={onComplete}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始拼讀" }));
        const firstQuestionId = screen.getByTestId("practice-question-id").textContent;
        fireEvent.click(screen.getByRole("button", { name: "模擬答錯" }));
        expect(screen.getByTestId("practice-question-id")).toHaveTextContent(firstQuestionId);
        expect(onComplete).not.toHaveBeenCalled();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "模擬答對" }));
            await Promise.resolve();
        });
        expect(screen.getByTestId("practice-question-id")).toHaveTextContent(firstQuestionId);
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("heading", { name: "太棒了，全部完成！" })).not.toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "模擬答對" }));
            await Promise.resolve();
        });
        expect(onComplete).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId("practice-question-id")).not.toHaveTextContent(firstQuestionId);
    });

    it.each([
        [14, 10],
        [15, 12],
        [16, 12],
        [17, 12]
    ])("P%s 拼讀關會以洗牌後題序完成全部 %s 個單字，沒有遺漏或重複", async (pageNumber, questionCount) => {
        const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);
        const questions = Array.from({ length: questionCount }, (_, index) => ({
            id: pageNumber * 100 + index,
            sort_order: index,
            question_text: `word-${pageNumber}-${index}`,
            model_answer: `W O R D ${index}`
        }));
        const onComplete = jest.fn().mockResolvedValue(true);

        render(<WorkbookOneFoundationChallenge
            challenge={{
                id: pageNumber,
                title: `P${pageNumber} 看字拼讀`,
                generation_metadata: { interaction_type: "letter_spelling" },
                speaking_questions: questions
            }}
            firebaseUser={{ uid: "student" }}
            onComplete={onComplete}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始拼讀" }));
        const seenQuestionIds = [];
        for (let index = 0; index < questionCount; index += 1) {
            seenQuestionIds.push(Number(screen.getByTestId("practice-question-id").textContent));
            await act(async () => {
                fireEvent.click(screen.getByRole("button", { name: "模擬答對" }));
                await Promise.resolve();
            });
            if (index < questionCount - 1) {
                expect(await screen.findByText(`第 ${index + 2} 題，共 ${questionCount} 題`)).toBeInTheDocument();
            }
        }

        expect(await screen.findByRole("heading", { name: "太棒了，全部完成！" })).toBeInTheDocument();
        expect(seenQuestionIds).not.toEqual(questions.map(question => question.id));
        expect([...seenQuestionIds].sort((a, b) => a - b)).toEqual(questions.map(question => question.id));
        expect(new Set(seenQuestionIds).size).toBe(questionCount);
        expect(onComplete).toHaveBeenCalledTimes(questionCount);
        expect(onComplete.mock.calls.map(([question]) => question.id)).toEqual(seenQuestionIds);
        randomSpy.mockRestore();
    });
});
