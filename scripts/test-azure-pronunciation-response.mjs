import assert from "node:assert/strict";
import { readAzureWordAssessment, selectAzureAssessmentResult } from "../supabase/functions/_shared/azure-pronunciation.ts";

const flatRestResponse = {
    RecognitionStatus: "Success",
    NBest: [{
        Display: "My name is Amy.",
        PronScore: 91,
        AccuracyScore: 94,
        FluencyScore: 88,
        CompletenessScore: 100,
        ProsodyScore: 82,
        Words: [{ Word: "My", AccuracyScore: 96, ErrorType: "None" }]
    }]
};
const flatResult = selectAzureAssessmentResult(flatRestResponse);
assert.equal(flatResult?.assessment.PronScore, 91);
assert.equal(flatResult?.assessment.CompletenessScore, 100);
assert.deepEqual(readAzureWordAssessment(flatRestResponse.NBest[0].Words[0]), { accuracyScore: 96, errorType: "None" });

const nestedSdkResponse = {
    NBest: [{
        Display: "My name is Amy.",
        PronunciationAssessment: { PronScore: 87, AccuracyScore: 90 },
        Words: [{ Word: "name", PronunciationAssessment: { AccuracyScore: 84, ErrorType: "Mispronunciation" } }]
    }]
};
const nestedResult = selectAzureAssessmentResult(nestedSdkResponse);
assert.equal(nestedResult?.assessment.PronScore, 87);
assert.deepEqual(readAzureWordAssessment(nestedSdkResponse.NBest[0].Words[0]), { accuracyScore: 84, errorType: "Mispronunciation" });

assert.equal(selectAzureAssessmentResult({ RecognitionStatus: "Success", NBest: [{ Display: "My name is Amy." }] }), null);

console.log("Azure pronunciation REST and SDK response contracts passed");
