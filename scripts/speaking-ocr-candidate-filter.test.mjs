import assert from "node:assert/strict";
import test from "node:test";
import { filterOcrPageSpeakingCandidates } from "../supabase/functions/_shared/speaking-ocr-candidate-filter.ts";

test("keeps only complete, speakable English sentences for automatic OCR candidates", () => {
    const result = filterOcrPageSpeakingCandidates(`Workbook 3
Page 4
1. It is an eye.（一隻）
Look at the picture.
__________
| | | | |
They are her eyes.
A. This is my book!
www.alanenglish.com.tw`);

    assert.deepEqual(result.sentences, ["It is an eye.", "They are her eyes.", "This is my book!"]);
    assert.equal(result.sourceText, "It is an eye.\nThey are her eyes.\nThis is my book!");
    assert.ok(result.discardedSegments >= 5);
});

test("does not turn incomplete exercises or directions into automatic speaking questions", () => {
    const result = filterOcrPageSpeakingCandidates(`P12
Read and circle.
It is ____.
Name: __________
1 2 3 4`);

    assert.deepEqual(result.sentences, []);
    assert.ok(result.discardedSegments >= 4);
});
