import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import SpeakingChallengeRules from "./SpeakingChallengeRules";

const policy = { daily_limit: 10, daily_remaining: 8 };

test("顯示每天十輪，舊送評月額度資料也不顯示", () => {
    render(<SpeakingChallengeRules policy={{ ...policy, audio_budget: { status: "ready", limit_seconds: 7200, remaining_seconds: 0 } }} />);
    expect(screen.getByRole("img", { name: "今天 10 輪，剩 8 輪，已用 2 輪" }).querySelectorAll(".is-available")).toHaveLength(8);
    expect(screen.queryByText("本月還能送評")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /查看說明/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/沒有個人每月送評秒數額度/)).toBeInTheDocument();
    expect(screen.getByText(/第一次送評才扣一輪/)).toBeInTheDocument();
});

test("null 或讀取失敗不冒充剩零輪", () => {
    render(<SpeakingChallengeRules policy={{ daily_limit: 10, daily_remaining: null }} />);
    expect(screen.queryByText("0 輪")).not.toBeInTheDocument();
    expect(screen.getByText(/暫時無法取得/)).toBeInTheDocument();
});

test("用量未完成顯示確認中", () => {
    render(<SpeakingChallengeRules policy={policy} loading />);
    expect(screen.getByText("正在確認用量…")).toBeInTheDocument();
    expect(screen.queryByText("8 輪")).not.toBeInTheDocument();
});

test("十輪用完仍可完成同輪，不出現月額度耗盡訊息", () => {
    render(<SpeakingChallengeRules policy={{ ...policy, daily_remaining: 0 }} />);
    expect(screen.getByText("0 輪")).toBeInTheDocument();
    expect(screen.getByText(/今天的新挑戰用完了/)).toBeInTheDocument();
    expect(screen.queryByText("本月已用完")).not.toBeInTheDocument();
});
