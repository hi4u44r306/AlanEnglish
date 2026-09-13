import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import WorkbookOneFoundationChallenge from "./WorkbookOneFoundationChallenge";

let mockFoundationScoreCalls = 0;
let mockAutomaticRecorderMounts = 0;

jest.mock("./AlphabetAutomaticRecorder", () => function AutomaticRecorder({ question, foundationRoundId, paused, onScored, onRoundInvalid }) {
    const MockReact = require("react");
    MockReact.useEffect(() => {
        mockAutomaticRecorderMounts += 1;
    }, []);
    return <div>
        <span data-testid="round-id">{foundationRoundId}</span>
        <span data-testid="practice-question-id">{question.id}</span>
        <span>麥克風已開啟</span>
        <button type="button" disabled={paused} onClick={() => {
            mockFoundationScoreCalls += 1;
            onScored({
                answer_match: true,
                foundation_round: { status: mockFoundationScoreCalls === 26 ? "completed" : "open" }
            });
        }}>模擬自動答對</button>
        <button type="button" disabled={paused} onClick={() => onScored({ answer_match: false, foundation_round: { status: "failed" } })}>模擬自動答錯</button>
        <button type="button" disabled={paused} onClick={() => onRoundInvalid?.({ code: "foundation_round_invalid" })}>模擬自動回合失效</button>
    </div>;
});

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
    model_answer: letter
}));
const alphabetAudio = {
    audio_url: "https://audio.test/alphabet-master.wav",
    duration_ms: 52000,
    segments: alphabetQuestions.map((question, index) => ({
        question_id: question.id,
        start_ms: index * 2000,
        end_ms: index * 2000 + 1200
    }))
};
const alphabetChallenge = {
    id: 1,
    title: "A–Z 大小寫挑戰",
    generation_metadata: { interaction_type: "alphabet_round" },
    speaking_questions: alphabetQuestions,
    alphabet_audio: alphabetAudio
};
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
        mockAutomaticRecorderMounts = 0;
        startAlphabetRound.mockReset().mockResolvedValue(alphabetRoundResponse);
        global.Audio = jest.fn().mockImplementation(() => ({
            onended: null,
            onerror: null,
            ontimeupdate: null,
            currentTime: 0,
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

    it("字母關必須先聽完 A–Z，挑戰中自動收音且答錯整輪歸零", async () => {
        const onComplete = jest.fn().mockResolvedValue(true);
        render(<WorkbookOneFoundationChallenge
            challenge={alphabetChallenge}
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
        expect(screen.getByLabelText(/^字母 /)).toHaveFocus();
        expect(screen.getByText("麥克風已開啟")).toBeInTheDocument();
        expect(screen.queryByText(/提示音/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "模擬自動答錯" }));

        expect(screen.getByRole("heading", { name: "沒關係，我們從第一題再來！" })).toHaveFocus();
        expect(screen.getByRole("button", { name: /重新聽 A–Z/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /直接再玩一次/ })).toBeInTheDocument();
        expect(onComplete).not.toHaveBeenCalled();
    });

    it("字母教學只載入一次 A–Z 單一主音檔", async () => {
        render(<WorkbookOneFoundationChallenge
            challenge={alphabetChallenge}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn().mockResolvedValue(true)}
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());

        expect(global.Audio).toHaveBeenCalledTimes(1);
        expect(global.Audio).toHaveBeenCalledWith(alphabetAudio.audio_url);
        expect(screen.getByRole("button", { name: "開始挑戰" })).toBeEnabled();
    });

    it("介紹頁的 26 個圖塊同時顯示大小寫字母", () => {
        render(<WorkbookOneFoundationChallenge
            challenge={alphabetChallenge}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn()}
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        expect(screen.getByLabelText("大寫 A，小寫 a")).toHaveTextContent("Aa");
        expect(screen.getByLabelText("大寫 Z，小寫 z")).toHaveTextContent("Zz");
        expect(screen.getByLabelText("英文字母 A 到 Z").querySelectorAll("span")).toHaveLength(26);
    });

    it("進入挑戰後回到列表前會警告本輪不存檔，取消留在原題、確定才退出", async () => {
        const onExit = jest.fn();
        render(<WorkbookOneFoundationChallenge
            challenge={alphabetChallenge}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn()}
            onStartRound={startAlphabetRound}
            onExit={onExit}
        />);
        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
            await Promise.resolve();
            await Promise.resolve();
        });

        fireEvent.click(screen.getByRole("button", { name: "回到列表" }));
        expect(screen.getByRole("alertdialog")).toHaveTextContent("挑戰紀錄不會存檔");
        expect(screen.getByRole("button", { name: "模擬自動答對" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "取消" }));
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(onExit).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "回到列表" }));
        fireEvent.click(screen.getByRole("button", { name: "確定" }));
        expect(onExit).toHaveBeenCalledTimes(1);
    });

    it("完整聽完後重新播放必須從 A 的起點開始", async () => {
        render(<WorkbookOneFoundationChallenge
            challenge={alphabetChallenge}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn()}
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());
        const masterAudio = global.Audio.mock.results[0].value;
        masterAudio.currentTime = 50;
        fireEvent.click(screen.getByRole("button", { name: "重新聽 A–Z" }));

        expect(masterAudio.currentTime).toBe(0);
    });

    it("Safari 尚未取得 metadata 時會等候再 seek 與播放", async () => {
        let mediaTime = 0;
        const safariAudio = {
            readyState: 0,
            onended: null,
            onerror: null,
            ontimeupdate: null,
            onloadedmetadata: null,
            oncanplay: null,
            pause: jest.fn(),
            play: jest.fn().mockResolvedValue(undefined)
        };
        Object.defineProperty(safariAudio, "currentTime", {
            get: () => mediaTime,
            set: value => { if (safariAudio.readyState >= 1) mediaTime = value; }
        });
        global.Audio.mockImplementationOnce(() => safariAudio);
        render(<WorkbookOneFoundationChallenge
            challenge={alphabetChallenge}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn()}
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        expect(safariAudio.play).not.toHaveBeenCalled();
        safariAudio.readyState = 1;
        await act(async () => safariAudio.onloadedmetadata());

        expect(safariAudio.currentTime).toBe(0);
        expect(safariAudio.play).toHaveBeenCalledTimes(1);
    });

    it("開始正式挑戰後不會再播放 A–Z 主音檔或任何字母提示音", async () => {
        render(<WorkbookOneFoundationChallenge
            challenge={alphabetChallenge}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn()}
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());
        const masterAudio = global.Audio.mock.results[0].value;
        masterAudio.play = jest.fn().mockResolvedValue(undefined);
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(masterAudio.play).not.toHaveBeenCalled();
        expect(screen.queryByRole("button", { name: /播放提示音/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    });

    it("字母答錯後選擇重新聽，會重播同一個 A–Z 主音檔", async () => {
        render(<WorkbookOneFoundationChallenge
            challenge={alphabetChallenge}
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
        fireEvent.click(screen.getByRole("button", { name: "模擬自動答錯" }));

        global.Audio.mockClear();
        fireEvent.click(screen.getByRole("button", { name: /重新聽 A–Z/ }));
        expect(screen.getByRole("button", { name: "開始挑戰" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "開始聽 A–Z" }));
        await act(async () => jest.runAllTimers());

        expect(global.Audio).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "開始挑戰" })).toBeEnabled();
    });

    it("中途答錯後直接重玩會回到新一輪第一題", async () => {
        const onComplete = jest.fn().mockResolvedValue(true);
        render(<WorkbookOneFoundationChallenge
            challenge={alphabetChallenge}
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
        fireEvent.click(screen.getByRole("button", { name: "模擬自動答對" }));
        expect(await screen.findByText("第 2 題，共 26 題")).toBeInTheDocument();
        expect(onComplete).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "模擬自動答錯" }));

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /直接再玩一次/ }));
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(await screen.findByText("第 1 題，共 26 題")).toBeInTheDocument();
        expect(screen.getByText("麥克風已開啟")).toBeInTheDocument();
        expect(startAlphabetRound).toHaveBeenCalledTimes(2);
    });

    it("後端回報上一題仍在評分時留在原畫面並允許稍後重試", async () => {
        startAlphabetRound.mockRejectedValueOnce(Object.assign(
            new Error("上一題正在評分，請稍候再開始新回合"),
            { code: "foundation_round_busy" }
        ));
        render(<WorkbookOneFoundationChallenge
            challenge={alphabetChallenge}
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
            challenge={alphabetChallenge}
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
            challenge={alphabetChallenge}
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
        fireEvent.click(screen.getByRole("button", { name: "模擬自動回合失效" }));

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
            challenge={alphabetChallenge}
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
            fireEvent.click(screen.getByRole("button", { name: "模擬自動答對" }));
            if (index < 25) expect(await screen.findByText(`第 ${index + 2} 題，共 26 題`)).toBeInTheDocument();
        }

        expect(await screen.findByRole("heading", { name: "太棒了，全部完成！" })).toBeInTheDocument();
        expect(startAlphabetRound).toHaveBeenCalledTimes(1);
        expect(mockAutomaticRecorderMounts).toBe(1);
        expect(onComplete).not.toHaveBeenCalled();
        expect(seenQuestionIds).toEqual([...alphabetQuestions].reverse().map(question => question.id));
        expect(new Set(seenQuestionIds).size).toBe(26);
    });

    it("缺少任一字母標準音時不能開始教學或挑戰", () => {
        render(<WorkbookOneFoundationChallenge
            challenge={{ ...alphabetChallenge, alphabet_audio: { ...alphabetAudio, segments: alphabetAudio.segments.slice(0, 25) } }}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn()}
            onStartRound={startAlphabetRound}
            onExit={jest.fn()}
        />);

        expect(screen.getByRole("alert")).toHaveTextContent("單一慢速音檔尚未準備完成");
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
