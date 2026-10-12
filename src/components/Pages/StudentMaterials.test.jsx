import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import StudentMaterials from "./StudentMaterials";
import { useAuth } from "../../auth/AuthContext";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { clearStudentPageCache } from "../../services/studentPageCache";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/contentAccessService", () => ({ getAccessibleCatalog: jest.fn() }));

const renderPage = () => render(<MemoryRouter><StudentMaterials /></MemoryRouter>);

beforeEach(() => {
    clearStudentPageCache();
    localStorage.clear();
    jest.clearAllMocks();
    useAuth.mockReturnValue({ firebaseUser: { uid: "learner" }, role: "student", studentProfile: { membership: { is_active: true, effective_access: { features: {} } } } });
});

test("lists every book the student may open as a name-only card, and nothing locked", async () => {
    getAccessibleCatalog.mockResolvedValue({ categories: [{ id: "workbook", name: "習作本", books: [
        { id: 1, code: "Workbook_1", name: "Workbook 1", locked: false },
        { id: 2, code: "Workbook_2", name: "Workbook 2", locked: true }
    ] }] });
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "教材" })).toBeInTheDocument();
    const card = await screen.findByRole("link", { name: "Workbook 1" });
    expect(card).toHaveAttribute("href", "/student/books/Workbook_1");
    expect(card.children).toHaveLength(0);
    expect(screen.queryByText("Workbook 2")).not.toBeInTheDocument();
});

test("says it is loading, then says so plainly when there is nothing to open", async () => {
    let resolveCatalog;
    getAccessibleCatalog.mockImplementationOnce(() => new Promise(resolve => { resolveCatalog = resolve; }));
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("教材載入中...");
    await act(async () => { resolveCatalog({ categories: [] }); });
    expect(screen.getByRole("status")).toHaveTextContent("目前沒有可使用的教材");
});
