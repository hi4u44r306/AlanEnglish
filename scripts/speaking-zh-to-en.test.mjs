import { test } from "node:test";
import assert from "node:assert/strict";
import {
    textQaPromptIsComplete,
    zhToEnAnswerIsComplete,
    zhToEnPromptIsComplete
} from "../supabase/functions/_shared/speaking-text-qa.ts";

test("中翻英接受中文題面與完整英文翻譯，保留英文問答原有規則", () => {
    assert.equal(zhToEnPromptIsComplete("你每天有做任何運動嗎？它對你的健康有益（中翻英）"), true);
    assert.equal(zhToEnPromptIsComplete("Do you exercise every day?"), false);
    assert.equal(zhToEnAnswerIsComplete("Do you do any exercise every day? It is good for your health."), true);
    assert.equal(zhToEnAnswerIsComplete("每天運動有益健康。"), false);
    assert.equal(textQaPromptIsComplete("What are those?（尺）"), true);
    assert.equal(textQaPromptIsComplete("你每天運動嗎？"), false);
});
