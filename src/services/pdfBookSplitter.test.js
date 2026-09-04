import { PDFDocument } from "pdf-lib";
import { splitWholeBookPdf, WHOLE_BOOK_CHUNK_PAGES } from "./pdfBookSplitter";

const createPdfFile = async pageCount => {
    const pdf = await PDFDocument.create();
    for (let index = 0; index < pageCount; index += 1) pdf.addPage([400, 600]);
    const bytes = await pdf.save();
    return {
        type: "application/pdf",
        size: bytes.byteLength,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    };
};

describe("splitWholeBookPdf", () => {
    it("splits a whole book into deterministic ten-page chunks", async () => {
        const result = await splitWholeBookPdf(await createPdfFile(23));
        expect(WHOLE_BOOK_CHUNK_PAGES).toBe(10);
        expect(result.pageCount).toBe(23);
        expect(result.chunks.map(({ chunk_index, page_from, page_to }) => ({ chunk_index, page_from, page_to }))).toEqual([
            { chunk_index: 0, page_from: 1, page_to: 10 },
            { chunk_index: 1, page_from: 11, page_to: 20 },
            { chunk_index: 2, page_from: 21, page_to: 23 }
        ]);
        expect(result.chunks.every(chunk => chunk.byte_size > 0 && chunk.blob.type === "application/pdf")).toBe(true);
    });

    it("rejects non-PDF input before processing", async () => {
        await expect(splitWholeBookPdf({ type: "image/png", size: 10 })).rejects.toThrow("只接受 PDF");
    });
});
