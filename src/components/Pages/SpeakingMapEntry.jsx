import React from "react";
import { FiBookOpen, FiChevronRight, FiLock } from "react-icons/fi";
import { usesSinglePracticeMode } from "../../utils/speakingPracticeMode";

export const speakingLessonTopic = (item, pages, fallback = "口說練習") => {
    const normalize = value => String(value || "").replace(/[.\s]/g, "").toLowerCase();
    const topic = String(item.topic || "").trim();
    const title = String(item.title || "").replace(/^\s*(?:P[.\s]*)?\d{1,4}(?:\s*[～~-]\s*\d+)?\s*/i, "").trim();
    return (topic && normalize(topic) !== normalize(pages) ? topic : title) || fallback;
};

export const speakingEntryAction = (count, total, completed, mode = "easy") => {
    if (completed || (total > 0 && count >= total)) return mode === "challenge" ? "再次挑戰" : "再練一次";
    if (count > 0) return mode === "challenge" ? "繼續挑戰" : "繼續練習";
    return mode === "challenge" ? "開始挑戰" : "開始練習";
};

export const SpeakingMapGoal = ({ target, pages, completed, total, staffPreview, onOpen }) => {
    const item = target?.item;
    const allCompleted = total > 0 && completed === total;
    const started = Number(item?.completed_count) > 0;
    return <aside className="speaking-map-goal" aria-label="地圖學習目標">
        <div className="speaking-map-goal__copy">
            <small>{staffPreview ? "關卡預覽" : allCompleted ? "冒險里程碑" : "下一個目標"}</small>
            <strong>{item ? speakingLessonTopic(item, pages) : allCompleted ? "這本已全部通關！" : "目前沒有可開始的關卡"}</strong>
            <span>{item ? `${pages ? `${pages} · ` : ""}已完成 ${Number(item.completed_count) || 0} / ${Number(item.question_count) || 0} 題` : allCompleted ? "點選地圖上的關卡，再練一次。" : "請返回教材總覽，稍後重新查看。"}</span>
        </div>
        {item && <button type="button" onClick={onOpen}>{staffPreview ? "查看這一關" : started ? "繼續這一關" : "開始這一關"}<FiChevronRight aria-hidden="true" /></button>}
    </aside>;
};

export const ChallengePreviewDialog = ({ item, section, sectionCopy, pages, onClose, onEnter, dialogRef, staffPreview }) => {
    const locked = !staffPreview && item.is_unlocked === false;
    const questionCount = Number(item.question_count) || 0;
    const completedCount = Number(item.completed_count) || 0;
    const challengeCompletedCount = Number(item.challenge_completed_count) || 0;
    const singlePractice = usesSinglePracticeMode(item) || section === "preparation";
    const topicLabel = speakingLessonTopic(item, pages, sectionCopy.label);
    const practiceOnly = !staffPreview && item.completed_today === true;
    const easyAction = practiceOnly ? "今天已完成，錄音回聽" : speakingEntryAction(completedCount, questionCount, item.is_completed === true);
    const challengeAction = speakingEntryAction(challengeCompletedCount, questionCount, false, "challenge");
    return <div className="speaking-level-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <section className={`speaking-level-dialog${locked ? " is-locked" : ""}`} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="speaking-level-title" aria-describedby="speaking-level-description">
            <button type="button" className="speaking-level-dialog__close" onClick={onClose} aria-label="關閉關卡摘要">×</button>
            <div className="speaking-level-dialog__crest" aria-hidden="true">{locked ? <FiLock /> : <FiBookOpen />}</div>
            <span className="speaking-level-dialog__eyebrow">{sectionCopy.eyebrow}</span>
            <h2 id="speaking-level-title">{topicLabel}</h2>
            <p id="speaking-level-description" className="speaking-level-dialog__topic">{pages || sectionCopy.badge} · {staffPreview ? "工作人員預覽" : "口說大挑戰"}</p>
            <div className={`speaking-level-dialog__facts${singlePractice ? " is-compact" : ""}`}>
                <span><small>本關題數</small><strong>{questionCount} 題</strong></span>
                <span><small>{singlePractice ? "完成進度" : "簡單"}</small><strong>{completedCount} / {questionCount}</strong></span>
                {!singlePractice && <span><small>挑戰</small><strong>{challengeCompletedCount} / {questionCount}</strong></span>}
            </div>
            {locked && <p className="speaking-level-dialog__locked">先完成前一關，就能解鎖這個挑戰。</p>}
            {practiceOnly && <p role="status">今天換一關挑戰吧！這一關仍可聽示範、錄音回聽，明天恢復評分。</p>}
            <div className={`speaking-level-dialog__actions${singlePractice ? " is-single" : ""}`}>
                <button type="button" className="primary is-easy" aria-label={locked ? "尚未解鎖" : singlePractice ? easyAction : `${easyAction} · 簡單 · 看答案說`} onClick={() => onEnter("easy")} disabled={locked}><span><strong>{locked ? "尚未解鎖" : easyAction}</strong><small>{singlePractice ? "看著文字念，需要時聽示範" : "簡單模式 · 看答案說"}</small></span><FiChevronRight aria-hidden="true" /></button>
                {!singlePractice && !practiceOnly && <button type="button" className="primary is-challenge" aria-label={locked ? "挑戰模式尚未解鎖" : `${challengeAction} · 挑戰 · 看題目回答`} onClick={() => onEnter("challenge")} disabled={locked}><span><strong>{locked ? "尚未解鎖" : challengeAction}</strong><small>挑戰模式 · 看題目回答</small></span><FiChevronRight aria-hidden="true" /></button>}
                <button type="button" className="speaking-level-dialog__return" onClick={onClose}>返回地圖</button>
            </div>
        </section>
    </div>;
};
