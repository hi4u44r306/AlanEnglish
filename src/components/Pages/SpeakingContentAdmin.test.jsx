import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SpeakingContentAdmin from "./SpeakingContentAdmin";
import { createWorkbookOneStarterQuestionSet, getSpeakingContentBootstrap } from "../../services/speakingContentService";

const mockFirebaseUser = { uid: "admin" };
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: mockFirebaseUser }) }));
jest.mock("../../services/speakingContentService", () => ({
    createWorkbookOneStarterQuestionSet: jest.fn(),
    getSpeakingContentBootstrap: jest.fn(),
    extractSpeakingSourceDocument: jest.fn(), extractSpeakingBookChunk: jest.fn(),
    publishSpeakingQuestionSet: jest.fn(), generateSpeakingQuestionSetAudio: jest.fn(), reviewSpeakingOcrSource: jest.fn(),
    saveReviewedSpeakingSource: jest.fn(), uploadAndExtractSpeakingSource: jest.fn(),
    uploadWholeBookSource: jest.fn(), updateDraftSpeakingQuestion: jest.fn(),
    generateSpeakingQuestionSet: jest.fn()
}));

describe("SpeakingContentAdmin whole-book OCR", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createWorkbookOneStarterQuestionSet.mockResolvedValue({ success: true, reused: false });
        getSpeakingContentBootstrap.mockResolvedValue({
        books: [{ id: 1, name: "Workbook 1", code: "Workbook_1" }, { id: 2, name: "Workbook 2", code: "Workbook_2" }],
        documents: [{ id: 20, book_id: 2, title: "Workbook 2 口說大關卡", page_count: 115, chunk_count: 12 }],
        chunks: [
            { id: 21, document_id: 20, chunk_index: 0, page_from: 1, page_to: 10, status: "uploaded" },
            { id: 22, document_id: 20, chunk_index: 1, page_from: 11, page_to: 20, status: "failed" }
        ],
        sections: [], question_sets: []
        });
    });

    it("shows persistent batch progress and a per-batch retry control", async () => {
        render(<SpeakingContentAdmin />);
        expect(await screen.findByRole("heading", { name: "整本教材分批辨識" })).toBeInTheDocument();
        expect(await screen.findByText("整本教材 · 115 頁")).toBeInTheDocument();
        expect(screen.getByText("P1–P10")).toBeInTheDocument();
        expect(screen.getByText("辨識失敗")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "重試第 2 批" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "開始批次 OCR" })).toBeInTheDocument();
    });

    it("creates the curated Workbook 1 starter without asking AI to generate it", async () => {
        render(<SpeakingContentAdmin />);
        const createButton = await screen.findByRole("button", { name: "建立範例草稿" });
        await waitFor(() => expect(createButton).toBeEnabled());
        fireEvent.click(createButton);

        await waitFor(() => expect(createWorkbookOneStarterQuestionSet).toHaveBeenCalledWith(mockFirebaseUser, 1));
    });

    it("shows a student-facing preview for an editable starter draft", async () => {
        getSpeakingContentBootstrap.mockResolvedValueOnce({
            books: [{ id: 1, name: "Workbook 1", code: "Workbook_1" }],
            documents: [{ id: 10, book_id: 1, title: "Workbook 1 口說大挑戰", chunk_count: 0 }], chunks: [],
            sections: [{ id: 11, document_id: 10, topic: "我的名字與自我介紹", unit_label: "Starter 01", page_from_label: "P18", page_to_label: "P20", language_level: "國小低年級", status: "reviewed" }],
            question_sets: [{
                id: 12, source_section_id: 11, title: "01 我的名字與自我介紹", status: "draft", version: 1,
                generation_metadata: { template_key: "workbook_1_name_intro_v1" },
                speaking_questions: [{ id: 13, sort_order: 0, question_text: "What's your name?", hint_zh: "請用完整句回答。", simple_answer: "My name is [你的名字].", model_answer: "My name is [你的名字].", keywords: ["name"], accepted_intents: ["說出名字"], pronunciation_notes_zh: "把 name 說清楚。" }]
            }]
        });

        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByText("預覽學生畫面"));

        expect(screen.getByText("What's your name?")).toBeInTheDocument();
        expect(screen.getByText("學生會先聽問題，自行回答；需要時才展開提示與示範句。")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "核准、發布並產生語音" })).toBeInTheDocument();
    });
});
