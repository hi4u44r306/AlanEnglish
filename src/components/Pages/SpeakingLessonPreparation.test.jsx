import React from "react";
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SpeakingLessonPreparation from "./SpeakingLessonPreparation";
import { getAccessibleBook } from "../../services/contentAccessService";
jest.mock("../../services/contentAccessService", () => ({ getAccessibleBook: jest.fn() }));
const user = { uid: "test" };
const challenge = { id: 7, topic: "打招呼", books: { id: 1, code: "W1", name: "Workbook 1" }, generation_metadata: { source_pages: [11] } };
const response = { book: { id: 1 }, tracks: [{ id: 3, book_id: 1, page: "P.11", audio_url: "signed-audio" }] };
afterEach(() => jest.resetAllMocks());
it("opens exact listening without starting playback or altering the challenge mode", async () => {
    getAccessibleBook.mockResolvedValue(response);
    render(<MemoryRouter><SpeakingLessonPreparation challenge={challenge} mode="challenge" firebaseUser={user} /></MemoryRouter>);
    expect(await screen.findByRole("link", { name: "先聽本關教材" })).toHaveAttribute("href", "/student/books/W1?speaking=7&mode=challenge&tracks=3");
    expect(getAccessibleBook).toHaveBeenCalledWith(user, "W1");
});
it("keeps the lesson usable when entitlement rejects listening", async () => {
    getAccessibleBook.mockRejectedValue(new Error("not entitled"));
    await act(async () => render(<MemoryRouter><SpeakingLessonPreparation challenge={challenge} mode="easy" firebaseUser={user} /></MemoryRouter>));
    expect(screen.getByText("打招呼")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("does not allow a listening departure during recording or scoring", async () => {
    getAccessibleBook.mockResolvedValue(response);
    render(<MemoryRouter><SpeakingLessonPreparation challenge={challenge} mode="easy" firebaseUser={user} busy /></MemoryRouter>);
    await screen.findByText("完成這次錄音與評分後，就能去聽教材。");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("does not render a late response from the previous lesson", async () => {
    let resolve;
    getAccessibleBook.mockReturnValue(new Promise(done => { resolve = done; }));
    const { rerender } = render(<MemoryRouter><SpeakingLessonPreparation challenge={challenge} mode="easy" firebaseUser={user} /></MemoryRouter>);
    rerender(<MemoryRouter><SpeakingLessonPreparation challenge={{ ...challenge, id: 8, generation_metadata: {} }} mode="easy" firebaseUser={user} /></MemoryRouter>);
    await act(async () => resolve(response));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
