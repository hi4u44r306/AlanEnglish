import React from "react";
import { FiBookOpen, FiCheck, FiMessageCircle, FiMic } from "react-icons/fi";
import "./css/SpeakingLearningJourney.scss";

export default function SpeakingLearningJourney({ phase = "ready", canListen = false }) {
    const current = phase === "feedback" ? 2 : phase === "ready" ? 0 : 1;
    const steps = [
        { title: canListen ? "看題目、聽示範" : "看清楚題目", Icon: FiBookOpen },
        { title: "開口練習", Icon: FiMic },
        { title: "看看回饋", Icon: FiMessageCircle }
    ];
    const detail = {
        ready: canListen ? "需要時先聽示範，再用自己的聲音練習。" : "看清楚題目，準備好就按麥克風。",
        recording: "正在收音，說完後按完成錄音。",
        preparing: "正在整理錄音，請稍候。",
        review: "先回聽自己的回答，確認清楚再送出。",
        assessing: "正在處理這次回答，請稍候。",
        feedback: "看一個練習方向，再試一次；完成紀錄請看下方提示。"
    };
    return <div className="speaking-learning-journey" aria-label="本題學習步驟">
        <ol>{steps.map(({ title, Icon }, index) => <li key={title} className={index === current ? "is-current" : index < current ? "is-visited" : ""} aria-current={index === current ? "step" : undefined}>
            <span aria-hidden="true">{index < current ? <FiCheck /> : <Icon />}</span><strong>{title}</strong>
        </li>)}</ol>
        <p>{detail[phase] || detail.ready}</p>
    </div>;
}
