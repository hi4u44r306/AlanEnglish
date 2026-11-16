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
const tileButtons = () => [...document.querySelectorAll(".wi-tile")];
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
        expect(tileButtons()[1]).toHaveTextContent("明天再來");
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
        expect(screen.getByText(/已佔領 16 \/ 16/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "前往下一座島" }));
        expect(screen.getByText("第 2 座島")).toBeInTheDocument();
    });

    test("\"我的島嶼\" shows every island: full, in progress and locked, and jumps to an open island", () => {
        const now = new Date().toISOString();
        const progress = Object.fromEntries(level1.slice(0, 18).map(word => [word.key, { status: "mastered", firstMasteredAt: now }]));
        window.localStorage.setItem("ae-word-island:v1", JSON.stringify({ progress }));
        renderPage();
        expect(screen.getByText("已拿下 1 / 7 座")).toBeInTheDocument();
        const full = screen.getByRole("button", { name: "第 1 座島，已全部佔領" });
        const open = screen.getByRole("button", { name: "第 2 座島，已佔領 2 / 16" });
        const locked = screen.getByRole("button", { name: "第 3 座島，尚未開放" });
        expect(full).toHaveClass("is-full");
        expect(open).toHaveAttribute("aria-current", "true");
        expect(locked).toBeDisabled();
        fireEvent.click(full);
        expect(screen.getByText("第 1 座島", { selector: "strong" })).toBeInTheDocument();
        expect(screen.getByText(/已佔領 16 \/ 16/)).toBeInTheDocument();
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
        service.answerWordChallenge.mockResolvedValue({ position: 0, correct: true, note: null, matched: null, skipped: false, hint_count: 0, already_answered: false, recently_seen: false, expected: "dog", xp: { xp_awarded: 2, daily_xp: 2, daily_cap: 30, total_xp: 12, level_before: 1, level_after: 1, progress_before: 10, progress_after: 12, next_level_xp: 100 } });

        renderPage({ variant: "app" });
        await screen.findByText("已佔領 0 / 16");
        expect(service.getWordIslandSummary).toHaveBeenCalledWith(user, 1);
        expect(document.body.textContent).not.toMatch(/\bdog\b/);

        fireEvent.click(tileButtons()[0]);
        await screen.findByLabelText("輸入英文單字");
        expect(service.startWordIslandTile).toHaveBeenCalledWith(user, 1, 0, 0, { practice: false });
        expect(screen.getByText("d _ _")).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/\bdog\b/);

        type("dog");
        submit();
        await screen.findByText(/這一格是你的/);
        expect(service.answerWordChallenge).toHaveBeenCalledWith(user, "r1", 0, { typed: "dog" });
        // XP 回饋：這次 +2 XP、目前 Lv.1、進度條 10% → 12%。
        expect(screen.getByText("+2 XP")).toBeInTheDocument();
        expect(screen.getByText("Lv.1")).toBeInTheDocument();
        expect(screen.getByRole("progressbar", { name: "目前等級進度" })).toHaveAttribute("aria-valuenow", "12");
        expect(screen.getByText(/10% → 12%/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "回到島上" }));
        await screen.findByText("已佔領 1 / 16");
        expect(tileButtons()[0]).toHaveClass("is-claimed");
        expect(tileButtons()[0]).toHaveAccessibleName(/已佔領：dog/);
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

