import { callEdgeFunction } from "./edgeFunctionClient";
import {
    completeSpeakingChallengeQuestion,
    getSpeakingChallengeCatalog,
    getSpeakingChallengeSet,
    startSpeakingFoundationRound
} from "./speakingChallengeService";

jest.mock("./edgeFunctionClient", () => ({ callEdgeFunction: jest.fn() }));

describe("speakingChallengeService", () => {
    const firebaseUser = { uid: "student" };

    beforeEach(() => {
        callEdgeFunction.mockResolvedValue({ success: true });
        jest.clearAllMocks();
    });

    it("uses Firebase-authenticated actions for catalog and question sets", async () => {
        await getSpeakingChallengeCatalog(firebaseUser);
        await getSpeakingChallengeSet(firebaseUser, 7);

        expect(callEdgeFunction).toHaveBeenNthCalledWith(1, "speaking-challenge", firebaseUser, { action: "catalog" });
        expect(callEdgeFunction).toHaveBeenNthCalledWith(2, "speaking-challenge", firebaseUser, { action: "question_set", question_set_id: 7 });
    });

    it("starts an A-Z round without accepting client question order or student identity", async () => {
        await startSpeakingFoundationRound(firebaseUser, 7);

        expect(callEdgeFunction).toHaveBeenCalledWith("speaking-challenge", firebaseUser, {
            action: "start_foundation_round",
            question_set_id: 7
        });
    });

    it("keeps ordinary question completion scoped to set and question ids", async () => {
        await completeSpeakingChallengeQuestion(firebaseUser, 7, 9);

        expect(callEdgeFunction).toHaveBeenCalledWith("speaking-challenge", firebaseUser, {
            action: "complete_question",
            question_set_id: 7,
            question_id: 9
        });
    });
});
