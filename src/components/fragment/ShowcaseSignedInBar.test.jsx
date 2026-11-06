import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import ShowcaseSignedInBar from "./ShowcaseSignedInBar";
import { useAuth } from "../../auth/AuthContext";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));

const mount = () => render(<MemoryRouter><ShowcaseSignedInBar /></MemoryRouter>);

describe("ShowcaseSignedInBar", () => {
    it("學生已登入時提示並帶回自己的學習首頁", () => {
        useAuth.mockReturnValue({ isAuthenticated: true, role: "student" });
        mount();
        expect(screen.getByText("你已登入")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "回到我的學習" })).toHaveAttribute("href", "/student/dashboard");
    });

    it("老師與管理員帶回各自的管理首頁", () => {
        useAuth.mockReturnValue({ isAuthenticated: true, role: "teacher" });
        const first = mount();
        expect(screen.getByRole("link", { name: "回到管理首頁" })).toHaveAttribute("href", "/teacher/dashboard");
        first.unmount();
        useAuth.mockReturnValue({ isAuthenticated: true, role: "admin" });
        mount();
        expect(screen.getByRole("link", { name: "回到管理首頁" })).toHaveAttribute("href", "/admin/dashboard");
    });

    it("沒登入時什麼都不顯示", () => {
        useAuth.mockReturnValue({ isAuthenticated: false, role: null });
        mount();
        expect(screen.queryByText("你已登入")).not.toBeInTheDocument();
    });
});
