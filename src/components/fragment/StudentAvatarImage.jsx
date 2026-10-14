import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import "../assets/scss/StudentAvatarImage.scss";

// 這次開啟網站期間已經載入成功過的圖片網址。換頁時元件會重新出現，
// 已載入過的圖片要直接顯示，不能再轉圈、淡入一次（看起來像每次都重新讀取）。
const loadedSources = new Set();

const getImageState = src => {
    if (!src) return "failed";
    // Data URLs and bundled presets are immediately available on this origin.
    // Do not hide them behind a route-change loader; onError still handles a
    // genuinely missing file.
    return String(src).startsWith("data:image/") || String(src).startsWith("/default-avatars/") || loadedSources.has(src)
        ? "loaded"
        : "loading";
};

const StudentAvatarImage = ({ alt = "", className = "", objectFit = "cover", onError, onLoad, src, ...props }) => {
    const [state, setState] = useState(() => getImageState(src));
    const imageRef = useRef(null);

    useEffect(() => {
        setState(getImageState(src));
    }, [src]);

    // 瀏覽器快取裡已經有這張圖時，onLoad 不一定會再觸發；在畫面繪製前先檢查，避免閃一下轉圈。
    useLayoutEffect(() => {
        const image = imageRef.current;
        if (src && image?.complete && image.naturalWidth > 0) {
            loadedSources.add(src);
            setState("loaded");
        }
    }, [src]);

    if (!src) return null;

    const isLoading = state === "loading";
    return <span className={`ae-student-avatar-image ${className}`.trim()} style={{ "--student-avatar-object-fit": objectFit }} aria-busy={isLoading}>
        {isLoading && <span className="ae-student-avatar-image__loader" role="status" aria-label="頭貼載入中" />}
        {state === "failed" && <span className="ae-student-avatar-image__fallback" aria-label="頭貼載入失敗">?</span>}
        <img
            {...props}
            ref={imageRef}
            src={src}
            alt={alt}
            className={state === "loaded" ? "is-loaded" : ""}
            onLoad={event => {
                loadedSources.add(src);
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
