import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import SpeakingChallengeRules from "./SpeakingChallengeRules";

const policy = { daily_limit: 5, daily_remaining: 3, audio_budget: {
    status: "ready", limit_seconds: 7200, remaining_seconds: 7127
} };

test("輪數與送評時間預設可見，次數是 25 秒估算而非固定上限", () => {
    render(<SpeakingChallengeRules policy={policy} />);
    expect(screen.getByLabelText("我的口說用量")).toHaveTextContent("3 輪");
    expect(screen.getByText("118 分鐘 47 秒")).toBeInTheDocument();
    expect(screen.getByText("285 段")).toBeInTheDocument();
    expect(screen.getByText(/短錄音可以送更多段/)).toBeInTheDocument();
    expect(screen.queryByText("選一本，挑一關")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /查看規則/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/每次送評都會扣錄音秒數/)).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByText("選一本，挑一關")).not.toBeInTheDocument();
});
test("null／缺少資料不冒充剩餘 0 輪或 120 分鐘", () => {
    render(<SpeakingChallengeRules policy={{ daily_limit: 5, daily_remaining: null }} />);
    expect(screen.queryByText("0 輪")).not.toBeInTheDocument();
    expect(screen.queryByText("120 分鐘")).not.toBeInTheDocument();
    expect(screen.getAllByText(/暫時無法取得/)).toHaveLength(2);
});
test("用量未完成時顯示確認中；讀取失敗可重新整理", () => {
    const { rerender } = render(<SpeakingChallengeRules policy={policy} loading />);
    expect(screen.getAllByText("正在確認用量…")).toHaveLength(2);
    expect(screen.queryByText("3 輪")).not.toBeInTheDocument();
    expect(screen.queryByText("285 段")).not.toBeInTheDocument();
    rerender(<SpeakingChallengeRules policy={{ ...policy, audio_budget: { status: "unavailable" } }} />);
    expect(screen.getByText("3 輪")).toBeInTheDocument();
    expect(screen.getByText(/暫時無法取得/)).toBeInTheDocument();
});
test("兩種額度用完分別說明；不足 25 秒仍能送短錄音", () => {
    const { rerender } = render(<SpeakingChallengeRules policy={{ ...policy, daily_remaining: 0,
        audio_budget: { ...policy.audio_budget, remaining_seconds: 0 } }} />);
    expect(screen.getByText("0 輪")).toBeInTheDocument();
    expect(screen.getByText(/今天的新挑戰輪數用完了/)).toBeInTheDocument();
    expect(screen.getByText(/本月送評時間用完了/)).toBeInTheDocument();
    rerender(<SpeakingChallengeRules policy={{ ...policy, audio_budget: { ...policy.audio_budget, remaining_seconds: 9 } }} />);
    expect(screen.getByText(/還能送 9 秒以內/)).toBeInTheDocument();
    expect(screen.queryByText("0 段")).not.toBeInTheDocument();
});
