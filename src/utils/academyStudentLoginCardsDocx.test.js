import QRCode from "qrcode";
import { TextEncoder } from "util";
import {
    buildAcademyStudentLoginCardsDocx,
    getSuccessfulStudentLoginCards
} from "./academyStudentLoginCardsDocx";

jest.mock("qrcode", () => ({
    toDataURL: jest.fn()
}));

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

    test("輸出包含本機產生 QR Code 的 Word 檔", async () => {
        QRCode.toDataURL.mockResolvedValue(ONE_PIXEL_PNG);

        const blob = await buildAcademyStudentLoginCardsDocx(results, rows);

        expect(QRCode.toDataURL).toHaveBeenCalledWith(
            results[0].credentials.activation_url,
            expect.objectContaining({ errorCorrectionLevel: "M" })
        );
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.size).toBeGreaterThan(1000);
    });
});
