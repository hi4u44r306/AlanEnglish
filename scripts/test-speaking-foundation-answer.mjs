import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    matchesFoundationAnswer,
    normalizedSpokenSentence,
    pictureGapAnswerMatchesPrompt,
    pictureQaResponseHasQuestionAndAnswer,
    readFoundationInteractionType,
    spokenLetterSequence,
    usesUnscriptedFoundationAssessment,
    visibleSentenceWords
} from "../supabase/functions/_shared/speaking-foundation-answer.ts";
import {
    approvedSpellingContentMatches,
    WORKBOOK_ONE_FOUNDATION_ACTIONS,
    WORKBOOK_ONE_FOUNDATION_TEMPLATES,
    workbookOneFoundationTemplateByKey
} from "../supabase/functions/_shared/workbook-one-foundations.ts";

assert.equal(readFoundationInteractionType({ interaction_type: "alphabet_round" }), "alphabet_round");
assert.equal(readFoundationInteractionType({ interaction_type: "unknown" }), "");
assert.equal(usesUnscriptedFoundationAssessment("picture_qa"), true);
assert.equal(usesUnscriptedFoundationAssessment("picture_gap_sentence"), true);
assert.equal(usesUnscriptedFoundationAssessment("letter_spelling"), false);

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
assert.equal(pictureGapAnswerMatchesPrompt("The ____ is in the tree.", "The apple is in the tree."), true);
assert.equal(pictureGapAnswerMatchesPrompt("The ____ is in the tree.", "Apple"), false);
assert.equal(pictureGapAnswerMatchesPrompt("The ____ is in the tree.", "The apple is on the table."), false);
assert.equal(pictureQaResponseHasQuestionAndAnswer("What is that? It is an apple."), true);
assert.equal(pictureQaResponseHasQuestionAndAnswer("What is that?"), false);
assert.equal(pictureQaResponseHasQuestionAndAnswer("It is an apple."), false);

assert.equal(WORKBOOK_ONE_FOUNDATION_ACTIONS.length, 5);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_alphabet_round.questions.length, 26);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_spelling_p14.questions.length, 10);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_spelling_p15.questions.length, 12);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_spelling_p16.questions.length, 12);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_spelling_p17.questions.length, 12);
assert.deepEqual(
    WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_spelling_p17.questions.map(question => question.question_text),
    ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"]
);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_spelling_p16.metadata.brand_review_completed, true);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_spelling_p14.sourceRequiresReview, false);
assert.equal(WORKBOOK_ONE_FOUNDATION_TEMPLATES.create_workbook_1_spelling_p14.approvedSourcePageLabel, "P14");

for (const action of [
    "create_workbook_1_spelling_p14",
    "create_workbook_1_spelling_p15",
    "create_workbook_1_spelling_p16",
    "create_workbook_1_spelling_p17"
]) {
    const template = WORKBOOK_ONE_FOUNDATION_TEMPLATES[action];
    const prompts = template.questions.map(question => question.question_text);
    const questions = template.questions.map((question, sortOrder) => ({ ...question, sort_order: sortOrder }));
    assert.equal(workbookOneFoundationTemplateByKey(template.templateKey), template);
    assert.equal(approvedSpellingContentMatches(template, prompts, questions), true);
    assert.equal(approvedSpellingContentMatches(template, [...prompts, "not-approved"], questions), false);
    assert.equal(approvedSpellingContentMatches(template, prompts.slice(0, -1), questions), false);
    assert.equal(approvedSpellingContentMatches(template, [...prompts].reverse(), questions), false);
    assert.equal(approvedSpellingContentMatches(template, prompts, questions.map((question, index) => (
        index === 0 ? { ...question, model_answer: `${question.model_answer} X` } : question
    ))), false);
}

const coachSource = readFileSync(new URL("../supabase/functions/pronunciation-coach/index.ts", import.meta.url), "utf8");
const challengeSource = readFileSync(new URL("../supabase/functions/speaking-challenge/index.ts", import.meta.url), "utf8");
const requestLedgerSource = readFileSync(new URL("../supabase/migrations/20260913013037_speaking_pronunciation_request_ledger.sql", import.meta.url), "utf8");
assert.match(coachSource, /matchesFoundationAnswer/);
assert.match(coachSource, /usesUnscriptedFoundationAssessment/);
assert.match(coachSource, /reference_text: question\.interactionType \? null/);
assert.match(coachSource, /reserveProviderRequest/);
assert.match(requestLedgerSource, /v_recent_limit integer := case when v_is_foundation then 60 else 12 end/);
assert.match(requestLedgerSource, /v_daily_count >= 160/);
assert.match(challengeSource, /correct_assessment_required/);

console.log("Workbook 1 foundation answer and template contract passed");
