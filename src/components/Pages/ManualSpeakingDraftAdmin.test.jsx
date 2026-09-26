import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ManualSpeakingDraftAdmin from "./ManualSpeakingDraftAdmin";
import { toast } from "react-toastify";
import {
    createManualPageSpeakingDraft,
    generateSpeakingQuestionSetAudio,
    generateSpeakingVisibleWordAudio,
    uploadSpeakingQuestionPicture
} from "../../services/speakingContentService";

jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock("../../services/speakingContentService", () => ({
    createManualPageSpeakingDraft: jest.fn(),
    generateSpeakingQuestionSetAudio: jest.fn(),
    generateSpeakingVisibleWordAudio: jest.fn(),
    uploadSpeakingQuestionPicture: jest.fn()
}));

describe("ManualSpeakingDraftAdmin", () => {
    const firebaseUser = { uid: "admin" };
    const renderBuilder = () => render(<ManualSpeakingDraftAdmin firebaseUser={firebaseUser} books={[{ id: 3, name: "Workbook 3", enabled: true }]} onCreated={jest.fn()} />);
    const fillPage = () => {
        fireEvent.change(screen.getByLabelText("教材"), { target: { value: "3" } });
        fireEvent.change(screen.getByLabelText("學生版頁碼"), { target: { value: "P4" } });
        fireEvent.change(screen.getByLabelText("關卡名稱"), { target: { value: "P4 身體部位" } });
        fireEvent.change(screen.getByLabelText("主題"), { target: { value: "身體部位" } });
    };
    beforeEach(() => {
        jest.clearAllMocks();
        createManualPageSpeakingDraft.mockResolvedValue({ question_set_id: 81, questions: [{ id: 811, sort_order: 0 }] });
        generateSpeakingQuestionSetAudio.mockResolvedValue({ success: true });
        generateSpeakingVisibleWordAudio.mockResolvedValue({ success: true });
        uploadSpeakingQuestionPicture.mockResolvedValue({ success: true });
    });

    it("shows per-field errors before any draft is created", () => {
        renderBuilder();
        fireEvent.click(screen.getByRole("button", { name: "建立未發布草稿" }));
        expect(screen.getByRole("alert")).toHaveTextContent("目前無法建立草稿");
        expect(screen.getByText("請選擇教材", { selector: "small" })).toBeInTheDocument();
        expect(screen.getByText("請輸入學生看到的題目", { selector: "small" })).toBeInTheDocument();
        expect(createManualPageSpeakingDraft).not.toHaveBeenCalled();
    });

    it("allows one page to contain mixed question types and shows them in final confirmation", () => {
        renderBuilder();
        fillPage();
        fireEvent.change(screen.getByLabelText("題型"), { target: { value: "standard_sentence" } });
        fireEvent.change(screen.getByLabelText("完整朗讀句子"), { target: { value: "This is my nose." } });
        fireEvent.click(screen.getByRole("button", { name: "新增一題" }));
        fireEvent.change(screen.getAllByLabelText("題型")[1], { target: { value: "picture_qa" } });
        fireEvent.change(screen.getByLabelText("完整問句"), { target: { value: "What is this?" } });
        fireEvent.change(screen.getByLabelText("完整回答"), { target: { value: "It is an eye." } });
        fireEvent.change(screen.getByLabelText("圖片替代文字"), { target: { value: "一隻眼睛" } });
        fireEvent.change(document.querySelectorAll('input[type="file"]')[0], { target: { files: [new File(["image"], "eye.png", { type: "image/png" })] } });
        fireEvent.click(screen.getByRole("button", { name: "建立未發布草稿" }));
        const dialog = screen.getByRole("dialog", { name: "確認建立未發布草稿" });
        expect(dialog).toHaveTextContent("P4");
        expect(dialog).toHaveTextContent("完整句朗讀");
        expect(dialog).toHaveTextContent("看圖說完整問答");
    });

    it("opens the local high-resolution PDF crop tool only for a picture question", () => {
        renderBuilder();
        expect(screen.getByRole("button", { name: "從 PDF 高解析擷取圖片" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "從 PDF 高解析擷取圖片" }));
        expect(screen.getByRole("region", { name: "從 PDF 高解析擷取圖片" })).toHaveTextContent("PDF 只在目前瀏覽器繪製");
        expect(screen.getByLabelText("教材 PDF")).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("題型"), { target: { value: "standard_sentence" } });
        expect(screen.queryByRole("button", { name: "從 PDF 高解析擷取圖片" })).not.toBeInTheDocument();
    });

    it("creates a no-image text question draft without answer audio", async () => {
        renderBuilder();
        fillPage();
        fireEvent.change(screen.getByLabelText("題型"), { target: { value: "text_qa" } });
        expect(screen.queryByText("題目圖片")).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("學生看到的完整問句（可加入中文提示）"), { target: { value: "What is seven minus two?（七減二）" } });
        fireEvent.change(screen.getByLabelText("完整示範回答（學生作答前不顯示）"), { target: { value: "Seven minus two is five." } });
        fireEvent.click(screen.getByRole("button", { name: "建立未發布草稿" }));
        expect(screen.getByRole("dialog", { name: "確認建立未發布草稿" })).toHaveTextContent("無圖片文字問答");
        fireEvent.click(screen.getByRole("button", { name: "確認建立未發布草稿" }));
        await waitFor(() => expect(createManualPageSpeakingDraft).toHaveBeenCalledWith(firebaseUser, expect.objectContaining({
            confirmed: true,
            questions: [expect.objectContaining({ interaction_type: "text_qa", prompt_text: "What is seven minus two?（七減二）", answer_text: "Seven minus two is five." })]
        })));
        expect(generateSpeakingQuestionSetAudio).not.toHaveBeenCalled();
        expect(uploadSpeakingQuestionPicture).not.toHaveBeenCalled();
    });

    it("rejects mixing no-image text questions with other types", () => {
        renderBuilder();
        fillPage();
        fireEvent.change(screen.getByLabelText("題型"), { target: { value: "text_qa" } });
        fireEvent.change(screen.getByLabelText("學生看到的完整問句（可加入中文提示）"), { target: { value: "What is seven minus two?" } });
        fireEvent.change(screen.getByLabelText("完整示範回答（學生作答前不顯示）"), { target: { value: "Seven minus two is five." } });
        fireEvent.click(screen.getByRole("button", { name: "新增一題" }));
        fireEvent.change(screen.getAllByLabelText("題型")[1], { target: { value: "standard_sentence" } });
        fireEvent.change(screen.getByLabelText("完整朗讀句子"), { target: { value: "Five." } });
        fireEvent.click(screen.getByRole("button", { name: "建立未發布草稿" }));
        expect(screen.getByRole("alert")).toHaveTextContent("不能與其他題型混用");
        expect(createManualPageSpeakingDraft).not.toHaveBeenCalled();
    });

    it("creates only a draft, uploads the matching private image, and keeps it when audio needs retry", async () => {
        generateSpeakingVisibleWordAudio.mockResolvedValue({ success: false });
        renderBuilder();
        fillPage();
        fireEvent.change(screen.getByLabelText("學生看到的題目（用 ____ 標示挖空）"), { target: { value: "They ____ her ____." } });
        fireEvent.change(screen.getByLabelText("補好答案的完整句子"), { target: { value: "They are her eyes." } });
        fireEvent.change(screen.getByLabelText("圖片替代文字"), { target: { value: "一雙眼睛" } });
        fireEvent.change(document.querySelectorAll('input[type="file"]')[0], { target: { files: [new File(["image"], "eyes.png", { type: "image/png" })] } });
        fireEvent.click(screen.getByRole("button", { name: "建立未發布草稿" }));
        fireEvent.click(screen.getByRole("button", { name: "確認建立未發布草稿" }));
        await waitFor(() => expect(createManualPageSpeakingDraft).toHaveBeenCalledWith(firebaseUser, expect.objectContaining({
            book_id: 3, page_label: "P4", confirmed: true,
            questions: [expect.objectContaining({ interaction_type: "picture_gap_sentence", prompt_text: "They ____ her ____." })]
        })));
        expect(uploadSpeakingQuestionPicture).toHaveBeenCalledWith(firebaseUser, 811, "P4", "一雙眼睛", expect.any(File));
        expect(generateSpeakingVisibleWordAudio).toHaveBeenCalledWith(firebaseUser, 81);
        expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("草稿已保留"));
    });
});
