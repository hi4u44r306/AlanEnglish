import React, { createContext, useState } from "react";
import SpeakingLessonPreparation from "./SpeakingLessonPreparation";

export const SpeakingActivityContext = createContext(null);

export default function SpeakingAdventureSession({ challenge, pages, mode, firebaseUser, notice = null, children }) {
    const [busy, setBusy] = useState(false);
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
