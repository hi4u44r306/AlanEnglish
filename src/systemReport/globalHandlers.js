import { getBuildId, newReportId } from "./reportClient";
import { showSystemReport } from "./reportBus";
import { canAutoReload, markReloadPending } from "./reloadGuard";
import { saveResume } from "./resume";

const CHUNK_PATTERN = /ChunkLoadError|Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Unexpected token '<'/i;
const IGNORE_PATTERN = /ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:/i;

export const isChunkError = error => CHUNK_PATTERN.test(`${error?.name || ""} ${error?.message || error || ""}`);

// 部署新版後，舊頁面找不到舊檔案是正常現象：確認伺服器上真的有新版，就安靜地重新整理一次，不打擾使用者也不送回報。
const hasNewerBuild = async () => {
    const current = getBuildId();
    if (current === "dev" || current === "unknown") return false;
    try {
        const response = await fetch("/asset-manifest.json", { cache: "no-store" });
        if (!response.ok) return false;
        const manifest = await response.json();
        const latest = ((manifest?.files?.["main.js"] || "").match(/main\.([\w-]+)\.js/) || [])[1];
        return Boolean(latest && latest !== current);
    } catch (error) {
        return false;
    }
};

export const handleChunkFailure = async error => {
    if (await hasNewerBuild() && canAutoReload("chunk")) {
        markReloadPending(true, "chunk");
        saveResume();
        window.location.reload();
        return;
    }
    showSystemReport({
        id: newReportId(),
        kind: "chunk_load",
        signature: "chunk_load",
        error_name: error?.name || "ChunkLoadError",
        error_message: error?.message || String(error || ""),
        stack: error?.stack || ""
    });
};

export const installGlobalHandlers = () => {
    const handle = (error, fallbackMessage) => {
        const text = `${error?.message || error || fallbackMessage || ""}`;
        if (IGNORE_PATTERN.test(text)) return;
        if (isChunkError(error || { message: text })) handleChunkFailure(error || { name: "ChunkLoadError", message: text });
    };
    window.addEventListener("error", event => handle(event.error, event.message));
    window.addEventListener("unhandledrejection", event => handle(event.reason));
};
