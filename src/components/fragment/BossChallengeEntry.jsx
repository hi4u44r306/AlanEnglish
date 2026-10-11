import React from "react";
import { Link } from "react-router-dom";
import { PiFireFill, PiSwordFill } from "react-icons/pi";
import "../assets/scss/BossChallengeEntry.scss";

// Shown in the adventure menu only while a Boss challenge is open. The whole fiery card is
// the button; motion is decorative and switches off for reduced-motion users.
export default function BossChallengeEntry({ event, onNavigate }) {
    if (!event?.path) return null;
    return <Link className="ae-boss-entry" to={event.path} onClick={onNavigate} aria-label={`Boss 挑戰出現了：${event.title || "全班一起打倒 Boss"}`}>
        <span className="ae-boss-entry__flames" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <span className="ae-boss-entry__sparks" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
        <span className="ae-boss-entry__icon" aria-hidden="true"><PiFireFill /></span>
        <span className="ae-boss-entry__copy">
            <small>現在出現！</small>
            <strong>BOSS 挑戰</strong>
            {event.title && <span>{event.title}</span>}
        </span>
        <span className="ae-boss-entry__go" aria-hidden="true"><PiSwordFill />出擊</span>
    </Link>;
}
