import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import TextbookSpeakingChallenge from "./TextbookSpeakingChallenge";
import SpeakingVisualAid from "./SpeakingVisualAid";
import { getSpeakingChallengeCatalog, getSpeakingChallengeSet } from "../../services/speakingChallengeService";

const mockFirebaseUser = { uid: "student", getIdToken: jest.fn() };
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: mockFirebaseUser }) }));
jest.mock("../../services/speakingChallengeService", () => ({
    completeSpeakingChallengeQuestion: jest.fn(), getSpeakingChallengeCatalog: jest.fn(), getSpeakingChallengeSet: jest.fn()
}));

describe("TextbookSpeakingChallenge model audio", () => {
    const originalAudio = global.Audio;
    afterEach(() => { global.Audio = originalAudio; });

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

    it("plays the stored private model audio instead of browser speech synthesis", async () => {
        const play = jest.fn().mockResolvedValue(undefined);
        global.Audio = jest.fn().mockImplementation(() => ({ play, pause: jest.fn(), addEventListener: jest.fn() }));
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [{
                    id: 9, sort_order: 0, question_text: "What's your name?", hint_zh: "說出名字",
                    model_answer: "My name is Alan.", model_audio_status: "ready",
                    model_audio_url: "https://r2.example/signed.mp3", progress_status: "opened"
                }]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: "不知道怎麼說？" }));
        fireEvent.click(screen.getByRole("button", { name: "聽回答範例" }));

        expect(global.Audio).toHaveBeenCalledWith("https://r2.example/signed.mp3");
        expect(play).toHaveBeenCalled();
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
        expect(screen.getByRole("button", { name: /完成大挑戰/ })).toBeDisabled();
    });

    it("可依教材或生活主題瀏覽口說大挑戰", async () => {
        getSpeakingChallengeCatalog.mockResolvedValue({
            challenges: [
                { id: 1, title: "01 我的名字與自我介紹", topic: "Names", difficulty: "E1", book: { name: "Workbook 1" }, question_count: 4, completed_count: 1 },
                { id: 2, title: "02 顏色與生活物品", topic: "Colors", difficulty: "E1", book: { name: "Workbook 1" }, question_count: 6, completed_count: 0 }
            ]
        });

        await act(async () => {
            render(<MemoryRouter initialEntries={["/student/speaking-challenges"]}><Routes><Route path="/student/speaking-challenges" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        });

        expect(screen.getByRole("heading", { name: "Workbook 1" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "依教材" })).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(screen.getByRole("button", { name: "依主題" }));
        expect(screen.getByRole("heading", { name: "認識新朋友" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "生活物品與顏色" })).toBeInTheDocument();
    });

    it("以真正的台灣國旗呈現台灣視覺提示", () => {
        const { container } = render(<SpeakingVisualAid aid={{ kind: "flag", value: "taiwan", alt_zh: "台灣國旗" }} />);
        expect(screen.getByRole("figure", { name: "台灣國旗" })).toBeInTheDocument();
        expect(container.querySelector('svg[viewBox="0 0 900 600"]')).toBeInTheDocument();
        expect(container).not.toHaveTextContent("TW");
    });

    it("切換大挑戰時立即隱藏上一關內容", async () => {
        let resolveSecondChallenge;
        getSpeakingChallengeSet.mockImplementation((_, id) => id === 7
            ? Promise.resolve({ challenge: { id: 7, title: "01 自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" }, speaking_questions: [{ id: 9, question_text: "What's your name?", progress_status: "opened" }] } })
            : new Promise(resolve => { resolveSecondChallenge = resolve; }));

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<><Link to="/student/speaking-challenges/8">切換到 02</Link><TextbookSpeakingChallenge /></>} /></Routes></MemoryRouter>);
        expect(await screen.findByText("What's your name?")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("link", { name: "切換到 02" }));
        expect(screen.queryByText("What's your name?")).not.toBeInTheDocument();
        expect(screen.getByText("載入小關卡中…")).toBeInTheDocument();

        await act(async () => resolveSecondChallenge({ challenge: { id: 8, title: "02 打招呼", topic: "Greetings", difficulty: "E1", books: { name: "Workbook 1" }, speaking_questions: [{ id: 10, question_text: "Good morning!", progress_status: "opened" }] } }));
        expect(screen.getByText("Good morning!")).toBeInTheDocument();
    });
});
