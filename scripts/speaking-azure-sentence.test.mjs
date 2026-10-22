import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateAzureSentenceAssessment, publicRecheckResult } from "../supabase/functions/_shared/speaking-azure-sentence.ts";

const word = (Word, AccuracyScore, ErrorType = "None") => ({ Word, PronunciationAssessment: { AccuracyScore, ErrorType } });
const payload = (PronScore, words, Display = "It is her mouth.") => ({ NBest: [{ Display, PronunciationAssessment: { PronScore, AccuracyScore: PronScore, FluencyScore: 90, CompletenessScore: 100 }, Words: words }] });

test("每個重要的字都念到、整句 ≥ 60 才通過", () => {
    const ok = evaluateAzureSentenceAssessment(payload(82, [word("It", 90), word("is", 85), word("her", 92), word("mouth", 74)]));
    assert.equal(ok.answer_match, true);
    assert.equal(ok.scores.pronunciation, 82);
    assert.equal(ok.assessment_kind, "azure_pronunciation");
    const low = evaluateAzureSentenceAssessment(payload(55, [word("It", 90), word("is", 85), word("her", 92), word("mouth", 74)]));
    assert.equal(low.answer_match, false, "整句 55 不通過");
    const edge = evaluateAzureSentenceAssessment(payload(60, [word("It", 90), word("is", 85), word("her", 92), word("mouth", 74)]));
    assert.equal(edge.answer_match, true, "整句 60 剛好通過（國小生不用念得很標準）");
});

test("重要的字發音太差、漏念或多念 not 都不通過", () => {
    assert.equal(evaluateAzureSentenceAssessment(payload(80, [word("It", 90), word("is", 85), word("her", 92), word("mouth", 40)])).answer_match, false);
    assert.equal(evaluateAzureSentenceAssessment(payload(80, [word("It", 90), word("is", 85), word("her", 92), word("mouth", 0, "Omission")])).answer_match, false);
    assert.equal(evaluateAzureSentenceAssessment(payload(80, [word("It", 90), word("is", 85), word("not", 90, "Insertion"), word("her", 92), word("mouth", 80)])).answer_match, false);
    assert.equal(evaluateAzureSentenceAssessment(payload(80, [word("It", 90), word("is", 85), word("her", 70), word("mouth", 80)])).answer_match, false, "代名詞要 ≥ 80");
    assert.equal(evaluateAzureSentenceAssessment(payload(80, [word("It", 90), word("is", 30), word("her", 92), word("mouth", 80)])).answer_match, true, "is 這種小字不擋");
});

test("沒有結果時不算答錯", () => {
    const result = evaluateAzureSentenceAssessment({});
    assert.equal(result.assessment_status, "uncertain");
    assert.equal(result.answer_match, false);
});

test("自己說沒過時，回給手機的內容不含答案字", () => {
    const failed = evaluateAzureSentenceAssessment(payload(60, [word("It", 90), word("is", 85), word("her", 92), word("mouth", 30)]));
    const shown = publicRecheckResult(failed, "challenge", "It is her moth");
    assert.equal(shown.recognized_text, "It is her moth");
    assert.deepEqual(shown.words, []);
    assert.doesNotMatch(shown.feedback, /mouth/);
    assert.match(shown.feedback, /有 1 個字/);
    assert.equal(publicRecheckResult(failed, "easy", "It is her moth").words.length, 4);
});
