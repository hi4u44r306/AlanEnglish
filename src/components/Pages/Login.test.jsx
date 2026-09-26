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

describe("Login push choice", () => {
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

    it("keeps login optional when the student chooses later", async () => {
        renderLogin();
        expect(screen.getByLabelText("稍後再說")).toBeChecked();
        submit();
        expect(await screen.findByRole("heading", { name: "我的首頁" })).toBeInTheDocument();
        await waitFor(() => expect(loginWithIdentifier).toHaveBeenCalledWith("student1", "password123"));
    });

    it("takes a student who opts in to the manual push setup page", async () => {
        renderLogin();
        fireEvent.click(screen.getByLabelText("登入後設定"));
        submit();
        expect(await screen.findByRole("heading", { name: "通知設定" })).toBeInTheDocument();
    });

    it("does not route a teacher into student notification settings", async () => {
        loginWithIdentifier.mockResolvedValue({ student: { role: "teacher", name: "老師" } });
        renderLogin();
        fireEvent.click(screen.getByLabelText("登入後設定"));
        submit();
        expect(await screen.findByRole("heading", { name: "我的首頁" })).toBeInTheDocument();
    });

    it("keeps required account onboarding before push setup", async () => {
        loginWithIdentifier.mockResolvedValue({ student: { role: "student", name: "同學", onboarding: { required: true } } });
        renderLogin();
        fireEvent.click(screen.getByLabelText("登入後設定"));
        submit();
        expect(await screen.findByRole("heading", { name: "首次帳號設定" })).toBeInTheDocument();
    });
});
