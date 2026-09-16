import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Containerfull from "./Containerfull";

jest.mock("react-redux", () => {
    const state = {
        musicReducer: {
            playing: {
                id: 1,
                page: "P22",
                bookname: "Workbook 1",
                audioURL: "test-audio.wav"
            },
            curr_margin: "110px"
        }
    };

    return {
        useSelector: selector => selector(state)
    };
});
jest.mock("./MainNavbar", () => () => <nav data-testid="navbar" />);
jest.mock("./MusicPlayer", () => ({ pausePlayback }) => (
    <div data-testid="music-player" data-paused={String(pausePlayback)} />
));
jest.mock("./GuidedTour", () => () => null);
jest.mock("./ConversationUXGuard", () => () => null);
jest.mock("./ConversationHintCoach", () => () => null);
jest.mock("./MobileOffcanvasScrollGuard", () => () => null);
jest.mock("./AssignmentShortcut", () => () => null);

const renderAt = pathname => render(
    <MemoryRouter
        initialEntries={[pathname]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
        <Containerfull>
            <div>頁面內容</div>
        </Containerfull>
    </MemoryRouter>
);

test("口說大挑戰所有層級都隱藏並暫停教材播放器", async () => {
    const { container } = renderAt("/student/speaking-challenges/11");

    await waitFor(() => expect(screen.getByTestId("music-player")).toHaveAttribute("data-paused", "true"));

    const footer = container.querySelector("footer.app-player");
    const main = container.querySelector("main.app-content");
    expect(footer).toHaveAttribute("hidden");
    expect(footer).toHaveAttribute("aria-hidden", "true");
    expect(footer).toHaveAttribute("data-speaking-player-hidden", "true");
    expect(footer).toHaveClass("speaking-player-blocked");
    expect(main).not.toHaveClass("has-player");
});

test("離開口說大挑戰後恢復教材播放器", async () => {
    const { container } = renderAt("/student/leaderboard");

    await waitFor(() => expect(screen.getByTestId("music-player")).toHaveAttribute("data-paused", "false"));

    const footer = container.querySelector("footer.app-player");
    const main = container.querySelector("main.app-content");
    expect(footer).not.toHaveAttribute("hidden");
    expect(main).toHaveClass("has-player");
});
