import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BatchSpeakingDraftAdmin from "./BatchSpeakingDraftAdmin";
import { createManualPageSpeakingDraft } from "../../services/speakingContentService";

jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../../services/speakingContentService", () => ({ createManualPageSpeakingDraft: jest.fn() }));

describe("BatchSpeakingDraftAdmin", () => {
    it("validates a reviewed JSON file and creates each page as an unpublished text draft", async () => {
        createManualPageSpeakingDraft
            .mockResolvedValueOnce({ question_set_id: 301 })
            .mockResolvedValueOnce({ question_set_id: 302 });
        const onCreated = jest.fn();
        render(<BatchSpeakingDraftAdmin firebaseUser={{ uid: "admin" }} books={[
            { id: 3, name: "Workbook 3", enabled: true },
            { id: 4, name: "Workbook 4", enabled: true }
        ]} onCreated={onCreated} />);
        const manifest = [
            { workbook: 3, page: 15, questions: [{ prompt_mode: "english_qa", prompt_text: "What is this?", answer_text: "It is a book." }] },
            { workbook: 4, page: 89, questions: [{ prompt_mode: "grammar_cue", prompt_text: "is, am ______", answer_text: "It was Thursday." }] }
        ];
        const file = new File([JSON.stringify(manifest)], "reviewed.json", { type: "application/json" });
        fireEvent.change(screen.getByLabelText("選擇已核對 JSON"), { target: { files: [file] } });
        expect(await screen.findByText(/2 頁／2 題/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "建立 2 份未發布草稿" }));
        await waitFor(() => expect(createManualPageSpeakingDraft).toHaveBeenCalledTimes(2));
        expect(createManualPageSpeakingDraft).toHaveBeenNthCalledWith(2, { uid: "admin" }, expect.objectContaining({
            book_id: 4, page_label: "P89", confirmed: true,
            questions: [expect.objectContaining({ interaction_type: "text_qa", prompt_mode: "grammar_cue" })]
        }));
        expect(await screen.findByText("成功 2 頁／失敗 0 頁。")).toBeInTheDocument();
        expect(onCreated).toHaveBeenCalledWith(302);
    });
});
