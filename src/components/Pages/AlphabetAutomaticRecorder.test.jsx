import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AlphabetAutomaticRecorder, { rmsLevel } from "./AlphabetAutomaticRecorder";
import { SpeakingAssessmentContext } from "./SpeakingAssessmentBudget";
import { submitSpeakingPronunciationAttempt } from "../../services/pronunciationCoachService";
import { convertAudioBlobToWav } from "../../utils/audioWav";
jest.mock("../../services/pronunciationCoachService", () => ({ submitSpeakingPronunciationAttempt: jest.fn() }));
jest.mock("../../utils/audioWav", () => ({ convertAudioBlobToWav: jest.fn() }));

describe("AlphabetAutomaticRecorder", () => {
    const originalMediaDevices = navigator.mediaDevices;
    const originalMediaRecorder = window.MediaRecorder;
    const originalAudioContext = window.AudioContext;
    const originalCreateUrl = URL.createObjectURL;
    const originalRevokeUrl = URL.revokeObjectURL;

    afterEach(() => {
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
        window.MediaRecorder = originalMediaRecorder;
        window.AudioContext = originalAudioContext;
        URL.createObjectURL = originalCreateUrl;
        URL.revokeObjectURL = originalRevokeUrl;
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it("計算本機 VAD 音量，不需要把連續環境音上傳", () => {
        expect(rmsLevel(new Float32Array([0, 0, 0]))).toBe(0);
        expect(rmsLevel(new Float32Array([1, -1]))).toBeCloseTo(1);
    });

    it("瀏覽器不支援錄音時清楚提示，不顯示手動錄音或送出按鈕", async () => {
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
        window.MediaRecorder = undefined;
        render(<AlphabetAutomaticRecorder
            firebaseUser={{ uid: "student" }}
            question={{ id: 1 }}
            foundationRoundId="11111111-1111-4111-8111-111111111111"
            onScored={jest.fn()}
            onRoundInvalid={jest.fn()}
        />);

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("不支援自動收音"));
        expect(screen.queryByRole("button", { name: /錄音|送出/ })).not.toBeInTheDocument();
    });

    it("A–Z 額度用完仍可錄音回聽與再錄，不呼叫評分或通關，停止後關閉麥克風", async () => {
        let frame;
        let volume = 0;
        const stopTrack = jest.fn();
        const getUserMedia = jest.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
        window.AudioContext = class {
            resume = async () => {};
            close = async () => {};
            createAnalyser = () => ({ fftSize: 1024, getFloatTimeDomainData: samples => samples.fill(volume) });
            createMediaStreamSource = () => ({ connect: () => {} });
        };
        window.MediaRecorder = class {
            state = "inactive";
            mimeType = "audio/webm";
            start() { this.state = "recording"; }
            stop() {
                this.state = "inactive";
                this.ondataavailable?.({ data: new Blob([new Uint8Array(1000)]) });
                this.onstop?.();
            }
        };
        jest.spyOn(performance, "now").mockReturnValue(0);
        jest.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frame = callback; return 1; });
        jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
        URL.createObjectURL = jest.fn().mockReturnValue("blob:local-alphabet");
        URL.revokeObjectURL = jest.fn();
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1000)], { type: "audio/wav" }));
        const onScored = jest.fn();
        const { container, unmount } = render(<SpeakingAssessmentContext.Provider value={{ usage: { can_assess: false, global_available: true }, onUsage: jest.fn() }}>
            <AlphabetAutomaticRecorder question={{ id: 1 }} foundationRoundId="11111111-1111-4111-8111-111111111111" onScored={onScored} />
        </SpeakingAssessmentContext.Provider>);
        await screen.findByText("麥克風已開啟");
        act(() => frame(100));
        volume = 0.1;
        for (const time of [500, 550, 600]) act(() => frame(time));
        volume = 0;
        await act(async () => frame(1600));
        await screen.findByText("錄音已保留");
        expect(container.querySelector("audio")).toHaveAttribute("src", "blob:local-alphabet");
        expect(stopTrack).toHaveBeenCalledTimes(1);
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
        expect(onScored).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "再錄一次（不送評）" }));
        await screen.findByText("麥克風已開啟");
        expect(getUserMedia).toHaveBeenCalledTimes(2);
        unmount();
        expect(stopTrack).toHaveBeenCalledTimes(2);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-alphabet");
    });
});
