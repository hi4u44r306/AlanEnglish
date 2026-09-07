export const WHOLE_BOOK_CHUNK_PAGES = 10;
export const MAX_WHOLE_BOOK_BYTES = 100 * 1024 * 1024;
export const MAX_WHOLE_BOOK_PAGES = 500;

export const splitWholeBookPdf = async file => {
    if (!file || file.type !== "application/pdf") throw new Error("整本教材只接受 PDF 檔案");
    if (file.size < 1 || file.size > MAX_WHOLE_BOOK_BYTES) throw new Error("整本 PDF 必須小於 100MB");
    let sourcePdf;
    try {
        const { PDFDocument } = await import("pdf-lib");
        sourcePdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
    } catch {
        throw new Error("PDF 無法開啟；請確認檔案未加密、未損壞");
    }
    const pageCount = sourcePdf.getPageCount();
    if (pageCount < 1 || pageCount > MAX_WHOLE_BOOK_PAGES) throw new Error("整本教材頁數必須介於 1 到 500 頁");
    const chunks = [];
    const { PDFDocument } = await import("pdf-lib");
    for (let start = 0; start < pageCount; start += WHOLE_BOOK_CHUNK_PAGES) {
        const end = Math.min(pageCount, start + WHOLE_BOOK_CHUNK_PAGES);
        const chunkPdf = await PDFDocument.create();
        const pageIndexes = Array.from({ length: end - start }, (_, offset) => start + offset);
        const copiedPages = await chunkPdf.copyPages(sourcePdf, pageIndexes);
        copiedPages.forEach(page => chunkPdf.addPage(page));
        const bytes = await chunkPdf.save({ useObjectStreams: true, addDefaultPage: false });
        const blob = new Blob([bytes], { type: "application/pdf" });
        chunks.push({
            chunk_index: chunks.length,
            page_from: start + 1,
            page_to: end,
            byte_size: blob.size,
            blob
        });
    }
    return { pageCount, chunks };
};
