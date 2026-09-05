import assert from "node:assert/strict";
import { buildSpeakingReferenceText, readSpeakingSlotValues } from "../supabase/functions/_shared/speaking-pronunciation-reference.ts";

assert.equal(buildSpeakingReferenceText("My name is Alan.", {}), "My name is Alan.");
assert.equal(
    buildSpeakingReferenceText("My name is [你的名字]. [你的名字] is easy to say.", readSpeakingSlotValues('{"你的名字":"Amy"}')),
    "My name is Amy. Amy is easy to say."
);
assert.equal(
    buildSpeakingReferenceText("My family name is ［你的姓氏］.", readSpeakingSlotValues('{"你的姓氏":"Lee"}')),
    "My family name is Lee."
);
assert.throws(() => buildSpeakingReferenceText("My name is [你的名字].", {}), error => error.code === "answer_slots_required");
assert.throws(() => buildSpeakingReferenceText("My name is Alan.", { "你的名字": "Amy" }), error => error.code === "answer_slots_required");
assert.throws(() => readSpeakingSlotValues('{"你的名字":"<script>"}'), error => error.code === "invalid_slot_value");
assert.throws(() => readSpeakingSlotValues('{"你的名字":""}'), error => error.code === "invalid_slot_value");

console.log("speaking pronunciation reference substitution contract passed");
