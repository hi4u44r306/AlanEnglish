import React, { useEffect, useRef, useState } from "react";
import { Crop, FileImage, LoaderCircle, RefreshCw, Scissors, X } from "lucide-react";

const RENDER_SCALE = 2.75;
const MAX_OUTPUT_SIDE = 2400;
const MIN_CROP_SIZE = 0.025;

const clamp = value => Math.min(1, Math.max(0, value));
const clampCrop = crop => ({
    x: clamp(Math.min(crop.x, crop.x + crop.width)),
    y: clamp(Math.min(crop.y, crop.y + crop.height)),
    width: Math.max(MIN_CROP_SIZE, Math.min(1, Math.abs(crop.width))),
    height: Math.max(MIN_CROP_SIZE, Math.min(1, Math.abs(crop.height)))
});
const cropWithinPage = crop => {
    const normalized = clampCrop(crop);
    return {
        ...normalized,
        width: Math.min(normalized.width, 1 - normalized.x),
        height: Math.min(normalized.height, 1 - normalized.y)
    };
};

export const cropPdfCanvasToJpeg = async (sourceCanvas, crop, pageNumber) => {
    const normalized = cropWithinPage(crop);
    const sourceX = Math.round(sourceCanvas.width * normalized.x);
    const sourceY = Math.round(sourceCanvas.height * normalized.y);
    const sourceWidth = Math.max(1, Math.round(sourceCanvas.width * normalized.width));
    const sourceHeight = Math.max(1, Math.round(sourceCanvas.height * normalized.height));
    const ratio = Math.min(1, MAX_OUTPUT_SIDE / Math.max(sourceWidth, sourceHeight));
    const target = document.createElement("canvas");
    target.width = Math.max(1, Math.round(sourceWidth * ratio));
    target.height = Math.max(1, Math.round(sourceHeight * ratio));
    const context = target.getContext("2d");
    if (!context) throw new Error("瀏覽器無法建立圖片裁切畫布");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, target.width, target.height);
    context.drawImage(sourceCanvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, target.width, target.height);
    const blob = await new Promise(resolve => target.toBlob(resolve, "image/jpeg", 0.94));
    if (!blob) throw new Error("無法輸出 PDF 圖片，請改用一般圖片上傳");
    return new File([blob], `workbook-p${pageNumber}-crop.jpg`, { type: "image/jpeg" });
};

