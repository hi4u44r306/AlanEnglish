import { createContext } from "react";

// 關卡內「正在忙」（錄音、評分、播放片段）的回報管道，給專注度判斷用。
// 獨立成小檔案，讓播放元件不必載入整個關卡（含登入）模組。
export const SpeakingActivityContext = createContext(null);

// 步驟列右邊的位置：「先聽一次」（本關教材聽力）放進去，和 1 拼 2 念排成同一列。
export const SpeakingHeaderToolsContext = createContext(null);
