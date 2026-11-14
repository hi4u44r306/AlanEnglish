import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import * as service from "../../services/wordChallengeService";
import { wordsForLevel } from "../../services/wordChallengeBank";
import { WORD_CHALLENGE_MODES } from "../../utils/wordChallengeAnswer";
import { islandWordsOf } from "../../utils/wordIsland";
import WordIsland from "./WordIsland";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/wordChallengeService", () => ({
    getWordIslandSummary: jest.fn(),
    startWordIslandTile: jest.fn(),
    answerWordChallenge: jest.fn()
}));

const renderPage = (props = {}) => render(<MemoryRouter><WordIsland {...props} /></MemoryRouter>);
const level1 = islandWordsOf(wordsForLevel(1, WORD_CHALLENGE_MODES.meaning));
const tileButtons = () => [...document.querySelectorAll(".word-island__tile")];
const type = value => fireEvent.change(screen.getByLabelText("輸入英文單字"), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "送出" }));

beforeEach(() => {
    Object.values(service).filter(item => typeof item === "function").forEach(mock => mock.mockReset());
    useAuth.mockReturnValue({ role: null, firebaseUser: null });
    window.localStorage.clear();
});

describe("local mode (guests, teachers, or no server)", () => {
    test("shows one island of 16 tiles at a time with no island list", () => {
        renderPage();
        expect(screen.getByText("第 1 座島")).toBeInTheDocument();
        expect(screen.getByText("已佔領 0 / 16")).toBeInTheDocument();
        expect(tileButtons()).toHaveLength(16);
        expect(screen.queryByText("回上一座島")).not.toBeInTheDocument();
        expect(service.getWordIslandSummary).not.toHaveBeenCalled();
    });

    test("a correct answer claims the tile, and the progress survives a reload", async () => {
        const view = renderPage();
        fireEvent.click(tileButtons()[0]);
        expect(screen.getByText(level1[0].gloss, { selector: "h2" })).toBeInTheDocument();
        type(level1[0].display);
        submit();
        expect(await screen.findByRole("status")).toHaveTextContent(/這一格是你的|答對了/);
        fireEvent.click(screen.getByRole("button", { name: "回到島上" }));
        expect(screen.getByText("已佔領 1 / 16")).toBeInTheDocument();
        expect(tileButtons()[0]).toHaveClass("is-claimed");
        view.unmount();
        renderPage();
        expect(screen.getByText("已佔領 1 / 16")).toBeInTheDocument();
    });

    test("one wrong answer reveals the answer and cools the tile; it cannot be tried again today", async () => {
        renderPage();
        fireEvent.click(tileButtons()[1]);
        type("zzzz");
        submit();
        expect(await screen.findByText(level1[1].display, { selector: "strong" })).toBeInTheDocument();
        expect(screen.queryByLabelText("輸入英文單字")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "知道了" }));
        expect(tileButtons()[1]).toHaveClass("is-cooldown");
        expect(screen.getByText("明天再來")).toBeInTheDocument();
        fireEvent.click(tileButtons()[1]);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByText("已佔領 0 / 16")).toBeInTheDocument();
    });

    test("a full first island opens the second one automatically; the full island offers the next, and you can go back", () => {
        const now = new Date().toISOString();
        const progress = Object.fromEntries(level1.slice(0, 16).map(word => [word.key, { status: "mastered", firstMasteredAt: now }]));
        window.localStorage.setItem("ae-word-island:v1", JSON.stringify({ progress }));
        renderPage();
        // 一進來就停在第一座還沒佔滿的島。
        expect(screen.getByText("第 2 座島")).toBeInTheDocument();
        expect(screen.getByText("已佔領 0 / 16")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "回上一座島" }));
        expect(screen.getByText("第 1 座島")).toBeInTheDocument();
        expect(screen.getByText("已佔領 16 / 16")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "前往下一座島" }));
        expect(screen.getByText("第 2 座島")).toBeInTheDocument();
    });

    test("the signed-in page without a server says progress stays on this device", () => {
        renderPage({ variant: "app" });
        expect(screen.getByText(/進度只存在這台裝置/)).toBeInTheDocument();
    });
});

