import React, { useEffect, useState } from "react";
import { Link, useInRouterContext } from "react-router-dom";

// 聽滿熟練次數後，在播放器旁邊跳出「去挑戰口說大挑戰」。只是入口，不影響任何計次。
function SpeakingChallengeNudge({ trackKey, lifted = false }) {
    const inRouter = useInRouterContext();
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => { setDismissed(false); }, [trackKey]);

    if (!inRouter || dismissed) return null;

    return (
        <aside className={`speaking-challenge-nudge${lifted ? " is-lifted" : ""}`} role="status">
            <Link to="/student/speaking-challenges" className="speaking-challenge-nudge__link">
                <span aria-hidden="true">🎤</span>
                <span>
                    <strong>聽熟了！去挑戰口說大挑戰</strong>
                    <small>現在就開口試試看</small>
                </span>
            </Link>
            <button type="button" onClick={() => setDismissed(true)} aria-label="關閉口說挑戰提示">×</button>
        </aside>
    );
}

export default SpeakingChallengeNudge;
