import { submitPronunciationAttempt, submitSpeakingPronunciationAttempt } from "./pronunciationCoachService";

jest.mock("../components/Pages/supabase-config", () => ({
    supabaseUrl: "https://project.example.test",
    supabaseKey: "public-anon-key"
}));

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

    it("題庫回答只傳 question_id 與本機辨識文字，不傳個人答案或示範文字", async () => {
        global.fetch.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ success: true }) });
        await submitSpeakingPronunciationAttempt({
            firebaseUser: { getIdToken: jest.fn().mockResolvedValue("firebase-token") },
            questionId: 42,
            recognizedText: "I like apples.", audioSeconds: 2
        });
        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body.question_id).toBe(42);
        expect(body.lesson_id).toBeUndefined();
        expect(body.reference_text).toBeUndefined();
        expect(body.slot_values).toBeUndefined();
        expect(body.foundation_round_id).toBe("");
        expect(body.challenge_mode).toBe("easy");
    });

    it("A–Z 評分只附上後端簽發的 round id，不傳成功狀態或題序", async () => {
        global.fetch.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ success: true }) });
        await submitSpeakingPronunciationAttempt({
            firebaseUser: { getIdToken: jest.fn().mockResolvedValue("firebase-token") },
            questionId: 42,
            foundationRoundId: "11111111-1111-4111-8111-111111111111",
            recognizedText: "I like apples.", audioSeconds: 2
        });

        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body.foundation_round_id).toBe("11111111-1111-4111-8111-111111111111");
        expect(body.answer_match).toBeUndefined();
        expect(body.question_order).toBeUndefined();
    });

    it("保留 A–Z 回合失效代碼，讓畫面安全歸零", async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 409,
            json: jest.fn().mockResolvedValue({
                error: "這一輪已失效，請從第一題重新開始",
                code: "foundation_round_invalid"
            })
        });

        await expect(submitSpeakingPronunciationAttempt({
            firebaseUser: { getIdToken: jest.fn().mockResolvedValue("firebase-token") },
            questionId: 42,
            foundationRoundId: "11111111-1111-4111-8111-111111111111",
            recognizedText: "I like apples.", audioSeconds: 2
        })).rejects.toMatchObject({
            status: 409,
            code: "foundation_round_invalid"
        });
    });
});
