import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { confirmWeeklyUnsubscribe, previewWeeklyUnsubscribe } from "../../services/guardianWeeklyUnsubscribeService";
import WeeklyReportUnsubscribe from "./WeeklyReportUnsubscribe";

jest.mock("../../services/guardianWeeklyUnsubscribeService", () => ({
    previewWeeklyUnsubscribe: jest.fn(),
    confirmWeeklyUnsubscribe: jest.fn()
}));

const open = search => render(<MemoryRouter initialEntries={[`/unsubscribe-weekly${search}`]}><WeeklyReportUnsubscribe /></MemoryRouter>);
const goodLink = `?s=7&e=1800000000&t=${"a".repeat(64)}`;

beforeEach(() => jest.resetAllMocks());

test("opening the link only checks it; nothing is cancelled until the button is pressed", async () => {
    previewWeeklyUnsubscribe.mockResolvedValue({ status: "ready" });
    confirmWeeklyUnsubscribe.mockResolvedValue({ status: "opted_out" });
    open(goodLink);
    expect(await screen.findByRole("button", { name: "確定取消每週週報" })).toBeInTheDocument();
    expect(previewWeeklyUnsubscribe).toHaveBeenCalledWith({ s: 7, e: 1800000000, t: "a".repeat(64) });
    expect(confirmWeeklyUnsubscribe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "確定取消每週週報" }));
    expect(await screen.findByText("已取消每週學習週報")).toBeInTheDocument();
    expect(confirmWeeklyUnsubscribe).toHaveBeenCalledTimes(1);
});

test("an incomplete link never calls the server", async () => {
    open("?s=7");
    expect(await screen.findByText("這個連結無法使用")).toBeInTheDocument();
    expect(previewWeeklyUnsubscribe).not.toHaveBeenCalled();
});

test.each([
    ["invalid", "這個連結無法使用"],
    ["expired", "這個連結已經過期"],
    ["already", "已經取消了"]
])("shows a clear message for %s links", async (status, title) => {
    previewWeeklyUnsubscribe.mockResolvedValue({ status });
    open(goodLink);
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "確定取消每週週報" })).not.toBeInTheDocument();
});

test("a server failure while checking is explained", async () => {
    previewWeeklyUnsubscribe.mockRejectedValue(new Error("boom"));
    open(goodLink);
    expect(await screen.findByText("目前無法處理")).toBeInTheDocument();
});

test("a failed confirm shows the error instead of pretending it worked", async () => {
    previewWeeklyUnsubscribe.mockResolvedValue({ status: "ready" });
    confirmWeeklyUnsubscribe.mockRejectedValue(new Error("x"));
    open(goodLink);
    fireEvent.click(await screen.findByRole("button", { name: "確定取消每週週報" }));
    await waitFor(() => expect(screen.getByText("目前無法處理")).toBeInTheDocument());
    expect(screen.queryByText("已取消每週學習週報")).not.toBeInTheDocument();
});
