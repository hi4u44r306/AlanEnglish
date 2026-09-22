import {
    activatePictureGapTheAudioCandidate,
    activateSpeakingAlphabetAudioCandidate,
    analyzeSpeakingBookChunkVisualPages,
    confirmWorkbookOneFoundationSource,
    createWorkbookOneFoundationQuestionSet,
    createWorkbookOneStarterQuestionSet,
    createSpeakingQuestionSetRevision,
    createWorkbookTwoStarterQuestionSet,
    updateSpeakingQuestionSetDraft,
    updatePictureDraftQuestion,
    addPictureDraftQuestion,
    createManualSpeakingDraft,
    updateManualStandardQuestion,
    addManualStandardQuestion,
    deleteDraftSpeakingQuestion,
    reorderDraftSpeakingQuestions,
    archiveSpeakingQuestionSet,
    confirmPageCandidateSpeakingDraft,
    generateSpeakingQuestionSet,
    generateSpeakingQuestionSetAudio,
    getSpeakingQuestionAudioPreview,
    getPictureGapTheAudioCandidates,
    getSpeakingQuestionPicturePreview,
    getWorkbookOnePictureReviewCandidates,
    getSpeakingContentBootstrap,
    prepareSpeakingSourceUpload,
    prepareSpeakingAlphabetAudioCandidate,
    restorePictureGapStandardAudio,
    publishSpeakingQuestionSet,
    reviewSpeakingOcrSource,
    saveReviewedSpeakingSource,
    extractSpeakingSourceDocument,
    extractSpeakingBookChunk,
    discardSpeakingSourceUpload,
    uploadAndExtractSpeakingSource,
    uploadWholeBookSource,
    updateDraftSpeakingQuestion
} from "./speakingContentService";
import { callEdgeFunction } from "./edgeFunctionClient";
import { PDFDocument } from "pdf-lib";

jest.mock("./edgeFunctionClient", () => ({ callEdgeFunction: jest.fn() }));

