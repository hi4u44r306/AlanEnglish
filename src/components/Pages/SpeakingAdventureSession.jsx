import React, { createContext, useState } from "react";
import SpeakingLessonPreparation from "./SpeakingLessonPreparation";

export const SpeakingActivityContext = createContext(null);

export default function SpeakingAdventureSession({ challenge, pages, mode, firebaseUser, children }) {
    const [busy, setBusy] = useState(false);
    return <SpeakingActivityContext.Provider value={setBusy}>
        <div className="speaking-adventure-session">
            <SpeakingLessonPreparation challenge={challenge} pages={pages} mode={mode} firebaseUser={firebaseUser} busy={busy} />
            {children}
        </div>
    </SpeakingActivityContext.Provider>;
}
