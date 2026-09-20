import { getStudentAvatarDisplayUrl } from "./defaultStudentAvatars";

describe("default student avatars", () => {
    it("uses the Cloudflare-served public asset directly", () => {
        expect(getStudentAvatarDisplayUrl("/default-avatars/alan-owl.png", 160))
            .toBe("/default-avatars/alan-owl.png");
    });
});
