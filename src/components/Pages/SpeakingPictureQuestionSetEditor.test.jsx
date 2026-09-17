import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SpeakingPictureQuestionSetEditor from "./SpeakingPictureQuestionSetEditor";
import { getPictureGapTheAudioCandidates } from "../../services/speakingContentService";

jest.mock("../../services/speakingContentService", () => ({
    addPictureDraftQuestion: jest.fn(),
    deleteDraftSpeakingQuestion: jest.fn(),
    generateSpeakingVisibleWordAudio: jest.fn(),
    getPictureGapTheAudioCandidates: jest.fn(),
    getSpeakingQuestionAudioPreview: jest.fn(),
    getSpeakingQuestionPicturePreview: jest.fn(),
    reorderDraftSpeakingQuestions: jest.fn(),
    updatePictureDraftQuestion: jest.fn(),
    updateSpeakingQuestionSetDraft: jest.fn(),
    uploadSpeakingQuestionPicture: jest.fn()
}));

const questionSet = {
    id: 24,
    title: "P24 看圖補句",
    topic: "Workbook 1",
    generation_metadata: {
        interaction_type: "picture_gap_sentence",
        template_key: "workbook_1_p24_picture_gap_v1",
        source_pages: [24]
    },
    speaking_questions: [{
        id: 241,
        sort_order: 0,
        question_text: "The ____ are in the classroom.",
        model_answer: "The students are in the classroom.",
        pronunciation_notes_zh: "",
        speaking_question_interactions: [{
            prompt_text: "The ____ are in the classroom.",
            answer_text: "The students are in the classroom.",
            accepted_full_responses: []
        }],
        speaking_question_visual_assets: [{
            speaking_visual_assets: { alt_zh: "教室中的學生", source_page_label: "P24" }
        }]
    }]
};

test("P24 的 The 題目可載入兩個不會直接啟用的弱讀候選", async () => {
    getPictureGapTheAudioCandidates.mockResolvedValue({
        candidates: [
            { id: "context-natural", label: "自然弱讀（連句語境）", audio_url: "https://audio.example/natural.wav" },
            { id: "context-clear", label: "清楚弱讀（The 稍慢）", audio_url: "https://audio.example/clear.wav" }
        ]
    });

    const { container } = render(<SpeakingPictureQuestionSetEditor
        firebaseUser={{ uid: "admin" }}
        questionSet={questionSet}
        onChanged={jest.fn()}
    />);
    fireEvent.click(screen.getByRole("button", { name: "比較 The 弱讀候選" }));

    await waitFor(() => expect(getPictureGapTheAudioCandidates).toHaveBeenCalledWith(
        { uid: "admin" }, 24, 241
    ));
    expect(await screen.findByText("自然弱讀（連句語境）")).toBeInTheDocument();
    expect(screen.getByText("清楚弱讀（The 稍慢）")).toBeInTheDocument();
    expect(screen.getByText("這些只供管理員試聽，不會替換學生目前的音檔。")).toBeInTheDocument();
    expect(container.querySelectorAll("audio")).toHaveLength(2);
});
