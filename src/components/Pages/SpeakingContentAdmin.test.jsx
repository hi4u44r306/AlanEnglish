import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SpeakingContentAdmin from "./SpeakingContentAdmin";
import {
    activatePictureGapTheAudioCandidate,
    activateSpeakingAlphabetAudioCandidate,
    archiveSpeakingQuestionSet,
    archiveSpeakingSourceSection,
    confirmPageCandidateSpeakingDraft,
    confirmWorkbookOneFoundationSource,
    createWorkbookOneFoundationQuestionSet,
    createWorkbookOneStarterQuestionSet,
    createWorkbookTwoStarterQuestionSet,
    generateSpeakingQuestionSet,
    generateSpeakingQuestionSetAudio,
    generateSpeakingVisibleWordAudio,
    getPictureGapTheAudioCandidates,
    getSpeakingContentBootstrap,
    getSpeakingQuestionAudioPreview,
    getSpeakingQuestionPicturePreview,
    publishSpeakingQuestionSet,
    prepareSpeakingAlphabetAudioCandidate,
    reviewSpeakingOcrSource
} from "../../services/speakingContentService";

const mockFirebaseUser = { uid: "admin" };
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: mockFirebaseUser }) }));
jest.mock("../../services/speakingContentService", () => ({
    activatePictureGapTheAudioCandidate: jest.fn(),
    activateSpeakingAlphabetAudioCandidate: jest.fn(),
    confirmWorkbookOneFoundationSource: jest.fn(),
    confirmPageCandidateSpeakingDraft: jest.fn(),
    createWorkbookOneFoundationQuestionSet: jest.fn(),
    createWorkbookOneStarterQuestionSet: jest.fn(),
    createWorkbookTwoStarterQuestionSet: jest.fn(),
    getSpeakingContentBootstrap: jest.fn(),
    getPictureGapTheAudioCandidates: jest.fn(),
    getSpeakingQuestionAudioPreview: jest.fn(),
    getSpeakingQuestionPicturePreview: jest.fn(),
    extractSpeakingSourceDocument: jest.fn(), extractSpeakingBookChunk: jest.fn(),
    publishSpeakingQuestionSet: jest.fn(), generateSpeakingQuestionSetAudio: jest.fn(), reviewSpeakingOcrSource: jest.fn(),
    generateSpeakingVisibleWordAudio: jest.fn(), createWorkbookOnePictureDraft: jest.fn(), uploadSpeakingQuestionPicture: jest.fn(),
    discardWorkbookOnePictureDraft: jest.fn(),
    saveReviewedSpeakingSource: jest.fn(), uploadAndExtractSpeakingSource: jest.fn(),
    uploadWholeBookSource: jest.fn(), updateDraftSpeakingQuestion: jest.fn(),
    generateSpeakingQuestionSet: jest.fn(), prepareSpeakingAlphabetAudioCandidate: jest.fn(),
    createSpeakingQuestionSetRevision: jest.fn(), updateSpeakingQuestionSetDraft: jest.fn(),
    updatePictureDraftQuestion: jest.fn(), addPictureDraftQuestion: jest.fn(),
    deleteDraftSpeakingQuestion: jest.fn(), reorderDraftSpeakingQuestions: jest.fn(),
    restorePictureGapStandardAudio: jest.fn(),
    archiveSpeakingQuestionSet: jest.fn(), archiveSpeakingSourceSection: jest.fn()
}));

