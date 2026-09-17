import React, { useEffect, useState } from "react";
import SpeakingVisualAid from "./SpeakingVisualAid";

export default function SpeakingSelectedImagePreview({ file, alt = "待上傳圖片預覽", variant = "admin" }) {
    const [imageUrl, setImageUrl] = useState("");

    useEffect(() => {
        if (!file || typeof URL.createObjectURL !== "function") {
            setImageUrl("");
            return undefined;
        }
        const nextUrl = URL.createObjectURL(file);
        setImageUrl(nextUrl);
        return () => URL.revokeObjectURL?.(nextUrl);
    }, [file]);

    if (!imageUrl) return null;
    return <div className="speaking-selected-image-preview">
        <strong>上傳前預覽（4:3 顯示範圍）</strong>
        <SpeakingVisualAid
            aid={{ kind: "private-image", image_url: imageUrl, alt_zh: alt.trim() || "待上傳圖片預覽" }}
            showCaption={false}
            variant={variant}
        />
    </div>;
}
