import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import TextbookSpeakingChallenge from "./TextbookSpeakingChallenge";
import { completeSpeakingChallengeQuestion, getSpeakingChallengeCatalog, getSpeakingChallengeSet } from "../../services/speakingChallengeService";

const mockUser = { uid: "student" };
let mockRole = "student";
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: mockUser, role: mockRole }) }));
jest.mock("../../services/speakingChallengeService", () => ({ completeSpeakingChallengeQuestion: jest.fn(), getSpeakingChallengeCatalog: jest.fn(), getSpeakingChallengeSet: jest.fn() }));
jest.mock("./SpeakingPracticeSteps", () => function Practice({ onCompleted }) { return <button onClick={onCompleted}>通過本題</button>; });
jest.mock("./WorkbookOnePictureChallenge", () => function Picture({ onFinished }) { return <button onClick={() => onFinished({ xp_awarded: 0, ae_points_awarded: 0 })}>完成圖片頁</button>; });
jest.mock("./WorkbookOneFoundationChallenge", () => function Foundation({ onFinished }) { return <button onClick={() => onFinished({ xp_awarded: 30, ae_points_awarded: 3 })}>完成字母頁</button>; });
const Probe = () => { const location = useLocation(); return <output data-testid="route">{location.pathname}|{location.search}|{location.state?.speakingReturn?.questionSetId}</output>; };
const fixture = { id: 7, title: "P11", books: { id: 1, name: "Workbook 1" }, speaking_questions: [{ id: 9, question_text: "What is this?", model_answer: "It is a book.", progress_status: "opened" }] };
const mount = (mode = "easy") => render(<MemoryRouter initialEntries={[`/student/speaking-challenges/7?mode=${mode}`]}><Probe /><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /><Route path="/student/speaking-challenges/book/:bookKey" element={<h1>地圖已返回</h1>} /></Routes></MemoryRouter>);

