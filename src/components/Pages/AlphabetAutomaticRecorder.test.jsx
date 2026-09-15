import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import AlphabetAutomaticRecorder, { rmsLevel } from "./AlphabetAutomaticRecorder";

describe("AlphabetAutomaticRecorder", () => {
    const originalMediaDevices = navigator.mediaDevices;
    const originalMediaRecorder = window.MediaRecorder;

    afterEach(() => {
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
        window.MediaRecorder = originalMediaRecorder;
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
});
