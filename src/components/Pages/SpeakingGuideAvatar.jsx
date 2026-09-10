import React from "react";

const GUIDE_ASSETS = {
    male: "/speaking-guide-boy.png",
    female: "/speaking-guide-girl.png"
};

export default function SpeakingGuideAvatar({ gender = "female", isSpeaking = false }) {
    const isMale = gender === "male";
    const label = isMale ? "男聲 AI 口說夥伴" : "女聲 AI 口說夥伴";

    return <div className={`speaking-guide-avatar ${isMale ? "is-male" : "is-female"} ${isSpeaking ? "is-speaking" : ""}`} role="img" aria-label={isSpeaking ? `${label}正在示範發音` : label}>
        <img src={GUIDE_ASSETS[isMale ? "male" : "female"]} alt="" />
        <span className="speaking-guide-avatar__mouth" aria-hidden="true" />
        <span className="speaking-guide-avatar__sound" aria-hidden="true"><i /><i /><i /></span>
    </div>;
}
