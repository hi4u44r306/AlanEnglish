import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SpeakingContentAdmin from "./SpeakingContentAdmin";
import { createWorkbookOneGreetingsQuestionSet, createWorkbookOneStarterQuestionSet, createWorkbookTwoStarterQuestionSet, getSpeakingContentBootstrap, getSpeakingQuestionAudioPreview } from "../../services/speakingContentService";

const mockFirebaseUser = { uid: "admin" };
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: mockFirebaseUser }) }));
jest.mock("../../services/speakingContentService", () => ({
    createWorkbookOneStarterQuestionSet: jest.fn(),
    createWorkbookOneGreetingsQuestionSet: jest.fn(),
    createWorkbookTwoStarterQuestionSet: jest.fn(),
    getSpeakingContentBootstrap: jest.fn(),
    getSpeakingQuestionAudioPreview: jest.fn(),
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
        createWorkbookOneGreetingsQuestionSet.mockResolvedValue({ success: true, reused: false });
        createWorkbookTwoStarterQuestionSet.mockResolvedValue({ success: true, reused: false });
        getSpeakingQuestionAudioPreview.mockResolvedValue({ success: true, voice_id: "en-US-Chirp3-HD-Puck", voice_gender: "male", audio_url: "https://audio.example/puck.wav" });
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

    it("creates the curated Workbook 2 origin challenge without paid OCR or AI", async () => {
        render(<SpeakingContentAdmin />);
        const createButton = await screen.findByRole("button", { name: "建立 Workbook 2 草稿" });
        await waitFor(() => expect(createButton).toBeEnabled());
        fireEvent.click(createButton);

        await waitFor(() => expect(createWorkbookTwoStarterQuestionSet).toHaveBeenCalledWith(mockFirebaseUser, 2));
    });

    it("creates the curated Workbook 1 greetings challenge without paid OCR or AI", async () => {
        render(<SpeakingContentAdmin />);
        const createButton = await screen.findByRole("button", { name: "建立關卡 02 草稿" });
        await waitFor(() => expect(createButton).toBeEnabled());
        fireEvent.click(createButton);

        await waitFor(() => expect(createWorkbookOneGreetingsQuestionSet).toHaveBeenCalledWith(mockFirebaseUser, 1));
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
        expect(screen.getByText("女聲 · Autonoe")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "核准、發布並產生語音" })).toBeInTheDocument();
    });

    it("shows the balanced voice plan and loads a stored preview for a published question", async () => {
        getSpeakingContentBootstrap.mockResolvedValueOnce({
            books: [{ id: 2, name: "Workbook 2", code: "Workbook_2" }],
            documents: [{ id: 20, book_id: 2, title: "Workbook 2 口說大挑戰", chunk_count: 0 }], chunks: [],
            sections: [{ id: 21, document_id: 20, topic: "我來自哪裡？", unit_label: "Topic 06", page_from_label: "P56", page_to_label: "P58", language_level: "國小中年級", status: "reviewed" }],
            question_sets: [{
                id: 13, source_section_id: 21, title: "01 我來自哪裡？", status: "published", version: 1,
                generation_metadata: { template_key: "workbook_2_origin_places_v1" },
                speaking_questions: [{ id: 31, sort_order: 0, question_text: "Where are you from?", hint_zh: "請用完整句回答。", simple_answer: "I am from Taiwan.", model_answer: "I am from [你的國家].", keywords: ["from"], accepted_intents: ["說出國家"], pronunciation_notes_zh: "把 from 說清楚。" }]
            }]
        });

        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByText("預覽學生畫面"));
        expect(screen.getByText("男聲 · Puck")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "試聽第 1 題男聲示範" }));

        await waitFor(() => expect(getSpeakingQuestionAudioPreview).toHaveBeenCalledWith(mockFirebaseUser, 13, 31));
        expect(await screen.findByLabelText("第 1 題示範語音")).toHaveAttribute("src", "https://audio.example/puck.wav");
    });
});
