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

    it("only a fully completed page opens the shared celebration with actual rewards", async () => {
        const reward = { challenge_completed: true, xp_awarded: 30, ae_points_awarded: 3 };
        const onFinished = jest.fn();
        render(<WorkbookOnePictureChallenge correctPauseMs={0} challenge={{ id: 21, title: "P21", generation_metadata: { interaction_type: "picture_qa" },
            speaking_questions: [{ id: 1, visual_aid: privateVisual, picture_interaction: { type: "picture_qa" } }] }}
            firebaseUser={{ uid: "student" }} onComplete={jest.fn().mockResolvedValue(reward)} onFinished={onFinished} />);
        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        fireEvent.click(screen.getByRole("button", { name: "模擬不完整回答" }));
        expect(onFinished).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "模擬完整回答" }));
        await waitFor(() => expect(onFinished).toHaveBeenCalledWith(reward));
    });

    it("老師按來源順序唯讀預覽看圖題並可切換，不啟用錄音", () => {
        const onComplete = jest.fn();
        render(<WorkbookOnePictureChallenge correctPauseMs={0}
            challenge={{
                id: 21,
                title: "P21 看圖問答",
                generation_metadata: { interaction_type: "picture_qa" },
                speaking_questions: [1, 2].map(id => ({
                    id,
                    sort_order: id,
                    visual_aid: { ...privateVisual, alt_zh: `圖片 ${id}` },
                    picture_interaction: { type: "picture_qa" }
                }))
            }}
            firebaseUser={{ uid: "teacher" }}
            staffPreview
            onComplete={onComplete}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "預覽題目" }));
        expect(screen.getByRole("img", { name: "圖片 1" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "模擬完整回答" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "上一題" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "下一題" }));
        expect(screen.getByRole("img", { name: "圖片 2" })).toBeInTheDocument();
        expect(onComplete).not.toHaveBeenCalled();
    });

    it("P21 只顯示經審核圖片，不洩漏問句或回答", async () => {
        const onComplete = jest.fn().mockResolvedValue(true);
        render(<WorkbookOnePictureChallenge correctPauseMs={0}
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
            expect.objectContaining({ answer_match: true, recognized_text: "complete" }), expect.stringMatching(/^[0-9a-f-]{36}$/)
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
        render(<WorkbookOnePictureChallenge correctPauseMs={0}
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

    it("答對後不等存檔就換題；存不到的題目加到這一輪最後面再念一次", async () => {
        jest.spyOn(Math, "random").mockReturnValue(0);
        let failSave;
        const onComplete = jest.fn()
            .mockImplementationOnce(() => new Promise(resolve => { failSave = () => resolve(false); }))
            .mockResolvedValue(true);
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
        render(<WorkbookOnePictureChallenge correctPauseMs={0}
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
        fireEvent.click(screen.getByRole("button", { name: "模擬完整回答" }));
        // 第一題的存檔還沒回來，就已經換到第二題。
        expect(await screen.findByRole("article", { name: "第 2 題，共 2 題" })).toBeInTheDocument();
        await act(async () => { failSave(); await Promise.resolve(); });
        expect(await screen.findByText(/第 2 \/ 3 題/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "模擬完整回答" }));
        expect(await screen.findByRole("article", { name: "第 3 題，共 3 題" })).toBeInTheDocument();
        expect(screen.getByRole("img")).toHaveAttribute("src", firstImageUrl);
        fireEvent.click(screen.getByRole("button", { name: "模擬完整回答" }));
        expect(await screen.findByRole("heading", { name: "太棒了，全部完成！" })).toBeInTheDocument();
        expect(onComplete).toHaveBeenCalledTimes(3);
    });

    it("重開看圖關卡時只重試沒有通過的題目", async () => {
        jest.spyOn(Math, "random").mockReturnValue(0);
        const questions = [1, 2].map(id => ({
            id,
            sort_order: id,
            visual_aid: { ...privateVisual, alt_zh: `圖片 ${id}` },
            picture_interaction: { type: "picture_qa" },
            progress_status: "opened"
        }));
        render(<WorkbookOnePictureChallenge correctPauseMs={0} challenge={{ id: 21, title: "P21", generation_metadata: { interaction_type: "picture_qa" }, speaking_questions: questions }}
            firebaseUser={{ uid: "student" }} onComplete={jest.fn().mockResolvedValue(true)} onExit={jest.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "模擬完整回答" })); await Promise.resolve(); });
        await screen.findByRole("article", { name: "第 2 題，共 2 題" });
        fireEvent.click(screen.getByRole("button", { name: "模擬不完整回答" }));
        fireEvent.click(screen.getByRole("button", { name: "先看下一題" }));
        expect(screen.getByText("已完成 1／2 題")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "只剩 1 題，再試一次！" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "再挑戰這 1 題" }));
        expect(screen.getByRole("article", { name: "第 1 題，共 1 題" })).toBeInTheDocument();
    });

    it("挑戰進行中按退出本輪要先確認，取消留在本輪，確定才離開", () => {
        const onExit = jest.fn();
        render(<WorkbookOnePictureChallenge correctPauseMs={0} challenge={{ id: 21, title: "P21", generation_metadata: { interaction_type: "picture_qa" },
            speaking_questions: [{ id: 1, visual_aid: privateVisual, picture_interaction: { type: "picture_qa" } }] }}
            firebaseUser={{ uid: "student" }} onComplete={jest.fn()} onExit={onExit} />);
        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        fireEvent.click(screen.getByRole("button", { name: "退出本輪" }));
        const dialog = screen.getByRole("alertdialog", { name: "確定要離開這一輪嗎？" });
        expect(screen.getByRole("button", { name: "取消" })).toHaveFocus();
        fireEvent.click(screen.getByRole("button", { name: "取消" }));
        expect(dialog).not.toBeInTheDocument();
        expect(onExit).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "退出本輪" }));
        fireEvent.click(screen.getByRole("button", { name: "確定離開" }));
        expect(onExit).toHaveBeenCalledTimes(1);
    });

    it("P22 學生看圖補句即使舊回應含網址也不顯示播放入口", () => {
        render(<WorkbookOnePictureChallenge correctPauseMs={0}
            challenge={{
                id: 22, title: "P22 看圖補句", generation_metadata: { interaction_type: "picture_gap_sentence" },
                speaking_questions: [{ id: 2201, sort_order: 0, visual_aid: privateVisual, picture_interaction: {
                    type: "picture_gap_sentence", sentence_pattern: "The ____ is in the tree.",
                    sentence_audio_url: "https://r2.example/sentence.wav"
                } }]
            }}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn()}
            onExit={jest.fn()}
        />);
        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        expect(screen.getByText("The")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /播放整句發音/ })).not.toBeInTheDocument();
    });

    it("看圖補句第一級先挖空拼字、拼對才顯示完整句子；第二級顯示圖片與挖空句", () => {
        const gapChallenge = { id: 22, title: "P22 看圖補句", generation_metadata: { interaction_type: "picture_gap_sentence" },
            speaking_questions: [{ id: 2201, sort_order: 0, visual_aid: privateVisual, model_answer: "The apple is in the tree.", picture_interaction: {
                type: "picture_gap_sentence", sentence_pattern: "The ____ is in the tree." } }] };
        const { unmount } = render(<WorkbookOnePictureChallenge correctPauseMs={0} challenge={gapChallenge} challengeMode="easy" firebaseUser={{ uid: "student" }} onComplete={jest.fn()} onExit={jest.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        expect(screen.getByRole("img", { name: "樹上的蘋果" })).toBeInTheDocument();
        // 先拼字：此時只看得到挖空句，看不到 apple。
        expect(screen.getByLabelText(/要補上的答案/)).toBeInTheDocument();
        expect(screen.queryByText("apple")).not.toBeInTheDocument();
        "apple".split("").forEach(letter => fireEvent.click(screen.getAllByRole("button", { name: `字母 ${letter}` }).find(button => !button.disabled)));
        fireEvent.click(screen.getByRole("button", { name: /下一步：看著句子念/ }));
        expect(screen.getByLabelText("The apple is in the tree.")).toHaveClass("is-full");
        expect(screen.getByText("apple")).toBeInTheDocument();
        expect(screen.queryByLabelText(/要補上的答案/)).not.toBeInTheDocument();
        expect(screen.queryByLabelText("跟著念參考答案")).not.toBeInTheDocument();
        unmount();
        const challenge = { ...gapChallenge, speaking_questions: [{ ...gapChallenge.speaking_questions[0], model_answer: "" }] };
        render(<WorkbookOnePictureChallenge correctPauseMs={0} challenge={challenge} challengeMode="challenge" firebaseUser={{ uid: "student" }} onComplete={jest.fn()} onExit={jest.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        expect(screen.getByRole("img", { name: "樹上的蘋果" })).toBeInTheDocument();
        expect(screen.getByLabelText(/要補上的答案/)).toBeInTheDocument();
        expect(screen.queryByText("apple")).not.toBeInTheDocument();
    });

    it("P22 工作人員預覽保留停頓整句播放，句型單字不可點選且完整句才完成", async () => {
        const audioInstances = [];
        global.Audio = jest.fn().mockImplementation(() => {
            const audio = { play: jest.fn().mockResolvedValue(undefined), pause: jest.fn(), onended: null, onerror: null };
            audioInstances.push(audio);
            return audio;
        });
        const onComplete = jest.fn().mockResolvedValue(true);
        render(<WorkbookOnePictureChallenge correctPauseMs={0}
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
                        sentence_pattern: "The ____ is in the ____.",
                        sentence_audio_url: "https://r2.example/sentence.wav"
                    }
                }]
            }}
            firebaseUser={{ uid: "student" }}
            staffAudioPreview
            onComplete={onComplete}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        expect(screen.getByRole("img", { name: "樹上的蘋果" })).toBeInTheDocument();
        expect(screen.getByText("（樹上的蘋果）")).toHaveClass("speaking-gap-cue");
        screen.getAllByLabelText("要補上的答案").forEach(blank => {
            expect(blank).toHaveTextContent("____");
        });
        expect(screen.queryByRole("button", { name: /apple/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /播放 The 的發音/ })).not.toBeInTheDocument();
        expect(screen.getByText("The")).toBeInTheDocument();
        expect(screen.getByText("the")).toBeInTheDocument();
        expect(screen.getAllByLabelText("要補上的答案")).toHaveLength(2);

        fireEvent.click(screen.getByRole("button", { name: "播放整句發音；每個挖空處停留 2 秒" }));
        expect(global.Audio).toHaveBeenLastCalledWith("https://r2.example/sentence.wav");
        expect(audioInstances.at(-1).play).toHaveBeenCalledTimes(1);
        act(() => audioInstances.at(-1).onended());
        expect(global.Audio).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole("button", { name: "模擬不完整回答" }));
        expect(onComplete).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "模擬完整回答" }));
        expect(await screen.findByRole("heading", { name: "太棒了，全部完成！" })).toBeInTheDocument();
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ id: 2201 }),
            expect.objectContaining({ answer_match: true, recognized_text: "complete" }), expect.stringMatching(/^[0-9a-f-]{36}$/)
        );
    });

    it("P22 整句播放被瀏覽器拒絕後會解鎖並允許重試", async () => {
        const blockedAudio = { play: jest.fn().mockRejectedValue(new Error("blocked")), pause: jest.fn(), onended: null, onerror: null };
        const retryAudio = { play: jest.fn().mockResolvedValue(undefined), pause: jest.fn(), onended: null, onerror: null };
        global.Audio = jest.fn()
            .mockImplementationOnce(() => blockedAudio)
            .mockImplementationOnce(() => retryAudio);
        render(<WorkbookOnePictureChallenge correctPauseMs={0}
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
                        sentence_audio_url: "https://r2.example/sentence.wav"
                    }
                }]
            }}
            firebaseUser={{ uid: "student" }}
            staffAudioPreview
            onComplete={jest.fn().mockResolvedValue(true)}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        expect(screen.getByRole("img", { name: "樹上的蘋果" })).toBeInTheDocument();
        expect(screen.getByLabelText("要補上的答案：樹上的蘋果")).toHaveTextContent("樹上的蘋果");
        expect(screen.queryByText("（樹上的蘋果）")).not.toBeInTheDocument();
        const sentenceButton = screen.getByRole("button", { name: "播放整句發音；每個挖空處停留 2 秒" });
        fireEvent.click(sentenceButton);
        expect(await screen.findByRole("alert")).toHaveTextContent("瀏覽器阻擋了播放，請再按一次聽整句。");
        await waitFor(() => expect(sentenceButton).toBeEnabled());

        fireEvent.click(sentenceButton);
        expect(global.Audio).toHaveBeenCalledTimes(2);
        expect(retryAudio.play).toHaveBeenCalledTimes(1);
        act(() => retryAudio.onended());
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("P22 整句音檔載入錯誤後會解鎖並允許重試", async () => {
        const failedAudio = { play: jest.fn().mockResolvedValue(undefined), pause: jest.fn(), onended: null, onerror: null };
        const retryAudio = { play: jest.fn().mockResolvedValue(undefined), pause: jest.fn(), onended: null, onerror: null };
        global.Audio = jest.fn()
            .mockImplementationOnce(() => failedAudio)
            .mockImplementationOnce(() => retryAudio);
        render(<WorkbookOnePictureChallenge correctPauseMs={0}
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
                        sentence_audio_url: "https://r2.example/sentence.wav"
                    }
                }]
            }}
            firebaseUser={{ uid: "student" }}
            staffAudioPreview
            onComplete={jest.fn().mockResolvedValue(true)}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        const sentenceButton = screen.getByRole("button", { name: "播放整句發音；每個挖空處停留 2 秒" });
        fireEvent.click(sentenceButton);
        act(() => failedAudio.onerror());
        expect(await screen.findByRole("alert")).toHaveTextContent("整句發音暫時無法播放，請稍後再試。");
        expect(sentenceButton).toBeEnabled();

        fireEvent.click(sentenceButton);
        expect(global.Audio).toHaveBeenCalledTimes(2);
        expect(retryAudio.play).toHaveBeenCalledTimes(1);
        act(() => retryAudio.onended());
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});

describe("pictureCueZh", () => {
    const { pictureCueZh } = require("./WorkbookOnePictureChallenge");
    it.each([
        ["一把鑰匙", "鑰匙"],
        ["一顆蘋果和一棵蘋果樹", "蘋果"],
        ["一隻黃色小鴨和池塘", "黃色小鴨"],
        ["外婆", "外婆"],
        ["", ""],
        [null, ""]
    ])("turns %s into the cue %s", (alt, cue) => {
        expect(pictureCueZh(alt)).toBe(cue);
    });
});
