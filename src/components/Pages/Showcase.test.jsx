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
});