describe("server mode (signed-in student)", () => {
    const user = { uid: "student-1" };
    const serverTiles = (overrides = {}) => Array.from({ length: 16 }, (_, tile) => ({ tile, gloss: `中文${tile}`, letters: 3, state: "open", review: false, ...(overrides[tile] || {}) }));
    const serverIslands = overrides => [
        { island: 0, unlocked: true, total: 16, claimed_count: Object.values(overrides || {}).filter(item => item.state === "claimed").length, tiles: serverTiles(overrides) },
        { island: 1, unlocked: false, total: 16, claimed_count: 0, tiles: serverTiles(Object.fromEntries(Array.from({ length: 16 }, (_, tile) => [tile, { state: "locked" }]))) }
    ];
    const serverSummary = overrides => ({ mode: "server", bank_version: "v1", level: 1, islands: serverIslands(overrides) });

    beforeEach(() => useAuth.mockReturnValue({ role: "student", firebaseUser: user }));

    test("the tile is opened by the server, graded by the server, and the board refreshes afterwards", async () => {
        service.getWordIslandSummary
            .mockResolvedValueOnce(serverSummary())
            .mockResolvedValueOnce(serverSummary({ 0: { state: "claimed", display: "dog" } }));
        service.startWordIslandTile.mockResolvedValue({
            round_id: "r1",
            level: 1,
            island: 0,
            tile: 0,
            question: { position: 0, gloss: "中文0", letters: 3, template: [{ kind: "letter", hint: "d" }, { kind: "letter", hint: "" }, { kind: "letter", hint: "" }] }
        });
        service.answerWordChallenge.mockResolvedValue({ position: 0, correct: true, note: null, matched: null, skipped: false, hint_count: 0, already_answered: false, recently_seen: false, expected: "dog" });

        renderPage({ variant: "app" });
        await screen.findByText("已佔領 0 / 16");
        expect(service.getWordIslandSummary).toHaveBeenCalledWith(user, 1);
        expect(document.body.textContent).not.toMatch(/\bdog\b/);

        fireEvent.click(tileButtons()[0]);
        await screen.findByLabelText("輸入英文單字");
        expect(service.startWordIslandTile).toHaveBeenCalledWith(user, 1, 0, 0);
        expect(screen.getByText("d _ _")).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/\bdog\b/);

        type("dog");
        submit();
        await screen.findByText(/這一格是你的/);
        expect(service.answerWordChallenge).toHaveBeenCalledWith(user, "r1", 0, { typed: "dog" });
        fireEvent.click(screen.getByRole("button", { name: "回到島上" }));
        await screen.findByText("已佔領 1 / 16");
        expect(tileButtons()[0]).toHaveClass("is-claimed");
        expect(tileButtons()[0]).toHaveTextContent("dog");
    });

    test("a correct answer right after seeing the answer is shown as not counted", async () => {
        service.getWordIslandSummary.mockResolvedValue(serverSummary());
        service.startWordIslandTile.mockResolvedValue({ round_id: "r2", question: { position: 0, gloss: "中文0", letters: 3, template: [{ kind: "letter", hint: "d" }, { kind: "letter", hint: "" }, { kind: "letter", hint: "" }] } });
        service.answerWordChallenge.mockResolvedValue({ position: 0, correct: true, note: null, matched: null, skipped: false, hint_count: 1, already_answered: false, recently_seen: true, expected: "dog" });
        renderPage({ variant: "app" });
        await screen.findByText("已佔領 0 / 16");
        fireEvent.click(tileButtons()[0]);
        await screen.findByLabelText("輸入英文單字");
        type("dog");
        submit();
        await screen.findByText(/明天再答對才算學會/);
        expect(screen.getByRole("button", { name: "知道了" })).toBeInTheDocument();
    });

    test("a wrong answer shows the server's answer and the tile stays unclaimed", async () => {
        service.getWordIslandSummary.mockResolvedValue(serverSummary());
        service.startWordIslandTile.mockResolvedValue({ round_id: "r3", question: { position: 0, gloss: "中文0", letters: 3, template: [{ kind: "letter", hint: "d" }, { kind: "letter", hint: "" }, { kind: "letter", hint: "" }] } });
        service.answerWordChallenge.mockResolvedValue({ position: 0, correct: false, note: null, matched: null, skipped: false, hint_count: 0, already_answered: false, recently_seen: false, expected: "dog", cooldown_until: "2099-01-01T16:00:00.000Z" });
        renderPage({ variant: "app" });
        await screen.findByText("已佔領 0 / 16");
        fireEvent.click(tileButtons()[0]);
        await screen.findByLabelText("輸入英文單字");
        type("cat");
        submit();
        await screen.findByText("dog", { selector: "strong" });
        expect(screen.getByText(/明天再來佔領/)).toBeInTheDocument();
    });

    test("cooling and locked tiles cannot be opened", async () => {
        service.getWordIslandSummary.mockResolvedValue(serverSummary({ 2: { state: "cooldown", review: true, cooldown_until: "2099-01-01T16:00:00.000Z" } }));
        renderPage({ variant: "app" });
        await screen.findByText("已佔領 0 / 16");
        fireEvent.click(tileButtons()[2]);
        expect(service.startWordIslandTile).not.toHaveBeenCalled();
        expect(tileButtons()[2]).toHaveClass("is-cooldown");
        expect(tileButtons()[2]).toHaveAttribute("aria-disabled", "true");
    });

    test("when the server says local mode, or is unreachable, the page falls back to this device", async () => {
        service.getWordIslandSummary.mockResolvedValueOnce({ mode: "local", bank_version: "v1" });
        const first = renderPage({ variant: "app" });
        await screen.findByText(/進度只存在這台裝置/);
        expect(tileButtons()).toHaveLength(16);
        first.unmount();

        service.getWordIslandSummary.mockRejectedValueOnce(new Error("boom"));
        renderPage({ variant: "app" });
        await screen.findByText(/暫時連不上伺服器/);
        await waitFor(() => expect(tileButtons()).toHaveLength(16));
        fireEvent.click(tileButtons()[0]);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(service.startWordIslandTile).not.toHaveBeenCalled();
    });

    test("teachers and admins never call the server", () => {
        useAuth.mockReturnValue({ role: "teacher", firebaseUser: user });
        renderPage({ variant: "app" });
        expect(service.getWordIslandSummary).not.toHaveBeenCalled();
        expect(tileButtons()).toHaveLength(16);
    });
});
