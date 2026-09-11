import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { syncStoreCheckout } from "../../services/storeService";
import StorePaymentResult from "./StorePaymentResult";

jest.mock("../../services/storeService", () => ({ syncStoreCheckout: jest.fn() }));
jest.mock("../../store/StoreContext", () => ({
    useStore: () => ({ session: { access_token: "store-token" }, authLoading: false, clearCart: jest.fn() })
}));
jest.mock("./StoreHeader", () => () => <header>商城導覽</header>);

const renderResult = () => render(
    <MemoryRouter initialEntries={["/shop/payment/success?session_id=cs_test_safe"]}>
        <StorePaymentResult />
    </MemoryRouter>
);

describe("StorePaymentResult", () => {
    beforeEach(() => jest.clearAllMocks());

    it("guides a paid but unclaimed buyer to verified learning-account activation", async () => {
        syncStoreCheckout.mockResolvedValue({
            order_number: "AE20260908-ABCDEFGH",
            payment_status: "paid",
            learning_access_status: "ready_to_claim"
        });

        renderResult();

        expect(await screen.findByText("還差一步：開通學習帳號")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "立即開通" })).toHaveAttribute("href", "/shop/activate-learning");
    });

    it("shows when learning access has already been claimed", async () => {
        syncStoreCheckout.mockResolvedValue({
            order_number: "AE20260908-ABCDEFGH",
            payment_status: "paid",
            learning_access_status: "claimed"
        });

        renderResult();

        expect(await screen.findByText("教材與 90 天平台權限已帶入")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "前往學習平台" })).toHaveAttribute("href", "/login?next=/student/membership");
    });
});
