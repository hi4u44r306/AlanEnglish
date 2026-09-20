import {
    cacheStudentAvatarDisplayUrl,
    getCachedStudentAvatarUrl,
    isStudentAvatarDisplayUrl
} from "./studentAvatarCache";

describe("student avatar display cache", () => {
    beforeEach(() => window.localStorage.clear());

    it("rejects a legacy private storage path and uses the current display URL", () => {
        window.localStorage.setItem("ae-userimage", "avatars/student-1.webp");

        expect(getCachedStudentAvatarUrl("https://example.com/avatar.webp", { ownerUid: "student-1" })).toBe("https://example.com/avatar.webp");
        expect(window.localStorage.getItem("ae-userimage")).toBeNull();
        expect(isStudentAvatarDisplayUrl("avatars/student-1.webp")).toBe(false);
    });

    it("keeps a default avatar in an account-scoped local record", async () => {
        await cacheStudentAvatarDisplayUrl("/default-avatars/alan-owl.png", {
            ownerUid: "student-1",
            sourceKey: "/default-avatars/alan-owl.png"
        });

        expect(getCachedStudentAvatarUrl(null, { ownerUid: "student-1" })).toBe("/default-avatars/alan-owl.png");
        expect(JSON.parse(window.localStorage.getItem("ae-userimage"))).toEqual(expect.objectContaining({
            version: 2,
            ownerUid: "student-1",
            displayUrl: "/default-avatars/alan-owl.png"
        }));
    });

    it("replaces a legacy transformed preset cache with its bundled source asset", () => {
        window.localStorage.setItem("ae-userimage", JSON.stringify({
            version: 2,
            ownerUid: "student-1",
            sourceKey: "/default-avatars/alan-owl.png",
            displayUrl: "/legacy-image-proxy?avatar=alan-owl"
        }));

        expect(getCachedStudentAvatarUrl(null, {
            ownerUid: "student-1",
            sourceKey: "/default-avatars/alan-owl.png"
        })).toBe("/default-avatars/alan-owl.png");
    });

    it("stores an uploaded avatar preview as a data URL for instant refresh rendering", async () => {
        const previewBlob = new Blob(["avatar-preview"], { type: "image/webp" });
        await cacheStudentAvatarDisplayUrl("https://example.com/signed-avatar.webp", {
            ownerUid: "student-1",
            sourceKey: "avatars/student-1.webp",
            previewBlob
        });

        expect(getCachedStudentAvatarUrl(null, {
            ownerUid: "student-1",
            sourceKey: "avatars/student-1.webp"
        })).toMatch(/^data:image\/webp;base64,/);
    });

    it("does not expose one account avatar cache to another account", async () => {
        await cacheStudentAvatarDisplayUrl("/default-avatars/alan-owl.png", { ownerUid: "student-1" });

        expect(getCachedStudentAvatarUrl(null, { ownerUid: "student-2" })).toBeNull();
        expect(window.localStorage.getItem("ae-userimage")).toBeNull();
    });
});
