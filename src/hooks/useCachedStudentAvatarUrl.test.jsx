import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { cacheStudentAvatarDisplayUrl } from "../constants/studentAvatarCache";
import { useCachedStudentAvatarUrl } from "./useCachedStudentAvatarUrl";

const CachedAvatar = ({ fallback, ownerUid, sourceKey }) => {
    const avatarUrl = useCachedStudentAvatarUrl(fallback, { ownerUid, sourceKey });
    return <output>{avatarUrl || "none"}</output>;
};

describe("useCachedStudentAvatarUrl", () => {
    beforeEach(() => window.localStorage.clear());

    it("replaces a remote fallback with the local preview when the cache finishes", async () => {
        render(<CachedAvatar fallback="https://example.com/avatar.webp" ownerUid="student-1" sourceKey="avatars/student-1.webp" />);

        expect(screen.getByText("https://example.com/avatar.webp")).toBeInTheDocument();

        await act(async () => {
            await cacheStudentAvatarDisplayUrl("https://example.com/avatar.webp", {
                ownerUid: "student-1",
                sourceKey: "avatars/student-1.webp",
                previewBlob: new Blob(["avatar-preview"], { type: "image/webp" })
            });
        });

        await waitFor(() => expect(screen.getByText(/^data:image\/webp;base64,/)).toBeInTheDocument());
    });
    it("uses the new account and source immediately on rerender", async () => {
        await cacheStudentAvatarDisplayUrl("/default-avatars/alan-owl.png", { ownerUid: "student-1", sourceKey: "/default-avatars/alan-owl.png" });
        const view = render(<CachedAvatar ownerUid="student-1" sourceKey="/default-avatars/alan-owl.png" />);
        view.rerender(<CachedAvatar ownerUid="student-2" fallback="https://example.com/second.webp" sourceKey="avatars/second.webp" />);
        expect(screen.getByText("https://example.com/second.webp")).toBeInTheDocument();
        expect(screen.queryByText("/default-avatars/alan-owl.png")).not.toBeInTheDocument();
    });
});
