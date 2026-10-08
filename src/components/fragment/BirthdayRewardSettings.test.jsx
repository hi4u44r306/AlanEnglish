import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import BirthdayRewardSettings from "./BirthdayRewardSettings";
import { useAuth } from "../../auth/AuthContext";
import { getBirthdayRewardSettings, saveBirthdayRewardSettings } from "../../services/gamificationService";
jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/gamificationService", () => ({ getBirthdayRewardSettings: jest.fn(), saveBirthdayRewardSettings: jest.fn() }));
const firebaseUser = { uid: "admin-1" };
beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ firebaseUser });
    getBirthdayRewardSettings.mockResolvedValue({ settings: { gift_points: 100, enabled: true, version: 1 } });
    saveBirthdayRewardSettings.mockResolvedValue({ settings: { gift_points: 150, enabled: true, version: 2 } });
});
test("loads the real amount, saves a new amount and preserves server configuration version", async () => {
    render(<BirthdayRewardSettings />);
    const input = await screen.findByLabelText("每年生日贈送 AE Points");
    expect(input).toHaveValue(100);
    fireEvent.change(input, { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存生日活動" }));
    await screen.findByText(/生日活動設定已儲存/);
    expect(saveBirthdayRewardSettings).toHaveBeenCalledWith(firebaseUser, { gift_points: 150, enabled: true, version: 1 });
    expect(input).toHaveValue(150);
});
test("loading errors never display an invented 100-point configuration and offer retry", async () => {
    getBirthdayRewardSettings.mockRejectedValueOnce(new Error("讀取失敗"));
    render(<BirthdayRewardSettings />);
    await screen.findByRole("alert");
    expect(screen.queryByLabelText("每年生日贈送 AE Points")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新讀取設定" }));
    expect(await screen.findByLabelText("每年生日贈送 AE Points")).toHaveValue(100);
});
test("stale save errors keep the entered amount and allow reloading the current version", async () => {
    saveBirthdayRewardSettings.mockRejectedValueOnce(new Error("設定已被其他管理員更新"));
    render(<BirthdayRewardSettings />);
    const input = await screen.findByLabelText("每年生日贈送 AE Points");
    fireEvent.change(input, { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存生日活動" }));
    await screen.findByRole("alert");
    expect(input).toHaveValue(200);
    getBirthdayRewardSettings.mockResolvedValueOnce({ settings: { gift_points: 150, enabled: true, version: 2 } });
    fireEvent.click(screen.getByRole("button", { name: "重新讀取設定" }));
    await waitFor(() => expect(screen.getByLabelText("每年生日贈送 AE Points")).toHaveValue(150));
});
test("zero points are valid and repeated clicks while saving issue just one request", async () => {
    saveBirthdayRewardSettings.mockReturnValue(new Promise(() => {}));
    render(<BirthdayRewardSettings />);
    const input = await screen.findByLabelText("每年生日贈送 AE Points");
    fireEvent.change(input, { target: { value: "0" } });
    const save = screen.getByRole("button", { name: "儲存生日活動" });
    fireEvent.click(save); fireEvent.click(save);
    expect(saveBirthdayRewardSettings).toHaveBeenCalledTimes(1);
    expect(saveBirthdayRewardSettings).toHaveBeenCalledWith(firebaseUser, { gift_points: 0, enabled: true, version: 1 });
    expect(input).toBeDisabled();
});
test("activity can be stopped without changing the stored gift amount", async () => {
    render(<BirthdayRewardSettings />);
    await screen.findByLabelText("每年生日贈送 AE Points");
    fireEvent.click(screen.getByRole("checkbox", { name: "啟用生日月活動" }));
    fireEvent.click(screen.getByRole("button", { name: "儲存生日活動" }));
    await waitFor(() => expect(saveBirthdayRewardSettings).toHaveBeenCalledWith(firebaseUser, { gift_points: 100, enabled: false, version: 1 }));
});
