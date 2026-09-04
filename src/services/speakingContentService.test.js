import {
    generateSpeakingQuestionSet,
    getSpeakingContentBootstrap,
    prepareSpeakingSourceUpload,
    publishSpeakingQuestionSet,
    reviewSpeakingOcrSource,
    saveReviewedSpeakingSource,
    extractSpeakingSourceDocument,
    uploadAndExtractSpeakingSource,
    updateDraftSpeakingQuestion
} from "./speakingContentService";
import { callEdgeFunction } from "./edgeFunctionClient";

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
        await reviewSpeakingOcrSource(firebaseUser, { source_section_id: 1 });
        await saveReviewedSpeakingSource(firebaseUser, { book_id: 1 });
        await generateSpeakingQuestionSet(firebaseUser, { source_section_id: 2, request_key: "key" });
        await updateDraftSpeakingQuestion(firebaseUser, { question_id: 3, question: {} });
        await publishSpeakingQuestionSet(firebaseUser, 4);

        expect(callEdgeFunction.mock.calls.map(call => [call[0], call[2].action])).toEqual([
            ["speaking-content-manager", "bootstrap"],
            ["speaking-content-manager", "create_document_upload"],
            ["speaking-content-manager", "extract_document"],
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
});
