import {
    generateSpeakingQuestionSet,
    getSpeakingContentBootstrap,
    prepareSpeakingSourceUpload,
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
        await discardSpeakingSourceUpload(firebaseUser, 12);
        await reviewSpeakingOcrSource(firebaseUser, { source_section_id: 1 });
        await saveReviewedSpeakingSource(firebaseUser, { book_id: 1 });
        await generateSpeakingQuestionSet(firebaseUser, { source_section_id: 2, request_key: "key" });
        await updateDraftSpeakingQuestion(firebaseUser, { question_id: 3, question: {} });
        await publishSpeakingQuestionSet(firebaseUser, 4);

        expect(callEdgeFunction.mock.calls.map(call => [call[0], call[2].action])).toEqual([
            ["speaking-content-manager", "bootstrap"],
            ["speaking-content-manager", "create_document_upload"],
            ["speaking-content-manager", "extract_document"],
            ["speaking-content-manager", "extract_book_chunk"],
            ["speaking-content-manager", "discard_document_upload"],
            ["speaking-content-manager", "review_ocr_source"],
            ["speaking-content-manager", "save_reviewed_source"],
            ["speaking-content-manager", "generate_question_set"],
            ["speaking-content-manager", "update_draft_question"],
            ["speaking-content-manager", "publish_question_set"]
        ]);
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
});
