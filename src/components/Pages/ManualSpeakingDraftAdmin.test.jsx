import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ManualSpeakingDraftAdmin from "./ManualSpeakingDraftAdmin";
import { toast } from "react-toastify";
import {
    createManualSpeakingDraft,
    discardWorkbookOnePictureDraft,
    generateSpeakingQuestionSetAudio
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
});
