import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-toastify";
import { acknowledgeCostAlert, getCostAlerts, subscribeCostAlerts } from "../../services/costAlertService";
import CostAlertPanel from "./CostAlertPanel";
jest.mock("../../services/costAlertService", () => ({ acknowledgeCostAlert: jest.fn(), getCostAlerts: jest.fn(), subscribeCostAlerts: jest.fn() }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn() } }));
const user = { getIdToken: jest.fn() };
const alert = { id: "alert-1", month: "2026-09-01", generation: 2, level: "warning", cost_usd: 8, monthly_budget_usd: 10, warning_percent: 80, acknowledged_at: null };
const ready = { notification: { configured: true, is_recipient: true, delivery_configured: true }, alerts: [alert] };
beforeEach(() => { jest.clearAllMocks(); getCostAlerts.mockResolvedValue(ready); });
afterEach(() => { jest.useRealTimers(); });
test("viewing the page and refreshing never acknowledge; previous-month pending alerts remain actionable", async () => {
    jest.useFakeTimers(); render(<CostAlertPanel firebaseUser={user} />);
    expect(await screen.findByRole("button", { name: "我已經看到" })).toBeInTheDocument();
    expect(screen.getByText("2026-09 已達警戒線")).toBeInTheDocument();
    await act(async () => jest.advanceTimersByTime(60000));
    expect(getCostAlerts).toHaveBeenCalledTimes(2); expect(acknowledgeCostAlert).not.toHaveBeenCalled();
});
test("only a successful explicit acknowledgement removes the button", async () => {
    acknowledgeCostAlert.mockResolvedValue({ ...ready, alerts: [{ ...alert, acknowledged_at: "2026-10-07" }] });
    render(<CostAlertPanel firebaseUser={user} />); fireEvent.click(await screen.findByRole("button", { name: "我已經看到" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "我已經看到" })).not.toBeInTheDocument());
    expect(acknowledgeCostAlert).toHaveBeenCalledWith(user, alert);
});
test("failed acknowledgement keeps the pending alert for retry", async () => {
    acknowledgeCostAlert.mockRejectedValue(new Error("提醒已更新"));
    render(<CostAlertPanel firebaseUser={user} />); fireEvent.click(await screen.findByRole("button", { name: "我已經看到" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("提醒已更新"));
    expect(screen.getByRole("button", { name: "我已經看到" })).toBeEnabled();
});
test("enables only the current administrator's account email after their click", async () => {
    getCostAlerts.mockResolvedValue({ notification: { configured: false }, alerts: [] }); subscribeCostAlerts.mockResolvedValue(ready);
    render(<CostAlertPanel firebaseUser={user} />); fireEvent.click(await screen.findByRole("button", { name: "使用我的 Email 接收提醒" }));
    await waitFor(() => expect(subscribeCostAlerts).toHaveBeenCalledWith(user));
    expect(await screen.findByText(/已啟用：/)).toBeInTheDocument();
});
test("read/provider failures never appear as healthy or silently disable the alert", async () => {
    getCostAlerts.mockRejectedValueOnce(new Error("網路中斷"));
    render(<CostAlertPanel firebaseUser={user} />); expect(await screen.findByRole("alert")).toHaveTextContent("無法確認通知狀態");
    getCostAlerts.mockResolvedValue({ ...ready, notification: { ...ready.notification, delivery_configured: false }, alerts: [{ ...alert, last_error: "provider_http_429" }] });
    fireEvent.click(screen.getByRole("button", { name: "重試讀取提醒" }));
    expect(await screen.findByText(/目前不會寄出 Email/)).toBeInTheDocument();
    expect(screen.getByText(/上次寄送失敗/)).toBeInTheDocument(); expect(screen.getByRole("button", { name: "我已經看到" })).toBeInTheDocument();
});
test("an unrelated administrator cannot claim the existing email subscription", async () => {
    getCostAlerts.mockResolvedValue({ notification: { configured: true, is_recipient: false }, alerts: [] });
    render(<CostAlertPanel firebaseUser={user} />); expect(await screen.findByText(/另一位管理員接收/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "使用我的 Email 接收提醒" })).not.toBeInTheDocument();
});
test("a late background refresh cannot resurrect an acknowledged alert", async () => {
    jest.useFakeTimers(); let finishRefresh;
    getCostAlerts.mockResolvedValueOnce(ready).mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
    acknowledgeCostAlert.mockResolvedValue({ ...ready, alerts: [{ ...alert, acknowledged_at: "2026-10-07" }] });
    render(<CostAlertPanel firebaseUser={user} />); await screen.findByRole("button", { name: "我已經看到" });
    await act(async () => jest.advanceTimersByTime(60000));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "我已經看到" })));
    await waitFor(() => expect(screen.queryByRole("button", { name: "我已經看到" })).not.toBeInTheDocument());
    await act(async () => finishRefresh(ready));
    expect(screen.queryByRole("button", { name: "我已經看到" })).not.toBeInTheDocument();
});
