import React, { createContext, useState } from "react";
import SpeakingLessonPreparation from "./SpeakingLessonPreparation";
import { useAuth } from "../../auth/AuthContext";
import useSpeakingAttention from "../../hooks/useSpeakingAttention";

export const SpeakingActivityContext = createContext(null);

export default function SpeakingAdventureSession({ challenge, pages, mode, firebaseUser, notice = null, children }) {
    const [busy, setBusy] = useState(false);
    const { role } = useAuth();
    // 專注度：關卡畫面開著時才記錄（讀取畫面、結果畫面不算）。
    useSpeakingAttention({ firebaseUser, role, questionSetId: challenge?.id, mode, busy });
    return <SpeakingActivityContext.Provider value={setBusy}>
        <div className="speaking-adventure-session">
            {/* 老師／管理員的預覽說明與「先聽本關教材」放在同一列。 */}
            <div className="speaking-session-topbar">
                {notice}
                <SpeakingLessonPreparation challenge={challenge} pages={pages} mode={mode} firebaseUser={firebaseUser} busy={busy} />
            </div>
            {children}
        </div>
    </SpeakingActivityContext.Provider>;
}
