import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import wordBank from "../../data/wordChallenge/wordBank.v1.json";
import WordChallenge from "./WordChallenge";

const renderPage = (props = {}) => render(<MemoryRouter><WordChallenge {...props} /></MemoryRouter>);

const currentGlossWord = () => {
    const gloss = document.querySelector(".word-challenge__gloss")?.textContent;
    return wordBank.words.find(word => word.gloss === gloss);
};

const answerInput = () => screen.getByLabelText(/輸入英文拼字/);

beforeEach(() => {
    window.localStorage.clear();
    window.scrollTo = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
    delete window.speechSynthesis;
    delete window.SpeechSynthesisUtterance;
});

afterEach(() => {
    document.body.classList.remove("word-challenge-playing");
});

test("menu shows six levels with suggested grades and only the Chinese mode", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /^看中文，\s?把英文單字拼出來$/ })).toBeInTheDocument();
    const levels = screen.getByRole("region", { name: "選擇等級" });
    expect(within(levels).getAllByRole("button")).toHaveLength(6);
    expect(within(levels).getByText("建議一年級")).toBeInTheDocument();
    expect(within(levels).getByText("建議六年級")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /聽發音/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "選擇題型" })).not.toBeInTheDocument();
    expect(screen.getByText(/不是教育部官方分級/)).toBeInTheDocument();
    expect(screen.getByText(/不用登入也能玩/)).toBeInTheDocument();
});

test("a full Chinese-mode round: correct, wrong, skip, then the score is saved on this device", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /第 1 級/ }));
    expect(document.body).toHaveClass("word-challenge-playing");
    expect(screen.getByLabelText("第 1 題，共 10 題")).toBeInTheDocument();

    // 第 1 題答對
    const first = currentGlossWord();
    expect(first.level).toBe(1);
    fireEvent.change(answerInput(), { target: { value: first.display } });
    fireEvent.click(screen.getByRole("button", { name: "確定" }));
    expect(screen.getByText("答對了！")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "下一題" }));

    // 第 2 題答錯
    const second = currentGlossWord();
    fireEvent.change(answerInput(), { target: { value: "zzzz" } });
    fireEvent.click(screen.getByRole("button", { name: "確定" }));
    expect(screen.getByText("差一點！正確拼法")).toBeInTheDocument();
    expect(document.querySelector(".word-challenge__answer")).toHaveTextContent(second.display);
    fireEvent.click(screen.getByRole("button", { name: "下一題" }));

    // 其餘題目都按「不會，看答案」
    for (let question = 3; question <= 10; question += 1) {
        fireEvent.click(screen.getByRole("button", { name: "不會，看答案" }));
        expect(screen.getByText("答案是")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: question === 10 ? "看成績" : "下一題" }));
    }

    const result = screen.getByRole("region", { name: "這一輪的成績" });
    expect(within(result).getByRole("heading")).toHaveTextContent("1 / 10");
    expect(within(result).getAllByRole("listitem")).toHaveLength(9);
    expect(document.body).not.toHaveClass("word-challenge-playing");

    const saved = JSON.parse(window.localStorage.getItem("ae-word-challenge:v1:meaning"));
    expect(saved.best["1"]).toBe(1);
    expect(saved.mastered).toHaveLength(1);
    expect(saved.missed).toHaveLength(9);

    fireEvent.click(screen.getByRole("button", { name: "換一級" }));
    expect(screen.getByText(/最佳 1\/10/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /練習之前錯的字（9 個）/ })).toBeInTheDocument();
});

test("hint reveals letters and leaving a round returns to the menu", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /第 2 級/ }));
    const word = currentGlossWord();
    const hintedBefore = document.querySelectorAll(".word-challenge__slot.is-hint").length;
    expect(hintedBefore).toBe(1);
    const hintButton = screen.getByRole("button", { name: "提示" });
    if (word.letters > 2) {
        fireEvent.click(hintButton);
        expect(document.querySelectorAll(".word-challenge__slot.is-hint")).toHaveLength(2);
    }
    fireEvent.click(screen.getByRole("button", { name: "離開" }));
    expect(screen.getByRole("region", { name: "選擇等級" })).toBeInTheDocument();
    expect(document.body).not.toHaveClass("word-challenge-playing");
});

test("never reads words aloud, even when the device has speech", () => {
    const speak = jest.fn();
    window.speechSynthesis = { speak, cancel: jest.fn(), getVoices: () => [] };
    window.SpeechSynthesisUtterance = function Utterance(text) { this.text = text; };
    renderPage({ variant: "app" });
    expect(screen.queryByText(/不用登入也能玩/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /第 3 級/ }));
    const word = currentGlossWord();
    expect(word.level).toBe(3);
    expect(screen.queryByRole("button", { name: /再聽一次|慢速|聽發音/ })).not.toBeInTheDocument();
    fireEvent.change(answerInput(), { target: { value: word.display.toUpperCase() } });
    fireEvent.click(screen.getByRole("button", { name: "確定" }));
    expect(screen.getByText("答對了！")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /聽發音/ })).not.toBeInTheDocument();
    expect(speak).not.toHaveBeenCalled();
});
