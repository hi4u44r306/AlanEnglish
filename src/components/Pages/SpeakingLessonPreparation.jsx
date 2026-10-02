import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiHeadphones } from "react-icons/fi";
import { getAccessibleBook } from "../../services/contentAccessService";
import { matchedSpeakingTracks, speakingListeningPath, speakingListeningSource } from "../../utils/speakingListening";
import { speakingLessonTopic } from "./SpeakingMapEntry";

export default function SpeakingLessonPreparation({ challenge, pages, mode, firebaseUser, busy = false }) {
    const [listening, setListening] = useState(null);
    const sourceKey = JSON.stringify(speakingListeningSource(challenge));
    const challengeId = challenge.id;
    useEffect(() => {
        let cancelled = false;
        setListening(null);
        const source = JSON.parse(sourceKey);
        if (source && firebaseUser) getAccessibleBook(firebaseUser, source.bookCode).then(response => {
            const tracks = matchedSpeakingTracks(source, response);
            if (!cancelled && tracks.length) setListening({ id: challengeId, mode, path: speakingListeningPath(source, challengeId, mode, tracks) });
        }).catch(() => { /* The lesson remains available when optional listening is unavailable. */ });
        return () => { cancelled = true; };
    }, [sourceKey, challengeId, mode, firebaseUser]);
    return <aside className="speaking-lesson-preparation" aria-label="本關冒險">
        <div><small>{challenge.books?.name || challenge.book?.name || "口說大挑戰"}</small><strong>{speakingLessonTopic(challenge, pages)}</strong></div>
        {listening?.id === challenge.id && listening.mode === mode && (busy
            ? <span className="speaking-listening-busy">完成這次錄音與評分後，就能去聽教材。</span>
            : <Link to={listening.path}><FiHeadphones aria-hidden="true" />先聽本關教材</Link>)}
    </aside>;
}
