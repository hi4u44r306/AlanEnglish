import React, { useState } from "react";
import { createPortal } from "react-dom";
import SpeakingLessonPreparation from "./SpeakingLessonPreparation";
import { useAuth } from "../../auth/AuthContext";
import useSpeakingAttention from "../../hooks/useSpeakingAttention";
import { SpeakingActivityContext, SpeakingHeaderToolsContext } from "./SpeakingActivityContext";

export { SpeakingActivityContext };

export default function SpeakingAdventureSession({ challenge, pages, mode, firebaseUser, notice = null, children }) {
    const [busy, setBusy] = useState(false);
    // 關卡標題列有預留位置時，「先聽本關教材」就放到題數旁邊；沒有時（讀取、結果畫面）留在上方。
    const [headerTools, setHeaderTools] = useState(null);
    const { role } = useAuth();
    // 專注度：關卡畫面開著時才記錄（讀取畫面、結果畫面不算）。
    useSpeakingAttention({ firebaseUser, role, questionSetId: challenge?.id, mode, busy });
    const preparation = <SpeakingLessonPreparation challenge={challenge} pages={pages} mode={mode} firebaseUser={firebaseUser} busy={busy} />;
    return <SpeakingActivityContext.Provider value={setBusy}><SpeakingHeaderToolsContext.Provider value={setHeaderTools}>
        <div className="speaking-adventure-session">
            {/* 老師／管理員的預覽說明；標題列還沒出現時「先聽本關教材」也放這裡。 */}
            <div className="speaking-session-topbar">
                {notice}
                {headerTools ? null : preparation}
            </div>
            {headerTools && createPortal(preparation, headerTools)}
            {children}
        </div>
    </SpeakingHeaderToolsContext.Provider></SpeakingActivityContext.Provider>;
}
