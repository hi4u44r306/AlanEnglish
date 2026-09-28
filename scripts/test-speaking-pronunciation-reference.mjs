import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    buildSpeakingReferenceText,
    hasSpeakingAnswerSlots,
    matchesSpeakingAnswerTemplate,
    readSpeakingSlotValues,
    speakingAnswerPrompt
} from "../supabase/functions/_shared/speaking-pronunciation-reference.ts";
import { matchesChildFriendlySentence } from "../supabase/functions/_shared/speaking-foundation-answer.ts";
import { authorizeSpeakingPronunciation } from "../supabase/functions/_shared/speaking-pronunciation-access.ts";
import { authorizeSpeakingChallenge } from "../supabase/functions/_shared/speaking-challenge-view.ts";

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

assert.equal(hasSpeakingAnswerSlots("My name is [你的名字]."), true);
assert.equal(hasSpeakingAnswerSlots("My name is Alan."), false);
assert.equal(speakingAnswerPrompt("My name is [你的名字]."), "My name is _____.");
assert.equal(matchesSpeakingAnswerTemplate("My name is [你的名字].", "My name is Amy."), true);
assert.equal(matchesSpeakingAnswerTemplate("My name is [你的名字].", "My name is Amy Lee."), true);
assert.equal(matchesSpeakingAnswerTemplate("My name is [你的名字].", "Amy."), false);
assert.equal(matchesSpeakingAnswerTemplate("My name is [你的名字].", "My name is."), false);

assert.equal(matchesChildFriendlySentence("It is an eraser.", "It's an eraser."), true);
assert.equal(matchesChildFriendlySentence("It is an eraser.", "It is eraser."), true);
assert.equal(matchesChildFriendlySentence("It is an eraser.", "It is a pencil."), false);
assert.equal(matchesChildFriendlySentence("No, it isn't mine.", "Yes, it is mine."), false);
assert.equal(matchesChildFriendlySentence("These are the books on the table.", "These are books on the table."), true);
assert.equal(matchesChildFriendlySentence("red", "read"), false);

const unusedAccessLoader = async () => { throw new Error("student lock must run before entitlement lookup"); };
assert.deepEqual(await authorizeSpeakingPronunciation({ role: "admin" }, unusedAccessLoader), { adminDemo: true, effectiveAccess: null });
assert.deepEqual(await authorizeSpeakingChallenge({ role: "teacher" }, unusedAccessLoader), { demoMode: true, effectiveAccess: null });
await assert.rejects(
    authorizeSpeakingPronunciation({ role: "student", id: 1 }, unusedAccessLoader),
    error => error.status === 423 && error.code === "student_speaking_games_paused"
);
await assert.rejects(
    authorizeSpeakingChallenge({ role: "student", id: 1 }, unusedAccessLoader),
    error => error.status === 423 && error.code === "student_speaking_games_paused"
);

const coachSource = readFileSync(new URL("../supabase/functions/pronunciation-coach/index.ts", import.meta.url), "utf8");
assert.match(coachSource, /isStructuredAnswer \? "structured_voice" : "scripted_voice"/);
assert.match(coachSource, /if \(!question\.isStructuredAnswer\) assessmentConfig\.ReferenceText = question\.referenceText/);
assert.doesNotMatch(coachSource, /form\?\.get\("slot_values"\)/);

console.log("speaking pronunciation reference substitution contract passed");
