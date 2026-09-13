import { test } from "node:test";
import assert from "node:assert/strict";
import { toPublicErrorResponse } from "../supabase/functions/_shared/public-error.ts";

test("學生可處理的 4xx 錯誤保留安全提示與代碼", () => {
    assert.deepEqual(
        toPublicErrorResponse(
            { status: 409, message: "這一題要先完成正確的口說評分", code: "correct_assessment_required" },
            "口說大挑戰服務發生錯誤"
        ),
        {
            status: 409,
            payload: {
                error: "這一題要先完成正確的口說評分",
                code: "correct_assessment_required"
            }
        }
    );
});

test("5xx 錯誤不把資料庫或內部實作細節回傳給學生", () => {
    const result = toPublicErrorResponse(
        {
            status: 500,
            message: "relation private.student_entitlements does not exist",
            code: "42P01"
        },
        "口說大挑戰服務發生錯誤"
    );

    assert.deepEqual(result, {
        status: 500,
        payload: { error: "口說大挑戰服務發生錯誤", code: null }
    });
    assert.doesNotMatch(JSON.stringify(result), /student_entitlements|42P01/);
});

test("無效或缺少 status 的例外採 fail-closed 泛化回應", () => {
    assert.deepEqual(
        toPublicErrorResponse(new Error("unexpected internal detail"), "口說大挑戰服務發生錯誤"),
        {
            status: 500,
            payload: { error: "口說大挑戰服務發生錯誤", code: null }
        }
    );
});
