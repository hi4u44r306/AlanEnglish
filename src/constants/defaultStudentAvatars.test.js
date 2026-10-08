import { getStudentAvatarDisplayUrl } from "./defaultStudentAvatars";

describe("default student avatars", () => {
    it("uses the bundled thumbnail at small display sizes and preserves the original identity", () => {
        expect(getStudentAvatarDisplayUrl("/default-avatars/alan-owl.png", 160))
            .toBe("/default-avatars/thumbs-v1/alan-owl.webp");
        expect(getStudentAvatarDisplayUrl("/default-avatars/alan-owl.png", 800)).toBe("/default-avatars/alan-owl.png");
        expect(getStudentAvatarDisplayUrl("https://example.com/photo.jpg", 160)).toBe("https://example.com/photo.jpg");
    });
});
