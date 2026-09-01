import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MaterialCatalog from "./MaterialCatalog";

let mockFirebaseUser = null;

jest.mock("../../auth/AuthContext", () => ({
    useAuth: () => ({ firebaseUser: mockFirebaseUser })
}));

jest.mock("../../services/commerceService", () => ({
    loadMaterialPackages: jest.fn().mockResolvedValue({ packages: [] }),
    loadPlacementAssessment: jest.fn().mockResolvedValue({ assessment: null }),
    submitPlacementAssessment: jest.fn()
}));

jest.mock("../../services/billingService", () => ({
    createMaterialCheckout: jest.fn()
}));

jest.mock("../fragment/Brand", () => () => <span>ALAN ENGLISH</span>);

const renderCatalog = ({ location = { pathname: "/materials", key: "default" } } = {}) => render(
    <MemoryRouter initialEntries={[location]}>
        <Routes>
            <Route path="/materials" element={<MaterialCatalog />} />
            <Route path="/" element={<div>公開首頁</div>} />
            <Route path="/userinfo" element={<div>我的首頁</div>} />
        </Routes>
    </MemoryRouter>
);

describe("MaterialCatalog navigation header", () => {
    beforeEach(() => {
        mockFirebaseUser = null;
    });

    test("公開商品頁顯示品牌、返回與登入入口", async () => {
        renderCatalog();

        expect(screen.getByRole("navigation", { name: "教材商品頁導覽" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "返回上一頁" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "登入" })).toHaveAttribute("href", "/login?next=/materials");
        await waitFor(() => expect(screen.getByText("三本教材內容尚在整理；課本、Workbook、聽力本與價格都確認後才會上架。")).toBeInTheDocument());
    });

    test("直接開啟商品頁時，返回按鈕回到公開首頁", async () => {
        renderCatalog();
        await screen.findByText("三本教材內容尚在整理；課本、Workbook、聽力本與價格都確認後才會上架。");

        fireEvent.click(screen.getByRole("button", { name: "返回上一頁" }));

        expect(await screen.findByText("公開首頁")).toBeInTheDocument();
    });

    test("已登入時顯示我的首頁入口", async () => {
        mockFirebaseUser = { uid: "test-user" };
        renderCatalog();
        await screen.findByText("三本教材內容尚在整理；課本、Workbook、聽力本與價格都確認後才會上架。");

        expect(screen.getByRole("link", { name: "我的首頁" })).toHaveAttribute("href", "/userinfo");
    });
});
