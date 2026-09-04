import assert from "node:assert/strict";
import { spokenExampleText } from "../supabase/functions/_shared/speaking-tts-text.ts";

assert.equal(spokenExampleText("My name is [你的名字]."), "My name is Amy.");
assert.equal(spokenExampleText("My family name is ［你的姓氏］."), "My family name is Lee.");
assert.equal(spokenExampleText("My full name is 【你的全名】."), "My full name is Amy Lee.");
assert.equal(spokenExampleText("I am [你的年齡] years old."), "I am ten years old.");
assert.equal(spokenExampleText("My answer is [請填入答案]."), "My answer is an example.");
assert.equal(spokenExampleText("I like ______."), "I like an example.");
assert.equal(/[\u3400-\u9fff［］【】]/.test(spokenExampleText("My name is ［你的名字］.")), false);

console.log("speaking TTS text normalization passed");
