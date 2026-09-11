import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StudentSpiralReview from "./StudentSpiralReview";

jest.mock("../../auth/AuthContext", () => ({
    useAuth: () => ({ firebaseUser: { uid: "student-1" } })
}));
jest.mock("../../services/spiralReviewService", () => ({
    getStudentSpiralQueue: jest.fn(),
    submitSpiralAnswer: jest.fn()
}));

const { getStudentSpiralQueue, submitSpiralAnswer } = require("../../services/spiralReviewService");

describe("StudentSpiralReview", () => {
    beforeEach(() => {
        window.scrollTo = jest.fn();
        window.speechSynthesis = { cancel: jest.fn(), speak: jest.fn() };
        window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) { this.text = text; };
        getStudentSpiralQueue.mockResolvedValue({
            due_count: 1,
            cards: [{
                assignment_id: 9,
                card_id: 11,
                audio_text: "apple",
                hint_zh: "蘋果",
                unit: { title: "水果", page_start: 20, page_end: 22, book: { name: "Workbook 1" } },
                choices: [
                    { id: 11, label: "apple" }, { id: 12, label: "banana" }, { id: 13, label: "grape" },
                    { id: 14, label: "orange" }, { id: 15, label: "lemon" }, { id: 16, label: "pear" }
                ]
            }]
        });
        submitSpiralAnswer.mockResolvedValue({ is_correct: true, next_review_at: "2026-09-12", correct_answer: "apple" });
    });

    test("plays a prompt and submits one of six choices", async () => {
        render(<StudentSpiralReview />);
        expect(await screen.findByRole("heading", { name: "水果" })).toBeTruthy();
        expect(screen.getAllByRole("button").filter(button => ["apple", "banana", "grape", "orange", "lemon", "pear"].includes(button.textContent))).toHaveLength(6);
        fireEvent.click(screen.getByRole("button", { name: "apple" }));
        fireEvent.click(screen.getByRole("button", { name: "確認答案" }));
        expect(await screen.findByText("答對了！")).toBeTruthy();
        await waitFor(() => expect(submitSpiralAnswer).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ card_id: 11, selected_card_id: 11 })));
    });
});
