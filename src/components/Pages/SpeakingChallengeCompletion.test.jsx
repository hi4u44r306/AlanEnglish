import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SpeakingChallengeCompletion from "./SpeakingChallengeCompletion";

test("shows one-time challenge rewards and level-up bonus", () => {
    const onDismiss = jest.fn();
    render(<SpeakingChallengeCompletion reward={{
        xp_awarded: 30,
        ae_points_awarded: 3,
        level_before: 1,
        level_after: 2,
        level_points_awarded: 5,
        levels_gained: [{ level: 2, points: 5 }]
    }} onDismiss={onDismiss} />);

    expect(screen.getByRole("dialog", { name: "口說大挑戰完成" })).toBeInTheDocument();
    expect(screen.getByText("+30 XP")).toBeInTheDocument();
    expect(screen.getByText("+3 AE Points")).toBeInTheDocument();
    expect(screen.getByText("Lv.2")).toBeInTheDocument();
    expect(screen.getByText("升等再獲得 +5 AE Points")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看這題結果" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
});

test("explains that AE Points are limited to academy students", () => {
    render(<SpeakingChallengeCompletion reward={{ xp_awarded: 30, ae_points_awarded: 0, level_before: 3, level_after: 3 }} onDismiss={jest.fn()} />);
    expect(screen.getByText("在校生限定")).toBeInTheDocument();
    expect(screen.queryByText(/LEVEL UP/)).not.toBeInTheDocument();
});
