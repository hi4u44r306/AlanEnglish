import { useEffect, useState } from "react";
import {
    getCachedStudentAvatarUrl,
    STUDENT_AVATAR_CACHE_UPDATED_EVENT
} from "../constants/studentAvatarCache";

const normalize = value => String(value || "").trim();

export const useCachedStudentAvatarUrl = (fallback, { ownerUid, sourceKey } = {}) => {
    const normalizedFallback = normalize(fallback);
    const normalizedOwnerUid = normalize(ownerUid);
    const normalizedSourceKey = normalize(sourceKey);
    const readAvatar = () => getCachedStudentAvatarUrl(normalizedFallback, {
        ownerUid: normalizedOwnerUid,
        sourceKey: normalizedSourceKey
    });
    const [avatarUrl, setAvatarUrl] = useState(readAvatar);

    useEffect(() => {
        const syncAvatar = () => setAvatarUrl(readAvatar());
        syncAvatar();
        window.addEventListener(STUDENT_AVATAR_CACHE_UPDATED_EVENT, syncAvatar);
        return () => window.removeEventListener(STUDENT_AVATAR_CACHE_UPDATED_EVENT, syncAvatar);
    }, [normalizedFallback, normalizedOwnerUid, normalizedSourceKey]);

    return avatarUrl;
};
