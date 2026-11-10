import React, { useState } from "react";
import { downloadAcademyStudentLoginCardsDocx } from "../../utils/academyStudentLoginCardsDocx";
import { downloadAcademyStudentLoginCardsPdf } from "../../utils/academyStudentLoginCardsPdf";
import { LOGIN_CARDS_PER_PAGE, normalizeStartSlot } from "../../utils/academyStudentLoginCards";

const SLOT_STORAGE_KEY = "ae-login-card-next-slot";

const readSavedSlot = () => {
    try {
        return normalizeStartSlot(window.sessionStorage.getItem(SLOT_STORAGE_KEY));
    } catch (error) {
        return 1;
    }
};

const saveSlot = slot => {
    try {
        window.sessionStorage.setItem(SLOT_STORAGE_KEY, String(slot));
    } catch (error) {
        // 瀏覽器不讓存就算了，只是下次要自己選格子。
    }
};

// 單一學生建立成功後，把這張登入卡下載成和「批次匯入」一樣的 A4 貼紙檔（每頁 12 格）。
// 可以選「放在第幾格」，這樣已經用過幾格的貼紙紙可以接著用；下載後會自動指向下一格。
function StudentLoginCardDownloads({ credentials, chineseName, englishName, onDownloaded }) {
    const [startSlot, setStartSlot] = useState(readSavedSlot);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const results = [{ source_row: 1, status: "success", credentials }];
    const rows = [{ source_row: 1, chinese_name: chineseName, english_name: englishName }];

    const chooseSlot = value => {
        const slot = normalizeStartSlot(value);
        setStartSlot(slot);
        saveSlot(slot);
        setNotice("");
    };

    const download = async kind => {
        if (busy) return;
        setBusy(kind);
        setError("");
        setNotice("");
        try {
            const options = { startSlot };
            if (kind === "docx") await downloadAcademyStudentLoginCardsDocx(results, rows, options);
            else await downloadAcademyStudentLoginCardsPdf(results, rows, options);
            const next = startSlot >= LOGIN_CARDS_PER_PAGE ? 1 : startSlot + 1;
            setStartSlot(next);
            saveSlot(next);
            setNotice(`已下載，這張放在第 ${startSlot} 格。下一位學生預設放第 ${next} 格${startSlot >= LOGIN_CARDS_PER_PAGE ? "（這張貼紙紙已用完，請換新的一張）" : ""}。`);
            onDownloaded?.();
        } catch (downloadError) {
            setError(downloadError?.message || (kind === "docx" ? "Word 登入卡產生失敗，請稍後再試" : "PDF 登入卡產生失敗，請稍後再試"));
        } finally {
            setBusy("");
        }
    };

    return (
        <div className="academy-sticker-download" role="group" aria-label="印在貼紙紙上">
            <strong>印在貼紙紙上</strong>
            <p>下載和「批次匯入」一樣的 A4 貼紙檔（每頁 12 格）。貼紙紙如果已經用過幾格，請先選這張要放在第幾格。</p>
            <div className="academy-sticker-download-row">
                <label>
                    <span>放在第幾格</span>
                    <select value={startSlot} onChange={event => chooseSlot(event.target.value)} disabled={Boolean(busy)}>
                        {Array.from({ length: LOGIN_CARDS_PER_PAGE }, (_, index) => (
                            <option key={index + 1} value={index + 1}>第 {index + 1} 格</option>
                        ))}
                    </select>
                </label>
                <button type="button" className="academy-account-secondary-button" onClick={() => download("pdf")} disabled={Boolean(busy)}>
                    {busy === "pdf" ? "產生 PDF 中…" : "下載 PDF 登入卡"}
                </button>
                <button type="button" className="academy-account-secondary-button" onClick={() => download("docx")} disabled={Boolean(busy)}>
                    {busy === "docx" ? "產生 Word 中…" : "下載 Word 登入卡"}
                </button>
            </div>
            <small>格子順序：由左到右、由上到下（左上是第 1 格，右下是第 12 格）。</small>
            {notice && <p className="academy-sticker-download-notice" role="status">{notice}</p>}
            {error && <p className="academy-sticker-download-error" role="alert">{error}</p>}
        </div>
    );
}

export default StudentLoginCardDownloads;
