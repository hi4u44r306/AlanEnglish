// PDF.js 4 只出 ESM。worker 放在 public/vendor（跟 docx 的做法一樣，不進打包），
// 不用 import.meta.url，因為 Jest 27 解析不了。升級 pdfjs-dist 時要同步換這個檔案與版本號，
// pdfjsLoader.test.js 會檢查兩邊一致。
export const PDFJS_WORKER_URL = `${process.env.PUBLIC_URL || ""}/vendor/pdf.worker-4.10.38.min.mjs`;

export const loadPdfJsLib = async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    return pdfjs;
};
