import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import wordBank from "../../data/wordChallenge/wordBank.v1.json";
import { useAuth } from "../../auth/AuthContext";
import * as service from "../../services/wordChallengeService";
import WordChallenge from "./WordChallenge";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/wordChallengeService", () => ({
    getWordChallengeSummary: jest.fn(),
    startWordChallengeRound: jest.fn(),
    revealWordChallengeHint: jest.fn(),
    answerWordChallenge: jest.fn(),
    finishWordChallengeRound: jest.fn()
}));

const renderPage = (props = {}) => render(<MemoryRouter><WordChallenge {...props} /></MemoryRouter>);
const answerInput = () => screen.getByLabelText(/輸入英文拼字/);
const currentGlossWord = () => {
    const gloss = document.querySelector(".word-challenge__gloss")?.textContent;
    return wordBank.words.find(word => word.gloss === gloss);
};

beforeEach(() => {
    Object.values(service).filter(item => typeof item === "function").forEach(mock => mock.mockReset());
    window.localStorage.clear();
    window.scrollTo = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
});

afterEach(() => {
    document.body.classList.remove("word-challenge-playing");
});

// 伺服器模式：登入的學生，且後端已開放。
const serverQuestions = Array.from({ length: 10 }, (_, position) => ({
    position,
    gloss: `中文${position}`,
    letters: 3,
    template: [{ kind: "letter", hint: "d" }, { kind: "letter", hint: "" }, { kind: "letter", hint: "" }]
}));
const studentAuth = () => useAuth.mockReturnValue({ role: "student", firebaseUser: { uid: "student-1" } });
const serverSummary = (extra = {}) => ({ mode: "server", bank_version: "v1", mastered: [], missed: [], best: {}, xp_today: 0, ...extra });

test("questions carry no answer, the server grades, and 10 XP shows on the result", async () => {
    studentAuth();
    service.getWordChallengeSummary.mockResolvedValue(serverSummary({ mastered: ["dog"], best: { 1: 7 } }));
    service.startWordChallengeRound.mockResolvedValue({ round_id: "r1", expires_at: "2099-01-01T00:00:00Z", level: 1, questions: serverQuestions });
    service.answerWordChallenge.mockImplementation(async (_user, _round, position) => ({ position, correct: true, note: null, matched: null, skipped: false, hint_count: 0, already_answered: false, expected: "dog" }));
    service.finishWordChallengeRound.mockResolvedValue({ total_questions: 10, correct_count: 10, unhinted_correct_count: 10, new_mastered_count: 10, xp_awarded: 10, already_finished: false, total_xp: 10 });
    const updated = jest.fn();
    window.addEventListener("ae:gamification-updated", updated);

    renderPage({ variant: "app" });
    await screen.findByText(/成績記在你的帳號/);
    expect(screen.getByText(/最佳 7\/10/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /第 1 級/ }));
    await screen.findByLabelText("第 1 題，共 10 題");
    expect(service.startWordChallengeRound).toHaveBeenCalledWith({ uid: "student-1" }, 1);
    // 畫面上只有已給的第一個字母，沒有完整答案。
    expect(document.querySelectorAll(".word-challenge__slot.is-hint")).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/\bdog\b/i);

    for (let question = 1; question <= 10; question += 1) {
        fireEvent.change(answerInput(), { target: { value: "dog" } });
        fireEvent.click(screen.getByRole("button", { name: "確定" }));
        await screen.findByText("答對了！");
        expect(document.querySelector(".word-challenge__answer")).toHaveTextContent("dog");
        fireEvent.click(screen.getByRole("button", { name: question === 10 ? "看成績" : "下一題" }));
        if (question < 10) await screen.findByLabelText(`第 ${question + 1} 題，共 10 題`);
    }
    expect(await screen.findByText("這一輪得到 10 XP！")).toBeInTheDocument();
    expect(service.finishWordChallengeRound).toHaveBeenCalledWith({ uid: "student-1" }, "r1");
    expect(updated).toHaveBeenCalled();
    window.removeEventListener("ae:gamification-updated", updated);
    // 伺服器模式不寫本機成績。
    expect(window.localStorage.getItem("ae-word-challenge:v1:meaning")).toBeNull();
});

