import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StoreVerificationPage from "./StoreVerificationPage";

const mockGetSession = jest.fn();
const mockSignOut = jest.fn();

jest.mock("../../store/storeSupabase", () => ({
    storeSupabase: {
        auth: {
            getSession: (...args) => mockGetSession(...args),
            signOut: (...args) => mockSignOut(...args)
        }
    }
}));
jest.mock("./StoreHeader", () => () => <header>教材商城</header>);

const renderPage = entry => render(
    <MemoryRouter initialEntries={[entry]}>
        <Routes>
            <Route path="/shop/verified" element={<StoreVerificationPage />} />
            <Route path="/shop/login" element={<div>商城登入頁</div>} />
        </Routes>
    </MemoryRouter>
);

describe("StoreVerificationPage", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockGetSession.mockReset();
        mockSignOut.mockReset();
    });

    afterEach(() => jest.useRealTimers());

    test("驗證成功後顯示五秒倒數並清除目前商城登入狀態", async () => {
        mockGetSession.mockResolvedValue({ data: { session: { user: { email_confirmed_at: "2026-08-27T08:00:00Z" } } }, error: null });
        mockSignOut.mockResolvedValue({ error: null });
        renderPage("/shop/verified?next=/shop/checkout#type=signup");

        expect(await screen.findByRole("heading", { name: "謝謝，已完成驗證" })).toBeInTheDocument();
        expect(screen.getByText(/5 秒後會前往登入頁/)).toBeInTheDocument();
        expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });

        for (let second = 0; second < 5; second += 1) {
            await act(async () => { jest.advanceTimersByTime(1000); });
        }
        expect(screen.getByText("商城登入頁")).toBeInTheDocument();
    });

    test("過期連結顯示重新寄送入口", async () => {
        renderPage("/shop/verified?next=/shop#type=signup&error=access_denied&error_description=otp_expired");

        expect(await screen.findByRole("heading", { name: "驗證連結無效或已使用" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "重新寄送驗證信" })).toHaveAttribute("href", "/shop/register?next=%2Fshop");
        expect(mockGetSession).not.toHaveBeenCalled();
    });
});
