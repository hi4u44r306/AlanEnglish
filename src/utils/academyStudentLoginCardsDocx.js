import QRCode from "qrcode";
import { getSuccessfulStudentLoginCards } from "./academyStudentLoginCards";
export { getSuccessfulStudentLoginCards } from "./academyStudentLoginCards";

// docx 的套件版本放進網站打包後會壞掉（TextRun 取不到，下載 Word 時出現 "_h is not a constructor"），
// 所以改成按下「下載 Word」才從本站載入一份獨立檔案；測試環境直接用 node_modules。
const DOCX_SCRIPT_URL = "/vendor/docx-9.7.1.iife.js";
let Document, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun;
let docxLoading = null;
const loadDocx = () => {
    if (process.env.NODE_ENV === "test") return Promise.resolve(require("docx"));
    if (typeof window !== "undefined" && window.docx?.Document) return Promise.resolve(window.docx);
    if (!docxLoading) {
        docxLoading = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = DOCX_SCRIPT_URL;
            script.onload = () => (window.docx?.Document ? resolve(window.docx) : reject(new Error("Word 元件載入不完整")));
            script.onerror = () => reject(new Error("Word 元件載入失敗，請重新整理後再試"));
            document.head.appendChild(script);
        }).catch(error => { docxLoading = null; throw error; });
    }
    return docxLoading;
};

const A4_WIDTH_TWIPS = 11906;
const A4_HEIGHT_TWIPS = 16838;
// A4 滿版貼紙紙每頁 12 張（2 欄 × 6 列），頁面四周與卡片之間都不留空（擁有者確認貼紙沒有空白邊）。
// 範本「帳號密碼格式」的格子是 5953 × 2645 twips，但 6 列只有 279.5 mm，下方會剩 17 mm，所以高度改成撐滿 A4。
const PAGE_MARGIN_TWIPS = 0;
const TABLE_WIDTH_TWIPS = A4_WIDTH_TWIPS - (PAGE_MARGIN_TWIPS * 2);
const CARD_WIDTH_TWIPS = Math.floor(TABLE_WIDTH_TWIPS / 2);
// 6 列加起來（16800）要略小於 A4 高度：Word 在表格後面一定會多一個空段落，剛好等於頁高時會被擠到第二頁。
const CARD_HEIGHT_TWIPS = 2800;
const TAIL_PARAGRAPH_TWIPS = 20;
const CARD_CONTENT_WIDTH_TWIPS = CARD_WIDTH_TWIPS - 480;
const CARD_INFO_WIDTH_TWIPS = Math.round(CARD_CONTENT_WIDTH_TWIPS * 0.62);
const CARD_QR_WIDTH_TWIPS = CARD_CONTENT_WIDTH_TWIPS - CARD_INFO_WIDTH_TWIPS;
// 資訊欄左右內距 50 + 90，扣掉後才是文字真正能用的寬度。
const INFO_TEXT_WIDTH_TWIPS = CARD_INFO_WIDTH_TWIPS - 140;
const LINE_EXACT = "exact";
const CARDS_PER_PAGE = 12;
const FONT = "Microsoft JhengHei";
const DXA_WIDTH = "dxa";
const ALIGN_CENTER = "center";
const ALIGN_LEFT = "left";
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

