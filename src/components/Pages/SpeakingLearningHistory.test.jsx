import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import SpeakingLearningHistory from "./SpeakingLearningHistory";
import {
    deleteSpeakingRecording,
    getSpeakingLearningSummary,
    getSpeakingRecordingHistory,
    getSpeakingRecordingUrl
} from "../../services/pronunciationCoachService";

const firebaseUser = { uid: "student" };
let mockRole = "student";
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser, role: mockRole }) }));
jest.mock("../../services/pronunciationCoachService", () => ({
    deleteSpeakingRecording: jest.fn(),
    getSpeakingLearningSummary: jest.fn(),
    getSpeakingRecordingHistory: jest.fn(),
    getSpeakingRecordingUrl: jest.fn()
}));

describe("SpeakingLearningHistory", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRole = "student";
        getSpeakingLearningSummary.mockResolvedValue({ summary: { learned_sentences: 4, learned_words: 12, saved_recordings: 1 } });
        getSpeakingRecordingHistory.mockResolvedValue({ recordings: [{
            id: 9, question_id: 3, pronunciation_score: 88, recognized_text: "Nice to meet you too.",
            created_at: "2026-09-07T02:00:00Z", question_text: "Hello! Nice to meet you.",
            challenge_title: "02 打招呼與禮貌對話", book_name: "Workbook 1"
        }], next_before_id: null });
        getSpeakingRecordingUrl.mockResolvedValue({ audio_url: "https://private.example/recording.wav" });
        deleteSpeakingRecording.mockResolvedValue({ success: true });
        window.confirm = jest.fn().mockReturnValue(true);
    });

    it("shows private learning totals and only requests audio when the student plays it", async () => {
        render(<MemoryRouter><SpeakingLearningHistory /></MemoryRouter>);

        expect(await screen.findByText("12")).toBeInTheDocument();
        expect(screen.getByText("已學句子")).toBeInTheDocument();
        expect(screen.getByText("Nice to meet you too.")).toBeInTheDocument();
        expect(screen.getByText("很清楚")).toBeInTheDocument();
        expect(screen.queryByText("88 分")).not.toBeInTheDocument();
        expect(getSpeakingRecordingUrl).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "回聽" }));
        await waitFor(() => expect(getSpeakingRecordingUrl).toHaveBeenCalledWith(firebaseUser, 9));
        expect(await screen.findByLabelText("Hello! Nice to meet you. 的私人錄音")).toHaveAttribute("src", "https://private.example/recording.wav");
    });

    it("lets the owner delete audio while keeping scores and progress", async () => {
        render(<MemoryRouter><SpeakingLearningHistory /></MemoryRouter>);
        await screen.findByText("Nice to meet you too.");
        fireEvent.click(screen.getByRole("button", { name: "刪除 Hello! Nice to meet you. 的錄音" }));

        await waitFor(() => expect(deleteSpeakingRecording).toHaveBeenCalledWith(firebaseUser, 9));
        await waitFor(() => expect(screen.queryByText("Nice to meet you too.")).not.toBeInTheDocument());
    });

    it("loads older private recordings with a server cursor", async () => {
        getSpeakingRecordingHistory
            .mockResolvedValueOnce({
                recordings: [{
                    id: 9, pronunciation_score: 88, recognized_text: "Nice to meet you too.",
                    created_at: "2026-09-07T02:00:00Z", question_text: "Hello! Nice to meet you.",
                    challenge_title: "02 打招呼與禮貌對話", book_name: "Workbook 1"
                }],
                next_before_id: 9
            })
            .mockResolvedValueOnce({
                recordings: [{
                    id: 4, pronunciation_score: 72, recognized_text: "My name is Amy.",
                    created_at: "2026-09-06T02:00:00Z", question_text: "What's your name?",
                    challenge_title: "01 我的名字與自我介紹", book_name: "Workbook 1"
                }],
                next_before_id: null
            });

        render(<MemoryRouter><SpeakingLearningHistory /></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: "載入更多錄音" }));

        await waitFor(() => expect(getSpeakingRecordingHistory).toHaveBeenLastCalledWith(firebaseUser, 9));
        expect(await screen.findByText("My name is Amy.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "載入更多錄音" })).not.toBeInTheDocument();
    });

    it("shows fixed safe demo data to teachers without requesting student history", async () => {
        mockRole = "teacher";
        render(<MemoryRouter><SpeakingLearningHistory /></MemoryRouter>);

        expect(await screen.findByRole("heading", { name: "口說學習歷程示範" })).toBeInTheDocument();
        expect(screen.getByText("Nice to meet you, too.")).toBeInTheDocument();
        expect(screen.getAllByText("示範資料")).toHaveLength(2);
        expect(screen.queryByRole("button", { name: "回聽" })).not.toBeInTheDocument();
        expect(getSpeakingLearningSummary).not.toHaveBeenCalled();
        expect(getSpeakingRecordingHistory).not.toHaveBeenCalled();
        expect(getSpeakingRecordingUrl).not.toHaveBeenCalled();
    });
});
