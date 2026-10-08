import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BirthdayRewardNotice from "./BirthdayRewardNotice";
const birthday = { enabled: true, is_birthday_month: true, evaluated_on: "2026-10-08", ends_on: "2026-10-31", xp_multiplier: 2, gift_status: "received", gift_points: 100 };
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date("2026-10-08T04:00:00Z")); });
afterEach(() => jest.useRealTimers());
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