test("hints come from the server and replace the letter template", async () => {
    studentAuth();
    service.getWordChallengeSummary.mockResolvedValue(serverSummary());
    service.startWordChallengeRound.mockResolvedValue({ round_id: "r2", level: 2, questions: serverQuestions });
    service.revealWordChallengeHint.mockResolvedValue({ position: 0, hint_count: 1, hints_left: 0, template: [{ kind: "letter", hint: "d" }, { kind: "letter", hint: "o" }, { kind: "letter", hint: "" }] });
    renderPage({ variant: "app" });
    await screen.findByText(/成績記在你的帳號/);
    fireEvent.click(screen.getByRole("button", { name: /第 2 級/ }));
    await screen.findByLabelText("第 1 題，共 10 題");
    fireEvent.click(screen.getByRole("button", { name: "提示" }));
    await waitFor(() => expect(document.querySelectorAll(".word-challenge__slot.is-hint")).toHaveLength(2));
    expect(service.revealWordChallengeHint).toHaveBeenCalledWith({ uid: "student-1" }, "r2", 0);
    expect(screen.getByRole("button", { name: "提示" })).toBeDisabled();
});

test("when the server says local, the student plays locally and never starts a server round", async () => {
    studentAuth();
    service.getWordChallengeSummary.mockResolvedValue({ mode: "local" });
    renderPage({ variant: "app" });
    await waitFor(() => expect(service.getWordChallengeSummary).toHaveBeenCalled());
    expect(screen.getByText(/成績目前只存在這台裝置/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /第 1 級/ }));
    expect(await screen.findByLabelText("第 1 題，共 10 題")).toBeInTheDocument();
    expect(service.startWordChallengeRound).not.toHaveBeenCalled();
});

test("if the server cannot start a round, a local round starts and the menu explains afterwards", async () => {
    studentAuth();
    service.getWordChallengeSummary.mockResolvedValue(serverSummary());
    service.startWordChallengeRound.mockRejectedValue(Object.assign(new Error("boom"), { status: 500 }));
    renderPage({ variant: "app" });
    await screen.findByText(/成績記在你的帳號/);
    fireEvent.click(screen.getByRole("button", { name: /第 1 級/ }));
    expect(await screen.findByLabelText("第 1 題，共 10 題")).toBeInTheDocument();
    expect(currentGlossWord()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "離開" }));
    expect(screen.getByText("暫時連不上伺服器，這一輪不會記到帳號，照樣可以玩。")).toBeInTheDocument();
    expect(screen.getByText(/成績目前只存在這台裝置/)).toBeInTheDocument();
});

test("a failure in the middle of a round returns to the menu with the message, never a stuck screen", async () => {
    studentAuth();
    service.getWordChallengeSummary.mockResolvedValue(serverSummary());
    service.startWordChallengeRound.mockResolvedValue({ round_id: "r3", level: 1, questions: serverQuestions });
    service.answerWordChallenge.mockRejectedValue(Object.assign(new Error("這一輪時間太久，已經過期，請重新開始"), { status: 409, code: "round_expired" }));
    renderPage({ variant: "app" });
    await screen.findByText(/成績記在你的帳號/);
    fireEvent.click(screen.getByRole("button", { name: /第 1 級/ }));
    await screen.findByLabelText("第 1 題，共 10 題");
    fireEvent.change(answerInput(), { target: { value: "dog" } });
    fireEvent.click(screen.getByRole("button", { name: "確定" }));
    expect(await screen.findByText("這一輪時間太久，已經過期，請重新開始")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "選擇等級" })).toBeInTheDocument();
    expect(document.body).not.toHaveClass("word-challenge-playing");
});

test("a failed finish is retried once, still shows the result, and can be retried from the result page", async () => {
    studentAuth();
    service.getWordChallengeSummary.mockResolvedValue(serverSummary());
    service.startWordChallengeRound.mockResolvedValue({ round_id: "r4", level: 1, questions: serverQuestions.slice(0, 1) });
    service.answerWordChallenge.mockResolvedValue({ position: 0, correct: false, note: null, matched: null, skipped: true, hint_count: 0, already_answered: false, expected: "dog" });
    service.finishWordChallengeRound.mockRejectedValue(Object.assign(new Error("x"), { status: 500 }));
    renderPage({ variant: "app" });
    await screen.findByText(/成績記在你的帳號/);
    fireEvent.click(screen.getByRole("button", { name: /第 1 級/ }));
    await screen.findByLabelText("第 1 題，共 1 題");
    fireEvent.click(screen.getByRole("button", { name: "不會，看答案" }));
    await screen.findByText("答案是");
    fireEvent.click(screen.getByRole("button", { name: "看成績" }));
    expect(await screen.findByText("作答已記下，但成績與 XP 還沒結算成功。")).toBeInTheDocument();
    expect(service.finishWordChallengeRound).toHaveBeenCalledTimes(2);
    expect(within(screen.getByRole("region", { name: "這一輪的成績" })).getByRole("heading")).toHaveTextContent("0 / 1");

    // 網路恢復後按「再結算一次」，用同一個 round_id。
    service.finishWordChallengeRound.mockResolvedValue({ total_questions: 1, correct_count: 0, unhinted_correct_count: 0, new_mastered_count: 0, xp_awarded: 0, already_finished: false, total_xp: 0 });
    fireEvent.click(screen.getByRole("button", { name: "再結算一次" }));
    await waitFor(() => expect(screen.queryByText("作答已記下，但成績與 XP 還沒結算成功。")).not.toBeInTheDocument());
    expect(service.finishWordChallengeRound).toHaveBeenLastCalledWith({ uid: "student-1" }, "r4");
    expect(screen.queryByRole("button", { name: "再結算一次" })).not.toBeInTheDocument();
});

