import QRCode from "qrcode";
import { getSuccessfulStudentLoginCards } from "./academyStudentLoginCards";
export { getSuccessfulStudentLoginCards } from "./academyStudentLoginCards";
const {
    Document,
    ImageRun,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun
} = require("docx");

const A4_WIDTH_TWIPS = 11906;
const A4_HEIGHT_TWIPS = 16838;
const PAGE_MARGIN_TWIPS = 360;
const TABLE_WIDTH_TWIPS = A4_WIDTH_TWIPS - (PAGE_MARGIN_TWIPS * 2);
const CARD_WIDTH_TWIPS = Math.floor(TABLE_WIDTH_TWIPS / 2);
const CARD_HEIGHT_TWIPS = 3900;
const CARD_CONTENT_WIDTH_TWIPS = CARD_WIDTH_TWIPS - 220;
const CARD_INFO_WIDTH_TWIPS = Math.round(CARD_CONTENT_WIDTH_TWIPS * 0.57);
const CARD_QR_WIDTH_TWIPS = CARD_CONTENT_WIDTH_TWIPS - CARD_INFO_WIDTH_TWIPS;
const CARDS_PER_PAGE = 8;
const FONT = "Microsoft JhengHei";
const DXA_WIDTH = "dxa";
const ALIGN_CENTER = "center";
const ALIGN_LEFT = "left";
const BORDER_DASHED = "dashed";
const HEIGHT_EXACT = "exact";
const SECTION_NEXT_PAGE = "nextPage";
const TABLE_LAYOUT_FIXED = "fixed";
const VERTICAL_CENTER = "center";
const NO_TABLE_BORDERS = {
    top: { style: "none", size: 0, color: "auto" },
    bottom: { style: "none", size: 0, color: "auto" },
    left: { style: "none", size: 0, color: "auto" },
    right: { style: "none", size: 0, color: "auto" },
    insideHorizontal: { style: "none", size: 0, color: "auto" },
    insideVertical: { style: "none", size: 0, color: "auto" }
};

const paragraph = (children, options = {}) => new Paragraph({
    alignment: ALIGN_CENTER,
    spacing: { before: 0, after: 20, line: 220 },
    ...options,
    children
});

const text = (value, options = {}) => new TextRun({
    text: String(value ?? ""),
    font: FONT,
    size: 18,
    color: "142443",
    ...options
});

const dataUrlToBytes = dataUrl => {
    const base64 = String(dataUrl || "").split(",")[1];
    if (!base64) throw new Error("QR Code 圖片格式不正確");
    const binary = atob(base64);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
};

const buildCardCell = (card, qrCodeDataUrl) => {
    const studentName = card.englishName
        ? `${card.chineseName} · ${card.englishName}`
        : card.chineseName;
    const recoveryOne = card.recoveryCodes[0] || "—";
    const recoveryTwo = card.recoveryCodes[1] || "—";

    return new TableCell({
        width: { size: CARD_WIDTH_TWIPS, type: DXA_WIDTH },
        margins: { top: 70, bottom: 70, left: 110, right: 110 },
        verticalAlign: VERTICAL_CENTER,
        borders: {
            top: { style: BORDER_DASHED, size: 4, color: "A8B4C7" },
            bottom: { style: BORDER_DASHED, size: 4, color: "A8B4C7" },
            left: { style: BORDER_DASHED, size: 4, color: "A8B4C7" },
            right: { style: BORDER_DASHED, size: 4, color: "A8B4C7" }
        },
        children: [new Table({
            width: { size: CARD_CONTENT_WIDTH_TWIPS, type: DXA_WIDTH },
            columnWidths: [CARD_INFO_WIDTH_TWIPS, CARD_QR_WIDTH_TWIPS],
            layout: TABLE_LAYOUT_FIXED,
            borders: NO_TABLE_BORDERS,
            rows: [new TableRow({
                cantSplit: true,
                height: { value: 3500, rule: HEIGHT_EXACT },
                children: [
                    new TableCell({
                        width: { size: CARD_INFO_WIDTH_TWIPS, type: DXA_WIDTH },
                        margins: { top: 40, bottom: 40, left: 50, right: 90 },
                        verticalAlign: VERTICAL_CENTER,
                        borders: NO_TABLE_BORDERS,
                        children: [
                            paragraph([
                                text("ALAN ENGLISH", { bold: true, size: 16, color: "2B66C3" }),
                                text("  英文班登入卡", { bold: true, size: 15, color: "2B66C3" })
                            ], { alignment: ALIGN_LEFT, spacing: { before: 0, after: 80, line: 220 } }),
                            paragraph([text(studentName, { bold: true, size: 26, color: "0F1F3A" })], {
                                alignment: ALIGN_LEFT,
                                spacing: { before: 0, after: 100, line: 280 }
                            }),
                            paragraph([
                                text("帳號  ", { bold: true, size: 15, color: "64748B" }),
                                text(card.username, { bold: true, size: 22 })
                            ], { alignment: ALIGN_LEFT, spacing: { before: 0, after: 55, line: 250 } }),
                            paragraph([
                                text("臨時密碼  ", { bold: true, size: 15, color: "64748B" }),
                                text(card.temporaryPassword, { bold: true, size: 20 })
                            ], { alignment: ALIGN_LEFT, spacing: { before: 0, after: 80, line: 250 } }),
                            paragraph([text("復原碼", { bold: true, size: 15, color: "64748B" })], {
                                alignment: ALIGN_LEFT,
                                spacing: { before: 0, after: 10, line: 210 }
                            }),
                            paragraph([text(`${recoveryOne}  ${recoveryTwo}`, { bold: true, size: 22, color: "9A3412" })], {
                                alignment: ALIGN_LEFT,
                                spacing: { before: 0, after: 60, line: 260 }
                            }),
                            paragraph([text("掃描右側 QR Code 設定密碼；復原碼每組只能用一次。", {
                                size: 14,
                                color: "64748B"
                            })], { alignment: ALIGN_LEFT, spacing: { before: 0, after: 0, line: 210 } })
                        ]
                    }),
                    new TableCell({
                        width: { size: CARD_QR_WIDTH_TWIPS, type: DXA_WIDTH },
                        margins: { top: 20, bottom: 20, left: 20, right: 20 },
                        verticalAlign: VERTICAL_CENTER,
                        borders: NO_TABLE_BORDERS,
                        children: [paragraph([
                            new ImageRun({
                                type: "png",
                                data: dataUrlToBytes(qrCodeDataUrl),
                                transformation: { width: 112, height: 112 }
                            })
                        ], { spacing: { before: 0, after: 0, line: 220 } })]
                    })
                ]
            })]
        })]
    });
};

