import assert from "node:assert/strict";
import test from "node:test";
import { wholeBookOcrPageMarkersMatch } from "../supabase/functions/_shared/speaking-ocr-page-markers.ts";

test("accepts exactly one ordered marker for every page in a whole-book OCR chunk", () => {
    assert.equal(wholeBookOcrPageMarkersMatch("[[PAGE P21]]\n1. The ____ is in the tree.\n[[PAGE P22]]\n2. It is a cat.", 21, 22), true);
});

test("rejects missing, duplicate, out-of-range, or inline page markers", () => {
    assert.equal(wholeBookOcrPageMarkersMatch("21\nThe ____ is in the tree.\n[[PAGE P22]]\nIt is a cat.", 21, 22), false);
    assert.equal(wholeBookOcrPageMarkersMatch("[[PAGE P21]]\n[[PAGE P21]]", 21, 22), false);
    assert.equal(wholeBookOcrPageMarkersMatch("[[PAGE P21]]\n[[PAGE P23]]", 21, 22), false);
    assert.equal(wholeBookOcrPageMarkersMatch("Some text [[PAGE P21]]\n[[PAGE P22]]", 21, 22), false);
});
