import QRCode from "qrcode";
import { getSuccessfulStudentLoginCards } from "./academyStudentLoginCards";

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
// A4 貼紙紙每頁 8 張、滿版：卡片之間與頁面四周都不留空，裁切由貼紙本身處理。
const PAGE_MARGIN = 0;
const COLUMN_GAP = 0;
const ROW_GAP = 0;
const COLUMNS = 2;
const ROWS = 4;
const CARDS_PER_PAGE = COLUMNS * ROWS;
const CARD_WIDTH = Math.floor((PAGE_WIDTH - (PAGE_MARGIN * 2) - COLUMN_GAP) / COLUMNS);
const CARD_HEIGHT = Math.floor((PAGE_HEIGHT - (PAGE_MARGIN * 2) - (ROW_GAP * (ROWS - 1))) / ROWS);
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
    const padding = 34;
    const infoX = x + padding;
    const infoWidth = Math.round(CARD_WIDTH * 0.58);
    const qrSize = 214;
    const qrX = x + CARD_WIDTH - padding - qrSize;
    const qrY = y + Math.round((CARD_HEIGHT - qrSize) / 2) - 8;
    const recoveryCodes = card.recoveryCodes.length
        ? card.recoveryCodes.slice(0, 2).join("   ")
        : "—";
    const textMaxWidth = infoWidth - (padding * 2);
    // 中文名與英文名各占一行，避免長名字被橫向壓扁；沒有英文名時，下方內容往上靠。
    const base = card.englishName ? 124 : 100;
    // 文字區塊在整張貼紙裡上下置中；有無英文名都用同一個起點，相鄰貼紙的標題才會對齊。
    const textY = y + Math.max(0, Math.round((CARD_HEIGHT - (124 + 227)) / 2) - 20);

    drawText(context, "ALAN ENGLISH  英文班登入卡", infoX, textY + 20, {
        size: 18,
        weight: 700,
        color: "#2b66c3"
    });
    drawText(context, card.chineseName, infoX, textY + 52, {
        size: 32,
        weight: 700,
        color: "#0f1f3a",
        maxWidth: textMaxWidth
    });
    if (card.englishName) {
        drawText(context, card.englishName, infoX, textY + 92, {
            size: 22,
            weight: 700,
            color: "#475569",
            maxWidth: textMaxWidth
        });
    }
    drawText(context, "帳號", infoX, textY + base, { size: 18, weight: 700, color: "#64748b" });
    drawText(context, card.username, infoX, textY + base + 25, { size: 26, weight: 700, maxWidth: textMaxWidth });
    drawText(context, "臨時密碼", infoX, textY + base + 66, { size: 18, weight: 700, color: "#64748b" });
    drawText(context, card.temporaryPassword, infoX, textY + base + 91, { size: 24, weight: 700, maxWidth: textMaxWidth });
    drawText(context, "復原碼", infoX, textY + base + 132, { size: 18, weight: 700, color: "#64748b" });
    drawText(context, recoveryCodes, infoX, textY + base + 157, {
        size: 24,
        weight: 700,
        color: "#9a3412",
        maxWidth: textMaxWidth
    });
    drawText(context, "掃描右側 QR Code 設定密碼", infoX, textY + base + 202, { size: 19, color: "#64748b", maxWidth: textMaxWidth });
    drawText(context, "復原碼每組只能使用一次", infoX, textY + base + 228, { size: 19, color: "#64748b", maxWidth: textMaxWidth });

    const qrImage = await loadImage(qrCodeDataUrl);
    context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    drawText(context, "掃描開始設定", qrX + (qrSize / 2), qrY + qrSize + 10, {
        size: 18,
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
