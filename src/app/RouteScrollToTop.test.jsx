import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import RouteScrollToTop from "./RouteScrollToTop";

const StartPage = () => {
    const navigate = useNavigate();
    return <button type="button" onClick={() => navigate("/next")}>下一頁</button>;
};

describe("RouteScrollToTop", () => {
    beforeEach(() => {
        window.scrollTo = jest.fn();
    });

    it("載入及每次切換不同頁面時都回到頂端", () => {
        render(
            <MemoryRouter initialEntries={["/start"]}>
                <RouteScrollToTop />
                <Routes>
                    <Route path="/start" element={<StartPage />} />
                    <Route path="/next" element={<p>下一頁內容</p>} />
                </Routes>
            </MemoryRouter>
        );

        expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "auto" });

        fireEvent.click(screen.getByRole("button", { name: "下一頁" }));

        expect(screen.getByText("下一頁內容")).toBeInTheDocument();
        expect(window.scrollTo).toHaveBeenCalledTimes(2);
        expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "auto" });
    });
});
