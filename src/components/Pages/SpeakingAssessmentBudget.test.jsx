import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SpeakingAssessmentBudget from "./SpeakingAssessmentBudget";
import SpeakingChallengeRules from "./SpeakingChallengeRules";

const usage = { monthly_limit_seconds: 5400, monthly_remaining_seconds: 5400, monthly_used_seconds: 0, can_assess: true, global_available: true, reset_at: "2026-10-31T16:00:00Z" };
test("quota displays real remaining time and Taipei reset date", () => {
    render(<SpeakingAssessmentBudget usage={{ ...usage, monthly_remaining_seconds: 61 }} />);
    expect(screen.getByLabelText("AI 評分額度")).toHaveTextContent("1 分 1 秒");
    expect(screen.getByLabelText("AI 評分額度")).toHaveTextContent("11/1");
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "61");
});
test("global exhaustion explains local practice even if student still has minutes", () => {
    render(<SpeakingAssessmentBudget usage={{ ...usage, global_available: false, can_assess: false }} />);
    expect(screen.getByRole("status")).toHaveTextContent("總額度暫已用完");
    expect(screen.getByRole("status")).toHaveTextContent("自行練習不計通關");
});
test("unknown quota is not fabricated as zero; rules distinguish sessions and retries", () => {
    render(<SpeakingChallengeRules policy={{ daily_remaining: null }} />);
    expect(screen.queryByText(/今天剩 0/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /查看規則/ }));
    expect(screen.getByText(/同一輪重試或換題/)).toHaveTextContent("每次再次送評都使用分鐘額度");
    expect(screen.getByText(/A–Z 是連續挑戰/)).toBeInTheDocument();
    expect(screen.getByText(/每段最長 12 秒/)).toBeInTheDocument();
    expect(screen.getByText(/每次送評依整段/)).toHaveTextContent("每月 1 日 00:00");
});
