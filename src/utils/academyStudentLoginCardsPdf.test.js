import { PDFDocument } from "pdf-lib";
import { TextEncoder } from "util";
import {
    buildAcademyStudentLoginCardsPdfBytesFromPagePngs,
    paginateAcademyStudentLoginCards
} from "./academyStudentLoginCardsPdf";

global.TextEncoder = TextEncoder;

const ONE_PIXEL_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("academyStudentLoginCardsPdf", () => {
    test("每頁安排 8 張學生登入卡", () => {
        const cards = Array.from({ length: 9 }, (_, index) => ({ username: `student${index}` }));
        expect(paginateAcademyStudentLoginCards(cards).map(page => page.length)).toEqual([8, 1]);
    });

    test("可建立多頁 A4 PDF", async () => {
        const bytes = await buildAcademyStudentLoginCardsPdfBytesFromPagePngs([
            ONE_PIXEL_PNG,
            ONE_PIXEL_PNG
        ]);
        const pdf = await PDFDocument.load(bytes);

        expect(bytes.length).toBeGreaterThan(1000);
        expect(pdf.getPageCount()).toBe(2);
        expect(pdf.getPages()[0].getSize()).toEqual(expect.objectContaining({
            width: 595.28,
            height: 841.89
        }));
    });
});