export default function SpeakingPdfImageCropper({ disabled, onUseCrop, onClose }) {
    const [pdf, setPdf] = useState(null);
    const [fileName, setFileName] = useState("");
    const [pageNumber, setPageNumber] = useState(1);
    const [pageImage, setPageImage] = useState("");
    const [crop, setCrop] = useState({ x: 0.04, y: 0.04, width: 0.92, height: 0.92 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const sourceCanvasRef = useRef(null);
    const pointerStartRef = useRef(null);

    useEffect(() => () => pdf?.destroy?.(), [pdf]);

    const renderPage = async (documentProxy, requestedPage) => {
        if (!documentProxy) return;
        const safePage = Math.min(Math.max(1, Number(requestedPage) || 1), documentProxy.numPages);
        setLoading(true);
        setError("");
        try {
            const page = await documentProxy.getPage(safePage);
            const viewport = page.getViewport({ scale: RENDER_SCALE });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext("2d", { alpha: false });
            if (!context) throw new Error("瀏覽器無法繪製 PDF 頁面");
            await page.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;
            sourceCanvasRef.current = canvas;
            setPageNumber(safePage);
            setCrop({ x: 0.04, y: 0.04, width: 0.92, height: 0.92 });
            setPageImage(canvas.toDataURL("image/jpeg", 0.9));
        } catch (renderError) {
            setError(renderError.message || "PDF 頁面無法繪製");
        } finally {
            setLoading(false);
        }
    };

    const loadPdf = async file => {
        if (!file) return;
        if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
            setError("請選擇 PDF 檔案");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const [pdfjs, worker] = await Promise.all([
                import("pdfjs-dist/legacy/build/pdf"),
                import("pdfjs-dist/legacy/build/pdf.worker.entry")
            ]);
            pdfjs.GlobalWorkerOptions.workerSrc = worker.default || worker;
            const loaded = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
            pdf?.destroy?.();
            setPdf(loaded);
            setFileName(file.name);
            await renderPage(loaded, 1);
        } catch (loadError) {
            setError(loadError.message || "PDF 無法開啟；請確認檔案沒有加密或損壞");
            setLoading(false);
        }
    };

    const pointForEvent = event => {
        const rect = event.currentTarget.getBoundingClientRect();
        return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
    };
    const beginCrop = event => {
        if (disabled || !pageImage) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        pointerStartRef.current = pointForEvent(event);
    };
    const moveCrop = event => {
        const start = pointerStartRef.current;
        if (!start) return;
        const end = pointForEvent(event);
        setCrop(cropWithinPage({ x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y }));
    };
    const endCrop = event => {
        if (!pointerStartRef.current) return;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        pointerStartRef.current = null;
    };
    const useCrop = async () => {
        if (!sourceCanvasRef.current || disabled) return;
        setLoading(true);
        setError("");
        try {
            const image = await cropPdfCanvasToJpeg(sourceCanvasRef.current, crop, pageNumber);
            await onUseCrop(image);
            onClose();
        } catch (cropError) {
            setError(cropError.message || "無法擷取圖片");
        } finally {
            setLoading(false);
        }
    };

    return <section className="speaking-pdf-cropper" aria-label="從 PDF 高解析擷取圖片">
        <header><div><span className="platform-eyebrow">PRIVATE PDF IMAGE</span><h4>從 PDF 高解析擷取圖片</h4><p>PDF 只在目前瀏覽器繪製，不會上傳。請在單一圖片外框拖曳，系統會輸出裁好的 JPG；裁切前不會公開或建立草稿。</p></div><button type="button" aria-label="關閉 PDF 圖片擷取" onClick={onClose} disabled={loading}><X size={18} /></button></header>
        <label className="speaking-file-picker"><span><FileImage size={16} />教材 PDF</span><input aria-label="教材 PDF" type="file" accept=".pdf,application/pdf" onChange={event => loadPdf(event.target.files?.[0])} disabled={disabled || loading} /><small>{fileName || "可選學生版或教師版 PDF；大檔案會先在本機讀取，請使用桌面瀏覽器。"}</small></label>
        {pdf && <div className="speaking-pdf-cropper__controls"><label><span>PDF 實際頁次</span><input type="number" min="1" max={pdf.numPages} value={pageNumber} onChange={event => setPageNumber(event.target.value)} disabled={loading || disabled} /></label><button type="button" className="platform-secondary" onClick={() => renderPage(pdf, pageNumber)} disabled={loading || disabled}><RefreshCw size={16} />載入第 {pageNumber} 頁／共 {pdf.numPages} 頁</button></div>}
        {loading && <p className="speaking-pdf-cropper__loading"><LoaderCircle className="speaking-spin" size={18} />正在以高解析度處理 PDF 頁面…</p>}
        {error && <p className="speaking-pdf-cropper__error" role="alert">{error}</p>}
        {pageImage && <><p className="speaking-pdf-cropper__instruction"><Crop size={16} />請拖曳框選單一圖片，避免包含旁邊圖片、文字或大量白邊。輸出圖片最長邊最多 {MAX_OUTPUT_SIDE}px。</p><div className="speaking-pdf-cropper__page" onPointerDown={beginCrop} onPointerMove={moveCrop} onPointerUp={endCrop} onPointerCancel={endCrop}><img src={pageImage} alt={`PDF 第 ${pageNumber} 頁預覽`} draggable="false" /><span className="speaking-pdf-cropper__selection" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }} /></div><button type="button" className="platform-primary speaking-pdf-cropper__use" onClick={useCrop} disabled={disabled || loading}><Scissors size={17} />使用這張裁切圖片</button></>}
    </section>;
}