describe("two-stage upgrade, fused island, practice and the review cloud", () => {
    const DAY = 24 * 60 * 60 * 1000;
    const daysAgo = count => new Date(Date.now() - count * DAY).toISOString();
    const seed = progress => window.localStorage.setItem("ae-word-island:v1", JSON.stringify({ progress }));
    const maxedProgress = extra => Object.fromEntries(level1.slice(0, 16).map(word => [word.key, { status: "mastered", firstMasteredAt: "2026-03-05T04:00:00.000Z", lastCorrectAt: daysAgo(2), upgradeLevel: 1, lastUpgradedOn: daysAgo(10).slice(0, 10), ...extra }]));

    test("a tile claimed on an earlier day can be answered again to upgrade — once", async () => {
        seed({ [level1[0].key]: { status: "mastered", firstMasteredAt: daysAgo(3) } });
        renderPage();
        expect(tileButtons()[0]).toHaveClass("can-upgrade");
        fireEvent.click(tileButtons()[0]);
        expect(screen.getByText(/再答對一次，這塊地就升級/)).toBeInTheDocument();
        type(level1[0].display);
        submit();
        expect(await screen.findByText("升級了！這塊地繁榮起來了。")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "回到島上" }));
        expect(tileButtons()[0]).not.toHaveClass("can-upgrade");
        expect(tileButtons()[0]).toHaveClass("is-gold");
        expect(JSON.parse(window.localStorage.getItem("ae-word-island:v1")).progress[level1[0].key].upgradeLevel).toBe(1);
        // 已經升級：再點不會開題目。
        fireEvent.click(tileButtons()[0]);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    test("a tile claimed today cannot be upgraded until another day; there is no daily cap", () => {
        seed({ [level1[0].key]: { status: "mastered", firstMasteredAt: new Date().toISOString() } });
        renderPage();
        expect(tileButtons()[0]).not.toHaveClass("can-upgrade");
        fireEvent.click(tileButtons()[0]);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        window.localStorage.clear();
        const progress = {};
        level1.slice(0, 12).forEach(word => { progress[word.key] = { status: "mastered", firstMasteredAt: daysAgo(3) }; });
        seed(progress);
        document.body.innerHTML = "";
        renderPage();
        expect(document.querySelectorAll(".wi-tile.can-upgrade")).toHaveLength(12);
    });

    test("claiming the last tile of an island shows the island medal, then the next island opens", async () => {
        const progress = {};
        level1.slice(0, 15).forEach(word => { progress[word.key] = { status: "mastered", firstMasteredAt: daysAgo(3) }; });
        seed(progress);
        renderPage();
        fireEvent.click(tileButtons()[15]);
        type(level1[15].display);
        submit();
        await screen.findByRole("button", { name: "回到島上" });
        fireEvent.click(screen.getByRole("button", { name: "回到島上" }));
        expect(await screen.findByText("全島佔領！")).toBeInTheDocument();
    });

    test("upgrading the last tile plays the full-upgrade crown, and the island becomes one fused picture", async () => {
        const progress = maxedProgress();
        progress[level1[15].key] = { status: "mastered", firstMasteredAt: daysAgo(3), lastCorrectAt: daysAgo(3) };
        seed(progress);
        renderPage();
        expect(screen.queryByRole("dialog", { name: "完全升級" })).not.toBeInTheDocument();
        fireEvent.click(tileButtons()[15]);
        type(level1[15].display);
        submit();
        await screen.findByRole("button", { name: "回到島上" });
        fireEvent.click(screen.getByRole("button", { name: "回到島上" }));
        expect(await screen.findByRole("dialog", { name: "完全升級" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "繼續" }));
        expect(screen.queryByRole("dialog", { name: "完全升級" })).not.toBeInTheDocument();
        expect(screen.getByRole("img", { name: /已完全升級/ })).toBeInTheDocument();
        expect(tileButtons()).toHaveLength(0);
    });

    test("a fully upgraded island can be flipped open and any tile practised without losing the island", async () => {
        seed(maxedProgress());
        renderPage();
        // 第 1 座已經升滿，一進來會停在還沒完成的第 2 座；從「我的島嶼」回到第 1 座。
        fireEvent.click(screen.getByRole("button", { name: /第 1 座島/ }));
        expect(screen.getByRole("img", { name: /已完全升級/ })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "翻開地塊" }));
        expect(tileButtons()).toHaveLength(16);
        expect(tileButtons()[3]).toHaveTextContent(level1[3].display);
        fireEvent.click(tileButtons()[3]);
        expect(screen.getByText(/練習一下/)).toBeInTheDocument();
        type("zzzz");
        submit();
        expect(await screen.findByText(level1[3].display, { selector: "strong" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "知道了" }));
        const saved = JSON.parse(window.localStorage.getItem("ae-word-island:v1")).progress[level1[3].key];
        expect([saved.firstMasteredAt !== undefined, saved.upgradeLevel, saved.status]).toEqual([true, 1, "missed"]);
        fireEvent.click(screen.getByRole("button", { name: "收起地塊" }));
        expect(screen.getByRole("img", { name: /已完全升級/ })).toBeInTheDocument();
    });

    test("after 7 quiet days a cloud asks to review, opens the tiles and marks the 3 stalest", () => {
        const progress = maxedProgress({ lastCorrectAt: daysAgo(12) });
        [0, 1, 2].forEach(index => { progress[level1[index].key].lastCorrectAt = daysAgo(30); });
        seed(progress);
        renderPage();
        fireEvent.click(screen.getByRole("button", { name: /第 1 座島/ }));
        fireEvent.click(screen.getByRole("button", { name: /這座島有字想複習/ }));
        expect(tileButtons()).toHaveLength(16);
        expect([...document.querySelectorAll(".wi-tile.is-stale")].map(node => tileButtons().indexOf(node))).toEqual([0, 1, 2]);
    });

    test("no cloud and no ambient motion on a recently used island", () => {
        seed(maxedProgress());
        renderPage();
        fireEvent.click(screen.getByRole("button", { name: /第 1 座島/ }));
        expect(screen.getByRole("img", { name: /已完全升級/ })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /這座島有字想複習/ })).not.toBeInTheDocument();
    });

    test("a tile claimed on a holiday is a holiday tile even among ordinary ones, and the island notes how many", () => {
        const progress = {};
        level1.slice(0, 15).forEach(word => { progress[word.key] = { status: "mastered", firstMasteredAt: "2026-03-05T04:00:00.000Z", lastCorrectAt: daysAgo(2), upgradeLevel: 1, lastUpgradedOn: "2026-03-06" }; });
        progress[level1[15].key] = { status: "mastered", firstMasteredAt: "2026-09-25T04:00:00.000Z", lastCorrectAt: daysAgo(2), upgradeLevel: 1, lastUpgradedOn: "2026-09-26" };
        seed(progress);
        renderPage();
        fireEvent.click(screen.getByRole("button", { name: /第 1 座島/ }));
        // 15 塊一般日 + 1 塊中秋：融合成一般島，標出 1 塊中秋地塊；翻開後看得到那塊中秋地塊。
        expect(screen.getByText("中秋限定地塊 ×1")).toBeInTheDocument();
        expect(screen.getByRole("img", { name: /已完全升級/ }).getAttribute("src")).toMatch(/island-hd-grass\.webp$/);
        fireEvent.click(screen.getByRole("button", { name: "翻開地塊" }));
        const sources = tileButtons().map(node => node.querySelector(".wi-tile__img").getAttribute("src"));
        expect(sources[15]).toMatch(/tile-midautumn-/);
        expect(sources.slice(0, 15).every(src => /tile-grass-/.test(src))).toBe(true);
    });

    test("an island completed on a holiday keeps its holiday tag", () => {
        const progress = {};
        level1.slice(0, 16).forEach(word => { progress[word.key] = { status: "mastered", firstMasteredAt: "2026-12-10T04:00:00.000Z" }; });
        seed(progress);
        renderPage();
        fireEvent.click(screen.getByRole("button", { name: /第 1 座島，已全部佔領/ }));
        expect(screen.getByText("聖誕限定")).toBeInTheDocument();
    });
});
