const RENDER_SCALE = 3.5;
const MAX_OUTPUT_SIDE = 2400;
const WHITE_THRESHOLD = 247;
const SAFE_PIXEL_PADDING_RATIO = 0.025;

const clamp = value => Math.min(1, Math.max(0, Number(value) || 0));

const normalizedCrop = value => {
    const x = clamp(value?.x);
    const y = clamp(value?.y);
    const width = Math.min(clamp(value?.width), 1 - x);
    const height = Math.min(clamp(value?.height), 1 - y);
    if (width < 0.01 || height < 0.01) throw new Error("AI 圖片座標太小或超出頁面");
    return { x, y, width, height };
};

const contentBounds = (context, width, height) => {
    const { data } = context.getImageData(0, 0, width, height);
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;
            if (data[offset + 3] > 8 && (data[offset] < WHITE_THRESHOLD || data[offset + 1] < WHITE_THRESHOLD || data[offset + 2] < WHITE_THRESHOLD)) {
                left = Math.min(left, x);
                top = Math.min(top, y);
                right = Math.max(right, x);
                bottom = Math.max(bottom, y);
            }
        }
    }
    if (right < left || bottom < top) return { x: 0, y: 0, width, height, trimmed: false };
    const padding = Math.max(4, Math.round(Math.max(right - left + 1, bottom - top + 1) * SAFE_PIXEL_PADDING_RATIO));
    const x = Math.max(0, left - padding);
    const y = Math.max(0, top - padding);
    return {
        x,
        y,
        width: Math.min(width, right + padding + 1) - x,
        height: Math.min(height, bottom + padding + 1) - y,
        trimmed: true
    };
};

const canvasToJpeg = canvas => new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("瀏覽器無法輸出裁切圖片")), "image/jpeg", 0.94);
});

export const cropRenderedPdfPage = async (pageCanvas, rawCrop, pageNumber, questionId) => {
    const crop = normalizedCrop(rawCrop);
    const sourceX = Math.max(0, Math.floor(pageCanvas.width * crop.x));
    const sourceY = Math.max(0, Math.floor(pageCanvas.height * crop.y));
    const sourceWidth = Math.max(1, Math.ceil(pageCanvas.width * crop.width));
    const sourceHeight = Math.max(1, Math.ceil(pageCanvas.height * crop.height));
    const staging = document.createElement("canvas");
    staging.width = Math.min(sourceWidth, pageCanvas.width - sourceX);
    staging.height = Math.min(sourceHeight, pageCanvas.height - sourceY);
    const stagingContext = staging.getContext("2d", { willReadFrequently: true });
    if (!stagingContext) throw new Error("瀏覽器無法建立高解析裁切畫布");
    stagingContext.fillStyle = "#ffffff";
    stagingContext.fillRect(0, 0, staging.width, staging.height);
    stagingContext.drawImage(pageCanvas, sourceX, sourceY, staging.width, staging.height, 0, 0, staging.width, staging.height);
    const trimmed = contentBounds(stagingContext, staging.width, staging.height);
    const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(trimmed.width, trimmed.height));
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(trimmed.width * scale));
    output.height = Math.max(1, Math.round(trimmed.height * scale));
    const outputContext = output.getContext("2d");
    if (!outputContext) throw new Error("瀏覽器無法建立圖片輸出畫布");
    outputContext.fillStyle = "#ffffff";
    outputContext.fillRect(0, 0, output.width, output.height);
    outputContext.drawImage(staging, trimmed.x, trimmed.y, trimmed.width, trimmed.height, 0, 0, output.width, output.height);
    const blob = await canvasToJpeg(output);
    return {
        file: new File([blob], `workbook-p${pageNumber}-q${questionId}.jpg`, { type: "image/jpeg" }),
        width: output.width,
        height: output.height,
        cropMetadata: {
            source: "private_original_pdf",
            version: 1,
            page_number: Number(pageNumber),
            normalized_bbox: crop,
            whitespace_trimmed: trimmed.trimmed,
            output_width: output.width,
            output_height: output.height
        }
    };
};

export const cropOriginalPdfVisuals = async (pdfUrl, pages, onProgress = () => {}) => {
    if (!pdfUrl) throw new Error("缺少原始私人 PDF 網址");
    const [pdfjs, worker] = await Promise.all([
        import("pdfjs-dist/legacy/build/pdf"),
        import("pdfjs-dist/legacy/build/pdf.worker.entry")
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default || worker;
    const pdf = await pdfjs.getDocument({ url: pdfUrl, rangeChunkSize: 256 * 1024 }).promise;
    const results = [];
    try {
        const targets = (pages || []).flatMap(page => (page.crop_hints || []).map(hint => ({ ...hint, pageNumber: Number(page.page_number) })));
        const byPage = new Map();
        targets.forEach(target => byPage.set(target.pageNumber, [...(byPage.get(target.pageNumber) || []), target]));
        let completed = 0;
        for (const [pageNumber, hints] of byPage.entries()) {
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: RENDER_SCALE });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext("2d", { alpha: false });
            if (!context) throw new Error(`無法繪製原始 PDF 第 ${pageNumber} 頁`);
            await page.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;
            for (const hint of hints) {
                const cropped = await cropRenderedPdfPage(canvas, hint.bbox, pageNumber, hint.question_id);
                results.push({ ...hint, ...cropped });
                completed += 1;
                onProgress({ completed, total: targets.length, pageNumber, questionId: hint.question_id });
            }
            canvas.width = 1;
            canvas.height = 1;
            page.cleanup?.();
        }
        return results;
    } finally {
        await pdf.destroy?.();
    }
};