test("a finish that fails with a 4xx (round expired) is not retried automatically", async () => {
    studentAuth();
    service.getWordChallengeSummary.mockResolvedValue(serverSummary());
    service.startWordChallengeRound.mockResolvedValue({ round_id: "r5", level: 1, questions: serverQuestions.slice(0, 1) });
    service.answerWordChallenge.mockResolvedValue({ position: 0, correct: true, note: null, matched: null, skipped: false, hint_count: 0, already_answered: false, expected: "dog" });
    service.finishWordChallengeRound.mockRejectedValue(Object.assign(new Error("過期"), { status: 409, code: "round_expired" }));
    renderPage({ variant: "app" });
    await screen.findByText(/成績記在你的帳號/);
    fireEvent.click(screen.getByRole("button", { name: /第 1 級/ }));
    await screen.findByLabelText("第 1 題，共 1 題");
    fireEvent.change(answerInput(), { target: { value: "dog" } });
    fireEvent.click(screen.getByRole("button", { name: "確定" }));
    await screen.findByText("答對了！");
    fireEvent.click(screen.getByRole("button", { name: "看成績" }));
    await screen.findByText("作答已記下，但成績與 XP 還沒結算成功。");
    expect(service.finishWordChallengeRound).toHaveBeenCalledTimes(1);
});

test("a double tap on 確定 sends one answer only", async () => {
    studentAuth();
    service.getWordChallengeSummary.mockResolvedValue(serverSummary());
    service.startWordChallengeRound.mockResolvedValue({ round_id: "r6", level: 1, questions: serverQuestions });
    let resolveAnswer;
    service.answerWordChallenge.mockImplementation(() => new Promise(resolve => { resolveAnswer = resolve; }));
    renderPage({ variant: "app" });
    await screen.findByText(/成績記在你的帳號/);
    fireEvent.click(screen.getByRole("button", { name: /第 1 級/ }));
    await screen.findByLabelText("第 1 題，共 10 題");
    fireEvent.change(answerInput(), { target: { value: "dog" } });
    const submit = screen.getByRole("button", { name: "確定" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(service.answerWordChallenge).toHaveBeenCalledTimes(1);
    resolveAnswer({ position: 0, correct: true, note: null, matched: null, skipped: false, hint_count: 0, already_answered: false, expected: "dog" });
    await screen.findByText("答對了！");
    expect(document.querySelectorAll(".word-challenge__dot.is-correct")).toHaveLength(1);
});

test("teachers never call the server", () => {
    useAuth.mockReturnValue({ role: "teacher", firebaseUser: { uid: "teacher" } });
    renderPage({ variant: "app" });
    fireEvent.click(screen.getByRole("button", { name: /第 1 級/ }));
    expect(service.getWordChallengeSummary).not.toHaveBeenCalled();
    expect(service.startWordChallengeRound).not.toHaveBeenCalled();
});

test("when a round pays nothing because the words were already learned, the result page says why", async () => {
    studentAuth();
    service.getWordChallengeSummary.mockResolvedValue(serverSummary());
    service.startWordChallengeRound.mockResolvedValue({ round_id: "r7", level: 1, questions: serverQuestions.slice(0, 1) });
    service.answerWordChallenge.mockResolvedValue({ position: 0, correct: true, note: null, matched: null, skipped: false, hint_count: 0, already_answered: false, expected: "dog" });
    service.finishWordChallengeRound.mockResolvedValue({ total_questions: 1, correct_count: 1, unhinted_correct_count: 1, new_mastered_count: 0, xp_awarded: 0, already_finished: false, total_xp: 0 });
    renderPage({ variant: "app" });
    await screen.findByText(/成績記在你的帳號/);
    fireEvent.click(screen.getByRole("button", { name: /第 1 級/ }));
    await screen.findByLabelText("第 1 題，共 1 題");
    fireEvent.change(answerInput(), { target: { value: "dog" } });
    fireEvent.click(screen.getByRole("button", { name: "確定" }));
    await screen.findByText("答對了！");
    fireEvent.click(screen.getByRole("button", { name: "看成績" }));
    expect(await screen.findByText(/第一次學會」的新字/)).toBeInTheDocument();
});
