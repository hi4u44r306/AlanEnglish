import { createContext } from "react";

// 關卡內「正在忙」（錄音、評分、播放片段）的回報管道，給專注度判斷用。
// 獨立成小檔案，讓播放元件不必載入整個關卡（含登入）模組。
export const SpeakingActivityContext = createContext(null);

// 關卡標題列右側的位置：「先聽本關教材」放進去，和題數排成同一列。
export const SpeakingHeaderToolsContext = createContext(null);
