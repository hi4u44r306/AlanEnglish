import React, { createContext, useState } from "react";
import SpeakingLessonPreparation from "./SpeakingLessonPreparation";
import SpeakingAssessmentBudget, { SpeakingAssessmentContext } from "./SpeakingAssessmentBudget";

export const SpeakingActivityContext = createContext(null);

export default function SpeakingAdventureSession({ challenge, pages, mode, firebaseUser, assessmentUsage, children }) {
    const [busy, setBusy] = useState(false);
    const [usage, setUsage] = useState(assessmentUsage || null);
    return <SpeakingAssessmentContext.Provider value={{ usage, onUsage: setUsage }}><SpeakingActivityContext.Provider value={setBusy}>
        <div className="speaking-adventure-session">
            <SpeakingLessonPreparation challenge={challenge} pages={pages} mode={mode} firebaseUser={firebaseUser} busy={busy} />
            <SpeakingAssessmentBudget usage={usage} />
            {children}
        </div>
    </SpeakingActivityContext.Provider></SpeakingAssessmentContext.Provider>;
}
