import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SystemErrorBoundary from "./SystemErrorBoundary";
import SystemReportHost from "./SystemReportHost";
import { clearSystemReport, showSystemReport } from "./reportBus";
import { canAutoReload, canUserReload, markReloadPending, settleReload } from "./reloadGuard";
import { addPendingReport, flushPendingReports, getPendingReports } from "./pendingReport";
import { restoreResume, saveResume } from "./resume";
import { isChunkError } from "./globalHandlers";
import { sendSystemReport } from "./reportClient";

jest.mock("../components/Pages/firebase-config", () => ({ authentication: { currentUser: null } }));
jest.mock("../components/Pages/supabase-config", () => ({ supabaseUrl: "https://example.supabase.co", supabaseKey: "key" }));

const report = (overrides = {}) => ({ id: "abcd1234-0001", kind: "render_crash", signature: `sig-${Math.random()}`, error_name: "TypeError", error_message: "boom", stack: "at x", ...overrides });

beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    clearSystemReport();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
});

describe("reload guard", () => {
    it("lets the user reload twice in five minutes, then stops", () => {
        const now = Date.now();
        expect(canUserReload(now)).toBe(true);
        markReloadPending(false, "render_crash", now); settleReload(now);
        expect(canUserReload(now)).toBe(true);
        markReloadPending(false, "render_crash", now); settleReload(now);
        expect(canUserReload(now + 1000)).toBe(false);
        expect(canUserReload(now + 6 * 60 * 1000)).toBe(true);
    });

    it("does not count a reload that never happened (user cancelled the browser prompt)", () => {
        const now = Date.now();
        markReloadPending(false, "render_crash", now - 5 * 60 * 1000);
        settleReload(now);
        expect(canUserReload(now)).toBe(true);
    });

    it("auto-reloads the same reason at most once in ten minutes", () => {
        const now = Date.now();
        expect(canAutoReload("chunk", now)).toBe(true);
        markReloadPending(true, "chunk", now); settleReload(now);
        expect(canAutoReload("chunk", now + 1000)).toBe(false);
        expect(canAutoReload("chunk", now + 11 * 60 * 1000)).toBe(true);
    });
});

describe("pending reports", () => {
    it("keeps a report until it is sent, and resends without duplicates", async () => {
        addPendingReport({ report_id: "r1-aaaaaaaa" });
        addPendingReport({ report_id: "r1-aaaaaaaa" });
        expect(getPendingReports()).toHaveLength(1);
        const send = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        await flushPendingReports(send);
        expect(getPendingReports()).toHaveLength(1);
        await flushPendingReports(send);
        expect(getPendingReports()).toHaveLength(0);
    });
});

describe("resume", () => {
    it("restores only for the same page and shows a short notice", () => {
        jest.useFakeTimers();
        window.scrollTo = jest.fn();
        saveResume();
        expect(restoreResume()).toBe(true);
        act(() => { jest.advanceTimersByTime(2000); });
        expect(window.scrollTo).toHaveBeenCalled();
        expect(document.body.textContent).toContain("已重新整理，繼續剛才的內容");
        jest.useRealTimers();
    });
});

describe("error classification", () => {
    it("recognises chunk failures and not ordinary errors", () => {
        expect(isChunkError({ name: "ChunkLoadError", message: "Loading chunk 7 failed." })).toBe(true);
        expect(isChunkError(new SyntaxError("Unexpected token '<'"))).toBe(true);
        expect(isChunkError(new TypeError("x is undefined"))).toBe(false);
    });
});

describe("sending", () => {
    it("treats a rate-limited answer as received so reload is never blocked", async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });
        expect(await sendSystemReport({ report_id: "x" })).toBe(true);
    });

    it("returns false (and does not throw) when the network is down", async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error("offline"));
        expect(await sendSystemReport({ report_id: "x" })).toBe(false);
    });
});

describe("boundary and dialog", () => {
    const Bomb = () => { throw new TypeError("kaboom"); };

    it("shows the fallback and opens the report dialog when a page crashes", async () => {
        jest.spyOn(console, "error").mockImplementation(() => {});
        render(<><SystemErrorBoundary><Bomb /></SystemErrorBoundary><SystemReportHost /></>);
        expect(screen.getByText("這一頁暫時無法顯示")).toBeInTheDocument();
        expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
        expect(screen.getByText("遇到問題了")).toBeInTheDocument();
        console.error.mockRestore();
    });

    it("sends the report, keeps a local copy until delivered, then reloads", async () => {
        const reload = jest.fn();
        Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload, pathname: "/student/review", search: "" } });
        render(<SystemReportHost />);
        act(() => { showSystemReport(report()); });
        fireEvent.change(screen.getByPlaceholderText(/按下一題/), { target: { value: "白畫面" } });
        fireEvent.click(screen.getByRole("button", { name: "回報並重新整理" }));
        await waitFor(() => expect(reload).toHaveBeenCalled());
        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body).toMatchObject({ action: "system_report", kind: "render_crash", user_note: "白畫面", path: "/student/review" });
        expect(body.name).toBeUndefined();
        expect(body.email).toBeUndefined();
        expect(getPendingReports()).toHaveLength(0);
    });

    it("still reloads when the report cannot be sent, and keeps it for later", async () => {
        const reload = jest.fn();
        Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload, pathname: "/", search: "" } });
        global.fetch = jest.fn().mockRejectedValue(new Error("offline"));
        render(<SystemReportHost />);
        act(() => { showSystemReport(report()); });
        fireEvent.click(screen.getByRole("button", { name: "回報並重新整理" }));
        await waitFor(() => expect(reload).toHaveBeenCalled());
        expect(getPendingReports()).toHaveLength(1);
    });

    it("stops offering reload after repeated reloads and points to home and support", () => {
        const now = Date.now();
        for (let index = 0; index < 2; index += 1) { markReloadPending(false, "render_crash", now); settleReload(now); }
        render(<SystemReportHost />);
        act(() => { showSystemReport(report()); });
        expect(screen.queryByRole("button", { name: "回報並重新整理" })).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "回首頁" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "聯絡客服" })).toBeInTheDocument();
    });

    it("shows each kind of problem only once per session", () => {
        const first = report({ signature: "same" });
        expect(showSystemReport(first)).toBe(true);
        expect(showSystemReport(first)).toBe(false);
    });

    it("pauses playing audio when it opens", () => {
        const audio = document.createElement("audio");
        Object.defineProperty(audio, "paused", { value: false, configurable: true });
        const pause = jest.spyOn(audio, "pause").mockImplementation(() => {});
        document.body.appendChild(audio);
        render(<SystemReportHost />);
        act(() => { showSystemReport(report()); });
        expect(pause).toHaveBeenCalled();
        expect(screen.getByText(/重新整理後要重新聽才會計次/)).toBeInTheDocument();
        audio.remove();
    });
});
