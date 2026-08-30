import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import PronunciationCoach from "./PronunciationCoach";

jest.mock("../../auth/AuthContext", () => ({
    useAuth: () => ({
        firebaseUser: { getIdToken: jest.fn() },
        role: "student",
        studentProfile: { membership: { effective_access: { features: { ai_materials: true } } } }
    })
}));

jest.mock("../../services/pronunciationCoachService", () => ({
    submitPronunciationAttempt: jest.fn()
}));

jest.mock("../../utils/audioWav", () => ({
    convertAudioBlobToWav: jest.fn()
}));

describe("PronunciationCoach", () => {
    it("顯示日常問候首個關卡與朗讀句子", () => {
        render(<PronunciationCoach />);

        expect(screen.getByRole("heading", { name: "AI 發音教練" })).toBeInTheDocument();
        expect(screen.getByText("Good morning. How are you?")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /開始錄音/ })).toBeInTheDocument();
    });

    it("切換關卡時同步更新任務、句子與提示", () => {
        render(<PronunciationCoach />);

        fireEvent.click(screen.getByRole("button", { name: /第一次見面/ }));

        expect(screen.getByText("It is nice to meet you.")).toBeInTheDocument();
        expect(screen.getByText("很高興認識你。")).toBeInTheDocument();
        expect(screen.getByText(/nice 和 meet/)).toBeInTheDocument();
    });
});
