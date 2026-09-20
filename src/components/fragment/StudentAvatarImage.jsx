import React, { useEffect, useState } from "react";
import "../assets/scss/StudentAvatarImage.scss";

const getImageState = src => {
    if (!src) return "failed";
    // Data URLs are the account-scoped Local Storage preview. Do not briefly
    // hide an already-local image behind a new loading animation on every route.
    return String(src).startsWith("data:image/") ? "loaded" : "loading";
};

const StudentAvatarImage = ({ alt = "", className = "", objectFit = "cover", onError, onLoad, src, ...props }) => {
    const [state, setState] = useState(() => getImageState(src));

    useEffect(() => {
        setState(getImageState(src));
    }, [src]);

    if (!src) return null;

    const isLoading = state === "loading";
    return <span className={`ae-student-avatar-image ${className}`.trim()} style={{ "--student-avatar-object-fit": objectFit }} aria-busy={isLoading}>
        {isLoading && <span className="ae-student-avatar-image__loader" role="status" aria-label="頭貼載入中" />}
        {state === "failed" && <span className="ae-student-avatar-image__fallback" aria-label="頭貼載入失敗">?</span>}
        <img
            {...props}
            src={src}
            alt={alt}
            className={state === "loaded" ? "is-loaded" : ""}
            onLoad={event => {
                setState("loaded");
                onLoad?.(event);
            }}
            onError={event => {
                setState("failed");
                onError?.(event);
            }}
        />
    </span>;
};

export default StudentAvatarImage;
