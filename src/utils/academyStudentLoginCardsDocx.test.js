import QRCode from "qrcode";
import JSZip from "jszip";
import { TextEncoder } from "util";
import {
    buildAcademyStudentLoginCardsDocx,
    getSuccessfulStudentLoginCards
} from "./academyStudentLoginCardsDocx";

jest.mock("qrcode", () => ({
    toDataURL: jest.fn()
}));

jest.mock("docx", () => {
    const actual = jest.requireActual("docx");
    return {
        ...actual,
        AlignmentType: undefined,
        BorderStyle: undefined,
        HeightRule: undefined,
        SectionType: undefined,
        TableBorders: undefined,
        TableLayoutType: undefined,
        VerticalAlign: undefined,
        WidthType: undefined
    };
});

global.TextEncoder = TextEncoder;

const ONE_PIXEL_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("academyStudentLoginCardsDocx", () => {
    const rows = [{
        source_row: 2,
        chinese_name: "王小明",
        english_name: "Alan"
    }];
    const results = [{
        source_row: 2,
        status: "success",
        credentials: {
            username: "alanwang",
            temporary_password: "Ae-K7M2-P9RX",
            activation_url: "https://alanenglish.com.tw/academy/student-setup?token=one-time",
            recovery_codes: ["123456", "654321"]
        }
    }];

    test("將中文姓名、帳號、臨時密碼與兩組復原碼集中成同一張卡", () => {
        expect(getSuccessfulStudentLoginCards(results, rows)).toEqual([{
            sourceRow: 2,
            chineseName: "王小明",
            englishName: "Alan",
            username: "alanwang",
            temporaryPassword: "Ae-K7M2-P9RX",
            activationUrl: "https://alanenglish.com.tw/academy/student-setup?token=one-time",
            recoveryCodes: ["123456", "654321"]
        }]);
    });

    test("瀏覽器未提供 docx 列舉匯出時仍可輸出包含 QR Code 的 Word 檔", async () => {
        QRCode.toDataURL.mockResolvedValue(ONE_PIXEL_PNG);

        const blob = await buildAcademyStudentLoginCardsDocx(results, rows);

        expect(QRCode.toDataURL).toHaveBeenCalledWith(
            results[0].credentials.activation_url,
            expect.objectContaining({ errorCorrectionLevel: "M" })
        );
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.size).toBeGreaterThan(1000);
    });

    test("每頁 12 格：13 位學生分成 2 頁，每頁 6 列、每列高 2800 twips", async () => {
        QRCode.toDataURL.mockResolvedValue(ONE_PIXEL_PNG);
        const manyRows = Array.from({ length: 13 }, (_, index) => ({
            source_row: index + 2,
            chinese_name: `學生${index}`,
            english_name: `Student${index}`
        }));
        const manyResults = manyRows.map(row => ({
            source_row: row.source_row,
            status: "success",
            credentials: {
                username: `student${row.source_row}`,
                temporary_password: "Ae-K7M2-P9RX",
                activation_url: `https://alanenglish.com.tw/academy/student-setup?token=${row.source_row}`,
                recovery_codes: ["123456", "654321"]
            }
        }));

        const blob = await buildAcademyStudentLoginCardsDocx(manyResults, manyRows);
        const buffer = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(blob);
        });
        const zip = await JSZip.loadAsync(buffer);
        const xml = await zip.file("word/document.xml").async("string");

        // 外層每頁 6 列（第 2 頁的空格會補滿），內層卡片表格的列高另外是 2500。
        expect(xml.match(/w:val="2800"/g)).toHaveLength(12);
        expect(xml.match(/<w:sectPr/g)).toHaveLength(2);
    });
});
