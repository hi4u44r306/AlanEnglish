import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ManualSpeakingDraftAdmin from "./ManualSpeakingDraftAdmin";
import { toast } from "react-toastify";
import {
    createManualSpeakingDraft,
    discardWorkbookOnePictureDraft,
    generateSpeakingQuestionSetAudio,
    generateSpeakingVisibleWordAudio
} from "../../services/speakingContentService";

jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock("../../services/speakingContentService", () => ({
    createManualSpeakingDraft: jest.fn(),
    discardWorkbookOnePictureDraft: jest.fn(),
    generateSpeakingQuestionSetAudio: jest.fn(),
    generateSpeakingVisibleWordAudio: jest.fn(),
    uploadSpeakingQuestionPicture: jest.fn()
}));

describe("ManualSpeakingDraftAdmin", () => {
    const firebaseUser = { uid: "admin" };

    beforeEach(() => {
        jest.clearAllMocks();
        createManualSpeakingDraft.mockResolvedValue({
            question_set_id: 81,
            questions: [
                { id: 811, sort_order: 1 },
                { id: 812, sort_order: 2 },
                { id: 813, sort_order: 3 }
            ]
        });
        generateSpeakingQuestionSetAudio.mockResolvedValue({ success: true });
        generateSpeakingVisibleWordAudio.mockResolvedValue({ success: true });
    });

    it("allows a complete draft to be created without an extra confirmation checkbox", async () => {
        const onCreated = jest.fn();
        render(<ManualSpeakingDraftAdmin
            firebaseUser={firebaseUser}
            books={[{ id: 1, name: "Workbook 1", enabled: true }]}
            onCreated={onCreated}
        />);

        expect(screen.queryByText(/我已確認教材、頁碼、所有句子/)).not.toBeInTheDocument();
        const submitButton = screen.getByRole("button", { name: "建立未發布草稿" });
        expect(submitButton).toBeDisabled();

        fireEvent.change(screen.getByLabelText("教材"), { target: { value: "1" } });
        fireEvent.change(screen.getByLabelText("活動類型"), { target: { value: "standard_sentence" } });
        fireEvent.change(screen.getByLabelText("關卡名稱"), { target: { value: "P30 完整句" } });
        fireEvent.change(screen.getByLabelText("主題"), { target: { value: "教室用品" } });
        screen.getAllByLabelText("完整朗讀句子").forEach((input, index) => {
            fireEvent.change(input, { target: { value: `This is sentence ${index + 1}.` } });
        });

        expect(submitButton).toBeEnabled();
        fireEvent.click(submitButton);

        await waitFor(() => expect(createManualSpeakingDraft).toHaveBeenCalledWith(
            firebaseUser,
            expect.objectContaining({
                book_id: 1,
                confirmed: true,
                interaction_type: "standard_sentence",
                questions: [
                    expect.objectContaining({ full_sentence: "This is sentence 1." }),
                    expect.objectContaining({ full_sentence: "This is sentence 2." }),
                    expect.objectContaining({ full_sentence: "This is sentence 3." })
                ]
            })
        ));
        expect(generateSpeakingQuestionSetAudio).toHaveBeenCalledWith(firebaseUser, 81);
        await waitFor(() => expect(onCreated).toHaveBeenCalledWith(81));
    });

    it("keeps the completed draft when audio generation needs a retry", async () => {
        const onCreated = jest.fn();
        generateSpeakingQuestionSetAudio.mockResolvedValue({ success: false, failed: 1 });
        render(<ManualSpeakingDraftAdmin
            firebaseUser={firebaseUser}
            books={[{ id: 1, name: "Workbook 1", enabled: true }]}
            onCreated={onCreated}
        />);

        fireEvent.change(screen.getByLabelText("教材"), { target: { value: "1" } });
        fireEvent.change(screen.getByLabelText("活動類型"), { target: { value: "standard_sentence" } });
        fireEvent.change(screen.getByLabelText("關卡名稱"), { target: { value: "P28 顏色" } });
        fireEvent.change(screen.getByLabelText("主題"), { target: { value: "顏色" } });
        screen.getAllByLabelText("完整朗讀句子").forEach((input, index) => {
            fireEvent.change(input, { target: { value: `This is sentence ${index + 1}.` } });
        });
        fireEvent.click(screen.getByRole("button", { name: "建立未發布草稿" }));

        await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("草稿與圖片已保留")));
        expect(discardWorkbookOnePictureDraft).not.toHaveBeenCalled();
        expect(onCreated).toHaveBeenCalledWith(81);
    });

    it("lets Workbook 3 create its first page-based draft with full-width blank markers", async () => {
        const { container } = render(<ManualSpeakingDraftAdmin
            firebaseUser={firebaseUser}
            books={[{ id: 3, name: "Workbook 3", enabled: true }]}
            onCreated={jest.fn()}
        />);

        fireEvent.change(screen.getByLabelText("教材"), { target: { value: "3" } });
        expect(screen.getByText(/這本教材的第一個關卡發布後/)).toHaveTextContent("Workbook 3");
        fireEvent.change(screen.getByLabelText("關卡名稱"), { target: { value: "P30 多挖空" } });
        fireEvent.change(screen.getByLabelText("主題"), { target: { value: "身體部位" } });
        screen.getAllByLabelText("學生看到的題目（用 ____ 標示挖空）").forEach(input => {
            fireEvent.change(input, { target: { value: "They ＿＿＿＿ her ＿＿＿＿. (眼睛)" } });
        });
        screen.getAllByLabelText("補好答案的完整句子").forEach(input => {
            fireEvent.change(input, { target: { value: "They are her eyes. (眼睛)" } });
        });
        screen.getAllByLabelText("圖片替代文字").forEach(input => {
            fireEvent.change(input, { target: { value: "女孩的眼睛" } });
        });
        container.querySelectorAll('input[type="file"]').forEach(input => {
            fireEvent.change(input, { target: { files: [new File(["image"], "eyes.png", { type: "image/png" })] } });
        });

        const submitButton = screen.getByRole("button", { name: "建立未發布草稿" });
        expect(submitButton).toBeEnabled();
        fireEvent.click(submitButton);

        await waitFor(() => expect(createManualSpeakingDraft).toHaveBeenCalledWith(
            firebaseUser,
            expect.objectContaining({
                book_id: 3,
                interaction_type: "picture_gap_sentence",
                questions: expect.arrayContaining([
                    expect.objectContaining({
                        prompt_text: "They ____ her ____. (眼睛)",
                        answer_text: "They are her eyes. (眼睛)"
                    })
                ])
            })
        ));
        expect(generateSpeakingVisibleWordAudio).toHaveBeenCalledWith(firebaseUser, 81);
    });
});
