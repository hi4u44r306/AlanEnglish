import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import TrialLesson, { COLOUR_QUESTIONS, SAMPLE_AUDIO } from "./TrialLesson";

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
    expect(screen.queryByText("red")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /我說完了，看答案/ }));
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

test("every colour question has a real colour and a Chinese cue", () => {
    expect(COLOUR_QUESTIONS).toHaveLength(8);
    COLOUR_QUESTIONS.forEach(item => {
        expect(item.answer).toMatch(/^(red|yellow|green|blue|purple|white|brown|black)$/);
        expect(item.swatch).toMatch(/^#[0-9a-f]{6}$/);
        expect(item.zh).toBeTruthy();
    });
});