describe("SpeakingContentAdmin whole-book OCR", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createWorkbookOneStarterQuestionSet.mockResolvedValue({ success: true, reused: false });
        createWorkbookOneFoundationQuestionSet.mockResolvedValue({ success: true, reused: false });
        confirmWorkbookOneFoundationSource.mockResolvedValue({ success: true });
        confirmPageCandidateSpeakingDraft.mockResolvedValue({ success: true });
        archiveSpeakingSourceSection.mockResolvedValue({ success: true, archived: true });
        prepareSpeakingAlphabetAudioCandidate.mockResolvedValue({
            success: true, reused: false, candidates: [
                { status: "ready", candidate_id: "11111111-1111-4111-8111-111111111111", voice_label: "Leda", audio_url: "https://audio.example/leda.wav", segments: [] },
                { status: "ready", candidate_id: "22222222-2222-4222-8222-222222222222", voice_label: "Aoede", audio_url: "https://audio.example/aoede.wav", segments: [] },
                { status: "ready", candidate_id: "33333333-3333-4333-8333-333333333333", voice_label: "Zephyr", audio_url: "https://audio.example/zephyr.wav", segments: [] }
            ]
        });
        activateSpeakingAlphabetAudioCandidate.mockResolvedValue({ success: true, activated: true });
        activatePictureGapTheAudioCandidate.mockResolvedValue({ success: true, applied: true });
        createWorkbookTwoStarterQuestionSet.mockResolvedValue({ success: true, reused: false });
        generateSpeakingQuestionSet.mockResolvedValue({ success: true, question_set_id: 88 });
        generateSpeakingQuestionSetAudio.mockResolvedValue({ success: true, generated: 3, reused: 0, failed: 0, pending: 0 });
        generateSpeakingVisibleWordAudio.mockResolvedValue({ success: true, generated: 3, reused: 0, failed: 0, pending: 0 });
        publishSpeakingQuestionSet.mockResolvedValue({ success: true });
        getSpeakingQuestionAudioPreview.mockResolvedValue({ success: true, voice_id: "en-US-Chirp3-HD-Leda", voice_gender: "female", audio_url: "https://audio.example/leda.wav" });
        getPictureGapTheAudioCandidates.mockResolvedValue({
            success: true,
            candidates: [
                { id: "context-natural", label: "自然弱讀（連句語境）", audio_url: "https://audio.example/the-natural.wav" },
                { id: "context-clear", label: "清楚弱讀（The 稍慢）", audio_url: "https://audio.example/the-clear.wav" }
            ]
        });
        getSpeakingQuestionPicturePreview.mockResolvedValue({
            question_id: 53,
            image_url: "https://r2.example/p21-preview.png",
            alt_zh: "教材中的蘋果插圖",
            expires_in_seconds: 900
        });
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
    afterEach(() => jest.restoreAllMocks());

    it("shows persistent batch progress and a per-batch retry control", async () => {
        render(<SpeakingContentAdmin />);
        expect(await screen.findByRole("heading", { name: "關卡製作流程" })).toBeInTheDocument();
        expect(screen.getByRole("navigation", { name: "口說題庫快速操作" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /2 製作中草稿/ })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /建立新關卡/ }));
        expect(await screen.findByRole("heading", { name: "P21～P24 人工內容與私人圖片" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /1 教材來源/ }));
        expect(await screen.findByRole("heading", { name: "整本教材分批辨識" })).toBeInTheDocument();
        expect(screen.getByText("支援 1～500 頁、500MB 以內；單頁原始掃描可達 200MB。加密或損壞的 PDF 無法處理。")).toBeInTheDocument();
        expect(await screen.findByText("整本教材 · 115 頁")).toBeInTheDocument();
        expect(screen.getByText("P1–P10")).toBeInTheDocument();
        expect(screen.getByText("辨識失敗")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "重試第 2 批" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "開始批次 OCR" })).toBeInTheDocument();
    });

    it("shows four source tabs and hides superseded whole-book OCR duplicates", async () => {
        getSpeakingContentBootstrap.mockResolvedValue({
            books: [
                { id: 1, name: "Workbook 1", code: "Workbook_1" },
                { id: 3, name: "Workbook 3", code: "Workbook_3" }
            ],
            documents: [
                { id: 30, book_id: 3, title: "Workbook 3 舊版", source_kind: "pdf", page_count: 106, chunk_count: 11, updated_at: "2026-09-20T00:00:00Z" },
                { id: 40, book_id: 3, title: "Workbook 3 新版", source_kind: "pdf", page_count: 106, chunk_count: 11, updated_at: "2026-09-24T00:00:00Z" },
                { id: 50, book_id: 1, title: "Workbook 1", source_kind: "pdf", page_count: 20, chunk_count: 2, updated_at: "2026-09-23T00:00:00Z" }
            ],
            chunks: [
                { id: 31, document_id: 30, source_section_id: 32, chunk_index: 0, page_from: 1, page_to: 10, status: "review_required" },
                { id: 41, document_id: 40, source_section_id: 42, chunk_index: 0, page_from: 1, page_to: 10, status: "review_required" },
                { id: 51, document_id: 50, source_section_id: 52, chunk_index: 0, page_from: 1, page_to: 10, status: "review_required" }
            ],
            sections: [
                { id: 32, document_id: 30, page_from_label: "P1", page_to_label: "P10", topic: "舊版內容", status: "draft", source_text: "Old text that should remain stored." },
                { id: 42, document_id: 40, page_from_label: "P1", page_to_label: "P10", topic: "新版內容", status: "draft", source_text: "New text that should be reviewed." },
                { id: 52, document_id: 50, page_from_label: "P1", page_to_label: "P10", topic: "Workbook 1 內容", status: "draft", source_text: "Workbook one pending text." }
            ],
            question_sets: []
        });

        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /1 教材來源/ }));

        expect(screen.getByRole("navigation", { name: "教材來源分類" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /整本教材辨識/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /核對 OCR 批次/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /單一範圍或貼入文字/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /已核准教材頁面/ })).toBeInTheDocument();
        expect(screen.getByText("Workbook 3 新版")).toBeInTheDocument();
        expect(screen.queryByText("Workbook 3 舊版")).not.toBeInTheDocument();
        expect(screen.getByText(/已隱藏 1 份同一本書的較舊整本 OCR 紀錄/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /核對 OCR 批次/ }));
        expect(await screen.findByRole("heading", { name: "待核對 OCR 批次" })).toBeInTheDocument();
        expect(screen.getByText(/已排除 1 批較舊整本 OCR 的重複待核對項目/)).toBeInTheDocument();
        expect(screen.getByText("Workbook 1", { selector: ".speaking-ocr-book-group > summary strong" })).toBeInTheDocument();
        expect(screen.getByText("Workbook 3", { selector: ".speaking-ocr-book-group > summary strong" })).toBeInTheDocument();
        expect(screen.queryByText("P1–P10 · 舊版內容")).not.toBeInTheDocument();
    });

    it("groups reviewed sources by book and safely archives an unused old source", async () => {
        jest.spyOn(window, "confirm").mockReturnValue(true);
        getSpeakingContentBootstrap.mockResolvedValue({
            books: [
                { id: 1, name: "Workbook 1", code: "Workbook_1" },
                { id: 3, name: "Workbook 3", code: "Workbook_3" }
            ],
            documents: [
                { id: 61, book_id: 1, title: "Workbook 1 舊來源", source_kind: "pasted_text", chunk_count: 0 },
                { id: 63, book_id: 3, title: "Workbook 3 使用中來源", source_kind: "pasted_text", chunk_count: 0 }
            ],
            chunks: [],
            sections: [
                { id: 62, document_id: 61, page_from_label: "P28", page_to_label: "P28", topic: "舊顏色題", status: "reviewed", source_text: "This is an old reviewed source text." },
                { id: 64, document_id: 63, page_from_label: "P4", page_to_label: "P4", topic: "使用中題目", status: "reviewed", source_text: "This source is still used by a draft." }
            ],
            question_sets: [
                { id: 65, source_section_id: 64, book_id: 3, title: "P4 使用中草稿", topic: "使用中題目", difficulty: "國小中年級", status: "draft", version: 1, generation_metadata: {}, speaking_questions: [] }
            ]
        });

        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /1 教材來源/ }));
        fireEvent.click(screen.getByRole("button", { name: /已核准教材頁面/ }));

        expect(screen.getByText("Workbook 1", { selector: ".speaking-reviewed-book-group > summary strong" })).toBeInTheDocument();
        expect(screen.getByText("Workbook 3", { selector: ".speaking-reviewed-book-group > summary strong" })).toBeInTheDocument();
        expect(screen.getByText(/已有 1 個關卡，須先處理關卡才能封存來源/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "封存舊來源" }));

        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("P28 · 舊顏色題"));
        await waitFor(() => expect(archiveSpeakingSourceSection).toHaveBeenCalledWith(mockFirebaseUser, 62));
    });

    it("shows an OCR review editor in sources before a question set exists", async () => {
        reviewSpeakingOcrSource.mockResolvedValue({ success: true });
        getSpeakingContentBootstrap.mockResolvedValue({
            books: [{ id: 3, name: "Workbook 3", code: "Workbook_3" }],
            documents: [
                { id: 30, book_id: 3, title: "Workbook 3", source_kind: "pdf", page_count: 70, chunk_count: 7 },
                { id: 40, book_id: 3, title: "Workbook 3 人工內容", source_kind: "pasted_text", chunk_count: 0 }
            ],
            chunks: [{ id: 31, document_id: 30, source_section_id: 32, chunk_index: 0, page_from: 1, page_to: 10, status: "review_required" }],
            sections: [
                { id: 32, document_id: 30, unit_label: "Unit 1", page_from_label: "P1", page_to_label: "P10", topic: "身體部位", language_level: "國小中年級", status: "draft", source_text: "[[PAGE P1]]\nIt is an eye.\n[[PAGE P2]]\nIt is a nose." },
                { id: 41, document_id: 40, unit_label: "人工草稿", page_from_label: "P26", page_to_label: "P27", topic: "完整句", language_level: "國小中年級", status: "draft", source_text: "Manual source" }
            ],
            question_sets: []
        });

        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /1 教材來源/ }));
        fireEvent.click(screen.getByRole("button", { name: /核對 OCR 批次/ }));

        expect(await screen.findByRole("heading", { name: "待核對 OCR 批次" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /1 教材來源 1 個項目待核對/ })).toBeInTheDocument();
        expect(screen.queryByText("P26–P27 · 完整句")).not.toBeInTheDocument();
        fireEvent.click(screen.getByText("Workbook 3", { selector: ".speaking-ocr-book-group > summary strong" }));
        fireEvent.click(screen.getByText("P1–P10 · 身體部位"));
        expect(screen.getByDisplayValue(/\[\[PAGE P1\]\]/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("checkbox", { name: /我已逐頁對照原教材/ }));
        fireEvent.click(screen.getByRole("button", { name: "核准 OCR 教材文字" }));

        await waitFor(() => expect(reviewSpeakingOcrSource).toHaveBeenCalledWith(mockFirebaseUser, expect.objectContaining({
            source_section_id: 32,
            page_from_label: "P1",
            page_to_label: "P10",
            confirmed: true
        })));
    });

    it("creates page-specific candidate drafts only from OCR text that is marked by page", async () => {
        jest.spyOn(window, "confirm").mockReturnValue(true);
        let resolveSecondPage;
        const secondPageResult = new Promise(resolve => { resolveSecondPage = resolve; });
        generateSpeakingQuestionSet.mockImplementation((firebaseUser, payload) => payload.source_page_label === "P5" ? secondPageResult : Promise.resolve({
            success: true,
            question_set_id: 88,
            source_page_label: payload.source_page_label,
            question_count: 3,
            requires_manual_authoring: false,
            manual_authoring_reason: null
        }));
        getSpeakingContentBootstrap.mockResolvedValue({
            books: [{ id: 1, name: "Workbook 1", code: "Workbook_1" }], documents: [{ id: 31, title: "Workbook 1", book_id: 1 }], chunks: [],
            sections: [{ id: 32, document_id: 31, unit_label: "Unit 1", page_from_label: "P4", page_to_label: "P5", topic: "身體部位", language_level: "國小低年級", status: "reviewed", source_text: "[[PAGE P4]]\\nIt is an eye.\\n[[PAGE P5]]\\nThey are her eyes." }],
            question_sets: []
        });

        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /1 教材來源/ }));
        fireEvent.click(screen.getByRole("button", { name: /已核准教材頁面/ }));
        fireEvent.click(await screen.findByRole("button", { name: "選取可處理頁面" }));
        fireEvent.click(screen.getByRole("button", { name: "建立／重新產生 2 頁草稿" }));

        await waitFor(() => expect(generateSpeakingQuestionSet).toHaveBeenCalledTimes(2));
        expect(screen.getByRole("progressbar", { name: "逐頁草稿建立進度" })).toHaveAttribute("aria-valuenow", "50");
        expect(screen.getByText("正在處理 P5：AI 分析、重複檢查與草稿儲存。")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "處理中 1/2" })).toBeDisabled();
        expect(generateSpeakingQuestionSet).toHaveBeenNthCalledWith(1, mockFirebaseUser, expect.objectContaining({ source_section_id: 32, source_page_label: "P4" }));
        expect(generateSpeakingQuestionSet).toHaveBeenNthCalledWith(2, mockFirebaseUser, expect.objectContaining({ source_section_id: 32, source_page_label: "P5" }));
        await act(async () => resolveSecondPage({
            success: true, question_set_id: 89, source_page_label: "P5", question_count: 0,
            requires_manual_authoring: true, manual_authoring_reason: "no_speakable_sentence"
        }));
        expect(await screen.findByText("本次逐頁建立結果")).toBeInTheDocument();
        expect(screen.getByText("AI 草稿 3 題")).toBeInTheDocument();
        expect(screen.getByText(/本頁只有填空、中文單字或不完整句/)).toBeInTheDocument();
    });

    it("only creates drafts for page markers retained in the approved transcript", async () => {
        jest.spyOn(window, "confirm").mockReturnValue(true);
        getSpeakingContentBootstrap.mockResolvedValue({
            books: [{ id: 3, name: "Workbook 3", code: "Workbook_3" }],
            documents: [{ id: 35, title: "Workbook 3", book_id: 3 }],
            chunks: [],
            sections: [{
                id: 36,
                document_id: 35,
                unit_label: "Unit 1",
                page_from_label: "P1",
                page_to_label: "P4",
                topic: "所有格",
                language_level: "國小中年級",
                status: "reviewed",
                source_text: "[[PAGE P1]]\nThis is my book.\n[[PAGE P3]]\nIt is her pencil."
            }],
            question_sets: []
        });

        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /1 教材來源/ }));
        fireEvent.click(screen.getByRole("button", { name: /已核准教材頁面/ }));

        expect(await screen.findByText(/逐字稿保留 P1、P3/)).toBeInTheDocument();
        fireEvent.click(screen.getByText("查看已保留的核准逐字稿"));
        expect(screen.getByText(/This is my book/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("checkbox", { name: "選擇 P1（建立新草稿）" }));
        fireEvent.click(screen.getByRole("checkbox", { name: "選擇 P3（建立新草稿）" }));
        fireEvent.click(screen.getByRole("button", { name: "建立／重新產生 2 頁草稿" }));

        await waitFor(() => expect(generateSpeakingQuestionSet).toHaveBeenCalledTimes(2));
        expect(generateSpeakingQuestionSet).toHaveBeenNthCalledWith(1, mockFirebaseUser, expect.objectContaining({ source_section_id: 36, source_page_label: "P1" }));
        expect(generateSpeakingQuestionSet).toHaveBeenNthCalledWith(2, mockFirebaseUser, expect.objectContaining({ source_section_id: 36, source_page_label: "P3" }));
        expect(generateSpeakingQuestionSet).not.toHaveBeenCalledWith(mockFirebaseUser, expect.objectContaining({ source_page_label: "P2" }));
        expect(generateSpeakingQuestionSet).not.toHaveBeenCalledWith(mockFirebaseUser, expect.objectContaining({ source_page_label: "P4" }));
    });

    it("regenerates only selected draft pages and prevents overwriting published pages", async () => {
        jest.spyOn(window, "confirm").mockReturnValue(true);
        generateSpeakingQuestionSet.mockImplementation((firebaseUser, payload) => Promise.resolve({
            success: true,
            question_set_id: payload.source_page_label === "P15" ? 115 : 120,
            source_page_label: payload.source_page_label,
            question_count: payload.source_page_label === "P15" ? 5 : 6
        }));
        getSpeakingContentBootstrap.mockResolvedValue({
            books: [{ id: 3, name: "Workbook 3", code: "Workbook_3" }],
            documents: [{ id: 35, title: "Workbook 3", book_id: 3 }], chunks: [],
            sections: [{
                id: 36, document_id: 35, unit_label: "Family & Daily Life", page_from_label: "P11", page_to_label: "P20",
                topic: "家庭與日常生活", language_level: "國小中年級", status: "reviewed",
                source_text: "[[PAGE P15]]\n15. What do you eat?\nRice.\n[[PAGE P17]]\n17. What do you drink?\nMilk.\n[[PAGE P20]]\n20. What would you like?\nNoodles."
            }],
            question_sets: [
                { id: 51, source_section_id: 36, status: "draft", generation_metadata: { source: "ocr_page_candidate", source_page_label: "P15", source_pages: [15] }, speaking_questions: [{ id: 511 }] },
                { id: 52, source_section_id: 36, status: "published", generation_metadata: { source: "ocr_page_candidate", source_page_label: "P17", source_pages: [17] }, speaking_questions: [{ id: 521 }, { id: 522 }] }
            ]
        });

        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /1 教材來源/ }));
        fireEvent.click(screen.getByRole("button", { name: /已核准教材頁面/ }));

        const publishedPage = await screen.findByRole("checkbox", { name: "選擇 P17（已發布）" });
        expect(publishedPage).toBeDisabled();
        fireEvent.click(screen.getByRole("checkbox", { name: "選擇 P15（已有草稿，重新產生）" }));
        fireEvent.click(screen.getByRole("checkbox", { name: "選擇 P20（建立新草稿）" }));
        fireEvent.click(screen.getByRole("button", { name: "建立／重新產生 2 頁草稿" }));

        await waitFor(() => expect(generateSpeakingQuestionSet).toHaveBeenCalledTimes(2));
        expect(generateSpeakingQuestionSet).toHaveBeenCalledWith(mockFirebaseUser, expect.objectContaining({
            source_section_id: 36,
            source_page_label: "P15",
            replace_question_set_id: 51
        }));
        expect(generateSpeakingQuestionSet).toHaveBeenCalledWith(mockFirebaseUser, expect.objectContaining({
            source_section_id: 36,
            source_page_label: "P20",
            replace_question_set_id: undefined
        }));
        expect(generateSpeakingQuestionSet).not.toHaveBeenCalledWith(mockFirebaseUser, expect.objectContaining({ source_page_label: "P17" }));
    });

    it("shows OCR page candidates as one page per challenge instead of the source batch range", async () => {
        getSpeakingContentBootstrap.mockResolvedValue({
            books: [{ id: 3, name: "Workbook 3", code: "Workbook_3" }],
            documents: [{ id: 35, title: "Workbook 3", book_id: 3 }],
            chunks: [],
            sections: [{ id: 36, document_id: 35, unit_label: "Unit 1", page_from_label: "P1", page_to_label: "P10", topic: "所有格", language_level: "國小中年級", status: "reviewed" }],
            question_sets: [
                { id: 37, source_section_id: 36, book_id: 3, title: "P1 口說練習", topic: "所有格", difficulty: "國小中年級", status: "draft", version: 1, generation_metadata: { source: "ocr_page_candidate", source_pages: [1], source_page_label: "P1", interaction_type: "standard_sentence", requires_content_review: true }, speaking_questions: [{ id: 371, sort_order: 0, question_text: "It is my book.", model_answer: "It is my book." }] },
                { id: 38, source_section_id: 36, book_id: 3, title: "P2 口說練習", topic: "身體部位", difficulty: "國小中年級", status: "draft", version: 1, generation_metadata: { source: "ocr_page_candidate", source_pages: [2], source_page_label: "P2", interaction_type: "standard_sentence", requires_content_review: true }, speaking_questions: [{ id: 381, sort_order: 0, question_text: "This is my nose.", model_answer: "This is my nose." }] }
            ]
        });

        render(<SpeakingContentAdmin />);

        expect(await screen.findByRole("heading", { name: "P1 · 所有格" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "P2 · 身體部位" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: /P1–P10（舊版跨頁）/ })).not.toBeInTheDocument();
        expect(screen.getByText("P1 單頁關卡 · 國小中年級")).toBeInTheDocument();
        expect(screen.getByText("P2 單頁關卡 · 國小中年級")).toBeInTheDocument();
    });

    it("labels no-image text questions and exposes reviewed alternative full answers", async () => {
        getSpeakingContentBootstrap.mockResolvedValue({
            books: [{ id: 3, name: "Workbook 3", code: "Workbook_3" }],
            documents: [{ id: 35, title: "Workbook 3", book_id: 3 }], chunks: [],
            sections: [{ id: 36, document_id: 35, unit_label: "Unit 1", page_from_label: "P5", page_to_label: "P5", topic: "所有格", language_level: "國小中年級", status: "reviewed" }],
            question_sets: [{
                id: 39, source_section_id: 36, book_id: 3, title: "P5 文字問答", topic: "所有格", difficulty: "國小中年級", status: "draft", version: 1,
                generation_metadata: { source: "ocr_page_candidate", source_pages: [5], source_page_label: "P5", interaction_type: "text_qa", requires_content_review: true, candidate_filter: { generation_strategy: "reviewed_numbered_text_qa", eligible_sentence_count: 4, discarded_segment_count: 2 } },
                speaking_questions: [{ id: 391, sort_order: 0, question_text: "Who is your friend?", hint_zh: "男生或女生皆可，請選一種完整回答。", keywords: ["friend"], simple_answer: "He is my friend.", model_answer: "He is my friend.", accepted_intents: ["She is my friend."] }]
            }]
        });

        render(<SpeakingContentAdmin />);
        expect(await screen.findByText("1 題文字問答（無圖片）候選")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /P5 文字問答/ }));
        expect(screen.getByText(/男女兩種完整答案都要保留/)).toBeInTheDocument();
        expect(screen.getByText(/已維持一個編號一題/)).toBeInTheDocument();
        expect(screen.getByText(/底線改為姓名、年齡或拼字等可變口說欄位/)).toBeInTheDocument();
        expect(screen.getByText("其他可接受的完整答案（每行一項）")).toBeInTheDocument();
    });

    it("lets AI determine the actual question count for one reviewed page", async () => {
        generateSpeakingQuestionSet.mockResolvedValueOnce({ success: true, question_set_id: 89, question_count: 7 });
        getSpeakingContentBootstrap.mockResolvedValue({
            books: [{ id: 3, name: "Workbook 3", code: "Workbook_3" }],
            documents: [{ id: 33, title: "Workbook 3", book_id: 3 }],
            chunks: [],
            sections: [{ id: 34, document_id: 33, unit_label: "Unit 1", page_from_label: "P4", page_to_label: "P4", topic: "所有格", language_level: "國小中年級", status: "reviewed", source_text: "1. It is an eye.\n2. They are her eyes.\n3. It is my nose." }],
            question_sets: []
        });

        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /1 教材來源/ }));
        fireEvent.click(screen.getByRole("button", { name: /已核准教材頁面/ }));
        expect(await screen.findByText(/AI 會依每頁實際可出題內容自動判斷題數/)).toBeInTheDocument();
        expect(screen.queryByText("每頁題數")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "建立本頁 AI 草稿" }));

        await waitFor(() => expect(generateSpeakingQuestionSet).toHaveBeenCalledWith(mockFirebaseUser, expect.objectContaining({
            source_section_id: 34,
            auto_question_count: true
        })));
    });

    it("only batch-approves OCR candidates the administrator explicitly selected as reviewed", async () => {
        jest.spyOn(window, "confirm").mockReturnValue(true);
        getSpeakingContentBootstrap.mockResolvedValue({
            books: [{ id: 1, name: "Workbook 1", code: "Workbook_1" }], documents: [], chunks: [], sections: [],
            question_sets: [
                { id: 41, title: "P4 口說練習", status: "draft", generation_metadata: { source: "ocr_page_candidate", source_page_label: "P4", requires_content_review: true, image_suggestions: ["眼睛插圖"] }, speaking_questions: [{ id: 1 }, { id: 2 }, { id: 3 }] },
                { id: 42, title: "P5 口說練習", status: "draft", generation_metadata: { source: "ocr_page_candidate", source_page_label: "P5", requires_content_review: true, duplicate_review: { excluded_count: 1 } }, speaking_questions: [{ id: 4 }, { id: 5 }, { id: 6 }] },
                { id: 43, title: "P6 所有格（待人工補題）", status: "draft", generation_metadata: { source: "ocr_page_candidate", source_page_label: "P6", requires_content_review: true, requires_manual_authoring: true, manual_authoring_reason: "no_speakable_sentence" }, speaking_questions: [] }
            ]
        });

        render(<SpeakingContentAdmin />);
        expect(await screen.findByRole("heading", { name: "逐頁候選待審核" })).toBeInTheDocument();
        expect(screen.getByLabelText("已逐題核對 P4 候選草稿")).not.toBeChecked();
        expect(screen.getByLabelText("已逐題核對 P6 候選草稿")).toBeDisabled();
        expect(screen.getByRole("button", { name: "打開補題" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "選取全部已核對" }));
        fireEvent.click(screen.getByRole("button", { name: "批次核准 2 份草稿" }));

        await waitFor(() => expect(confirmPageCandidateSpeakingDraft).toHaveBeenCalledWith(mockFirebaseUser, 41));
        expect(confirmPageCandidateSpeakingDraft).toHaveBeenCalledWith(mockFirebaseUser, 42);
        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("絕不會發布給學生"));
    });

    it("creates the curated Workbook 1 starter without asking AI to generate it", async () => {
        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /建立新關卡/ }));
        const createButton = await screen.findByRole("button", { name: "建立範例草稿" });
        await waitFor(() => expect(createButton).toBeEnabled());
        fireEvent.click(createButton);

        await waitFor(() => expect(createWorkbookOneStarterQuestionSet).toHaveBeenCalledWith(mockFirebaseUser, 1));
    });

    it("creates the curated Workbook 2 origin challenge without paid OCR or AI", async () => {
        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /建立新關卡/ }));
        const createButton = await screen.findByRole("button", { name: "建立 Workbook 2 草稿" });
        await waitFor(() => expect(createButton).toBeEnabled());
        fireEvent.click(createButton);

        await waitFor(() => expect(createWorkbookTwoStarterQuestionSet).toHaveBeenCalledWith(mockFirebaseUser, 2));
    });

    it("creates Workbook 1 foundation drafts and requires source review before publishing", async () => {
        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /建立新關卡/ }));
        const createButtons = await screen.findAllByRole("button", { name: "建立草稿" });
        expect(createButtons).toHaveLength(6);
        fireEvent.click(createButtons[1]);

        await waitFor(() => expect(createWorkbookOneFoundationQuestionSet).toHaveBeenCalledWith(
            mockFirebaseUser,
            1,
            "create_workbook_1_spelling_p14"
        ));
    });

    it("previews three A–Z candidates and only unlocks the one fully played", async () => {
        jest.spyOn(window, "confirm").mockReturnValue(true);
        getSpeakingContentBootstrap.mockResolvedValueOnce({
            books: [{ id: 1, name: "Workbook 1", code: "Workbook_1" }],
            documents: [], chunks: [], sections: [],
            question_sets: [{
                id: 7, source_section_id: 70, title: "A–Z 大小寫挑戰", status: "draft", version: 1,
                generation_metadata: { template_key: "workbook_1_alphabet_round_v1", interaction_type: "alphabet_round" },
                speaking_questions: []
            }]
        });

        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /建立新關卡/ }));
        fireEvent.click(await screen.findByRole("button", { name: "產生／載入新版 A–Z 女聲候選音檔" }));

        await waitFor(() => expect(prepareSpeakingAlphabetAudioCandidate).toHaveBeenCalledWith(mockFirebaseUser, 7));
        expect(await screen.findByText("先逐一完整試聽，再選一個套用")).toBeInTheDocument();
        expect(screen.getByText(/三個 Chirp 3 HD 自然女聲/)).toBeInTheDocument();
        const ledaButton = screen.getByRole("button", { name: "核准 Leda 套用學生版本" });
        const aoedeButton = screen.getByRole("button", { name: "核准 Aoede 套用學生版本" });
        expect(ledaButton).toBeDisabled();
        expect(aoedeButton).toBeDisabled();
        fireEvent.ended(screen.getByLabelText("Leda A–Z 女聲候選音檔"));
        expect(ledaButton).toBeEnabled();
        expect(aoedeButton).toBeDisabled();
        fireEvent.click(ledaButton);
        await waitFor(() => expect(activateSpeakingAlphabetAudioCandidate).toHaveBeenCalledWith(
            mockFirebaseUser, 7, "11111111-1111-4111-8111-111111111111"
        ));
        const service = jest.requireMock("../../services/speakingContentService");
        expect(service.generateSpeakingQuestionSetAudio).not.toHaveBeenCalled();
    });

    it("sends an explicit confirmation for a reviewed Workbook 1 foundation draft", async () => {
        jest.spyOn(window, "confirm").mockReturnValue(true);
        getSpeakingContentBootstrap.mockResolvedValueOnce({
            books: [{ id: 1, name: "Workbook 1", code: "Workbook_1" }],
            documents: [{ id: 40, book_id: 1, title: "Workbook 1 P14 拼讀關", chunk_count: 0 }], chunks: [],
            sections: [{ id: 41, document_id: 40, topic: "看單字逐字母拼讀", unit_label: "P14 拼讀", page_from_label: "P14", page_to_label: "P14", language_level: "國小低年級", status: "draft" }],
            question_sets: [{
                id: 42, source_section_id: 41, title: "P14 看字拼讀", status: "draft", version: 1,
                generation_metadata: { template_key: "workbook_1_p14_letter_spelling_v1", requires_content_review: true },
                speaking_questions: [{ id: 43, sort_order: 0, question_text: "apple", hint_zh: "逐字母拼讀", simple_answer: "A P P L E", model_answer: "A P P L E", keywords: ["apple"], accepted_intents: ["完整拼讀"] }]
            }]
        });

        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /建立新關卡/ }));
        fireEvent.click(await screen.findByRole("button", { name: /已對照原頁，核准內容/ }));

        await waitFor(() => expect(confirmWorkbookOneFoundationSource).toHaveBeenCalledWith(mockFirebaseUser, 42));
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
        expect(await screen.findByRole("heading", { name: "製作中草稿" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /2 製作中草稿/ })).toHaveTextContent("1 份需要處理");
        const setToggle = await screen.findByRole("button", { name: /01 我的名字與自我介紹/ });
        expect(setToggle).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(setToggle);
        expect(setToggle).toHaveAttribute("aria-expanded", "true");
        fireEvent.click(await screen.findByText("預覽學生畫面"));

        expect(screen.getByText("What's your name?")).toBeInTheDocument();
        expect(screen.getByText("學生會先聽問題，自行回答；需要時才展開提示與示範句。")).toBeInTheDocument();
        expect(screen.getByText("女聲 · Leda")).toBeInTheDocument();
        expect(screen.getByText(/目前只有 1 題/)).toBeInTheDocument();
        fireEvent.click(setToggle);
        expect(setToggle).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByText("預覽學生畫面")).not.toBeInTheDocument();
    });

    it("keeps complete page drafts in ready and prepares audio before publishing", async () => {
        jest.spyOn(window, "confirm").mockReturnValue(true);
        getSpeakingContentBootstrap.mockResolvedValue({
            books: [{ id: 1, name: "Workbook 1", code: "Workbook_1" }],
            documents: [{ id: 80, book_id: 1, title: "Workbook 1", chunk_count: 0 }], chunks: [],
            sections: [{ id: 81, document_id: 80, topic: "身體部位", unit_label: "P4", page_from_label: "P4", page_to_label: "P4", language_level: "國小中年級", status: "reviewed" }],
            question_sets: [{
                id: 82, source_section_id: 81, book_id: 1, title: "P4 身體部位", status: "draft", version: 1,
                generation_metadata: { source: "admin_manual_builder", source_pages: [4], interaction_type: "standard_sentence" },
                speaking_questions: [
                    { id: 83, sort_order: 0, question_text: "It is an eye.", model_answer: "It is an eye." },
                    { id: 84, sort_order: 1, question_text: "They are her eyes.", model_answer: "They are her eyes." },
                    { id: 85, sort_order: 2, question_text: "It is my nose.", model_answer: "It is my nose." }
                ]
            }]
        });

        render(<SpeakingContentAdmin />);
        await waitFor(() => expect(screen.getByRole("button", { name: /3 待發布/ })).toHaveTextContent("1 份已通過內容檢查"));
        fireEvent.click(screen.getByRole("button", { name: /3 待發布/ }));
        fireEvent.click(await screen.findByRole("button", { name: /P4 身體部位/ }));
        expect(screen.getByText("內容檢查完成")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "先產生並試聽示範語音" }));
        await waitFor(() => expect(generateSpeakingQuestionSetAudio).toHaveBeenCalledWith(mockFirebaseUser, 82));
        fireEvent.click(screen.getByText("預覽學生畫面"));
        fireEvent.click(screen.getByRole("button", { name: "試聽第 1 題女聲示範" }));
        await waitFor(() => expect(getSpeakingQuestionAudioPreview).toHaveBeenCalledWith(mockFirebaseUser, 82, 83));
        generateSpeakingQuestionSetAudio.mockClear();
        fireEvent.click(screen.getByRole("button", { name: "準備語音並發布" }));

        await waitFor(() => expect(publishSpeakingQuestionSet).toHaveBeenCalledWith(mockFirebaseUser, 82));
        expect(generateSpeakingQuestionSetAudio).toHaveBeenCalledWith(mockFirebaseUser, 82);
        expect(generateSpeakingQuestionSetAudio.mock.invocationCallOrder[0]).toBeLessThan(publishSpeakingQuestionSet.mock.invocationCallOrder[0]);
    });

    it("prepares gap audio for a mixed page containing only picture gap questions", async () => {
        jest.spyOn(window, "confirm").mockReturnValue(true);
        const pictureGapQuestion = (id, sortOrder, prompt, answer) => ({
            id, sort_order: sortOrder, question_text: prompt, model_answer: answer,
            speaking_question_interactions: [{ interaction_type: "picture_gap_sentence", prompt_text: prompt, answer_text: answer, accepted_full_responses: [] }],
            speaking_question_visual_assets: [{ asset_id: `asset-${id}`, speaking_visual_assets: [{ alt_zh: "教材圖片", status: "ready", source_page_label: "P4" }] }]
        });
        getSpeakingContentBootstrap.mockResolvedValue({
            books: [{ id: 3, name: "Workbook 3", code: "Workbook_3" }],
            documents: [{ id: 90, book_id: 3, title: "Workbook 3", chunk_count: 0 }], chunks: [],
            sections: [{ id: 91, document_id: 90, topic: "身體部位", unit_label: "P4", page_from_label: "P4", page_to_label: "P4", language_level: "國小中年級", status: "reviewed" }],
            question_sets: [{
                id: 92, source_section_id: 91, book_id: 3, title: "P4 看圖補句", status: "draft", version: 1,
                generation_metadata: { source: "admin_page_builder", manual_builder_version: 2, source_pages: [4], interaction_type: "mixed", content_reviewed_at: "2026-09-22T00:00:00Z" },
                speaking_questions: [
                    pictureGapQuestion(93, 0, "It is ____.( 一隻 )", "It is an eye."),
                    pictureGapQuestion(94, 1, "____ are ____.( 她的 )", "They are her eyes."),
                    pictureGapQuestion(95, 2, "It is ____.( 我的 )", "It is my nose.")
                ]
            }]
        });

        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /3 待發布/ }));
        fireEvent.click(await screen.findByRole("button", { name: /P4 看圖補句/ }));
        fireEvent.click(screen.getByRole("button", { name: "準備語音並發布" }));

        await waitFor(() => expect(publishSpeakingQuestionSet).toHaveBeenCalledWith(mockFirebaseUser, 92));
        expect(generateSpeakingVisibleWordAudio).toHaveBeenCalledWith(mockFirebaseUser, 92);
        expect(generateSpeakingQuestionSetAudio).not.toHaveBeenCalled();
        expect(generateSpeakingVisibleWordAudio.mock.invocationCallOrder[0]).toBeLessThan(publishSpeakingQuestionSet.mock.invocationCallOrder[0]);
    });

    it("deletes any selected unpublished draft without affecting the published version", async () => {
        jest.spyOn(window, "confirm").mockReturnValue(true);
        archiveSpeakingQuestionSet.mockResolvedValue({ success: true, deleted: true });
        getSpeakingContentBootstrap.mockResolvedValueOnce({
            books: [{ id: 1, name: "Workbook 1", code: "Workbook_1" }],
            documents: [{ id: 60, book_id: 1, title: "Workbook 1 P21 人工圖片內容", chunk_count: 0 }], chunks: [],
            sections: [{ id: 61, document_id: 60, topic: "P21 看圖問答", unit_label: "P21", page_from_label: "P21", page_to_label: "P21", language_level: "國小低年級", status: "reviewed" }],
            question_sets: [{
                id: 62, source_section_id: 61, title: "P21 看圖問答 題庫", status: "draft", version: 4,
                generation_metadata: { source: "ai_generated" },
                speaking_questions: [
                    { id: 63, sort_order: 0, question_text: "What is that?", hint_zh: "看圖回答。", simple_answer: "It is a ball.", model_answer: "It is a ball.", keywords: ["ball"], accepted_intents: [] },
                    { id: 64, sort_order: 1, question_text: "What is this?", hint_zh: "看圖回答。", simple_answer: "It is a book.", model_answer: "It is a book.", keywords: ["book"], accepted_intents: [] }
                ]
            }]
        });

        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /P21 看圖問答 題庫/ }));
        const deleteButton = await screen.findByRole("button", { name: "刪除草稿" });
        fireEvent.click(deleteButton);

        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("草稿內的 2 題會一併刪除"));
        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("已發布版本與學生進度不受影響"));
        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("已核准 OCR 逐字稿會保留"));
        await waitFor(() => expect(archiveSpeakingQuestionSet).toHaveBeenCalledWith(mockFirebaseUser, 62));
    });

    it("does not expose P21/P22 drafts to the generic question editor", async () => {
        getSpeakingQuestionPicturePreview
            .mockRejectedValueOnce(new Error("preview unavailable"))
            .mockResolvedValueOnce({
                question_id: 53,
                image_url: "https://r2.example/p21-preview.png",
                alt_zh: "教材中的蘋果插圖",
                expires_in_seconds: 900
            });
        getSpeakingContentBootstrap.mockResolvedValueOnce({
            books: [{ id: 1, name: "Workbook 1", code: "Workbook_1" }],
            documents: [{ id: 50, book_id: 1, title: "Workbook 1 P21 人工圖片內容", chunk_count: 0 }], chunks: [],
            sections: [{ id: 51, document_id: 50, topic: "P21 看圖問答", unit_label: "P21", page_from_label: "P21", page_to_label: "P21", language_level: "國小低年級", status: "reviewed" }],
            question_sets: [{
                id: 52, source_section_id: 51, title: "P21 看圖完整問答", status: "draft", version: 1,
                generation_metadata: { template_key: "workbook_1_p21_picture_qa_v1", interaction_type: "picture_qa", requires_content_review: true, source_pages: [21] },
                speaking_questions: [{
                    id: 53, sort_order: 0, question_text: "What is that?", hint_zh: "看圖說完整問答。",
                    simple_answer: "What is that? It is an apple.", model_answer: "What is that? It is an apple.", keywords: [], accepted_intents: [],
                    speaking_question_interactions: [{ interaction_type: "picture_qa", prompt_text: "What is that?", answer_text: "It is an apple.", accepted_full_responses: [] }],
                    speaking_question_visual_assets: [{ asset_id: "asset-1", speaking_visual_assets: [{ alt_zh: "教材中的蘋果插圖", status: "ready", source_page_label: "P21" }] }]
                }]
            }]
        });

        render(<SpeakingContentAdmin />);

        fireEvent.click(await screen.findByRole("button", { name: /P21 看圖完整問答/ }));
        expect(await screen.findByText("P21 題目")).toBeInTheDocument();
        expect(screen.getByLabelText("完整問句（結尾需有 ?）")).toHaveValue("What is that?");
        expect(screen.queryByLabelText("AI 要問學生的問題")).not.toBeInTheDocument();
        expect(getSpeakingQuestionPicturePreview).not.toHaveBeenCalled();
        expect(screen.queryByRole("img", { name: "教材中的蘋果插圖" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByText("預覽學生畫面"));
        fireEvent.click(screen.getByRole("button", { name: "載入第 1 題圖片預覽" }));
        await waitFor(() => expect(getSpeakingQuestionPicturePreview).toHaveBeenCalledWith(mockFirebaseUser, 53));
        expect(await screen.findByRole("status")).toHaveTextContent("圖片尚未準備完成，請確認上傳狀態後再試。");
        expect(screen.queryByRole("img", { name: "教材中的蘋果插圖" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "載入第 1 題圖片預覽" }));
        await waitFor(() => expect(getSpeakingQuestionPicturePreview).toHaveBeenCalledTimes(2));
        expect(await screen.findByRole("img", { name: "教材中的蘋果插圖" })).toHaveAttribute("src", "https://r2.example/p21-preview.png");
        expect(screen.getByText("學生只會看到圖片，並在同一次錄音說出完整問句與回答。")).toBeInTheDocument();
    });

    it("shows the Leda female voice plan and loads a stored preview for a published question", async () => {
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
        fireEvent.click(await screen.findByRole("button", { name: /4 已發布/ }));
        fireEvent.click(await screen.findByRole("button", { name: /01 我來自哪裡/ }));
        fireEvent.click(await screen.findByText("預覽學生畫面"));
        expect(screen.getByText("女聲 · Leda")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "試聽第 1 題女聲示範" }));

        await waitFor(() => expect(getSpeakingQuestionAudioPreview).toHaveBeenCalledWith(mockFirebaseUser, 13, 31));
        expect(await screen.findByLabelText("第 1 題示範語音")).toHaveAttribute("src", "https://audio.example/leda.wav");
    });
});
