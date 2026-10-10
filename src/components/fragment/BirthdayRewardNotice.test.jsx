import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BirthdayRewardNotice from "./BirthdayRewardNotice";
const birthday = { enabled: true, is_birthday_month: true, evaluated_on: "2026-10-08", ends_on: "2026-10-31", xp_multiplier: 2, gift_status: "received", gift_points: 100 };
beforeEach(() => { localStorage.clear(); jest.useFakeTimers(); jest.setSystemTime(new Date("2026-10-08T04:00:00Z")); });
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
test("shows birthday double XP and the actually received amount", () => {
    render(<BirthdayRewardNotice birthday={birthday} />);
    expect(screen.getByText(/經驗值 ×2/)).toHaveTextContent("10/31");
    expect(screen.getByText("100 AE Points")).toBeInTheDocument();
});
test("eligible non-academy learners see double XP and the point qualification", () => {
    render(<BirthdayRewardNotice birthday={{ ...birthday, gift_status: "not_eligible" }} />);
    expect(screen.getByText(/經驗值 ×2/)).toBeInTheDocument();
    expect(screen.getByText(/生日禮限有效在校/)).toBeInTheDocument();
    expect(screen.queryByText("100 AE Points")).not.toBeInTheDocument();
});
test.each([null, { ...birthday, enabled: false }, { ...birthday, is_birthday_month: false }, { ...birthday, evaluated_on: "2026-10-07" }])("hides inactive or stale birthday snapshots", value => {
    const { container } = render(<BirthdayRewardNotice birthday={value} />);
    expect(container).toBeEmptyDOMElement();
});
test("zero-point setting keeps the XP benefit without claiming a gift was received", () => {
    render(<BirthdayRewardNotice birthday={{ ...birthday, gift_status: "disabled", gift_points: 0 }} />);
    expect(screen.getByText(/經驗值 ×2/)).toBeInTheDocument();
    expect(screen.queryByText(/已入帳/)).not.toBeInTheDocument();
});

const hiddenKey = uid => `ae-birthday-notice-hidden-v1:${encodeURIComponent(uid)}`;
const openOptions = () => fireEvent.click(screen.getByRole("button", { name: "關閉生日月祝福" }));
const chooseTemporary = () => fireEvent.click(screen.getByRole("button", { name: /暫時關閉/ }));
const choosePermanent = () => fireEvent.click(screen.getByRole("button", { name: /不再顯示/ }));

test("offers inline choices only after closing is requested and Escape cancels", () => {
    render(<BirthdayRewardNotice birthday={birthday} ownerUid="learner-a" />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    openOptions();
    expect(screen.getByRole("button", { name: "關閉生日月祝福" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "生日月祝福顯示選項" })).toBeInTheDocument();
    expect(screen.getByText("關閉祝福不影響生日月獎勵。")).toBeInTheDocument();
    const temporary = screen.getByRole("button", { name: /暫時關閉/ });
    temporary.focus();
    fireEvent.keyDown(temporary, { key: "Escape" });
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "關閉生日月祝福" })).toHaveFocus();
    openOptions();
    openOptions();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
});

test("temporary dismissal survives summary updates but returns on the next page visit", () => {
    const onDismiss = jest.fn();
    const writes = jest.spyOn(Storage.prototype, "setItem");
    const view = render(<BirthdayRewardNotice birthday={birthday} ownerUid="learner-a" onDismiss={onDismiss} />);
    openOptions(); chooseTemporary();
    expect(screen.queryByText("生日月快樂！")).not.toBeInTheDocument();
    view.rerender(<BirthdayRewardNotice birthday={null} ownerUid="learner-a" />);
    view.rerender(<BirthdayRewardNotice birthday={{ ...birthday, gift_points: 150 }} ownerUid="learner-a" />);
    expect(screen.queryByText("生日月快樂！")).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(writes).not.toHaveBeenCalled();
    view.unmount();
    render(<BirthdayRewardNotice birthday={birthday} ownerUid="learner-a" />);
    expect(screen.getByText("生日月快樂！")).toBeInTheDocument();
});

test("permanent dismissal persists across visits and only affects its signed-in account", () => {
    const view = render(<BirthdayRewardNotice birthday={birthday} ownerUid="learner/a" />);
    openOptions(); choosePermanent();
    expect(localStorage.getItem(hiddenKey("learner/a"))).toBe("1");
    expect(localStorage.length).toBe(1);
    view.unmount();
    const next = render(<BirthdayRewardNotice birthday={birthday} ownerUid="learner/a" />);
    expect(screen.queryByText("生日月快樂！")).not.toBeInTheDocument();
    next.rerender(<BirthdayRewardNotice birthday={birthday} ownerUid="learner-b" />);
    expect(screen.getByText("100 AE Points")).toBeInTheDocument();
    next.rerender(<BirthdayRewardNotice birthday={birthday} ownerUid="learner/a" />);
    expect(screen.queryByText("生日月快樂！")).not.toBeInTheDocument();
});

test("account changes clear temporary dismissal and the previous account's choices", () => {
    const view = render(<BirthdayRewardNotice birthday={birthday} ownerUid="learner-a" />);
    openOptions();
    view.rerender(<BirthdayRewardNotice birthday={birthday} ownerUid="learner-b" />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    openOptions(); chooseTemporary();
    view.rerender(<BirthdayRewardNotice birthday={birthday} ownerUid="learner-c" />);
    expect(screen.getByText("生日月快樂！")).toBeInTheDocument();
});

test("blocked storage reads do not break the notice or temporary dismissal", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<BirthdayRewardNotice birthday={birthday} ownerUid="learner-a" />);
    expect(screen.getByText("100 AE Points")).toBeInTheDocument();
    openOptions(); chooseTemporary();
    expect(screen.queryByText("生日月快樂！")).not.toBeInTheDocument();
});

test("a failed permanent save stays visible, reports the failure and allows temporary dismissal", () => {
    const onDismiss = jest.fn();
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<BirthdayRewardNotice birthday={birthday} ownerUid="learner-a" onDismiss={onDismiss} />);
    openOptions(); choosePermanent();
    expect(screen.getByRole("alert")).toHaveTextContent("這個瀏覽器無法記住設定");
    expect(screen.getByText("100 AE Points")).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
    chooseTemporary();
    expect(screen.queryByText("生日月快樂！")).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledTimes(1);
});