// Word 要求表格後面一定要有一個段落；縮到 1 pt 行高，才不會撐高格子。
const tinyParagraph = () => new Paragraph({
    spacing: { before: 0, after: 0, line: TAIL_PARAGRAPH_TWIPS, lineRule: "exact" },
    children: [new TextRun({ text: "", size: 2 })]
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

// 格子只有約 46 mm 高，每一行都用固定行高（exact）才算得準；文字太長時縮小字級，免得換行把下面的內容擠出格子。
const CJK_PATTERN = /[⺀-￿]/;
const estimateEm = value => Array.from(String(value ?? "")).reduce(
    (sum, character) => sum + (CJK_PATTERN.test(character) ? 1 : 0.62),
    0
);
const fitHalfPoints = (value, baseHalfPoints, widthTwips, minHalfPoints) => {
    const em = estimateEm(value);
    if (em === 0) return baseHalfPoints;
    const maxHalfPoints = Math.floor((widthTwips / 20 / em) * 2);
    return Math.max(minHalfPoints, Math.min(baseHalfPoints, maxHalfPoints));
};
const fitsOneLine = (value, halfPoints, widthTwips) => estimateEm(value) * (halfPoints / 2) <= widthTwips / 20;

const LABEL_HALF_POINTS = 15;
// 「標籤＋內容」同一行：內容可用寬度 = 文字寬度扣掉標籤（含後面兩個空格）。
const labeledLine = (label, value, valueOptions, spacingAfter, lineTwips) => paragraph([
    text(`${label}  `, { bold: true, size: LABEL_HALF_POINTS, color: "64748B" }),
    text(value, {
        bold: true,
        ...valueOptions,
        size: fitHalfPoints(
            value,
            valueOptions.size,
            INFO_TEXT_WIDTH_TWIPS - Math.ceil(estimateEm(`${label}  `) * LABEL_HALF_POINTS * 10),
            14
        )
    })
], { alignment: ALIGN_LEFT, spacing: { before: 0, after: spacingAfter, line: lineTwips, lineRule: LINE_EXACT } });

// 中英文姓名盡量同一行；兩者合起來縮到最小字級還放不下時，才分成兩行（英文名較小）。
const nameParagraphs = card => {
    const nameColor = "0F1F3A";
    const oneLine = card.englishName ? `${card.chineseName} · ${card.englishName}` : card.chineseName;
    const oneLineSize = fitHalfPoints(oneLine, 24, INFO_TEXT_WIDTH_TWIPS, 18);
    if (!card.englishName || fitsOneLine(oneLine, oneLineSize, INFO_TEXT_WIDTH_TWIPS)) {
        return [paragraph([text(oneLine, { bold: true, size: oneLineSize, color: nameColor })], {
            alignment: ALIGN_LEFT,
            spacing: { before: 0, after: 40, line: 320, lineRule: LINE_EXACT }
        })];
    }
    return [
        paragraph([text(card.chineseName, {
            bold: true,
            size: fitHalfPoints(card.chineseName, 24, INFO_TEXT_WIDTH_TWIPS, 18),
            color: nameColor
        })], { alignment: ALIGN_LEFT, spacing: { before: 0, after: 0, line: 320, lineRule: LINE_EXACT } }),
        paragraph([text(card.englishName, {
            bold: true,
            size: fitHalfPoints(card.englishName, 18, INFO_TEXT_WIDTH_TWIPS, 14),
            color: "475569"
        })], { alignment: ALIGN_LEFT, spacing: { before: 0, after: 40, line: 240, lineRule: LINE_EXACT } })
    ];
};

const buildCardCell = (card, qrCodeDataUrl) => {
    const recoveryOne = card.recoveryCodes[0] || "—";
    const recoveryTwo = card.recoveryCodes[1] || "—";

    return new TableCell({
        width: { size: CARD_WIDTH_TWIPS, type: DXA_WIDTH },
        margins: { top: 0, bottom: 0, left: 240, right: 240 },
        verticalAlign: VERTICAL_CENTER,
        borders: {
            top: { style: "none", size: 0, color: "auto" },
            bottom: { style: "none", size: 0, color: "auto" },
            left: { style: "none", size: 0, color: "auto" },
            right: { style: "none", size: 0, color: "auto" }
        },
        children: [new Table({
            width: { size: CARD_CONTENT_WIDTH_TWIPS, type: DXA_WIDTH },
            columnWidths: [CARD_INFO_WIDTH_TWIPS, CARD_QR_WIDTH_TWIPS],
            layout: TABLE_LAYOUT_FIXED,
            borders: NO_TABLE_BORDERS,
            rows: [new TableRow({
                cantSplit: true,
                height: { value: CARD_HEIGHT_TWIPS - 300, rule: HEIGHT_EXACT },
                children: [
                    new TableCell({
                        width: { size: CARD_INFO_WIDTH_TWIPS, type: DXA_WIDTH },
                        margins: { top: 40, bottom: 40, left: 50, right: 90 },
                        verticalAlign: VERTICAL_CENTER,
                        borders: NO_TABLE_BORDERS,
                        children: [
                            paragraph([
                                text("ALAN ENGLISH", { bold: true, size: 15, color: "2B66C3" }),
                                text("  英文班登入卡", { bold: true, size: 15, color: "2B66C3" })
                            ], { alignment: ALIGN_LEFT, spacing: { before: 0, after: 40, line: 220, lineRule: LINE_EXACT } }),
                            ...nameParagraphs(card),
                            labeledLine("帳號", card.username, { size: 21 }, 40, 280),
                            labeledLine("臨時密碼", card.temporaryPassword, { size: 20 }, 30, 270),
                            labeledLine("復原碼", `${recoveryOne}  ${recoveryTwo}`, { size: 20, color: "9A3412" }, 40, 270),
                            // 在分號處斷成兩行，避免最後一個字單獨掉到第二行。
                            paragraph([
                                text("掃描右側 QR Code 設定密碼；", { size: 14, color: "64748B" }),
                                text("復原碼每組只能用一次。", { size: 14, color: "64748B", break: 1 })
                            ], { alignment: ALIGN_LEFT, spacing: { before: 0, after: 0, line: 200, lineRule: LINE_EXACT } })
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
        }), tinyParagraph()]
    });
};

const buildBlankCell = () => new TableCell({
    width: { size: CARD_WIDTH_TWIPS, type: DXA_WIDTH },
    borders: {
        top: { style: "none", size: 0, color: "auto" },
        bottom: { style: "none", size: 0, color: "auto" },
        left: { style: "none", size: 0, color: "auto" },
        right: { style: "none", size: 0, color: "auto" }
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
        borders: NO_TABLE_BORDERS,
        rows
    });
};

export const buildAcademyStudentLoginCardsDocx = async (results, rows) => {
    const cards = getSuccessfulStudentLoginCards(results, rows);
    if (cards.length === 0) throw new Error("沒有可輸出的學生登入卡");
    ({ Document, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun } = await loadDocx());

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
            children: [
                buildPageTable(pageCards),
                tinyParagraph()
            ]
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
