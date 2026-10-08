import { useCallback, useEffect, useState } from "react";
import {
    getCachedStudentAvatarUrl,
    STUDENT_AVATAR_CACHE_UPDATED_EVENT
} from "../constants/studentAvatarCache";

const normalize = value => String(value || "").trim();

export const useCachedStudentAvatarUrl = (fallback, { ownerUid, sourceKey } = {}) => {
    const normalizedFallback = normalize(fallback);
    const normalizedOwnerUid = normalize(ownerUid);
    const normalizedSourceKey = normalize(sourceKey);
    const readAvatar = useCallback(() => getCachedStudentAvatarUrl(normalizedFallback, {
        ownerUid: normalizedOwnerUid,
        sourceKey: normalizedSourceKey
    }), [normalizedFallback, normalizedOwnerUid, normalizedSourceKey]);
    const [, setRevision] = useState(0);

    useEffect(() => {
        const syncAvatar = () => setRevision(revision => revision + 1);
        window.addEventListener(STUDENT_AVATAR_CACHE_UPDATED_EVENT, syncAvatar);
        window.addEventListener("storage", syncAvatar);
        return () => {
            window.removeEventListener(STUDENT_AVATAR_CACHE_UPDATED_EVENT, syncAvatar);
            window.removeEventListener("storage", syncAvatar);
        };
    }, [readAvatar]);

    return readAvatar();
};
