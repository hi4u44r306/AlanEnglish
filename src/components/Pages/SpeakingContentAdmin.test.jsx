import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SpeakingContentAdmin from "./SpeakingContentAdmin";
import {
    activatePictureGapTheAudioCandidate,
    activateSpeakingAlphabetAudioCandidate,
    archiveSpeakingQuestionSet,
    confirmPageCandidateSpeakingDraft,
    confirmWorkbookOneFoundationSource,
    createWorkbookOneFoundationQuestionSet,
    createWorkbookOneStarterQuestionSet,
    createWorkbookTwoStarterQuestionSet,
    generateSpeakingQuestionSet,
    generateSpeakingQuestionSetAudio,
    getPictureGapTheAudioCandidates,
    getSpeakingContentBootstrap,
    getSpeakingQuestionAudioPreview,
    getSpeakingQuestionPicturePreview,
    publishSpeakingQuestionSet,
    prepareSpeakingAlphabetAudioCandidate
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
    archiveSpeakingQuestionSet: jest.fn()
}));

describe("SpeakingContentAdmin whole-book OCR", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createWorkbookOneStarterQuestionSet.mockResolvedValue({ success: true, reused: false });
        createWorkbookOneFoundationQuestionSet.mockResolvedValue({ success: true, reused: false });
        confirmWorkbookOneFoundationSource.mockResolvedValue({ success: true });
        confirmPageCandidateSpeakingDraft.mockResolvedValue({ success: true });
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

    it("creates page-specific candidate drafts only from OCR text that is marked by page", async () => {
        jest.spyOn(window, "confirm").mockReturnValue(true);
        getSpeakingContentBootstrap.mockResolvedValue({
            books: [{ id: 1, name: "Workbook 1", code: "Workbook_1" }], documents: [{ id: 31, title: "Workbook 1", book_id: 1 }], chunks: [],
            sections: [{ id: 32, document_id: 31, unit_label: "Unit 1", page_from_label: "P4", page_to_label: "P5", topic: "身體部位", language_level: "國小低年級", status: "reviewed", source_text: "[[PAGE P4]]\\nIt is an eye.\\n[[PAGE P5]]\\nThey are her eyes." }],
            question_sets: []
        });

        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: /1 教材來源/ }));
        const candidateButton = await screen.findByRole("button", { name: "依每頁建立候選草稿" });
        fireEvent.click(candidateButton);

        await waitFor(() => expect(generateSpeakingQuestionSet).toHaveBeenCalledTimes(2));
        expect(generateSpeakingQuestionSet).toHaveBeenNthCalledWith(1, mockFirebaseUser, expect.objectContaining({ source_section_id: 32, source_page_label: "P4" }));
        expect(generateSpeakingQuestionSet).toHaveBeenNthCalledWith(2, mockFirebaseUser, expect.objectContaining({ source_section_id: 32, source_page_label: "P5" }));
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
                { id: 42, title: "P5 口說練習", status: "draft", generation_metadata: { source: "ocr_page_candidate", source_page_label: "P5", requires_content_review: true, duplicate_review: { excluded_count: 1 } }, speaking_questions: [{ id: 4 }, { id: 5 }, { id: 6 }] }
            ]
        });

        render(<SpeakingContentAdmin />);
        expect(await screen.findByRole("heading", { name: "逐頁候選待審核" })).toBeInTheDocument();
        expect(screen.getByLabelText("已逐題核對 P4 候選草稿")).not.toBeChecked();
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
        fireEvent.click(screen.getByRole("button", { name: "準備語音並發布" }));

        await waitFor(() => expect(publishSpeakingQuestionSet).toHaveBeenCalledWith(mockFirebaseUser, 82));
        expect(generateSpeakingQuestionSetAudio).toHaveBeenCalledWith(mockFirebaseUser, 82);
        expect(generateSpeakingQuestionSetAudio.mock.invocationCallOrder[0]).toBeLessThan(publishSpeakingQuestionSet.mock.invocationCallOrder[0]);
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
