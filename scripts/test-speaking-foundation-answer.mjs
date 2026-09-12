import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    matchesFoundationAnswer,
    normalizedSpokenSentence,
    readFoundationInteractionType,
    spokenLetterSequence,
    visibleSentenceWords
} from "../supabase/functions/_shared/speaking-foundation-answer.ts";
import {
    WORKBOOK_ONE_FOUNDATION_ACTIONS,
    WORKBOOK_ONE_FOUNDATION_TEMPLATES
} from "../supabase/functions/_shared/workbook-one-foundations.ts";

assert.equal(readFoundationInteractionType({ interaction_type: "alphabet_round" }), "alphabet_round");
assert.equal(readFoundationInteractionType({ interaction_type: "unknown" }), "");

assert.deepEqual(spokenLetterSequence("A, P, P, L, E"), ["A", "P", "P", "L", "E"]);
assert.deepEqual(spokenLetterSequence("ay pee pee ell e"), ["A", "P", "P", "L", "E"]);
assert.deepEqual(spokenLetterSequence("A double P L E"), ["A", "P", "P", "L", "E"]);
assert.deepEqual(spokenLetterSequence("double u"), ["W"]);
assert.equal(spokenLetterSequence("apple"), null);

assert.equal(matchesFoundationAnswer("alphabet_round", "B", "bee"), true);
assert.equal(matchesFoundationAnswer("alphabet_round", "C", "sea"), true);
assert.equal(matchesFoundationAnswer("alphabet_round", "B", "D"), false);
assert.equal(matchesFoundationAnswer("letter_spelling", "A P P L E", "A P P L E"), true);
assert.equal(matchesFoundationAnswer("letter_spelling", "A P P L E", "A P L E"), false);
assert.equal(matchesFoundationAnswer("letter_spelling", "A P P L E", "A P P E L"), false);
assert.equal(matchesFoundationAnswer("letter_spelling", "A P P L E", "apple"), false);
assert.equal(normalizedSpokenSentence("What is that?  It is an apple."), "what is that it is an apple");
assert.equal(matchesFoundationAnswer("picture_qa", "What is that? It is an apple.", "What is that? It is an apple."), true);
assert.equal(matchesFoundationAnswer("picture_qa", "What is that? It is an apple.", "It is an apple."), false);
assert.equal(matchesFoundationAnswer("picture_qa", "What is that? It is an apple.", "What's that? It's an apple.", ["What's that? It's an apple."]), true);
assert.equal(matchesFoundationAnswer("picture_gap_sentence", "The apple is in the tree.", "The apple is in the tree."), true);
assert.equal(matchesFoundationAnswer("picture_gap_sentence", "The apple is in the tree.", "Apple"), false);
assert.deepEqual(visibleSentenceWords("The ____ is in the tree."), [
    { text: "The", tokenIndex: 0 },
    { text: "is", tokenIndex: 2 },
    { text: "in", tokenIndex: 3 },
    { text: "the", tokenIndex: 4 },
    { text: "tree", tokenIndex: 5 }
]);

assert.equal(WORKBOOK_ONE_FOUNDATION_ACTIONS.length, 5);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_alphabet_round.questions.length, 26);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_spelling_p14.questions.length, 10);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_spelling_p15.questions.length, 12);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_spelling_p16.questions.length, 12);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_spelling_p17.questions.length, 13);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_spelling_p16.metadata.requires_brand_review, true);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_spelling_p14.sourceRequiresReview, true);

const coachSource = readFileSync(new URL("../supabase/functions/pronunciation-coach/index.ts", import.meta.url), "utf8");
const challengeSource = readFileSync(new URL("../supabase/functions/speaking-challenge/index.ts", import.meta.url), "utf8");
assert.match(coachSource, /matchesFoundationAnswer/);
assert.match(coachSource, /FOUNDATION_RATE_REQUEST_LIMIT/);
assert.match(challengeSource, /correct_assessment_required/);

console.log("Workbook 1 foundation answer and template contract passed");
