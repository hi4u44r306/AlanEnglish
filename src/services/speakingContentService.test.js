import {
    generateSpeakingQuestionSet,
    getSpeakingContentBootstrap,
    publishSpeakingQuestionSet,
    saveReviewedSpeakingSource,
    updateDraftSpeakingQuestion
} from "./speakingContentService";
import { callEdgeFunction } from "./edgeFunctionClient";

jest.mock("./edgeFunctionClient", () => ({ callEdgeFunction: jest.fn() }));

describe("speakingContentService", () => {
    const firebaseUser = { uid: "admin" };
    beforeEach(() => callEdgeFunction.mockReset().mockResolvedValue({ success: true }));

    it("routes all speaking content actions through the protected manager", async () => {
        await getSpeakingContentBootstrap(firebaseUser);
        await saveReviewedSpeakingSource(firebaseUser, { book_id: 1 });
        await generateSpeakingQuestionSet(firebaseUser, { source_section_id: 2, request_key: "key" });
        await updateDraftSpeakingQuestion(firebaseUser, { question_id: 3, question: {} });
        await publishSpeakingQuestionSet(firebaseUser, 4);

        expect(callEdgeFunction.mock.calls.map(call => [call[0], call[2].action])).toEqual([
            ["speaking-content-manager", "bootstrap"],
            ["speaking-content-manager", "save_reviewed_source"],
            ["speaking-content-manager", "generate_question_set"],
            ["speaking-content-manager", "update_draft_question"],
            ["speaking-content-manager", "publish_question_set"]
        ]);
    });
});
