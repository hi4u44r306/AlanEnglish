import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TextbookSpeakingChallenge from "./TextbookSpeakingChallenge";
import { getSpeakingChallengeCatalog, getSpeakingChallengeSet } from "../../services/speakingChallengeService";

const mockFirebaseUser = { uid: "student", getIdToken: jest.fn() };
let mockRole = "student";
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: mockFirebaseUser, role: mockRole }) }));
jest.mock("../../services/speakingChallengeService", () => ({
    completeSpeakingChallengeQuestion: jest.fn(), getSpeakingChallengeCatalog: jest.fn(), getSpeakingChallengeSet: jest.fn()
}));

describe("TextbookSpeakingChallenge model audio", () => {
    const originalAudio = global.Audio;
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    beforeEach(() => {
        mockRole = "student";
        Element.prototype.scrollIntoView = jest.fn();
    });
    afterEach(() => { global.Audio = originalAudio; });
    afterAll(() => { Element.prototype.scrollIntoView = originalScrollIntoView; });

    it("在進入大關卡前先顯示情境解說與學習目標", async () => {
        getSpeakingChallengeCatalog.mockResolvedValue({
            challenges: [{
                id: 7, title: "02 打招呼與禮貌對話", topic: "Greetings", difficulty: "E1",
                intro_zh: "和外國朋友見面時，先聽對方怎麼打招呼。",
                learning_goal_zh: "能在不同時間打招呼並有禮貌地說再見。",
                question_count: 5, completed_count: 1, version: 1, book: { name: "Workbook 1" }
            }]
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges"]}><Routes><Route path="/student/speaking-challenges" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(await screen.findByText("和外國朋友見面時，先聽對方怎麼打招呼。")).toBeInTheDocument();
        expect(screen.getByText("學習目標：能在不同時間打招呼並有禮貌地說再見。")).toBeInTheDocument();
        expect(screen.getByText("1/5 題已練習")).toBeInTheDocument();
    });

    it("removes the global mobile player clearance while the detail page is open", async () => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [{ id: 9, question_text: "What's your name?", hint_zh: "說出名字", model_answer: "My name is Alan.", progress_status: "opened" }]
            }
        });

        const { unmount } = render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        await screen.findByText("What's your name?");
        expect(document.body).toHaveClass("speaking-challenge-detail-active");
        unmount();
        expect(document.body).not.toHaveClass("speaking-challenge-detail-active");
    });

    it("先播放已儲存的私人問題語音，求助後才播放回答語音", async () => {
        const play = jest.fn().mockResolvedValue(undefined);
        global.Audio = jest.fn().mockImplementation(() => ({ play, pause: jest.fn(), addEventListener: jest.fn() }));
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [{
                    id: 9, sort_order: 0, question_text: "What's your name?", hint_zh: "說出名字",
                    question_audio_status: "ready", question_audio_url: "https://r2.example/question.wav",
                    model_answer: "My name is Alan.", model_audio_status: "ready",
                    model_audio_url: "https://r2.example/signed.mp3", progress_status: "opened"
                }]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: /聽問題並回答/ }));
        expect(global.Audio).toHaveBeenCalledWith("https://r2.example/question.wav");
        fireEvent.click(await screen.findByRole("button", { name: "不知道怎麼說？" }));
        fireEvent.click(screen.getByRole("button", { name: "聽回答範例" }));

        expect(global.Audio).toHaveBeenCalledWith("https://r2.example/signed.mp3");
        expect(play).toHaveBeenCalledTimes(2);
    });

    it("does not fall back to device speech while audio is missing", async () => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [{ id: 9, sort_order: 0, question_text: "What's your name?", hint_zh: "說出名字", model_answer: "My name is Alan.", model_audio_status: "missing", model_audio_url: null, progress_status: "opened" }]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        fireEvent.click(await screen.findByRole("button", { name: "不知道怎麼說？" }));
        expect(screen.getByRole("button", { name: "語音準備中" })).toBeDisabled();
    });

    it("一次只顯示一個小關卡，完成後才能前往下一題", async () => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [
                    { id: 9, question_text: "What's your name?", hint_zh: "說出名字", model_answer: "My name is Alan.", model_audio_url: null, progress_status: "completed" },
                    { id: 10, question_text: "How old are you?", hint_zh: "說出年齡", model_answer: "I am ten.", model_audio_url: null, progress_status: "opened" }
                ]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(await screen.findByText("What's your name?")).toBeInTheDocument();
        expect(screen.queryByText("How old are you?")).not.toBeInTheDocument();
        expect(screen.getByRole("progressbar", { name: "大挑戰完成進度" })).toHaveAttribute("aria-valuenow", "50");
        fireEvent.click(screen.getByRole("button", { name: /下一題/ }));
        expect(screen.getByText("How old are you?")).toBeInTheDocument();
        expect(screen.queryByText("What's your name?")).not.toBeInTheDocument();
        expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
        expect(screen.getByRole("button", { name: /完成大挑戰/ })).toBeDisabled();

        fireEvent.click(screen.getByRole("button", { name: /上一題/ }));
        expect(screen.getByText("What's your name?")).toBeInTheDocument();
        expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2);
    });

    it("在需要看圖回答的題目顯示教材圖片與替代文字", async () => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 9, title: "顏色與生活物品", topic: "Colors", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [{ id: 31, sort_order: 4, question_text: "What is this red fruit?", hint_zh: "看圖回答", model_answer: "It is an apple.", progress_status: "opened" }]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/9"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        const image = await screen.findByRole("img", { name: "題目圖片：一顆紅色水果" });
        expect(image).toHaveAttribute("src", "/images/speaking/workbook-1/red-apple.webp");
        expect(screen.getByText("先看圖片，再聽問題並回答。")).toBeInTheDocument();
    });

    it("lets teachers demonstrate published questions without recording or saving progress", async () => {
        mockRole = "teacher";
        getSpeakingChallengeSet.mockResolvedValue({
            demo_mode: true,
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [
                    { id: 9, question_text: "What's your name?", hint_zh: "說出名字", model_answer: "My name is Alan.", progress_status: "opened" },
                    { id: 10, question_text: "How are you?", hint_zh: "說出心情", model_answer: "I am great.", progress_status: "opened" }
                ]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(await screen.findByText("老師／管理員示範模式")).toBeInTheDocument();
        expect(screen.getByText(/請切換學生帳號示範這項操作/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /開始錄音/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /下一題/ }));
        expect(screen.getByText("How are you?")).toBeInTheDocument();
    });
});
