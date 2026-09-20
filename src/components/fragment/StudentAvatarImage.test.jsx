import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import StudentAvatarImage from "./StudentAvatarImage";

describe("StudentAvatarImage", () => {
    it("shows a loading animation until the avatar image has loaded", () => {
        render(<StudentAvatarImage src="https://example.com/avatar.jpg" alt="學生頭貼" />);

        const avatar = screen.getByAltText("學生頭貼");
        expect(screen.getByRole("status", { name: "頭貼載入中" })).toBeInTheDocument();
        expect(avatar).not.toHaveClass("is-loaded");

        fireEvent.load(avatar);

        expect(screen.queryByRole("status", { name: "頭貼載入中" })).not.toBeInTheDocument();
        expect(avatar).toHaveClass("is-loaded");
    });

    it("shows an account-local Data URL immediately without a route-change loader", () => {
        render(<StudentAvatarImage src="data:image/webp;base64,YXZhdGFy" alt="快取頭貼" />);

        expect(screen.getByAltText("快取頭貼")).toHaveClass("is-loaded");
        expect(screen.queryByRole("status", { name: "頭貼載入中" })).not.toBeInTheDocument();
    });
});
