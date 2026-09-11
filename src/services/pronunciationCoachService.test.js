import {
    deleteSpeakingRecording,
    getSpeakingLearningSummary,
    getSpeakingRecordingHistory,
    getSpeakingRecordingUrl,
    submitPronunciationAttempt,
    submitSpeakingPronunciationAttempt
} from "./pronunciationCoachService";
import { callEdgeFunction } from "./edgeFunctionClient";

jest.mock("../components/Pages/supabase-config", () => ({
    supabaseUrl: "https://project.example.test",
    supabaseKey: "public-anon-key"
}));
jest.mock("./edgeFunctionClient", () => ({ callEdgeFunction: jest.fn() }));

describe("submitPronunciationAttempt", () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("使用 Firebase token 與 multipart 錄音呼叫發音評分 Function", async () => {
        const firebaseUser = { getIdToken: jest.fn().mockResolvedValue("firebase-token") };
        const responseBody = { success: true, scores: { pronunciation: 88 } };
        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(responseBody)
        });

        const result = await submitPronunciationAttempt({
            firebaseUser,
            lessonId: "greeting-good-morning",
            audio: new Blob(["wav-data"], { type: "audio/wav" })
        });

        expect(result).toEqual(responseBody);
        expect(firebaseUser.getIdToken).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
            "https://project.example.test/functions/v1/pronunciation-coach",
            expect.objectContaining({
                method: "POST",
                headers: {
                    Authorization: "Bearer firebase-token",
                    apikey: "public-anon-key"
                },
                body: expect.any(FormData)
            })
        );
        const request = global.fetch.mock.calls[0][1];
        expect(request.headers["Content-Type"]).toBeUndefined();
        expect(request.body.get("lesson_id")).toBe("greeting-good-morning");
        expect(request.body.get("audio")).toBeInstanceOf(Blob);
    });

    it("保留後端錯誤代碼供畫面顯示明確訊息", async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 503,
            json: jest.fn().mockResolvedValue({
                error: "發音評分測試服務尚未設定",
                code: "service_not_configured"
            })
        });

        await expect(submitPronunciationAttempt({
            firebaseUser: { getIdToken: jest.fn().mockResolvedValue("firebase-token") },
            lessonId: "greeting-good-morning",
            audio: new Blob(["wav-data"], { type: "audio/wav" })
        })).rejects.toMatchObject({
            message: "發音評分測試服務尚未設定",
            status: 503,
            code: "service_not_configured"
        });
    });

    it("題庫回答只傳 question_id 與錄音，不傳個人答案或示範文字", async () => {
        global.fetch.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ success: true }) });
        await submitSpeakingPronunciationAttempt({
            firebaseUser: { getIdToken: jest.fn().mockResolvedValue("firebase-token") },
            questionId: 42,
            audio: new Blob(["wav-data"], { type: "audio/wav" })
        });
        const body = global.fetch.mock.calls[0][1].body;
        expect(body.get("question_id")).toBe("42");
        expect(body.get("lesson_id")).toBeNull();
        expect(body.get("reference_text")).toBeNull();
        expect(body.get("slot_values")).toBeNull();
    });

    it("所有私人歷程操作都由 Firebase 驗證的發音服務處理", async () => {
        const firebaseUser = { uid: "student" };
        callEdgeFunction.mockResolvedValue({ success: true });

        await getSpeakingLearningSummary(firebaseUser);
        await getSpeakingRecordingHistory(firebaseUser);
        await getSpeakingRecordingHistory(firebaseUser, 24);
        await getSpeakingRecordingUrl(firebaseUser, 8);
        await deleteSpeakingRecording(firebaseUser, 8);

        expect(callEdgeFunction.mock.calls.map(call => [call[0], call[2]])).toEqual([
            ["pronunciation-coach", { action: "learning_summary" }],
            ["pronunciation-coach", { action: "recording_history" }],
            ["pronunciation-coach", { action: "recording_history", before_id: 24 }],
            ["pronunciation-coach", { action: "recording_url", attempt_id: 8 }],
            ["pronunciation-coach", { action: "delete_recording", attempt_id: 8 }]
        ]);
    });
});
