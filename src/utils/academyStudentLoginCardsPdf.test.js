import { PDFDocument } from "pdf-lib";
import { TextEncoder } from "util";
import {
    buildAcademyStudentLoginCardsPdfBytesFromPagePngs,
    paginateAcademyStudentLoginCards
} from "./academyStudentLoginCardsPdf";
import { normalizeStartSlot } from "./academyStudentLoginCards";

global.TextEncoder = TextEncoder;

const ONE_PIXEL_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("academyStudentLoginCardsPdf", () => {
    test("每頁安排 12 張學生登入卡（2 欄 × 6 列）", () => {
        const cards = Array.from({ length: 13 }, (_, index) => ({ username: `student${index}` }));
        expect(paginateAcademyStudentLoginCards(cards).map(page => page.length)).toEqual([12, 1]);
    });

    test("從第幾格開始：前面先留空格，貼紙紙用過幾格也能接著印", () => {
        const one = [{ username: "student1" }];
        const pageOne = paginateAcademyStudentLoginCards(one, 5);
        expect(pageOne).toHaveLength(1);
        expect(pageOne[0].slice(0, 4)).toEqual([null, null, null, null]);
        expect(pageOne[0][4]).toEqual(one[0]);

        // 第 12 格只剩最後一格，再多一張就要換到下一頁的第 1 格。
        const three = Array.from({ length: 3 }, (_, index) => ({ username: `student${index}` }));
        expect(paginateAcademyStudentLoginCards(three, 11).map(page => page.length)).toEqual([12, 1]);
        expect(paginateAcademyStudentLoginCards(one, 1)[0][0]).toEqual(one[0]);
    });

    test("起始格只接受 1～12，不合理的值自動修正", () => {
        expect([normalizeStartSlot(1), normalizeStartSlot("5"), normalizeStartSlot(12)]).toEqual([1, 5, 12]);
        expect([normalizeStartSlot(0), normalizeStartSlot(-3), normalizeStartSlot(13), normalizeStartSlot(99)]).toEqual([1, 1, 12, 12]);
        expect([normalizeStartSlot(""), normalizeStartSlot("abc"), normalizeStartSlot(undefined), normalizeStartSlot(null)]).toEqual([1, 1, 1, 1]);
        expect(normalizeStartSlot(3.9)).toBe(3);
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
