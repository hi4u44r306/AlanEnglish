import React from "react";

const Flag = ({ value }) => {
    if (value === "taiwan") return <svg viewBox="0 0 900 600" aria-hidden="true"><rect width="900" height="600" fill="#fe0000" /><rect width="450" height="300" fill="#000095" /><g transform="translate(225 150)" fill="#fff">{Array.from({ length: 12 }, (_, index) => <path key={index} d="M0-112 15-64-15-64Z" transform={`rotate(${index * 30})`} />)}<circle r="58" /></g></svg>;
    if (value === "japan") return <svg viewBox="0 0 240 150" aria-hidden="true"><rect width="240" height="150" fill="#fffdf8" /><circle cx="120" cy="75" r="39" fill="#d94b49" /></svg>;
    if (value === "france") return <svg viewBox="0 0 240 150" aria-hidden="true"><rect width="80" height="150" fill="#2653a3" /><rect x="80" width="80" height="150" fill="#fffdf8" /><rect x="160" width="80" height="150" fill="#e64b4a" /></svg>;
    if (value === "england") return <svg viewBox="0 0 240 150" aria-hidden="true"><rect width="240" height="150" fill="#f9fbff" /><path d="M120 0v150M0 75h240" stroke="#d84445" strokeWidth="26" /></svg>;
    if (value === "australia") return <svg viewBox="0 0 240 150" aria-hidden="true"><rect width="240" height="150" fill="#24548e" /><g transform="scale(.5)"><rect width="240" height="150" fill="#25519a" /><path d="M0 0 240 150M240 0 0 150" stroke="#fff" strokeWidth="27" /><path d="M0 0 240 150M240 0 0 150" stroke="#e54b4a" strokeWidth="11" /><path d="M120 0v150M0 75h240" stroke="#fff" strokeWidth="42" /><path d="M120 0v150M0 75h240" stroke="#e54b4a" strokeWidth="23" /></g><g fill="#fff"><path d="m67 90 5 12 13-1-10 8 4 13-12-7-12 7 4-13-10-8 13 1z" /><path d="m176 35 4 10 11-1-9 7 4 11-10-6-10 6 4-11-9-7 11 1z" /><path d="m200 69 4 10 11-1-9 7 4 11-10-6-10 6 4-11-9-7 11 1z" /><path d="m177 105 4 10 11-1-9 7 4 11-10-6-10 6 4-11-9-7 11 1z" /><path d="m143 78 3 8 9-1-7 6 3 9-8-5-8 5 3-9-7-6 9 1z" /></g></svg>;
    return null;
};

const ColorObject = ({ value }) => {
    if (value === "banana") return <svg viewBox="0 0 240 150" aria-hidden="true"><rect width="240" height="150" rx="18" fill="#fff7cf" /><path d="M58 44c39 43 85 40 128-8-1 53-63 93-121 47-13-10-14-27-7-39Z" fill="#ffd54b" stroke="#d5a62a" strokeWidth="5" /><path d="M57 44l-9-9m137-1 9-11" stroke="#724d22" strokeWidth="7" strokeLinecap="round" /></svg>;
    if (value === "sky") return <svg viewBox="0 0 240 150" aria-hidden="true"><rect width="240" height="150" rx="18" fill="#7cc9f5" /><circle cx="184" cy="35" r="19" fill="#ffe16a" /><path d="M33 102c12-26 44-22 51-3 19-27 56-9 55 13H28c-5-4-3-8 5-10Z" fill="#fff" opacity=".92" /></svg>;
    if (value === "eggplant") return <svg viewBox="0 0 240 150" aria-hidden="true"><rect width="240" height="150" rx="18" fill="#f3e9ff" /><path d="M117 42c55 1 70 59 28 82-43 24-78-12-55-51 8-13 16-24 27-31Z" fill="#7752a6" /><path d="M112 50c-2-18 12-28 31-29-2 12-10 21-24 27l-7 13Z" fill="#59a565" /></svg>;
    if (value === "orange") return <svg viewBox="0 0 240 150" aria-hidden="true"><rect width="240" height="150" rx="18" fill="#fff0d9" /><circle cx="120" cy="82" r="47" fill="#f79831" /><path d="M121 37c5-20 27-26 43-19-13 15-25 23-43 26Z" fill="#55a86a" /><circle cx="100" cy="70" r="4" fill="#fbb65d" /><circle cx="142" cy="97" r="4" fill="#fbb65d" /></svg>;
    if (value === "apple") return <svg viewBox="0 0 240 150" aria-hidden="true"><rect width="240" height="150" rx="18" fill="#fff0ef" /><path d="M121 47c32-36 83 1 61 57-21 53-80 43-88 0-10-51 7-57 27-57Z" fill="#e84e4b" /><path d="M123 47c-3-19 4-29 18-35" stroke="#75492e" strokeWidth="7" strokeLinecap="round" /><path d="M140 22c18-10 34-2 40 13-16 4-29 0-40-13Z" fill="#58a468" /></svg>;
    if (value === "rainbow") return <svg viewBox="0 0 240 150" aria-hidden="true"><rect width="240" height="150" rx="18" fill="#e9f7ff" /><path d="M36 123a84 84 0 0 1 168 0" fill="none" stroke="#ed5a54" strokeWidth="15" /><path d="M52 123a68 68 0 0 1 136 0" fill="none" stroke="#f6a83d" strokeWidth="15" /><path d="M68 123a52 52 0 0 1 104 0" fill="none" stroke="#f5de55" strokeWidth="15" /><path d="M84 123a36 36 0 0 1 72 0" fill="none" stroke="#4eae72" strokeWidth="15" /><path d="M100 123a20 20 0 0 1 40 0" fill="none" stroke="#4b79c8" strokeWidth="15" /></svg>;
    return null;
};

