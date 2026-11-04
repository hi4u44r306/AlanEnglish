import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ForgotPassword from "./ForgotPassword";
import NotFound from "./NotFound";
import ReviewCenter from "./ReviewCenter";
import { useAuth } from "../../auth/AuthContext";
import { sendBrandedPasswordResetEmail } from "../../services/authEmailService";
import { getReviewDashboard } from "../../services/reviewService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/authEmailService", () => ({ sendBrandedPasswordResetEmail: jest.fn() }));
jest.mock("../../services/reviewService", () => ({ getReviewDashboard: jest.fn(), submitReviewAnswer: jest.fn() }));

beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ firebaseUser: { uid: "demo" }, isAuthenticated: false, role: "student", studentProfile: { membership: { is_active: false, effective_access: { features: {} } } } });
    getReviewDashboard.mockResolvedValue({ stats: { total: 0, due: 0, learning: 0, mastered: 0, weaknesses: [] }, items: [] });
    sendBrandedPasswordResetEmail.mockResolvedValue();
});

it("shows the student recovery code path first, with a card picture, and hides the Email account choice", () => {
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "使用復原碼" })).toHaveAttribute("href", "/academy/recover");
    expect(screen.getByText(/橘色的兩組 6 位數字/)).toBeInTheDocument();
    expect(screen.getByText("▲ 復原碼在這一行")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Email 帳號/ })).not.toBeInTheDocument();
    expect(screen.queryByText("你平常用哪一種方式登入？")).not.toBeInTheDocument();
    expect(sendBrandedPasswordResetEmail).not.toHaveBeenCalled();
});

it("keeps the Email reset available for staff behind a small link and lets them go back", async () => {
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "老師／管理員（Email 帳號）" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Teacher@Gmail.com" } });
    fireEvent.click(screen.getByRole("button", { name: "寄送密碼重設信" }));
    await waitFor(() => expect(sendBrandedPasswordResetEmail).toHaveBeenCalledWith("teacher@gmail.com"));
    expect(await screen.findByText(/已有帳號/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重新輸入 Email" }));
    fireEvent.click(screen.getByRole("button", { name: "回到學生的復原碼" }));
    expect(screen.getByRole("link", { name: "使用復原碼" })).toBeInTheDocument();
});

it("keeps the missing page visible until the user chooses a destination", () => {
    jest.useFakeTimers();
    render(<MemoryRouter initialEntries={["/missing"]}><Routes><Route path="/missing" element={<NotFound />} /><Route path="/" element={<h1>首頁</h1>} /></Routes></MemoryRouter>);
    jest.advanceTimersByTime(6000);
    expect(screen.getByRole("heading", { name: "這個頁面找不到了" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "回到首頁" }));
    expect(screen.getByRole("heading", { name: "首頁" })).toBeInTheDocument();
    jest.useRealTimers();
});

it.each([
    [false, { assignments: true, ai_materials: true }, "/student/dashboard"],
    [true, { assignments: true, ai_materials: true }, "/student/assignments"],
    [true, { assignments: false, ai_materials: true }, "/student/ai-generator"],
    [true, { assignments: false, ai_materials: false }, "/student/dashboard"]
])("recommends an available activity for active=%s features=%j", async (active, features, destination) => {
    useAuth.mockReturnValue({ firebaseUser: { uid: "demo" }, studentProfile: { membership: { is_active: active, effective_access: { features } } } });
    render(<MemoryRouter><ReviewCenter /></MemoryRouter>);
    await screen.findByRole("heading", { name: "目前還沒有錯題" });
    const action = screen.getAllByRole("link", { name: destination.includes("assignments") ? "查看老師作業" : destination.includes("ai-generator") ? "開始 AI 練習" : "回我的進度" })[0];
    expect(action).toHaveAttribute("href", destination);
    if (!destination.includes("ai-generator")) expect(screen.queryByRole("link", { name: "開始 AI 練習" })).not.toBeInTheDocument();
});
