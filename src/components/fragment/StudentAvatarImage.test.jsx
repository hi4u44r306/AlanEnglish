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

    it("shows a bundled default avatar immediately while retaining load-error handling", () => {
        render(<StudentAvatarImage src="/default-avatars/alan-owl.png" alt="預設頭像" />);

        expect(screen.getByAltText("預設頭像")).toHaveClass("is-loaded");
        expect(screen.queryByRole("status", { name: "頭貼載入中" })).not.toBeInTheDocument();
    });

    it("does not show the loader again when the same remote avatar comes back after a page change", () => {
        const src = "https://example.com/avatar-remount.jpg";
        const first = render(<StudentAvatarImage src={src} alt="換頁前" />);
        expect(screen.getByRole("status", { name: "頭貼載入中" })).toBeInTheDocument();
        fireEvent.load(screen.getByAltText("換頁前"));
        first.unmount();

        // 換頁後元件重新出現：同一張圖直接顯示，不再轉圈或淡入。
        render(<StudentAvatarImage src={src} alt="換頁後" />);
        expect(screen.getByAltText("換頁後")).toHaveClass("is-loaded");
        expect(screen.queryByRole("status", { name: "頭貼載入中" })).not.toBeInTheDocument();
    });

    it("still shows the loader for a remote avatar that has never loaded", () => {
        render(<StudentAvatarImage src="https://example.com/avatar-never-loaded.jpg" alt="新頭貼" />);
        expect(screen.getByRole("status", { name: "頭貼載入中" })).toBeInTheDocument();
    });
});
