import QRCode from "qrcode";
import { getSuccessfulStudentLoginCards } from "./academyStudentLoginCards";

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
// A4 貼紙紙每頁 12 張（2 欄 × 6 列）、滿版：卡片之間與頁面四周都不留空，裁切由貼紙本身處理。
// 格子尺寸與 Word 版相同：每格 5953 × 2800 twips（約 105 × 49.4 mm），6 列撐滿 A4 高度。
const PAGE_MARGIN = 0;
const COLUMN_GAP = 0;
const ROW_GAP = 0;
const COLUMNS = 2;
const ROWS = 6;
const CARDS_PER_PAGE = COLUMNS * ROWS;
const A4_WIDTH_TWIPS = 11906;
const CARD_HEIGHT_TWIPS = 2800;
const CARD_WIDTH = Math.floor((PAGE_WIDTH - (PAGE_MARGIN * 2) - COLUMN_GAP) / COLUMNS);
const CARD_HEIGHT = (CARD_HEIGHT_TWIPS / A4_WIDTH_TWIPS) * PAGE_WIDTH;
const FONT_FAMILY = '"Microsoft JhengHei", "Noto Sans TC", sans-serif';

const chunk = (items, size) => {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
};

export const paginateAcademyStudentLoginCards = cards => chunk(cards, CARDS_PER_PAGE);

const loadImage = source => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("QR Code 圖片載入失敗"));
    image.src = source;
});

const drawText = (context, value, x, y, options = {}) => {
    const {
        size = 20,
        weight = 400,
        color = "#142443",
        align = "left",
        maxWidth
    } = options;
    context.save();
    context.fillStyle = color;
    context.font = `${weight} ${size}px ${FONT_FAMILY}`;
    context.textAlign = align;
    context.textBaseline = "top";
    if (maxWidth) context.fillText(String(value ?? ""), x, y, maxWidth);
    else context.fillText(String(value ?? ""), x, y);
    context.restore();
};

const drawCard = async (context, card, qrCodeDataUrl, x, y) => {
    // 貼紙印刷可能偏移幾毫米，文字離邊緣多留一些。
    const padding = 26;
    const infoX = x + padding;
    const qrSize = 150;
    const qrX = x + CARD_WIDTH - padding - qrSize;
    const captionHeight = 20;
    const qrY = y + ((CARD_HEIGHT - qrSize - captionHeight) / 2);
    const recoveryCodes = card.recoveryCodes.length
        ? card.recoveryCodes.slice(0, 2).join("   ")
        : "—";
    const textMaxWidth = qrX - infoX - 14;
    const valueX = infoX + 74;
    const valueMaxWidth = textMaxWidth - 74;
    const studentName = card.englishName ? `${card.chineseName} · ${card.englishName}` : card.chineseName;
    // 格子只有約 46 mm 高，中英文姓名合成一行，帳號、臨時密碼、復原碼各自「標籤＋內容」同一行。
    // 文字區塊（約 200 px）在整張貼紙裡上下置中；有無英文名都用同一個起點，相鄰貼紙的標題才會對齊。
    const textY = y + ((CARD_HEIGHT - 200) / 2);
    const drawLine = (label, value, top, valueOptions) => {
        drawText(context, label, infoX, top + 6, { size: 16, weight: 700, color: "#64748b" });
        drawText(context, value, valueX, top, { weight: 700, maxWidth: valueMaxWidth, ...valueOptions });
    };

    drawText(context, "ALAN ENGLISH  英文班登入卡", infoX, textY, {
        size: 17,
        weight: 700,
        color: "#2b66c3",
        maxWidth: textMaxWidth
    });
    drawText(context, studentName, infoX, textY + 24, {
        size: 27,
        weight: 700,
        color: "#0f1f3a",
        maxWidth: textMaxWidth
    });
    drawLine("帳號", card.username, textY + 66, { size: 23 });
    drawLine("臨時密碼", card.temporaryPassword, textY + 98, { size: 21 });
    drawLine("復原碼", recoveryCodes, textY + 128, { size: 21, color: "#9a3412" });
    drawText(context, "掃描右側 QR Code 設定密碼", infoX, textY + 162, { size: 16, color: "#64748b", maxWidth: textMaxWidth });
    drawText(context, "復原碼每組只能使用一次", infoX, textY + 182, { size: 16, color: "#64748b", maxWidth: textMaxWidth });

    const qrImage = await loadImage(qrCodeDataUrl);
    context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    drawText(context, "掃描開始設定", qrX + (qrSize / 2), qrY + qrSize + 4, {
        size: 16,
        color: "#64748b",
        align: "center"
    });
};

const renderPagePng = async cards => {
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("瀏覽器無法建立 PDF 畫布");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    for (let index = 0; index < cards.length; index += 1) {
        const card = cards[index];
        const row = Math.floor(index / COLUMNS);
        const column = index % COLUMNS;
        const x = PAGE_MARGIN + (column * (CARD_WIDTH + COLUMN_GAP));
        const y = PAGE_MARGIN + (row * (CARD_HEIGHT + ROW_GAP));
        const qrCodeDataUrl = await QRCode.toDataURL(card.activationUrl, {
            width: 260,
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#142443", light: "#ffffff" }
        });
        await drawCard(context, card, qrCodeDataUrl, x, y);
    }

    return canvas.toDataURL("image/png");
};

export const buildAcademyStudentLoginCardsPdfBytesFromPagePngs = async pagePngs => {
    if (!Array.isArray(pagePngs) || pagePngs.length === 0) {
        throw new Error("沒有可輸出的 PDF 頁面");
    }
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    for (const pagePng of pagePngs) {
        const image = await pdf.embedPng(pagePng);
        const page = pdf.addPage([595.28, 841.89]);
        page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }
    return pdf.save();
};

export const buildAcademyStudentLoginCardsPdf = async (results, rows) => {
    const cards = getSuccessfulStudentLoginCards(results, rows);
    if (cards.length === 0) throw new Error("沒有可輸出的學生登入卡");
    const pagePngs = [];
    for (const pageCards of paginateAcademyStudentLoginCards(cards)) {
        pagePngs.push(await renderPagePng(pageCards));
    }
    const bytes = await buildAcademyStudentLoginCardsPdfBytesFromPagePngs(pagePngs);
    return new Blob([bytes], { type: "application/pdf" });
};

export const downloadAcademyStudentLoginCardsPdf = async (results, rows) => {
    const blob = await buildAcademyStudentLoginCardsPdf(results, rows);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alan-english-student-login-cards-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};
