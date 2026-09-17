import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SpeakingPictureQuestionSetEditor from "./SpeakingPictureQuestionSetEditor";
import { toast } from "react-toastify";
import {
    activatePictureGapTheAudioCandidate,
    generateSpeakingVisibleWordAudio,
    getPictureGapTheAudioCandidates
} from "../../services/speakingContentService";

jest.mock("react-toastify", () => ({
    toast: {
        error: jest.fn(),
        success: jest.fn(),
        warning: jest.fn()
    }
}));

jest.mock("../../services/speakingContentService", () => ({
    activatePictureGapTheAudioCandidate: jest.fn(),
    addPictureDraftQuestion: jest.fn(),
    deleteDraftSpeakingQuestion: jest.fn(),
    generateSpeakingVisibleWordAudio: jest.fn(),
    getPictureGapTheAudioCandidates: jest.fn(),
    getSpeakingQuestionAudioPreview: jest.fn(),
    getSpeakingQuestionPicturePreview: jest.fn(),
    reorderDraftSpeakingQuestions: jest.fn(),
    restorePictureGapStandardAudio: jest.fn(),
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

test("P24 的 The 題目必須完整試聽後才能套用單題候選", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    activatePictureGapTheAudioCandidate.mockResolvedValue({ success: true, applied: true });
    getPictureGapTheAudioCandidates.mockResolvedValue({
        active_candidate_id: null,
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
    expect(screen.getByText(/請先完整試聽/)).toBeInTheDocument();
    expect(screen.getByText("目前版本：標準分段版")).toBeInTheDocument();
    expect(container.querySelectorAll("audio")).toHaveLength(2);
    const applyButtons = screen.getAllByRole("button", { name: "套用到這一題" });
    expect(applyButtons[0]).toBeDisabled();
    fireEvent.ended(container.querySelectorAll("audio")[0]);
    expect(applyButtons[0]).toBeEnabled();
    fireEvent.click(applyButtons[0]);
    await waitFor(() => expect(activatePictureGapTheAudioCandidate).toHaveBeenCalledWith(
        { uid: "admin" }, 24, 241, "context-natural"
    ));
    expect(await screen.findByRole("button", { name: "目前使用中" })).toBeDisabled();
});

test("語音產生失敗時顯示後端實際原因", async () => {
    generateSpeakingVisibleWordAudio.mockResolvedValue({
        success: false,
        failed: 1,
        pending: 0,
        results: [{ status: "failed", error: "語音供應商暫時無法使用" }]
    });

    const customQuestionSet = {
        ...questionSet,
        generation_metadata: {
            ...questionSet.generation_metadata,
            template_key: "custom_picture_gap_v1"
        }
    };
    render(<SpeakingPictureQuestionSetEditor
        firebaseUser={{ uid: "admin" }}
        questionSet={customQuestionSet}
        onChanged={jest.fn()}
    />);
    fireEvent.click(screen.getByRole("button", { name: "更新停頓整句女聲" }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(
        "仍有 1 項語音尚未完成：語音供應商暫時無法使用"
    ));
});
