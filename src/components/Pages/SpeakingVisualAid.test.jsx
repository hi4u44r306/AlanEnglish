import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import SpeakingSelectedImagePreview from "./SpeakingSelectedImagePreview";
import SpeakingVisualAid from "./SpeakingVisualAid";

describe("SpeakingVisualAid", () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;

    beforeEach(() => {
        URL.createObjectURL = jest.fn().mockReturnValue("blob:selected-picture");
        URL.revokeObjectURL = jest.fn();
    });

    afterEach(() => {
        URL.createObjectURL = originalCreateObjectUrl;
        URL.revokeObjectURL = originalRevokeObjectUrl;
        jest.clearAllMocks();
    });

    it("uses the fixed challenge frame without changing the image ratio", () => {
        const { container } = render(<SpeakingVisualAid
            aid={{ kind: "private-image", image_url: "/picture.webp", alt_zh: "騎掃帚的女巫" }}
            showCaption={false}
        />);

        expect(container.querySelector(".speaking-visual-aid--challenge .speaking-visual-aid__media")).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "騎掃帚的女巫" })).toHaveAttribute("src", "/picture.webp");
    });

    it("previews a selected admin image and releases its temporary URL", () => {
        const file = new File(["image"], "question.png", { type: "image/png" });
        const { unmount } = render(<SpeakingSelectedImagePreview file={file} alt="題目圖片" />);

        expect(URL.createObjectURL).toHaveBeenCalledWith(file);
        expect(screen.getByText("上傳前預覽（4:3 顯示範圍）")).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "題目圖片" })).toHaveAttribute("src", "blob:selected-picture");
        expect(screen.getByRole("figure")).toHaveClass("speaking-visual-aid--admin");

        unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:selected-picture");
    });
});
