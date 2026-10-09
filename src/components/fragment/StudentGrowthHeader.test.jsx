import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import StudentGrowthHeader from "./StudentGrowthHeader";

const balance = { level: 12, total_xp: 1860, next_level_xp: 2000, progress_percent: 70, points_balance: 1280 };
const mount = props => render(<MemoryRouter><StudentGrowthHeader {...props} /></MemoryRouter>);

it("shows exact server values in details and only eligible students get the rewards link", () => {
    const view = mount({ summary: { balance }, pointsAccess: true });
    fireEvent.click(screen.getByRole("button", { name: "查看成長詳情" }));
    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText("累積經驗：1,860 XP")).toBeInTheDocument();
    expect(within(modal).getByText("距離下一級還差 140 XP。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "關閉詳情" }));
    fireEvent.click(screen.getByRole("button", { name: /查看點數詳情/ }));
    expect(screen.getByText("1,280 AE Points")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看獎品與兌換紀錄" })).toHaveAttribute("href", "/student/rewards");
    view.rerender(<MemoryRouter><StudentGrowthHeader summary={{ balance }} pointsAccess={false} /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: "查看獎品與兌換紀錄" })).not.toBeInTheDocument();
    expect(screen.getByText("目前無兌換資格，既有點數與 XP 保留。")).toBeInTheDocument();
});

it("keeps missing or invalid values distinct from zero, supports retry and retains the last successful balance", () => {
    const retry = jest.fn();
    const view = mount({ loading: true, onRetry: retry });
    expect(screen.queryByText("Lv.1")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    view.rerender(<MemoryRouter><StudentGrowthHeader summary={{ balance: { level: NaN, points_balance: "" } }} error={new Error()} onRetry={retry} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "查看成長詳情" }));
    fireEvent.click(screen.getByRole("button", { name: "重新讀取成長" }));
    expect(retry).toHaveBeenCalledTimes(1);
    view.rerender(<MemoryRouter><StudentGrowthHeader summary={{ balance }} error={new Error()} /></MemoryRouter>);
    expect(screen.getAllByText("Lv.12").length).toBeGreaterThan(0);
    expect(screen.getByText("暫時無法更新，這裡顯示上次讀取的資料。")).toBeInTheDocument();
});

it("replaces top and detailed values when the shared summary updates, with full large numbers in details", () => {
    const view = mount({ summary: { balance } });
    view.rerender(<MemoryRouter><StudentGrowthHeader summary={{ balance: { ...balance, level: 13, points_balance: 123456789 } }} /></MemoryRouter>);
    expect(screen.getByText("Lv.13")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /123,456,789 點/ }));
    expect(screen.getByText("123,456,789 AE Points")).toBeInTheDocument();
});

it("hides stale, failed, disabled and expired birthday confirmation including a Taipei midnight transition", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-09T15:59:30Z"));
    const birthday = { enabled: true, is_birthday_month: true, evaluated_on: "2026-10-09", xp_multiplier: 2, ends_on: "2026-10-31" };
    const view = mount({ summary: { balance, birthday } });
    expect(screen.getByText("XP ×2")).toBeInTheDocument();
    view.rerender(<MemoryRouter><StudentGrowthHeader summary={{ balance, birthday }} error={new Error()} /></MemoryRouter>);
    expect(screen.queryByText("XP ×2")).not.toBeInTheDocument();
    view.rerender(<MemoryRouter><StudentGrowthHeader summary={{ balance, birthday: { ...birthday, enabled: false } }} /></MemoryRouter>);
    expect(screen.queryByText("XP ×2")).not.toBeInTheDocument();
    view.rerender(<MemoryRouter><StudentGrowthHeader summary={{ balance, birthday }} /></MemoryRouter>);
    act(() => jest.advanceTimersByTime(60000));
    expect(screen.queryByText("XP ×2")).not.toBeInTheDocument();
    jest.useRealTimers();
});