const ClockFace = ({ hour = 7, minute = 0 }) => {
    const hourAngle = (hour % 12) * 30 + minute * .5 - 90;
    const minuteAngle = minute * 6 - 90;
    const hand = (angle, length, width) => <line x1="120" y1="78" x2={120 + Math.cos(angle * Math.PI / 180) * length} y2={78 + Math.sin(angle * Math.PI / 180) * length} stroke="#293e67" strokeWidth={width} strokeLinecap="round" />;
    return <><circle cx="120" cy="78" r="55" fill="#fffdf6" stroke="#546a9c" strokeWidth="5" />{[12, 3, 6, 9].map((number, index) => <text key={number} x={[120, 170, 120, 70][index]} y={[37, 84, 126, 84][index]} textAnchor="middle" fill="#293e67" fontWeight="700" fontSize="17">{number}</text>)}{hand(hourAngle, 28, 7)}{hand(minuteAngle, 40, 5)}<circle cx="120" cy="78" r="6" fill="#e75d5b" /></>;
};

const Clock = ({ hour = 7, minute = 0, night = false }) => <svg viewBox="0 0 240 150" aria-hidden="true"><rect width="240" height="150" rx="18" fill={night ? "#273d70" : "#dff4ff"} /><ClockFace hour={hour} minute={minute} /></svg>;

const Routine = ({ value }) => {
    if (value === "breakfast-seven") return <svg viewBox="0 0 240 150" aria-hidden="true"><rect width="240" height="150" rx="18" fill="#fff4d8" /><g transform="translate(-28 0) scale(.65)"><ClockFace hour={7} /></g><circle cx="166" cy="79" r="33" fill="#fff" stroke="#b7c7dd" strokeWidth="4" /><circle cx="166" cy="79" r="15" fill="#f6c64b" /><path d="M145 113h42" stroke="#7e9a6f" strokeWidth="5" strokeLinecap="round" /></svg>;
    if (value === "homework-before-nine") return <svg viewBox="0 0 240 150" aria-hidden="true"><rect width="240" height="150" rx="18" fill="#eef0ff" /><g transform="translate(-34 5) scale(.62)"><ClockFace hour={8} minute={30} /></g><rect x="111" y="43" width="84" height="68" rx="8" fill="#fff" stroke="#8295bd" strokeWidth="4" /><path d="M125 62h54m-54 15h40m-40 15h48" stroke="#7691bd" strokeWidth="5" strokeLinecap="round" /><path d="m177 108 21 17" stroke="#e49447" strokeWidth="8" strokeLinecap="round" /></svg>;
    if (value === "brush-bedtime") return <svg viewBox="0 0 240 150" aria-hidden="true"><rect width="240" height="150" rx="18" fill="#293d70" /><path d="M31 78h65v41H31z" fill="#f5e5b2" /><path d="M31 78h65v15H31z" fill="#e3625f" /><path d="M119 108h82v18h-82z" fill="#94b8e9" /><path d="M119 88h62v20h-62z" fill="#fff3ce" /><path d="M54 57c10-22 42-22 52 0" stroke="#63c7d3" strokeWidth="13" strokeLinecap="round" /><path d="M76 38v39" stroke="#f6f9ff" strokeWidth="7" strokeLinecap="round" /><circle cx="190" cy="35" r="16" fill="#ffe389" /></svg>;
    return null;
};

export default function SpeakingVisualAid({ aid, showCaption = true }) {
    if (aid?.kind === "private-image") {
        if (!aid?.image_url || !aid?.alt_zh) return null;
        return <figure className="speaking-visual-aid speaking-visual-aid--private">
            <img src={aid.image_url} alt={aid.alt_zh} />
            {showCaption && <figcaption>{aid.alt_zh}</figcaption>}
        </figure>;
    }
    if (!aid?.kind || !aid?.value) return null;
    const visual = aid.kind === "flag" ? <Flag value={aid.value} />
        : aid.kind === "color-object" ? <ColorObject value={aid.value} />
            : aid.kind === "clock" ? <Clock hour={Number(aid.value) || 7} />
                : aid.kind === "routine" ? <Routine value={aid.value} /> : null;
    if (!visual) return null;
    return <figure className="speaking-visual-aid" aria-label={aid.alt_zh || "題目輔助圖片"}>{visual}<figcaption>{aid.alt_zh || "看圖回答"}</figcaption></figure>;
}
