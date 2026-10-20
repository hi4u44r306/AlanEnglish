import React from "react";
import { act, render } from "@testing-library/react";
import useSpeakingAttention, { SPEAKING_IDLE_MS } from "./useSpeakingAttention";
import { recordSpeakingAttention } from "../services/learningActivityService";

jest.mock("../services/learningActivityService", () => ({ recordSpeakingAttention: jest.fn(() => Promise.resolve()) }));

const Probe = props => { useSpeakingAttention(props); return null; };
const user = { uid: "s1" };
const setVisibility = value => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
    document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => { jest.useFakeTimers(); recordSpeakingAttention.mockClear(); setVisibility("visible"); recordSpeakingAttention.mockClear(); });
afterEach(() => { jest.useRealTimers(); });

test("關卡進行中切換頁面記一次 hidden，30 秒內不重複", () => {
    render(<Probe firebaseUser={user} role="student" questionSetId={7} mode="challenge" busy={false} />);
    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    act(() => setVisibility("hidden"));
    expect(recordSpeakingAttention).toHaveBeenCalledTimes(1);
    expect(recordSpeakingAttention).toHaveBeenCalledWith(user, { reason: "hidden", question_set_id: 7, mode: "challenge" });
});

test("90 秒沒有操作記 idle；有點擊就重新計時；錄音評分中不記", () => {
    const view = render(<Probe firebaseUser={user} role="student" questionSetId={7} mode="easy" busy={false} />);
    act(() => { jest.advanceTimersByTime(SPEAKING_IDLE_MS - 1000); });
    act(() => { window.dispatchEvent(new Event("pointerdown")); });
    act(() => { jest.advanceTimersByTime(SPEAKING_IDLE_MS - 1000); });
    expect(recordSpeakingAttention).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(2000); });
    expect(recordSpeakingAttention).toHaveBeenCalledWith(user, { reason: "idle", question_set_id: 7, mode: "easy" });
    recordSpeakingAttention.mockClear();
    view.rerender(<Probe firebaseUser={user} role="student" questionSetId={7} mode="easy" busy />);
    act(() => { jest.advanceTimersByTime(SPEAKING_IDLE_MS * 2); });
    act(() => { window.dispatchEvent(new Event("pointerdown")); jest.advanceTimersByTime(SPEAKING_IDLE_MS + 10); });
    expect(recordSpeakingAttention).not.toHaveBeenCalled();
});

test("老師與管理員不記錄", () => {
    render(<Probe firebaseUser={user} role="admin" questionSetId={7} mode="easy" busy={false} />);
    act(() => setVisibility("hidden"));
    act(() => { jest.advanceTimersByTime(SPEAKING_IDLE_MS * 2); });
    expect(recordSpeakingAttention).not.toHaveBeenCalled();
});