describe("speaking return and completion flow", () => {
    const originalMatchMedia = window.matchMedia;
    beforeEach(() => {
        jest.clearAllMocks(); mockRole = "student";
        window.matchMedia = jest.fn(() => ({ matches: false }));
        getSpeakingChallengeSet.mockResolvedValue({ challenge: fixture });
        getSpeakingChallengeCatalog.mockResolvedValue({ challenges: [] });
    });
    afterEach(() => { window.matchMedia = originalMatchMedia; });
    it("return has a short animation, unmounts recording content, and preserves the map location", async () => {
        mount(); await screen.findByRole("button", { name: "通過本題" });
        fireEvent.click(screen.getByRole("button", { name: "關卡列表" }));
        expect(screen.getByText("返回地圖中…")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "通過本題" })).not.toBeInTheDocument();
        await screen.findByRole("heading", { name: "地圖已返回" });
        expect(screen.getByTestId("route")).toHaveTextContent("|7");
        expect(completeSpeakingChallengeQuestion).not.toHaveBeenCalled();
    });
    it.each(["easy", "challenge"])("%s completion uses the response awards", async mode => {
        completeSpeakingChallengeQuestion.mockResolvedValue({ success: true, challenge_completed: true, xp_awarded: mode === "easy" ? 30 : 0, ae_points_awarded: mode === "easy" ? 3 : 0 });
        mount(mode); fireEvent.click(await screen.findByRole("button", { name: "通過本題" }));
        await screen.findByRole("dialog", { name: "闖關成功！" });
        expect(screen.getByLabelText(`本次獲得 ${mode === "easy" ? 30 : 0} XP`)).toBeInTheDocument();
        expect(screen.getByLabelText(`本次獲得 ${mode === "easy" ? 3 : 0} AE Points`)).toBeInTheDocument();
        expect(completeSpeakingChallengeQuestion).toHaveBeenCalledTimes(1);
        expect(completeSpeakingChallengeQuestion.mock.calls[0][3]).toBe(mode);
    });
    it("a rejected completion cannot celebrate", async () => {
        completeSpeakingChallengeQuestion.mockRejectedValue(Object.assign(new Error("提示已使用"), { code: "challenge_hint_used" }));
        mount("challenge"); fireEvent.click(await screen.findByRole("button", { name: "通過本題" }));
        await waitFor(() => expect(completeSpeakingChallengeQuestion).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    it("late completion responses cannot interrupt a return", async () => {
        let resolve;
        completeSpeakingChallengeQuestion.mockImplementation(() => new Promise(done => { resolve = done; }));
        mount(); fireEvent.click(await screen.findByRole("button", { name: "通過本題" }));
        fireEvent.click(screen.getByRole("button", { name: "關卡列表" }));
        await act(async () => resolve({ challenge_completed: true, xp_awarded: 30 }));
        expect(screen.getByText("返回地圖中…")).toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        await screen.findByRole("heading", { name: "地圖已返回" });
    });
    it.each(["picture_gap_sentence", "letter_spelling", "alphabet_round"])("%s shares the completion view", async type => {
        getSpeakingChallengeSet.mockResolvedValue({ challenge: { ...fixture, generation_metadata: { interaction_type: type } } });
        mount();
        const finish = await screen.findByRole("button", { name: type === "picture_gap_sentence" ? "完成圖片頁" : "完成字母頁" });
        await act(async () => fireEvent.click(finish));
        expect(screen.getByRole("dialog", { name: "闖關成功！" })).toBeInTheDocument();
    });
    it("staff can preview the completion without recording or awarding rewards", async () => {
        mockRole = "teacher"; mount();
        const finish = await screen.findByRole("button", { name: "完成大挑戰" });
        await act(async () => fireEvent.click(finish));
        expect(screen.getByRole("dialog", { name: "通關動畫預覽" })).toBeInTheDocument();
        expect(screen.getByLabelText("本次獲得 0 XP")).toBeInTheDocument();
        expect(completeSpeakingChallengeQuestion).not.toHaveBeenCalled();
    });
    it("staff can open the next level after entering a lesson directly", async () => {
        mockRole = "teacher";
        getSpeakingChallengeCatalog.mockResolvedValue({ challenges: [fixture, { id: 8, title: "P14", books: fixture.books, sequence_order: 2 }] });
        mount("challenge"); fireEvent.click(await screen.findByRole("button", { name: "完成大挑戰" }));
        fireEvent.click(await screen.findByRole("button", { name: "前往下一關" }));
        await waitFor(() => expect(screen.getByTestId("route")).toHaveTextContent("/student/speaking-challenges/8|?mode=challenge"));
        expect(completeSpeakingChallengeQuestion).not.toHaveBeenCalled();
    });
    it("late completion errors cannot replace the return animation", async () => {
        let reject;
        completeSpeakingChallengeQuestion.mockImplementation(() => new Promise((resolve, fail) => { reject = fail; }));
        mount(); fireEvent.click(await screen.findByRole("button", { name: "通過本題" }));
        fireEvent.click(screen.getByRole("button", { name: "關卡列表" }));
        await act(async () => reject(new Error("無法儲存練習紀錄")));
        expect(screen.getByText("返回地圖中…")).toBeInTheDocument();
        expect(screen.queryByText("無法儲存練習紀錄")).not.toBeInTheDocument();
        await screen.findByRole("heading", { name: "地圖已返回" });
    });
    it("a lesson with only book_id returns to its workbook map", async () => {
        getSpeakingChallengeSet.mockResolvedValue({ challenge: { ...fixture, books: undefined, book_id: 1 } });
        mount(); await screen.findByRole("button", { name: "通過本題" });
        fireEvent.click(screen.getByRole("button", { name: "關卡列表" }));
        await screen.findByRole("heading", { name: "地圖已返回" });
        expect(screen.getByTestId("route")).toHaveTextContent("/student/speaking-challenges/book/book-1");
    });
    it("next navigation uses the newly unlocked catalog and keeps the mode", async () => {
        completeSpeakingChallengeQuestion.mockResolvedValue({ challenge_completed: true, xp_awarded: 30, ae_points_awarded: 3 });
        getSpeakingChallengeCatalog.mockResolvedValue({ challenges: [fixture, { id: 8, title: "P14", books: fixture.books, sequence_order: 2, is_unlocked: true }] });
        mount(); fireEvent.click(await screen.findByRole("button", { name: "通過本題" }));
        fireEvent.click(await screen.findByRole("button", { name: "前往下一關" }));
        await waitFor(() => expect(screen.getByTestId("route")).toHaveTextContent("/student/speaking-challenges/8|?mode=easy"));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});
