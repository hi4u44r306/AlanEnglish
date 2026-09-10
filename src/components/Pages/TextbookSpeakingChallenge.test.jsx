import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TextbookSpeakingChallenge from "./TextbookSpeakingChallenge";
import { getSpeakingChallengeSet } from "../../services/speakingChallengeService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: { uid: "student", getIdToken: jest.fn() } }) }));
jest.mock("../../services/speakingChallengeService", () => ({
    completeSpeakingChallengeQuestion: jest.fn(), getSpeakingChallengeCatalog: jest.fn(), getSpeakingChallengeSet: jest.fn()
}));

describe("TextbookSpeakingChallenge model audio", () => {
    const originalAudio = global.Audio;
    afterEach(() => { global.Audio = originalAudio; });

    it("plays the stored private model audio instead of browser speech synthesis", async () => {
        const play = jest.fn().mockResolvedValue(undefined);
        const listeners = {};
        global.Audio = jest.fn().mockImplementation(() => ({
            play,
            pause: jest.fn(),
            addEventListener: jest.fn((event, handler) => { listeners[event] = handler; })
        }));
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [{
                    id: 9, sort_order: 0, question_text: "What's your name?", hint_zh: "說出名字",
                    model_answer: "My name is Alan.", model_audio_status: "ready",
                    model_audio_url: "https://r2.example/signed.mp3", progress_status: "opened",
                    model_voice_gender: "male",
                    visual_aid: { kind: "clock", value: "7", alt_zh: "時鐘顯示七點整" }
                }]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        expect(await screen.findByLabelText("時鐘顯示七點整")).toBeInTheDocument();
        fireEvent.click(await screen.findByRole("button", { name: "聽自然示範" }));

        expect(global.Audio).toHaveBeenCalledWith("https://r2.example/signed.mp3");
        expect(play).toHaveBeenCalled();

        act(() => listeners.play());
        expect(screen.getByLabelText("男聲 AI 口說夥伴正在示範發音")).toBeInTheDocument();
        expect(screen.getByLabelText("男聲 AI 口說夥伴正在示範發音").querySelector("img")).toHaveAttribute("src", "/speaking-guide-boy.png");
        expect(screen.getByText("跟著我一起說！")).toBeInTheDocument();

        act(() => listeners.ended());
        expect(screen.getByLabelText("男聲 AI 口說夥伴")).toBeInTheDocument();
        expect(screen.getByText("嗨！我是男聲口說夥伴。")).toBeInTheDocument();
    });

    it("does not fall back to device speech while audio is missing", async () => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [{ id: 9, sort_order: 0, question_text: "What's your name?", hint_zh: "說出名字", model_answer: "My name is Alan.", model_audio_status: "missing", model_audio_url: null, progress_status: "opened", model_voice_gender: "female" }]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(await screen.findByRole("button", { name: "語音準備中" })).toBeDisabled();
        expect(screen.getByLabelText("女聲 AI 口說夥伴")).toBeInTheDocument();
        expect(screen.getByLabelText("女聲 AI 口說夥伴").querySelector("img")).toHaveAttribute("src", "/speaking-guide-girl.png");
    });

    it("shows one small challenge at a time and lets the learner change questions", async () => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [{
                    id: 9, sort_order: 0, question_text: "What's your name?", hint_zh: "說出名字",
                    model_answer: "My name is Alan.", model_audio_status: "missing", model_audio_url: null, progress_status: "opened", model_voice_gender: "male"
                }, {
                    id: 10, sort_order: 1, question_text: "How old are you?", hint_zh: "說出年紀",
                    model_answer: "I am seven years old.", model_audio_status: "missing", model_audio_url: null, progress_status: "completed", model_voice_gender: "female"
                }]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(await screen.findByRole("heading", { name: "What's your name?" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "How old are you?" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "上一題" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "下一題" }));
        expect(screen.getByRole("heading", { name: "How old are you?" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "What's your name?" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "下一題" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "前往第 2 題，已練習" })).toHaveAttribute("aria-current", "step");
    });
});
