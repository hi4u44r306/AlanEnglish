import {
    cacheStudentAvatarDisplayUrl,
    clearStudentAvatarCache,
    getCachedStudentAvatarUrl,
    isStudentAvatarDisplayUrl
} from "./studentAvatarCache";

describe("student avatar display cache", () => {
    beforeEach(() => { clearStudentAvatarCache(); window.localStorage.clear(); });
    afterEach(() => jest.restoreAllMocks());

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
    it("reuses local pixels when signed URLs rotate without another download", async () => {
        await cacheStudentAvatarDisplayUrl("https://example.com/old.webp", {
            ownerUid: "student-1", sourceKey: "avatars/photo-1.webp",
            previewBlob: new Blob(["photo"], { type: "image/webp" })
        });
        const originalFetch = global.fetch;
        global.fetch = jest.fn();
        try {
            await cacheStudentAvatarDisplayUrl("https://example.com/new.webp", { ownerUid: "student-1", sourceKey: "avatars/photo-1.webp" });
            expect(global.fetch).not.toHaveBeenCalled();
            expect(getCachedStudentAvatarUrl(null, { ownerUid: "student-1", sourceKey: "avatars/photo-1.webp" })).toMatch(/^data:image\/webp/);
            expect(getCachedStudentAvatarUrl(null, { ownerUid: "student-1", sourceKey: "avatars/different.webp" })).toBeNull();
        } finally { global.fetch = originalFetch; }
    });

    it("coalesces simultaneous downloads and accepts URL rotation during download", async () => {
        const originalFetch = global.fetch;
        let finish;
        global.fetch = jest.fn(() => new Promise(resolve => { finish = resolve; }));
        try {
            const first = cacheStudentAvatarDisplayUrl("https://example.com/first.webp", { ownerUid: "student-1", sourceKey: "avatars/photo.webp" });
            const second = cacheStudentAvatarDisplayUrl("https://example.com/rotated.webp", { ownerUid: "student-1", sourceKey: "avatars/photo.webp" });
            expect(global.fetch).toHaveBeenCalledTimes(1);
            finish({ ok: true, blob: async () => new Blob(["image"], { type: "image/webp" }) });
            await Promise.all([first, second]);
            expect(getCachedStudentAvatarUrl(null, { ownerUid: "student-1", sourceKey: "avatars/photo.webp" })).toMatch(/^data:image\/webp/);
        } finally { global.fetch = originalFetch; }
    });

    it("does not resurrect a cleared avatar when its download finishes later", async () => {
        const originalFetch = global.fetch;
        let finish;
        global.fetch = jest.fn(() => new Promise(resolve => { finish = resolve; }));
        try {
            const pending = cacheStudentAvatarDisplayUrl("https://example.com/first.webp", { ownerUid: "student-1", sourceKey: "avatars/photo.webp" });
            clearStudentAvatarCache("student-1");
            finish({ ok: true, blob: async () => new Blob(["image"], { type: "image/webp" }) });
            await pending;
            expect(localStorage.getItem("ae-userimage")).toBeNull();
        } finally { global.fetch = originalFetch; }
    });

    it("falls back to the current URL if browser storage reads are blocked", () => {
        jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
        expect(getCachedStudentAvatarUrl("https://example.com/current.webp", { ownerUid: "student-1" })).toBe("https://example.com/current.webp");
    });
});
