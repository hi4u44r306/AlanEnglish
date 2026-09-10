import React from "react";

const Face = ({ gender }) => <>
    <ellipse className="speaking-guide-avatar__ear" cx="53" cy="88" rx="11" ry="14" />
    <ellipse className="speaking-guide-avatar__ear" cx="167" cy="88" rx="11" ry="14" />
    <path className="speaking-guide-avatar__face" d="M65 57c0-29 19-43 45-43s45 14 45 43v36c0 33-19 54-45 54S65 126 65 93V57Z" />
    <g className="speaking-guide-avatar__eyes"><ellipse cx="91" cy="86" rx="11" ry="13" /><ellipse cx="129" cy="86" rx="11" ry="13" /><circle cx="94" cy="82" r="3" fill="#fff" /><circle cx="132" cy="82" r="3" fill="#fff" /></g>
    <path className="speaking-guide-avatar__nose" d="M110 91l-4 15 8 1" />
    <path className="speaking-guide-avatar__mouth" d="M97 120q13 11 26 0" />
    <circle className="speaking-guide-avatar__cheek" cx="78" cy="112" r="8" /><circle className="speaking-guide-avatar__cheek" cx="142" cy="112" r="8" />
    {gender === "female" ? <>
        <path className="speaking-guide-avatar__hair speaking-guide-avatar__hair--long" d="M59 109V57c0-38 24-54 51-54 31 0 50 21 50 55v60l-21-7V61c0-20-11-32-29-32-19 0-30 12-30 32v50l-21 12Z" />
        <path className="speaking-guide-avatar__fringe" d="M66 58c9-29 52-42 76-13-18-7-27 6-38 1-10-5-23 9-38 12Z" />
        <path className="speaking-guide-avatar__bow" d="M154 45c15-15 25-7 22 7-2 13-14 12-22 4-8 8-20 9-22-4-3-14 7-22 22-7Z" />
    </> : <>
        <path className="speaking-guide-avatar__hair speaking-guide-avatar__hair--short" d="M62 67c0-39 27-57 52-57 28 0 43 18 43 48-14-10-29-20-45-17-20 3-33 16-50 26Z" />
        <path className="speaking-guide-avatar__fringe" d="M66 53c14-33 62-42 86 0-14-7-30-11-42-3-15-9-30-3-44 3Z" />
    </>}
</>;

export default function SpeakingGuideAvatar({ gender = "female", isSpeaking = false }) {
    const isMale = gender === "male";
    const label = isMale ? "男聲 AI 口說夥伴" : "女聲 AI 口說夥伴";
    return <div className={`speaking-guide-avatar ${isMale ? "is-male" : "is-female"} ${isSpeaking ? "is-speaking" : ""}`} role="img" aria-label={isSpeaking ? `${label}正在示範發音` : label}>
        <svg viewBox="0 0 220 220" aria-hidden="true">
            <rect className="speaking-guide-avatar__backdrop" x="10" y="10" width="200" height="200" rx="48" />
            <circle className="speaking-guide-avatar__spark speaking-guide-avatar__spark--one" cx="42" cy="49" r="7" />
            <circle className="speaking-guide-avatar__spark speaking-guide-avatar__spark--two" cx="177" cy="61" r="5" />
            <g className="speaking-guide-avatar__character">
                <path className="speaking-guide-avatar__body" d="M45 210c5-43 29-66 65-66s60 23 65 66H45Z" />
                <path className="speaking-guide-avatar__shirt" d="M83 151h54l14 59H69l14-59Z" />
                <path className="speaking-guide-avatar__collar" d="m91 146 19 25 19-25" />
                <Face gender={isMale ? "male" : "female"} />
            </g>
            <g className="speaking-guide-avatar__sound" aria-hidden="true"><path d="M180 112v-12" /><path d="M191 118V94" /><path d="M202 112v-12" /></g>
        </svg>
    </div>;
}
