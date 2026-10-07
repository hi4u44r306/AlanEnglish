import React from "react";
import { act, render } from "@testing-library/react";
import "@testing-library/jest-dom";
import SpeakingRecognizerWarmup from "./SpeakingRecognizerWarmup";
import { retainLocalSpeakingRecognizer } from "../services/localSpeakingRecognizer";

jest.mock("../services/localSpeakingRecognizer", () => ({retainLocalSpeakingRecognizer:jest.fn()}));
describe("全站背景語音準備", () => {
    let prepare, release;
    beforeEach(() => {
        jest.useFakeTimers();
        prepare = jest.fn().mockResolvedValue();
        release = jest.fn();
        retainLocalSpeakingRecognizer.mockReturnValue({recognizer:{ready:false,prepare},release});
    });
    afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });
    it("頁面先顯示，再自動準備；重新 render 不重複啟動", async () => {
        const {container,rerender,unmount} = render(<SpeakingRecognizerWarmup />);
        expect(container).toBeEmptyDOMElement();
        expect(prepare).not.toHaveBeenCalled();
        await act(async () => { jest.advanceTimersByTime(1500); });
        expect(prepare).toHaveBeenCalledTimes(1);
        rerender(<SpeakingRecognizerWarmup />);
        expect(retainLocalSpeakingRecognizer).toHaveBeenCalledTimes(1);
        unmount(); expect(release).toHaveBeenCalledTimes(1);
    });
    it("離開網站會取消尚未開始的背景工作", () => {
        const {unmount} = render(<SpeakingRecognizerWarmup />);
        unmount(); jest.runOnlyPendingTimers();
        expect(prepare).not.toHaveBeenCalled();
        expect(release).toHaveBeenCalledTimes(1);
    });
    it("已就緒不用再載入，背景失敗不阻擋網站", async () => {
        retainLocalSpeakingRecognizer.mockReturnValueOnce({recognizer:{ready:true,prepare},release});
        const ready = render(<SpeakingRecognizerWarmup />);
        await act(async () => { jest.advanceTimersByTime(1500); });
        expect(prepare).not.toHaveBeenCalled();
        ready.unmount();
        prepare.mockRejectedValueOnce(new Error("synthetic load failure"));
        const failed = render(<SpeakingRecognizerWarmup />);
        await act(async () => { jest.advanceTimersByTime(1500); });
        expect(prepare).toHaveBeenCalledTimes(1);
        failed.unmount();
    });
});
