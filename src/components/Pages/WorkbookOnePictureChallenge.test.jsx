import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WorkbookOnePictureChallenge from "./WorkbookOnePictureChallenge";

jest.mock("./SpeakingPronunciationRecorder", () => function Recorder({ onScored }) {
    return <div>
        <button type="button" onClick={() => onScored({ answer_match: false, recognized_text: "incomplete" })}>模擬不完整回答</button>
        <button type="button" onClick={() => onScored({ answer_match: true, recognized_text: "complete" })}>模擬完整回答</button>
    </div>;
});

const privateVisual = {
    kind: "private-image",
    image_url: "https://r2.example/signed-picture.webp",
    alt_zh: "樹上的蘋果"
};

describe("WorkbookOnePictureChallenge", () => {
    const originalAudio = global.Audio;

    afterEach(() => {
        global.Audio = originalAudio;
        jest.restoreAllMocks();
    });

    it("P21 只顯示經審核圖片，不洩漏問句或回答", async () => {
        const onComplete = jest.fn().mockResolvedValue(true);
        render(<WorkbookOnePictureChallenge
            challenge={{
                id: 21,
                title: "P21 看圖問答",
                generation_metadata: { interaction_type: "picture_qa" },
                speaking_questions: [{
                    id: 2101,
                    sort_order: 0,
                    visual_aid: privateVisual,
                    picture_interaction: { type: "picture_qa" }
                }]
            }}
            firebaseUser={{ uid: "student" }}
            onComplete={onComplete}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        expect(screen.getByRole("article", { name: "第 1 題，共 1 題" })).toHaveFocus();
        expect(screen.getByRole("img", { name: "樹上的蘋果" })).toHaveAttribute("src", privateVisual.image_url);
        expect(screen.queryByText("樹上的蘋果")).not.toBeInTheDocument();
        expect(screen.queryByText(/What is it/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/It is an apple/i)).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "不知道怎麼說？" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "模擬不完整回答" }));
        expect(onComplete).not.toHaveBeenCalled();
        expect(screen.getByText("先用提示中的完整句型回答，再送出一次。")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "模擬完整回答" }));
        expect(await screen.findByRole("heading", { name: "太棒了，全部完成！" })).toBeInTheDocument();
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ id: 2101 }),
            expect.objectContaining({ answer_match: true, recognized_text: "complete" })
        );
    });

    it("P21 多張圖片會以洗牌後題序全部出現一次，最後一題完成後才結束", async () => {
        jest.spyOn(Math, "random").mockReturnValue(0);
        const questions = [1, 2, 3].map((number, index) => ({
            id: 2100 + number,
            sort_order: index,
            visual_aid: {
                kind: "private-image",
                image_url: `https://r2.example/signed-picture-${number}.webp`,
                alt_zh: `核准圖片 ${number}`
            },
            picture_interaction: { type: "picture_qa" }
        }));
        const onComplete = jest.fn().mockResolvedValue(true);
        render(<WorkbookOnePictureChallenge
            challenge={{
                id: 21,
                title: "P21 看圖問答",
                generation_metadata: { interaction_type: "picture_qa" },
                speaking_questions: questions
            }}
            firebaseUser={{ uid: "student" }}
            onComplete={onComplete}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        for (let index = 0; index < questions.length; index += 1) {
            expect(screen.getByRole("article", { name: `第 ${index + 1} 題，共 3 題` })).toHaveFocus();
            expect(screen.queryByRole("heading", { name: "太棒了，全部完成！" })).not.toBeInTheDocument();
            await act(async () => {
                fireEvent.click(screen.getByRole("button", { name: "模擬完整回答" }));
                await Promise.resolve();
            });
            if (index < questions.length - 1) {
                expect(await screen.findByRole("article", { name: `第 ${index + 2} 題，共 3 題` })).toBeInTheDocument();
            }
        }

        const completedIds = onComplete.mock.calls.map(([question]) => question.id);
        expect(await screen.findByRole("heading", { name: "太棒了，全部完成！" })).toBeInTheDocument();
        expect(completedIds).toEqual([2102, 2103, 2101]);
        expect(new Set(completedIds).size).toBe(3);
    });

    it("P21 完成紀錄保存失敗時留在原圖，重試成功後才前進", async () => {
        jest.spyOn(Math, "random").mockReturnValue(0);
        const onComplete = jest.fn()
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);
        const questions = [1, 2].map((number, index) => ({
            id: 2100 + number,
            sort_order: index,
            visual_aid: {
                kind: "private-image",
                image_url: `https://r2.example/signed-picture-${number}.webp`,
                alt_zh: `核准圖片 ${number}`
            },
            picture_interaction: { type: "picture_qa" }
        }));
        render(<WorkbookOnePictureChallenge
            challenge={{
                id: 21,
                title: "P21 看圖問答",
                generation_metadata: { interaction_type: "picture_qa" },
                speaking_questions: questions
            }}
            firebaseUser={{ uid: "student" }}
            onComplete={onComplete}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        const firstImageUrl = screen.getByRole("img").getAttribute("src");
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "模擬完整回答" }));
            await Promise.resolve();
        });
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("article", { name: "第 1 題，共 2 題" })).toBeInTheDocument();
        expect(screen.getByRole("img")).toHaveAttribute("src", firstImageUrl);

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "模擬完整回答" }));
            await Promise.resolve();
        });
        expect(onComplete).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("article", { name: "第 2 題，共 2 題" })).toBeInTheDocument();
        expect(screen.getByRole("img")).not.toHaveAttribute("src", firstImageUrl);
    });

    it("P22 依 token index 播放所有可見單字，空格不可播放且完整句才完成", async () => {
        const audioInstances = [];
        global.Audio = jest.fn().mockImplementation(() => {
            const audio = { play: jest.fn().mockResolvedValue(undefined), pause: jest.fn(), onended: null, onerror: null };
            audioInstances.push(audio);
            return audio;
        });
        const onComplete = jest.fn().mockResolvedValue(true);
        const wordAudio = [
            { token_index: 0, word: "The", audio_url: "https://r2.example/the-first.mp3" },
            { token_index: 2, word: "is", audio_url: "https://r2.example/is.mp3" },
            { token_index: 3, word: "in", audio_url: "https://r2.example/in.mp3" },
            { token_index: 4, word: "the", audio_url: "https://r2.example/the-second.mp3" },
            { token_index: 5, word: "tree", audio_url: "https://r2.example/tree.mp3" }
        ];
        render(<WorkbookOnePictureChallenge
            challenge={{
                id: 22,
                title: "P22 看圖補句",
                generation_metadata: { interaction_type: "picture_gap_sentence" },
                speaking_questions: [{
                    id: 2201,
                    sort_order: 0,
                    visual_aid: privateVisual,
                    picture_interaction: {
                        type: "picture_gap_sentence",
                        sentence_pattern: "The ____ is in the tree.",
                        word_audio: wordAudio
                    }
                }]
            }}
            firebaseUser={{ uid: "student" }}
            onComplete={onComplete}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        expect(screen.getByRole("img", { name: "樹上的蘋果" })).toHaveAttribute("src", privateVisual.image_url);
        expect(screen.getByLabelText("請依圖片補上的答案")).toHaveTextContent("____");
        expect(screen.queryByRole("button", { name: /apple/i })).not.toBeInTheDocument();

        for (const item of wordAudio) {
            fireEvent.click(screen.getByRole("button", { name: `播放 ${item.word} 的發音` }));
            expect(global.Audio).toHaveBeenLastCalledWith(item.audio_url);
            expect(audioInstances.at(-1).play).toHaveBeenCalledTimes(1);
            act(() => audioInstances.at(-1).onended());
        }
        expect(global.Audio).toHaveBeenNthCalledWith(1, "https://r2.example/the-first.mp3");
        expect(global.Audio).toHaveBeenNthCalledWith(4, "https://r2.example/the-second.mp3");

        fireEvent.click(screen.getByRole("button", { name: "模擬不完整回答" }));
        expect(onComplete).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "模擬完整回答" }));
        expect(await screen.findByRole("heading", { name: "太棒了，全部完成！" })).toBeInTheDocument();
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ id: 2201 }),
            expect.objectContaining({ answer_match: true, recognized_text: "complete" })
        );
    });

    it("P22 單字播放被瀏覽器拒絕後會解鎖並允許重試", async () => {
        const blockedAudio = { play: jest.fn().mockRejectedValue(new Error("blocked")), pause: jest.fn(), onended: null, onerror: null };
        const retryAudio = { play: jest.fn().mockResolvedValue(undefined), pause: jest.fn(), onended: null, onerror: null };
        global.Audio = jest.fn()
            .mockImplementationOnce(() => blockedAudio)
            .mockImplementationOnce(() => retryAudio);
        render(<WorkbookOnePictureChallenge
            challenge={{
                id: 22,
                title: "P22 看圖補句",
                generation_metadata: { interaction_type: "picture_gap_sentence" },
                speaking_questions: [{
                    id: 2202,
                    sort_order: 0,
                    visual_aid: privateVisual,
                    picture_interaction: {
                        type: "picture_gap_sentence",
                        sentence_pattern: "The ____ is in the tree.",
                        word_audio: [{ token_index: 0, word: "The", audio_url: "https://r2.example/the.mp3" }]
                    }
                }]
            }}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn().mockResolvedValue(true)}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        const wordButton = screen.getByRole("button", { name: "播放 The 的發音" });
        fireEvent.click(wordButton);
        expect(await screen.findByRole("alert")).toHaveTextContent("瀏覽器阻擋了播放，請再按一次單字。");
        await waitFor(() => expect(wordButton).toBeEnabled());

        fireEvent.click(wordButton);
        expect(global.Audio).toHaveBeenCalledTimes(2);
        expect(retryAudio.play).toHaveBeenCalledTimes(1);
        act(() => retryAudio.onended());
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("P22 音檔載入錯誤後會解鎖並允許重試", async () => {
        const failedAudio = { play: jest.fn().mockResolvedValue(undefined), pause: jest.fn(), onended: null, onerror: null };
        const retryAudio = { play: jest.fn().mockResolvedValue(undefined), pause: jest.fn(), onended: null, onerror: null };
        global.Audio = jest.fn()
            .mockImplementationOnce(() => failedAudio)
            .mockImplementationOnce(() => retryAudio);
        render(<WorkbookOnePictureChallenge
            challenge={{
                id: 22,
                title: "P22 看圖補句",
                generation_metadata: { interaction_type: "picture_gap_sentence" },
                speaking_questions: [{
                    id: 2202,
                    sort_order: 0,
                    visual_aid: privateVisual,
                    picture_interaction: {
                        type: "picture_gap_sentence",
                        sentence_pattern: "The ____ is in the tree.",
                        word_audio: [{ token_index: 0, word: "The", audio_url: "https://r2.example/the.mp3" }]
                    }
                }]
            }}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn().mockResolvedValue(true)}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        const wordButton = screen.getByRole("button", { name: "播放 The 的發音" });
        fireEvent.click(wordButton);
        act(() => failedAudio.onerror());
        expect(await screen.findByRole("alert")).toHaveTextContent("這個單字的發音暫時無法播放，請稍後再試。");
        expect(wordButton).toBeEnabled();

        fireEvent.click(wordButton);
        expect(global.Audio).toHaveBeenCalledTimes(2);
        expect(retryAudio.play).toHaveBeenCalledTimes(1);
        act(() => retryAudio.onended());
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});