describe("speakingContentService", () => {
    const firebaseUser = { uid: "admin" };
    const originalFetch = global.fetch;
    beforeEach(() => callEdgeFunction.mockReset().mockResolvedValue({ success: true }));
    afterEach(() => { global.fetch = originalFetch; });

    it("routes all speaking content actions through the protected manager", async () => {
        await getSpeakingContentBootstrap(firebaseUser);
        await prepareSpeakingSourceUpload(firebaseUser, { book_id: 1 });
        await extractSpeakingSourceDocument(firebaseUser, { document_id: 1 });
        await extractSpeakingBookChunk(firebaseUser, 11);
        await analyzeSpeakingBookChunkVisualPages(firebaseUser, 13, "11111111-1111-4111-8111-111111111111");
        await discardSpeakingSourceUpload(firebaseUser, 12);
        await reviewSpeakingOcrSource(firebaseUser, { source_section_id: 1 });
        await saveReviewedSpeakingSource(firebaseUser, { book_id: 1 });
        await generateSpeakingQuestionSet(firebaseUser, { source_section_id: 2, request_key: "key" });
        await confirmPageCandidateSpeakingDraft(firebaseUser, 41);
        await createWorkbookOneStarterQuestionSet(firebaseUser, 1);
        await createWorkbookOneFoundationQuestionSet(firebaseUser, 1, "create_workbook_1_spelling_p14");
        await createWorkbookOneFoundationQuestionSet(firebaseUser, 1, "create_workbook_1_p26_p27_contractions");
        await confirmWorkbookOneFoundationSource(firebaseUser, 14);
        await createWorkbookTwoStarterQuestionSet(firebaseUser, 2);
        await updateDraftSpeakingQuestion(firebaseUser, { question_id: 3, question: {} });
        await createSpeakingQuestionSetRevision(firebaseUser, 21);
        await updateSpeakingQuestionSetDraft(firebaseUser, { question_set_id: 22, title: "P21", topic: "看圖問答" });
        await updatePictureDraftQuestion(firebaseUser, { question_set_id: 22, question_id: 23, question: {} });
        await addPictureDraftQuestion(firebaseUser, { question_set_id: 22, question: {} });
        await createManualSpeakingDraft(firebaseUser, { book_id: 1, page_from_label: "P28", page_to_label: "P29" });
        await updateManualStandardQuestion(firebaseUser, { question_set_id: 30, question_id: 31, question: {} });
        await addManualStandardQuestion(firebaseUser, { question_set_id: 30, question: {} });
        await deleteDraftSpeakingQuestion(firebaseUser, 22, 23);
        await reorderDraftSpeakingQuestions(firebaseUser, 22, [24, 23]);
        await archiveSpeakingQuestionSet(firebaseUser, 22);
        await publishSpeakingQuestionSet(firebaseUser, 4);
        await generateSpeakingQuestionSetAudio(firebaseUser, 4);
        await prepareSpeakingAlphabetAudioCandidate(firebaseUser, 7);
        await activateSpeakingAlphabetAudioCandidate(firebaseUser, 7, "11111111-1111-4111-8111-111111111111");
        await getSpeakingQuestionAudioPreview(firebaseUser, 4, 8);
        await getPictureGapTheAudioCandidates(firebaseUser, 4, 8);
        await activatePictureGapTheAudioCandidate(firebaseUser, 4, 8, "context-natural");
        await restorePictureGapStandardAudio(firebaseUser, 4, 8);
        await getSpeakingQuestionPicturePreview(firebaseUser, 9);
        await getWorkbookOnePictureReviewCandidates(firebaseUser, "P21");

        expect(callEdgeFunction.mock.calls.map(call => [call[0], call[2].action])).toEqual([
            ["speaking-content-manager", "bootstrap"],
            ["speaking-content-manager", "create_document_upload"],
            ["speaking-content-manager", "extract_document"],
            ["speaking-content-manager", "extract_book_chunk"],
            ["speaking-content-manager", "analyze_book_chunk_visual_pages"],
            ["speaking-content-manager", "discard_document_upload"],
            ["speaking-content-manager", "review_ocr_source"],
            ["speaking-content-manager", "save_reviewed_source"],
            ["speaking-content-manager", "generate_question_set"],
            ["speaking-content-manager", "confirm_page_candidate_draft"],
            ["speaking-content-manager", "create_workbook_1_starter"],
            ["speaking-content-manager", "create_workbook_1_spelling_p14"],
            ["speaking-content-manager", "create_workbook_1_p26_p27_contractions"],
            ["speaking-content-manager", "confirm_workbook_1_foundation_source"],
            ["speaking-content-manager", "create_workbook_2_starter"],
            ["speaking-content-manager", "update_draft_question"],
            ["speaking-content-manager", "create_question_set_revision"],
            ["speaking-content-manager", "update_question_set_draft"],
            ["speaking-content-manager", "update_picture_draft_question"],
            ["speaking-content-manager", "add_picture_draft_question"],
            ["speaking-content-manager", "create_manual_speaking_draft"],
            ["speaking-content-manager", "update_manual_standard_question"],
            ["speaking-content-manager", "add_manual_standard_question"],
            ["speaking-content-manager", "delete_draft_question"],
            ["speaking-content-manager", "reorder_draft_questions"],
            ["speaking-content-manager", "archive_question_set"],
            ["speaking-content-manager", "publish_question_set"],
            ["speaking-tts-manager", "generate_set_audio"],
            ["speaking-tts-manager", "prepare_alphabet_audio_candidate"],
            ["speaking-tts-manager", "activate_alphabet_audio_candidate"],
            ["speaking-tts-manager", "preview_question_audio"],
            ["speaking-tts-manager", "preview_picture_gap_the_candidates"],
            ["speaking-tts-manager", "activate_picture_gap_the_candidate"],
            ["speaking-tts-manager", "restore_picture_gap_standard_audio"],
            ["speaking-content-manager", "preview_question_picture"],
            ["speaking-content-manager", "get_workbook_1_picture_review_candidates"]
        ]);
        expect(callEdgeFunction.mock.calls.at(-1)?.[2]).toEqual({
            action: "get_workbook_1_picture_review_candidates",
            page_label: "P21"
        });
    });

    it("uploads the private file before asking the manager to extract OCR text", async () => {
        callEdgeFunction
            .mockResolvedValueOnce({ document_id: 7, upload: { url: "https://r2.example/private", method: "PUT", headers: { "Content-Type": "application/pdf" } } })
            .mockResolvedValueOnce({ success: true, source_section_id: 9 });
        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
        const file = new File(["%PDF-test"], "unit-3.pdf", { type: "application/pdf" });

        await uploadAndExtractSpeakingSource(firebaseUser, file, { book_id: 2, document_title: "Unit 3", topic: "Food" });

        expect(global.fetch).toHaveBeenCalledWith("https://r2.example/private", expect.objectContaining({ method: "PUT", body: file }));
        expect(callEdgeFunction.mock.calls.map(call => call[2].action)).toEqual(["create_document_upload", "extract_document"]);
        expect(callEdgeFunction.mock.calls[1][2]).toEqual(expect.objectContaining({ document_id: 7, topic: "Food" }));
    });

    it("splits and uploads the original book plus private chunks before confirming", async () => {
        const pdf = await PDFDocument.create();
        for (let index = 0; index < 12; index += 1) pdf.addPage([400, 600]);
        const bytes = await pdf.save();
        const file = {
            name: "workbook-2.pdf", type: "application/pdf", size: bytes.byteLength,
            arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        };
        callEdgeFunction
            .mockResolvedValueOnce({
                document_id: 20,
                original_upload: { url: "https://r2.example/original", method: "PUT" },
                chunk_uploads: [
                    { chunk_id: 21, chunk_index: 0, url: "https://r2.example/chunk-1", method: "PUT" },
                    { chunk_id: 22, chunk_index: 1, url: "https://r2.example/chunk-2", method: "PUT" }
                ]
            })
            .mockResolvedValueOnce({ success: true, document_id: 20 });
        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

        await uploadWholeBookSource(firebaseUser, file, { book_id: 2, document_title: "Workbook 2" });

        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(callEdgeFunction.mock.calls.map(call => call[2].action)).toEqual(["create_book_upload", "confirm_book_upload"]);
        expect(callEdgeFunction.mock.calls[0][2]).toEqual(expect.objectContaining({
            page_count: 12,
            chunks: [
                expect.objectContaining({ chunk_index: 0, page_from: 1, page_to: 10 }),
                expect.objectContaining({ chunk_index: 1, page_from: 11, page_to: 12 })
            ]
        }));
    });

    it("turns a browser R2 fetch failure into an actionable CORS message and cleans up", async () => {
        const pdf = await PDFDocument.create();
        pdf.addPage([400, 600]);
        const bytes = await pdf.save();
        const file = {
            name: "workbook-2.pdf", type: "application/pdf", size: bytes.byteLength,
            arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        };
        callEdgeFunction
            .mockResolvedValueOnce({
                document_id: 30,
                original_upload: { url: "https://r2.example/original", method: "PUT" },
                chunk_uploads: [{ chunk_id: 31, chunk_index: 0, url: "https://r2.example/chunk-1", method: "PUT" }]
            })
            .mockResolvedValueOnce({ success: true });
        global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));

        await expect(uploadWholeBookSource(firebaseUser, file, { book_id: 2, document_title: "Workbook 2" }))
            .rejects.toThrow("R2 CORS 已允許目前網站與 PUT 上傳");
        expect(callEdgeFunction.mock.calls.map(call => call[2].action)).toEqual([
            "create_book_upload",
            "discard_document_upload"
        ]);
    });
});
