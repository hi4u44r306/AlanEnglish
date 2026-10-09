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

it("asks for the account type before showing a reset form", () => {
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /學生帳號/ }));
    expect(screen.getByRole("link", { name: "使用復原碼" })).toHaveAttribute("href", "/academy/recover");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(sendBrandedPasswordResetEmail).not.toHaveBeenCalled();
});

it("sends the existing reset email only after the Email account is selected", async () => {
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Email 帳號/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Parent@Gmail.com" } });
    fireEvent.click(screen.getByRole("button", { name: "寄送密碼重設信" }));
    await waitFor(() => expect(sendBrandedPasswordResetEmail).toHaveBeenCalledWith("parent@gmail.com"));
    expect(await screen.findByText(/已有帳號/)).toBeInTheDocument();
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
    const action = screen.getAllByRole("link", { name: destination.includes("assignments") ? "查看老師作業" : destination.includes("ai-generator") ? "開始 AI 練習" : "回到學習首頁" })[0];
    expect(action).toHaveAttribute("href", destination);
    if (!destination.includes("ai-generator")) expect(screen.queryByRole("link", { name: "開始 AI 練習" })).not.toBeInTheDocument();
});
