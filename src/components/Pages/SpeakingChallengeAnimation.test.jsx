import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { SpeakingChallengeCompletion } from "./SpeakingChallengeAnimation";

describe("SpeakingChallengeCompletion", () => {
    const originalMatchMedia = window.matchMedia;
    beforeEach(() => { jest.useFakeTimers(); window.matchMedia = jest.fn(() => ({ matches: false })); });
    afterEach(() => { jest.useRealTimers(); window.matchMedia = originalMatchMedia; });
    it("shows actual awards, counts to their final values, and keeps the result open", () => {
        const onReturn = jest.fn();
        render(<SpeakingChallengeCompletion notice={{ xp_awarded: 30, ae_points_awarded: 3 }} mode="easy" reference="Workbook 1 · P.11" onReturn={onReturn} />);
        const dialog = screen.getByRole("dialog", { name: "闖關成功！" });
        expect(within(dialog).getByLabelText("本次整頁通關 3 星")).toBeInTheDocument();
        act(() => jest.advanceTimersByTime(1900));
        expect(within(dialog).getByLabelText("本次獲得 30 XP")).toHaveTextContent("+30");
        expect(within(dialog).getByLabelText("本次獲得 3 AE Points")).toHaveTextContent("+3");
        expect(onReturn).not.toHaveBeenCalled();
    });
    it.each([
        ["challenge", { xp_awarded: 0, ae_points_awarded: 0 }, 0, 0],
        ["easy", { xp_awarded: 30, ae_points_awarded: 0 }, 30, 0],
        ["easy", {}, 0, 0],
        ["easy", { xp_awarded: -10, ae_points_awarded: "invalid" }, 0, 0]
    ])("does not invent rewards for %s %j", (mode, notice, xp, points) => {
        render(<SpeakingChallengeCompletion notice={notice} mode={mode} onReturn={jest.fn()} />);
        expect(screen.getByLabelText(`本次獲得 ${xp} XP`)).toBeInTheDocument();
        expect(screen.getByLabelText(`本次獲得 ${points} AE Points`)).toBeInTheDocument();
    });
    it("staff previews cannot display earned rewards and keyboard focus stays in the dialog", () => {
        const onReturn = jest.fn();
        const onNext = jest.fn();
        const previousOverflow = document.body.style.overflow;
        const { unmount } = render(<SpeakingChallengeCompletion staffPreview notice={{ xp_awarded: 30, ae_points_awarded: 3 }} onReturn={onReturn} onNext={onNext} />);
        const next = screen.getByRole("button", { name: "前往下一關" });
        const back = screen.getByRole("button", { name: "返回地圖" });
        expect(next).toHaveFocus();
        expect(screen.getByLabelText("本次獲得 0 XP")).toBeInTheDocument();
        fireEvent.keyDown(next, { key: "Tab", shiftKey: true });
        expect(back).toHaveFocus();
        fireEvent.keyDown(back, { key: "Tab" });
        expect(next).toHaveFocus();
        fireEvent.keyDown(next, { key: "Escape" });
        expect(onReturn).toHaveBeenCalledTimes(1);
        unmount();
        expect(document.body.style.overflow).toBe(previousOverflow);
    });
    it("reduced motion immediately shows the actual totals", () => {
        window.matchMedia.mockReturnValue({ matches: true });
        render(<SpeakingChallengeCompletion notice={{ xp_awarded: 30, ae_points_awarded: 3 }} onReturn={jest.fn()} />);
        expect(screen.getByLabelText("本次獲得 30 XP")).toHaveTextContent("+30");
        expect(screen.getByLabelText("本次獲得 3 AE Points")).toHaveTextContent("+3");
    });
});