const buildBlankCell = () => new TableCell({
    width: { size: CARD_WIDTH_TWIPS, type: DXA_WIDTH },
    borders: {
        top: { style: BORDER_DASHED, size: 4, color: "A8B4C7" },
        bottom: { style: BORDER_DASHED, size: 4, color: "A8B4C7" },
        left: { style: BORDER_DASHED, size: 4, color: "A8B4C7" },
        right: { style: BORDER_DASHED, size: 4, color: "A8B4C7" }
    },
    children: [new Paragraph("")]
});

const chunk = (items, size) => {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
};

const buildPageTable = cards => {
    const paddedCards = [...cards];
    while (paddedCards.length < CARDS_PER_PAGE) paddedCards.push(null);
    const rows = [];
    for (let index = 0; index < paddedCards.length; index += 2) {
        rows.push(new TableRow({
            cantSplit: true,
            height: { value: CARD_HEIGHT_TWIPS, rule: HEIGHT_EXACT },
            children: [
                paddedCards[index]?.cell || buildBlankCell(),
                paddedCards[index + 1]?.cell || buildBlankCell()
            ]
        }));
    }
    return new Table({
        width: { size: TABLE_WIDTH_TWIPS, type: DXA_WIDTH },
        columnWidths: [CARD_WIDTH_TWIPS, CARD_WIDTH_TWIPS],
        layout: TABLE_LAYOUT_FIXED,
        rows
    });
};

export const buildAcademyStudentLoginCardsDocx = async (results, rows) => {
    const cards = getSuccessfulStudentLoginCards(results, rows);
    if (cards.length === 0) throw new Error("沒有可輸出的學生登入卡");

    const renderedCards = await Promise.all(cards.map(async card => {
        const qrCodeDataUrl = await QRCode.toDataURL(card.activationUrl, {
            width: 220,
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#142443", light: "#ffffff" }
        });
        return { ...card, cell: buildCardCell(card, qrCodeDataUrl) };
    }));
    const pages = chunk(renderedCards, CARDS_PER_PAGE);
    const document = new Document({
        creator: "Alan English",
        title: "英文班學生帳號密碼登入卡",
        description: "CSV 批次建立學生後產生的一次性登入資訊",
        styles: {
            default: {
                document: { run: { font: FONT }, paragraph: { spacing: { after: 0 } } }
            }
        },
        sections: pages.map((pageCards, index) => ({
            properties: {
                type: index === 0 ? undefined : SECTION_NEXT_PAGE,
                page: {
                    size: { width: A4_WIDTH_TWIPS, height: A4_HEIGHT_TWIPS },
                    margin: {
                        top: PAGE_MARGIN_TWIPS,
                        right: PAGE_MARGIN_TWIPS,
                        bottom: PAGE_MARGIN_TWIPS,
                        left: PAGE_MARGIN_TWIPS,
                        header: 0,
                        footer: 0
                    }
                }
            },
            children: [buildPageTable(pageCards)]
        }))
    });
    return Packer.toBlob(document);
};

export const downloadAcademyStudentLoginCardsDocx = async (results, rows) => {
    const blob = await buildAcademyStudentLoginCardsDocx(results, rows);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alan-english-student-login-cards-${new Date().toISOString().slice(0, 10)}.docx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};
