import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Showcase from "./Showcase";

jest.mock("../fragment/ShowcaseNavbar", () => () => <nav aria-label="公開網站導覽" />);

describe("Showcase", () => {
    it("presents the core learning features and recorded learning journey", () => {
        render(<MemoryRouter><Showcase /></MemoryRouter>);

        expect(screen.getByRole("heading", { name: "英文班教材與聽力音檔" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "AI 口說大挑戰" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "完整學習歷程與獎勵" })).toBeInTheDocument();
        expect(screen.getByText(/AI 答題、口說通關與班級作業都會跟著帳號保存/)).toBeInTheDocument();
        expect(screen.getByText("10×")).toBeInTheDocument();
    });

    it("does not advertise plans, add-ons, pricing, or the material store", () => {
        render(<MemoryRouter><Showcase /></MemoryRouter>);

        expect(screen.queryByText("CHOOSE YOUR PLAN")).not.toBeInTheDocument();
        expect(screen.queryByText("PLAN COMPARISON")).not.toBeInTheDocument();
        expect(screen.queryByText(/NT\$299|NT\$499|NT\$798|NT\$2,800/)).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "教材商城" })).not.toBeInTheDocument();
        expect(screen.queryByText("現在可以購買實體教材嗎？")).not.toBeInTheDocument();
        expect(screen.queryByText("平台方案與 AI 加購的價格是多少？")).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "AI 口說大挑戰" })).toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: /免費試用 7 天/ }).length).toBeGreaterThan(0);
    });
});
