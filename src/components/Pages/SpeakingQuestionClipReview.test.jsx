import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SpeakingQuestionClipReview, { clipsFromScriptOutput } from "./SpeakingQuestionClipReview";
import { importSpeakingQuestionClips, listSpeakingQuestionClips, reviewSpeakingQuestionClip } from "../../services/speakingContentService";

jest.mock("../../services/speakingContentService", () => ({
    listSpeakingQuestionClips: jest.fn(),
    importSpeakingQuestionClips: jest.fn(),
    reviewSpeakingQuestionClip: jest.fn()
}));
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const questions = [{ id: 265, sort_order: 0, model_answer: "It is an eye." }, { id: 266, sort_order: 1, model_answer: "They are her eyes." }];
const listing = {
    questions,
    tracks: [{ id: 114, title: "Workbook 3 P4", page: "P4" }],
    clips: [
        { id: 1, question_id: 265, source_type: "audio", track_id: 114, start_ms: 6280, end_ms: 11580, status: "draft", transcript_en: "It is an eye." },
        { id: 2, question_id: 266, source_type: "audio", track_id: 114, start_ms: 16520, end_ms: 22400, status: "approved", transcript_en: "They are her eyes." }
    ],
    preview_urls: { 114: "https://r2.example/p4.mp3" }
};

describe("clipsFromScriptOutput", () => {
    it("maps the script's item numbers to the set's question order and the chosen track", () => {
        const clips = clipsFromScriptOutput({ clips: [
            { n: 2, text: "They are her eyes.", start_ms: 16520, end_ms: 22400, confidence: 0.914, heard: "There are her eyes.", repeats: 2 },
            { n: 9, text: "missing", start_ms: 0, end_ms: 1000 }
        ] }, questions, 114);
        expect(clips).toEqual([{
            question_id: 266, source_type: "audio", track_id: 114, youtube_video_id: undefined,
            start_ms: 16520, end_ms: 22400, transcript_en: "They are her eyes.",
            generation_metadata: { source: "clipper_script", confidence: 0.914, heard: "There are her eyes.", repeats: 2 }
        }]);
    });
});

describe("SpeakingQuestionClipReview", () => {
    beforeEach(() => {
        listSpeakingQuestionClips.mockResolvedValue(listing);
        reviewSpeakingQuestionClip.mockResolvedValue({ success: true });
        importSpeakingQuestionClips.mockResolvedValue({ created: 1, skipped: 0, results: [] });
    });

    it("lists each question with its clips and approves a draft", async () => {
        await act(async () => { render(<SpeakingQuestionClipReview firebaseUser={{ uid: "admin" }} questionSetId={37} />); });
        expect(screen.getByText(/已核准 1／2 題/)).toBeTruthy();
        expect(screen.getAllByRole("button", { name: "聽這題" })).toHaveLength(2);
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "試聽沒問題，核准" })); });
        expect(reviewSpeakingQuestionClip).toHaveBeenCalledWith({ uid: "admin" }, 1, "approve");
        expect(listSpeakingQuestionClips).toHaveBeenCalledTimes(2);
    });

    it("imports pasted script output as drafts", async () => {
        await act(async () => { render(<SpeakingQuestionClipReview firebaseUser={{ uid: "admin" }} questionSetId={37} />); });
        fireEvent.change(screen.getByLabelText("片段 JSON"), { target: { value: JSON.stringify({ clips: [{ n: 1, start_ms: 6280, end_ms: 11580, text: "It is an eye." }] }) } });
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "匯入成草稿" })); });
        expect(importSpeakingQuestionClips).toHaveBeenCalledWith({ uid: "admin" }, 37, [expect.objectContaining({ question_id: 265, track_id: 114, start_ms: 6280 })]);
    });
});
