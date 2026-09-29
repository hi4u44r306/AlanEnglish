import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "./Login";
import { useAuth } from "../../auth/AuthContext";
import { loginWithIdentifier } from "../../auth/authService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../auth/authService", () => ({ loginWithIdentifier: jest.fn() }));

const renderLogin = () => render(
    <MemoryRouter initialEntries={["/login"]}>
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/userinfo" element={<h1>我的首頁</h1>} />
            <Route path="/student/notifications" element={<h1>通知設定</h1>} />
            <Route path="/student/onboarding" element={<h1>首次帳號設定</h1>} />
        </Routes>
    </MemoryRouter>
);

describe("Login", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({ authLoading: false, isAuthenticated: false });
        window.scrollTo = jest.fn();
        loginWithIdentifier.mockResolvedValue({ student: { role: "student", name: "同學" } });
    });

    const submit = () => {
        fireEvent.change(screen.getByLabelText("帳號或 Email"), { target: { value: "student1" } });
        fireEvent.change(screen.getByLabelText("密碼"), { target: { value: "password123" } });
        fireEvent.click(screen.getByRole("button", { name: "登入" }));
    };

    it("keeps the sign-in form focused and hides optional help by default", async () => {
        renderLogin();
        expect(screen.queryByText("學生帳號登入後要設定手機通知嗎？")).not.toBeInTheDocument();
        expect(screen.getByText("第一次使用或需要協助？")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "掃描登入卡啟用" })).not.toBeVisible();
        submit();
        expect(await screen.findByRole("heading", { name: "我的首頁" })).toBeInTheDocument();
        await waitFor(() => expect(loginWithIdentifier).toHaveBeenCalledWith("student1", "password123"));
    });

    it("reveals the compact help links on demand", () => {
        renderLogin();
        fireEvent.click(screen.getByText("第一次使用或需要協助？"));
        expect(screen.getByRole("link", { name: "掃描登入卡啟用" })).toBeVisible();
        expect(screen.getByRole("link", { name: "使用登入卡復原碼" })).toBeVisible();
        expect(screen.queryByRole("link", { name: "註冊／輸入教材兌換碼" })).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "聯絡客服" })).toBeVisible();
    });

    it("routes a teacher directly to the requested page", async () => {
        loginWithIdentifier.mockResolvedValue({ student: { role: "teacher", name: "老師" } });
        renderLogin();
        submit();
        expect(await screen.findByRole("heading", { name: "我的首頁" })).toBeInTheDocument();
    });

    it("routes required account setup to the onboarding page", async () => {
        loginWithIdentifier.mockResolvedValue({ student: { role: "student", name: "同學", onboarding: { required: true } } });
        renderLogin();
        submit();
        expect(await screen.findByRole("heading", { name: "首次帳號設定" })).toBeInTheDocument();
    });
});
