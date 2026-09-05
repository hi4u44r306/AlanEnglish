import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spokenExampleText } from "../supabase/functions/_shared/speaking-tts-text.ts";

assert.equal(spokenExampleText("My name is [你的名字]."), "My name is Amy.");
assert.equal(spokenExampleText("My family name is ［你的姓氏］."), "My family name is Lee.");
assert.equal(spokenExampleText("My full name is 【你的全名】."), "My full name is Amy Lee.");
assert.equal(spokenExampleText("I am [你的年齡] years old."), "I am ten years old.");
assert.equal(spokenExampleText("My answer is [請填入答案]."), "My answer is an example.");
assert.equal(spokenExampleText("I like ______."), "I like an example.");
assert.equal(/[\u3400-\u9fff［］【】]/.test(spokenExampleText("My name is ［你的名字］.")), false);

const managerSource = readFileSync(new URL("../supabase/functions/speaking-tts-manager/index.ts", import.meta.url), "utf8");
assert.match(managerSource, /const OUTPUT_FORMAT = "wav";/);
assert.match(managerSource, /const PIPELINE_VERSION = "elementary-clear-v3";/);
assert.match(managerSource, /audioEncoding: "LINEAR16", speakingRate: 0\.82/);
assert.match(managerSource, /settingsHash\.slice\(0, 16\)\}\.wav/);
assert.match(managerSource, /"Content-Type": "audio\/wav"/);

console.log("speaking TTS text normalization and elementary audio contract passed");
