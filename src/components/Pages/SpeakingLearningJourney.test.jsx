import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SpeakingLearningJourney from "./SpeakingLearningJourney";

it("does not imply that an unavailable model audio can be played", () => {
    render(<SpeakingLearningJourney />);
    expect(screen.getByText("看清楚題目")).toBeInTheDocument();
    expect(screen.queryByText("看題目、聽示範")).not.toBeInTheDocument();
});
it.each([["ready", 0], ["recording", 1], ["review", 1], ["assessing", 1], ["feedback", 2]])("shows one current learning step for %s", (phase, index) => {
    const { container } = render(<SpeakingLearningJourney phase={phase} canListen />);
    const items = container.querySelectorAll("li");
    expect(items[index]).toHaveAttribute("aria-current", "step");
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(screen.queryByText(/已通關/)).not.toBeInTheDocument();
});
