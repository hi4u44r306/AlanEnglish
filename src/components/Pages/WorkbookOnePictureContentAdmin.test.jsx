import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-toastify";
import WorkbookOnePictureContentAdmin from "./WorkbookOnePictureContentAdmin";
import {
    createWorkbookOnePictureDraft,
    discardWorkbookOnePictureDraft,
    generateSpeakingVisibleWordAudio,
    uploadSpeakingQuestionPicture
} from "../../services/speakingContentService";

jest.mock("../../services/speakingContentService", () => ({
    createWorkbookOnePictureDraft: jest.fn(),
    discardWorkbookOnePictureDraft: jest.fn(),
    generateSpeakingVisibleWordAudio: jest.fn(),
    uploadSpeakingQuestionPicture: jest.fn()
}));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

describe("WorkbookOnePictureContentAdmin", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createWorkbookOnePictureDraft.mockResolvedValue({
            question_set_id: 21,
            questions: [{ id: 101, sort_order: 0 }, { id: 102, sort_order: 1 }, { id: 103, sort_order: 2 }]
        });
        uploadSpeakingQuestionPicture.mockResolvedValue({ success: true });
        discardWorkbookOnePictureDraft.mockResolvedValue({ success: true });
        generateSpeakingVisibleWordAudio.mockResolvedValue({ success: true, failed: 0 });
    });

    it("沒有三題完整圖片與人工確認時不能建立 P21 草稿", () => {
        render(<WorkbookOnePictureContentAdmin firebaseUser={{ uid: "admin" }} workbookOne={{ id: 1 }} />);
        expect(screen.getAllByLabelText("經核准圖片")).toHaveLength(3);
        expect(screen.getByRole("button", { name: "建立 P21 草稿並上傳私人圖片" })).toBeDisabled();
    });

    it("只把人工輸入的 P21 內容建成草稿，再逐題上傳私人圖片", async () => {
        const onCreated = jest.fn();
        render(<WorkbookOnePictureContentAdmin firebaseUser={{ uid: "admin" }} workbookOne={{ id: 1 }} onCreated={onCreated} />);
        const prompts = screen.getAllByLabelText("完整問句");
        const answers = screen.getAllByLabelText("完整回答");
        const alts = screen.getAllByLabelText("圖片替代文字（繁體中文）");
        const files = screen.getAllByLabelText("經核准圖片");
        for (let index = 0; index < 3; index += 1) {
            fireEvent.change(prompts[index], { target: { value: "What is that?" } });
            fireEvent.change(answers[index], { target: { value: `It is item ${index + 1}.` } });
            fireEvent.change(alts[index], { target: { value: `教材圖片 ${index + 1}` } });
            fireEvent.change(files[index], { target: { files: [new File(["image"], `item-${index + 1}.png`, { type: "image/png" })] } });
        }
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(screen.getByRole("button", { name: "建立 P21 草稿並上傳私人圖片" }));

        await waitFor(() => expect(createWorkbookOnePictureDraft).toHaveBeenCalledWith(
            { uid: "admin" },
            expect.objectContaining({
                book_id: 1, interaction_type: "picture_qa", page_label: "P21", confirmed: true,
                questions: expect.arrayContaining([expect.objectContaining({ prompt_text: "What is that?" })])
            })
        ));
        await waitFor(() => expect(uploadSpeakingQuestionPicture).toHaveBeenCalledTimes(3));
        expect(generateSpeakingVisibleWordAudio).not.toHaveBeenCalled();
        expect(onCreated).toHaveBeenCalled();
    });

    it("P22 會要求挖空句型並在圖片完成後產生可見單字音檔", async () => {
        render(<WorkbookOnePictureContentAdmin firebaseUser={{ uid: "admin" }} workbookOne={{ id: 1 }} onCreated={jest.fn()} />);
        fireEvent.change(screen.getByLabelText("活動類型"), { target: { value: "picture_gap_sentence" } });
        const prompts = screen.getAllByLabelText("挖空句型");
        const answers = screen.getAllByLabelText("補好答案的完整句子");
        const alts = screen.getAllByLabelText("圖片替代文字（繁體中文）");
        const files = screen.getAllByLabelText("經核准圖片");
        for (let index = 0; index < 3; index += 1) {
            fireEvent.change(prompts[index], { target: { value: "The ____ is in the tree." } });
            fireEvent.change(answers[index], { target: { value: "The apple is in the tree." } });
            fireEvent.change(alts[index], { target: { value: `樹上的教材圖片 ${index + 1}` } });
            fireEvent.change(files[index], { target: { files: [new File(["image"], `tree-${index + 1}.webp`, { type: "image/webp" })] } });
        }
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(screen.getByRole("button", { name: "建立 P22 草稿並上傳私人圖片" }));

        await waitFor(() => expect(generateSpeakingVisibleWordAudio).toHaveBeenCalledWith({ uid: "admin" }, 21));
    });

    it("圖片上傳中途失敗時會回復未發布草稿，避免留下無法重試的半套資料", async () => {
        uploadSpeakingQuestionPicture.mockRejectedValueOnce(new Error("圖片上傳中斷"));
        render(<WorkbookOnePictureContentAdmin firebaseUser={{ uid: "admin" }} workbookOne={{ id: 1 }} onCreated={jest.fn()} />);
        const prompts = screen.getAllByLabelText("完整問句");
        const answers = screen.getAllByLabelText("完整回答");
        const alts = screen.getAllByLabelText("圖片替代文字（繁體中文）");
        const files = screen.getAllByLabelText("經核准圖片");
        for (let index = 0; index < 3; index += 1) {
            fireEvent.change(prompts[index], { target: { value: "What is that?" } });
            fireEvent.change(answers[index], { target: { value: `It is item ${index + 1}.` } });
            fireEvent.change(alts[index], { target: { value: `教材圖片 ${index + 1}` } });
            fireEvent.change(files[index], { target: { files: [new File(["image"], `item-${index + 1}.png`, { type: "image/png" })] } });
        }
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(screen.getByRole("button", { name: "建立 P21 草稿並上傳私人圖片" }));

        await waitFor(() => expect(discardWorkbookOnePictureDraft).toHaveBeenCalledWith({ uid: "admin" }, 21));
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("未完成草稿已安全回復"));
    });
});
