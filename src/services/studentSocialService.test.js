import { callEdgeFunction } from "./edgeFunctionClient";
import { blockStudent, getSocialOverview, respondFriendRequest, searchStudents, sendFriendRequest, updateSocialProfile } from "./studentSocialService";

jest.mock("./edgeFunctionClient", () => ({ callEdgeFunction: jest.fn() }));

describe("studentSocialService", () => {
    const firebaseUser = { uid: "student-1" };

    beforeEach(() => callEdgeFunction.mockReset());

    it("sends all social mutations through the Firebase-authenticated Edge Function", async () => {
        callEdgeFunction.mockResolvedValue({ success: true });

        await getSocialOverview(firebaseUser);
        await updateSocialProfile(firebaseUser, { nickname: "Alan Fox", stats_visibility: "friends", presence_visibility: "friends" });
        await searchStudents(firebaseUser, "AE-ABCDEFGH");
        await sendFriendRequest(firebaseUser, 12);
        await respondFriendRequest(firebaseUser, 5, "accept");
        await blockStudent(firebaseUser, 12);

        expect(callEdgeFunction.mock.calls).toEqual([
            ["student-social", firebaseUser, { action: "overview" }],
            ["student-social", firebaseUser, { action: "update_profile", nickname: "Alan Fox", stats_visibility: "friends", presence_visibility: "friends" }],
            ["student-social", firebaseUser, { action: "search", query: "AE-ABCDEFGH" }],
            ["student-social", firebaseUser, { action: "send_request", student_id: 12 }],
            ["student-social", firebaseUser, { action: "respond_request", request_id: 5, decision: "accept" }],
            ["student-social", firebaseUser, { action: "block", student_id: 12 }]
        ]);
    });
});
