import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import TrialLesson, { COLOUR_QUESTIONS, SAMPLE_AUDIO } from "./TrialLesson";
import useTrialSpeaking, { heardExpectedWord } from "../../hooks/useTrialSpeaking";
import { TRIAL_PICTURE_IDS } from "./TrialPictures";

jest.mock("../../hooks/useTrialSpeaking", () => ({ __esModule: true, default: jest.fn(), heardExpectedWord: jest.requireActual("../../hooks/useTrialSpeaking").heardExpectedWord }));
const speaking = overrides => ({ status: "idle", heard: "", message: "", start: jest.fn(), stop: jest.fn(), reset: jest.fn(), ...overrides });
beforeEach(() => { useTrialSpeaking.mockReturnValue(speaking()); });

const renderPage = () => render(<MemoryRouter><TrialLesson /></MemoryRouter>);

test("shows the lesson, its three steps and no video request until asked", () => {
    const { container } = renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "顏色" })).toBeInTheDocument();
    ["看老師教", "聽課本", "自己說"].forEach(name => expect(screen.getByRole("heading", { level: 2, name: new RegExp(name) })).toBeInTheDocument());
    expect(container.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "播放第 28 頁教學影片" }));
    expect(container.querySelector("iframe")).toHaveAttribute("src", expect.stringContaining("youtube-nocookie.com/embed/IgMCnPvCHyI?start=886"));
});

test("speaking practice hides the answer until the learner has tried, then moves on", () => {
    renderPage();
    expect(screen.getByText("What color is the apple?")).toBeInTheDocument();
    expect(document.querySelector(".trial-lesson__picture svg.trial-lesson__drawing")).toBeInTheDocument();
    expect(screen.queryByText("red")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "看答案" }));
    expect(screen.getByText("red")).toHaveClass("is-shown");
    fireEvent.click(screen.getByRole("button", { name: /下一題/ }));
    expect(screen.getByText("What color is the banana?")).toBeInTheDocument();
    expect(screen.queryByText("yellow")).not.toBeInTheDocument();
});

test("says so plainly when the sample audio is not available", () => {
    const { container } = renderPage();
    const audio = container.querySelector("audio");
    expect(audio).toHaveAttribute("src", SAMPLE_AUDIO);
    fireEvent.error(audio);
    expect(screen.getByRole("status")).toHaveTextContent("試聽音檔正在準備中");
});

test("every colour question has a real colour, a picture and a Chinese cue", () => {
    expect(COLOUR_QUESTIONS).toHaveLength(8);
    COLOUR_QUESTIONS.forEach(item => {
        expect(item.answer).toMatch(/^(red|yellow|green|blue|purple|white|brown|gray)$/);
        expect(TRIAL_PICTURE_IDS).toContain(item.id);
        expect(item.zh).toBeTruthy();
    });
});

test("the microphone button records for the expected word, and a correct answer unlocks the next question", () => {
    const idle = speaking();
    useTrialSpeaking.mockReturnValue(idle);
    const { rerender } = renderPage();
    fireEvent.click(screen.getByRole("button", { name: /按一下，開口說/ }));
    expect(idle.start).toHaveBeenCalledWith("red");
    useTrialSpeaking.mockReturnValue(speaking({ status: "recording" }));
    rerender(<MemoryRouter><TrialLesson /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /說完了/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "看答案" })).not.toBeInTheDocument();
    useTrialSpeaking.mockReturnValue(speaking({ status: "correct", heard: "It's red." }));
    rerender(<MemoryRouter><TrialLesson /></MemoryRouter>);
    expect(screen.getByRole("status")).toHaveTextContent("說對了！");
    expect(screen.getByText("red")).toHaveClass("is-shown");
    expect(screen.getByRole("button", { name: /下一題/ })).toBeInTheDocument();
});

test("a miss shows what was heard and offers another try or the answer", () => {
    useTrialSpeaking.mockReturnValue(speaking({ status: "retry", heard: "It's bread." }));
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("我聽到：「It's bread.」");
    expect(screen.getByRole("button", { name: /再說一次/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "看答案" })).toBeInTheDocument();
    expect(screen.queryByText("red")).not.toBeInTheDocument();
});

test("matching looks for the whole expected word only", () => {
    expect(heardExpectedWord("It's red.", "red")).toBe(true);
    expect(heardExpectedWord("What color is the apple? It is RED!", "red")).toBe(true);
    expect(heardExpectedWord("It's bread.", "red")).toBe(false);
    expect(heardExpectedWord("", "red")).toBe(false);
});
