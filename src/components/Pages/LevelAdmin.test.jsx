import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-toastify";
import LevelAdmin from "./LevelAdmin";
import { getLevelAdminCatalog, updatePromotionExam } from "../../services/learningProgressService";
const user = { uid: "admin" };
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: user }) }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../../services/learningProgressService", () => ({ getLevelAdminCatalog: jest.fn(), updatePromotionExam: jest.fn(), updateBookLevel: jest.fn(), setStudentLevel: jest.fn() }));
const questions = Array.from({ length: 5 }, (_, i) => ({ question: `Question ${i + 1}`, options: ["One", "Two", "Three", "Four"], answer: "One", explanation: "Reason" }));
beforeEach(() => { jest.clearAllMocks(); getLevelAdminCatalog.mockResolvedValue({ levels: [], books: [], students: [], exams: [{ id: 12, title: "Test", passing_score: 80, questions, question_count: 5 }] }); updatePromotionExam.mockResolvedValue({}); });
const open = async () => { const button = await screen.findByRole("button", { name: "編輯測驗" }); button.focus(); fireEvent.click(button); return button; };
test("form updates selected answer with edited option and submits existing API contract", async () => {
    render(<LevelAdmin />); await open();
    fireEvent.change(screen.getByLabelText("第 1 題選項 A"), { target: { value: "Hello" } });
    fireEvent.change(screen.getByLabelText("第 1 題解說（選填）"), { target: { value: "Explanation" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存測驗" }));
    await waitFor(() => expect(updatePromotionExam).toHaveBeenCalledTimes(1));
    expect(updatePromotionExam).toHaveBeenCalledWith(user, expect.objectContaining({ exam_id: 12, passing_score: 80, questions: expect.arrayContaining([expect.objectContaining({ question: "Question 1", options: ["Hello", "Two", "Three", "Four"], answer: "Hello", explanation: "Explanation" })]) }));
});
test("malformed JSON is retained and cannot call update until repaired", async () => {
    render(<LevelAdmin />); await open(); fireEvent.click(screen.getByText("進階：編輯題目 JSON"));
    fireEvent.change(screen.getByLabelText("題目 JSON"), { target: { value: "invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存測驗" }));
    expect(updatePromotionExam).not.toHaveBeenCalled(); expect(screen.getByLabelText("題目 JSON")).toHaveValue("invalid");
    fireEvent.change(screen.getByLabelText("題目 JSON"), { target: { value: JSON.stringify([{ ...questions[0], options: ["One", "One", "Three", "Four"] }, ...questions.slice(1)]) } });
    fireEvent.click(screen.getByRole("button", { name: "儲存測驗" }));
    expect(updatePromotionExam).not.toHaveBeenCalled(); expect(toast.error).toHaveBeenLastCalledWith(expect.stringContaining("四個不同"));
});
test("Escape restores focus without saving", async () => {
    render(<LevelAdmin />); const button = await open(); expect(screen.getByRole("dialog")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" }); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(button).toHaveFocus(); expect(updatePromotionExam).not.toHaveBeenCalled();
});

test("saving locks inputs, blocks duplicate submit and cannot close the pending request", async () => {
    let finish;
    updatePromotionExam.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<LevelAdmin />); await open();
    fireEvent.click(screen.getByRole("button", { name: "儲存測驗" }));
    expect(screen.getByLabelText("標題")).toBeDisabled();
    fireEvent.submit(screen.getByRole("dialog")); fireEvent.keyDown(document, { key: "Escape" });
    expect(updatePromotionExam).toHaveBeenCalledTimes(1); expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => finish({}));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
