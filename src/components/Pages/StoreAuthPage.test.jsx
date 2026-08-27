import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StoreAuthPage from "./StoreAuthPage";

const mockResend = jest.fn();
const mockSignUp = jest.fn();

jest.mock("../../store/StoreContext", () => ({
    useStore: () => ({ user: null, authLoading: false })
}));
jest.mock("../../store/storeSupabase", () => ({
    storeSupabase: {
        auth: {
            resend: (...args) => mockResend(...args),
            signUp: (...args) => mockSignUp(...args),
            signInWithPassword: jest.fn()
        }
    }
}));
jest.mock("./StoreHeader", () => () => <header>教材商城</header>);
jest.mock("react-toastify", () => ({
    toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() }
}));

const renderRegister = () => render(
    <MemoryRouter initialEntries={["/shop/register"]}>
        <Routes><Route path="/shop/register" element={<StoreAuthPage register />} /></Routes>
    </MemoryRouter>
);

describe("StoreAuthPage 商城驗證信", () => {
    beforeEach(() => {
        mockResend.mockReset();
        mockSignUp.mockReset();
    });

    test("未驗證的商城帳號可從註冊頁重新寄送驗證信", async () => {
        mockResend.mockResolvedValue({ error: null });
        renderRegister();

        const resendButton = screen.getByRole("button", { name: "重新寄送驗證信" });
        expect(resendButton).toBeDisabled();

        fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Buyer@Example.com" } });
        expect(resendButton).toBeEnabled();
        fireEvent.click(resendButton);

        await waitFor(() => expect(mockResend).toHaveBeenCalledWith({
            type: "signup",
            email: "buyer@example.com",
            options: { emailRedirectTo: "http://localhost/shop/login?next=%2Fshop" }
        }));
        expect(await screen.findByRole("status")).toHaveTextContent("驗證信已重新寄送");
        expect(screen.getByRole("button", { name: /秒後可重新寄送/ })).toBeDisabled();
    });

    test("註冊成功後會保留可重寄驗證信的提示", async () => {
        mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
        renderRegister();

        fireEvent.change(screen.getByLabelText("收件人姓名"), { target: { value: "王小明" } });
        fireEvent.change(screen.getByLabelText("Email"), { target: { value: "buyer@example.com" } });
        fireEvent.change(screen.getByLabelText(/^商城密碼/), { target: { value: "password123" } });
        fireEvent.click(screen.getByRole("button", { name: "建立商城帳號" }));

        expect(await screen.findByRole("status")).toHaveTextContent("若原本的連結已失效");
        expect(screen.getByRole("button", { name: "重新寄送驗證信" })).toBeEnabled();
    });
});
