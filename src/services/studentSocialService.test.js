import { callEdgeFunction } from "./edgeFunctionClient";
import * as studentSocialService from "./studentSocialService";

jest.mock("./edgeFunctionClient", () => ({ callEdgeFunction: jest.fn() }));

describe("studentSocialService", () => {
    const firebaseUser = { uid: "student-1" };

    beforeEach(() => callEdgeFunction.mockReset());

    it("sends nickname requests through the Firebase-authenticated Edge Function", async () => {
        callEdgeFunction.mockResolvedValue({ success: true });

        await studentSocialService.getNicknameSettings(firebaseUser);
        await studentSocialService.updateNickname(firebaseUser, "Brave Owl");

        expect(callEdgeFunction.mock.calls).toEqual([
            ["student-social", firebaseUser, { action: "nickname_settings" }],
            ["student-social", firebaseUser, { action: "update_nickname", nickname: "Brave Owl" }]
        ]);
    });

    it("no longer exposes the retired friends actions", () => {
        expect(Object.keys(studentSocialService).sort()).toEqual(["getNicknameSettings", "updateNickname"]);
    });
});
