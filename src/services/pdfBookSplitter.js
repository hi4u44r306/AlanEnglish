export const WHOLE_BOOK_CHUNK_PAGES = 10;
export const MAX_WHOLE_BOOK_BYTES = 500 * 1024 * 1024;
export const MAX_WHOLE_BOOK_PAGES = 500;
// A source page can be large (for example a scanner may embed one 139MB image).
// The original stays private in R2; only the OCR derivative must fit the Edge Function.
export const MAX_WHOLE_BOOK_PAGE_BYTES = 200 * 1024 * 1024;
export const MAX_OCR_CHUNK_BYTES = 20 * 1024 * 1024;

const OCR_REENCODE_ATTEMPTS = [
    { maxSide: 2600, quality: 0.94 },
    { maxSide: 2300, quality: 0.92 },
    { maxSide: 2000, quality: 0.9 },
    { maxSide: 1800, quality: 0.88 },
    { maxSide: 1600, quality: 0.85 }
];

export const needsOcrReencoding = byteSize => Number(byteSize) > MAX_OCR_CHUNK_BYTES;

const toJpegBlob = (canvas, quality) => new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("瀏覽器無法建立 OCR 圖片副本"));
    }, "image/jpeg", quality);
});

const loadPdfJs = async sourceBytes => {
    const [pdfjs, worker] = await Promise.all([
        import("pdfjs-dist/legacy/build/pdf"),
        import("pdfjs-dist/legacy/build/pdf.worker.entry")
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default || worker;
    // PDF.js may transfer its input to its worker, so retain the original bytes
    // for pdf-lib and any subsequent fallback attempt.
    return pdfjs.getDocument({ data: sourceBytes.slice(0) }).promise;
};

const createCopiedChunk = async (sourcePdf, start, end, PDFDocument) => {
    const chunkPdf = await PDFDocument.create();
    const pageIndexes = Array.from({ length: end - start }, (_, offset) => start + offset);
    const copiedPages = await chunkPdf.copyPages(sourcePdf, pageIndexes);
    copiedPages.forEach(page => chunkPdf.addPage(page));
    return new Blob([await chunkPdf.save({ useObjectStreams: true, addDefaultPage: false })], { type: "application/pdf" });
};

const createOcrDerivative = async (sourceBytes, start, end, PDFDocument, onProgress) => {
    let pdfjsDocument;
    try {
        pdfjsDocument = await loadPdfJs(sourceBytes);
        for (const attempt of OCR_REENCODE_ATTEMPTS) {
            const derivativePdf = await PDFDocument.create();
            for (let pageIndex = start; pageIndex < end; pageIndex += 1) {
                onProgress?.({ phase: "optimizing", pageFrom: start + 1, pageTo: end, currentPage: pageIndex + 1, maxSide: attempt.maxSide });
                const sourcePage = await pdfjsDocument.getPage(pageIndex + 1);
                const pageViewport = sourcePage.getViewport({ scale: 1 });
                const scale = attempt.maxSide / Math.max(pageViewport.width, pageViewport.height);
                const viewport = sourcePage.getViewport({ scale });
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.ceil(viewport.width));
                canvas.height = Math.max(1, Math.ceil(viewport.height));
                const context = canvas.getContext("2d", { alpha: false });
                if (!context) throw new Error("瀏覽器無法建立 OCR 頁面畫布");
                context.fillStyle = "#ffffff";
                context.fillRect(0, 0, canvas.width, canvas.height);
                await sourcePage.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;
                const image = await derivativePdf.embedJpg(await (await toJpegBlob(canvas, attempt.quality)).arrayBuffer());
                const page = derivativePdf.addPage([pageViewport.width, pageViewport.height]);
                page.drawImage(image, { x: 0, y: 0, width: pageViewport.width, height: pageViewport.height });
                canvas.width = 1;
                canvas.height = 1;
                sourcePage.cleanup?.();
            }
            const blob = new Blob([await derivativePdf.save({ useObjectStreams: true, addDefaultPage: false })], { type: "application/pdf" });
            if (!needsOcrReencoding(blob.size)) return blob;
        }
    } catch (error) {
        throw new Error(`P${start + 1}–P${end} 含有超大頁面，但瀏覽器無法建立 OCR 安全副本：${error.message || "PDF 頁面無法繪製"}`);
    } finally {
        await pdfjsDocument?.destroy?.();
    }
    throw new Error(`P${start + 1}–P${end} 的 OCR 副本仍超過 20MB。原始 PDF 已保持不變；請改用桌面版 Chrome 後重試，或將這 10 頁另存為較低解析度 PDF。`);
};

export const splitWholeBookPdf = async (file, { onProgress } = {}) => {
    if (!file || file.type !== "application/pdf") throw new Error("整本教材只接受 PDF 檔案");
    if (file.size < 1 || file.size > MAX_WHOLE_BOOK_BYTES) throw new Error("整本 PDF 不可超過 500MB");
    let sourceBytes;
    let sourcePdf;
    let PDFDocument;
    try {
        sourceBytes = await file.arrayBuffer();
        ({ PDFDocument } = await import("pdf-lib"));
        sourcePdf = await PDFDocument.load(sourceBytes, { updateMetadata: false });
    } catch {
        throw new Error("PDF 無法開啟；請確認檔案未加密、未損壞");
    }
    const pageCount = sourcePdf.getPageCount();
    if (pageCount < 1 || pageCount > MAX_WHOLE_BOOK_PAGES) throw new Error("整本教材頁數必須介於 1 到 500 頁");
    const chunks = [];
    const totalChunks = Math.ceil(pageCount / WHOLE_BOOK_CHUNK_PAGES);
    for (let start = 0; start < pageCount; start += WHOLE_BOOK_CHUNK_PAGES) {
        const end = Math.min(pageCount, start + WHOLE_BOOK_CHUNK_PAGES);
        onProgress?.({ phase: "splitting", completed: chunks.length, total: totalChunks, pageCount, pageFrom: start + 1, pageTo: end });
        let blob = await createCopiedChunk(sourcePdf, start, end, PDFDocument);
        if (needsOcrReencoding(blob.size)) {
            onProgress?.({ phase: "optimizing", completed: chunks.length, total: totalChunks, pageCount, pageFrom: start + 1, pageTo: end });
            blob = await createOcrDerivative(sourceBytes, start, end, PDFDocument, onProgress);
        }
        chunks.push({
            chunk_index: chunks.length,
            page_from: start + 1,
            page_to: end,
            byte_size: blob.size,
            blob
        });
        onProgress?.({ phase: "splitting", completed: chunks.length, total: totalChunks, pageCount, pageFrom: start + 1, pageTo: end });
    }
    return { pageCount, chunks };
};
