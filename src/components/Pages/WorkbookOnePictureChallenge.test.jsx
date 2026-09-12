import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import WorkbookOnePictureChallenge from "./WorkbookOnePictureChallenge";

jest.mock("./SpeakingPracticeSteps", () => function Practice({ interactionType, hideHelp, onCompleted }) {
    return <div>
        <span>{interactionType}</span>
        <span>{hideHelp ? "不顯示答案提示" : "顯示答案提示"}</span>
        <button type="button" onClick={() => onCompleted({ answer_match: true })}>模擬答對</button>
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
        expect(screen.getByRole("img", { name: "樹上的蘋果" })).toHaveAttribute("src", privateVisual.image_url);
        expect(screen.queryByText("樹上的蘋果")).not.toBeInTheDocument();
        expect(screen.queryByText(/What is it/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/It is an apple/i)).not.toBeInTheDocument();
        expect(screen.getByText("不顯示答案提示")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "模擬答對" }));
        expect(await screen.findByRole("heading", { name: "太棒了，全部完成！" })).toBeInTheDocument();
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 2101 }), { answer_match: true });
    });

    it("P22 只讓可見單字播放發音，答案空格保持不可播放", () => {
        const play = jest.fn().mockResolvedValue(undefined);
        global.Audio = jest.fn().mockImplementation(() => ({ play, pause: jest.fn(), onended: null, onerror: null }));
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
                        word_audio: [{ token_index: 0, word: "The", audio_url: "https://r2.example/the.mp3" }]
                    }
                }]
            }}
            firebaseUser={{ uid: "student" }}
            onComplete={jest.fn().mockResolvedValue(true)}
            onExit={jest.fn()}
        />);

        fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
        expect(screen.getByLabelText("請依圖片補上的答案")).toHaveTextContent("____");
        expect(screen.queryByRole("button", { name: /apple/i })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "播放 is 的發音" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "播放 The 的發音" }));
        expect(global.Audio).toHaveBeenCalledWith("https://r2.example/the.mp3");
        expect(play).toHaveBeenCalledTimes(1);
    });
});
