import React from "react";
import { FiChevronRight } from "react-icons/fi";
import { usesSinglePracticeMode } from "../../utils/speakingPracticeMode";
import { SPEAKING_LEVELS } from "../../constants/speakingLevels";

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
    const challengeCompletedCount = Number(item.challenge_completed_count) || 0;
    const singlePractice = usesSinglePracticeMode(item) || section === "preparation";
    const topicLabel = speakingLessonTopic(item, pages, sectionCopy.label);
    const bookLine = [item.book?.name || item.books?.name, pages].filter(Boolean).join(" · ");
    const practiceOnly = !staffPreview && item.generation_metadata?.interaction_type === "alphabet_round" && item.completed_today === true;
    const easyAction = practiceOnly ? "聽示範與錄音練習" : SPEAKING_LEVELS.easy.label;
    const challengeAction = speakingEntryAction(challengeCompletedCount, questionCount, false, "challenge");
    return <div className="speaking-level-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <section className={`speaking-level-dialog${locked ? " is-locked" : ""}`} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={bookLine ? "speaking-level-book speaking-level-title" : "speaking-level-title"} aria-describedby={practiceOnly || item.is_completed ? "speaking-level-status" : undefined}>
            <button type="button" className="speaking-level-dialog__close" onClick={onClose} aria-label="關閉關卡摘要">×</button>
            {bookLine && <p id="speaking-level-book" className="speaking-level-dialog__book">{bookLine}</p>}
            <h2 id="speaking-level-title">{topicLabel}</h2>
            {staffPreview && <p className="speaking-level-dialog__topic">工作人員預覽</p>}
            <div className={`speaking-level-dialog__facts${singlePractice ? " is-compact" : ""}`}>
                <span><small>題數</small><strong>{questionCount} 題</strong></span>
                <span><small>通過</small><strong>{challengeCompletedCount}/{questionCount} 句</strong></span>
            </div>
            {locked && <p className="speaking-level-dialog__locked">先完成前一關，就能解鎖這個挑戰。</p>}
            {practiceOnly ? <p id="speaking-level-status" role="status">A–Z 今日挑戰已完成，明天可再評分；現在可聽示範與錄音練習。</p> : item.is_completed && <p id="speaking-level-status" role="status">這關已過！想再玩隨時都可以。</p>}
            <div className={`speaking-level-dialog__actions${singlePractice ? " is-single" : ""}`}>
                <button type="button" className="primary is-easy" aria-label={locked ? "尚未解鎖" : easyAction} onClick={() => onEnter("easy")} disabled={locked}><span><strong>{locked ? "尚未解鎖" : easyAction}</strong><small>{practiceOnly ? "不送評、不計通關" : SPEAKING_LEVELS.easy.how}</small></span><FiChevronRight aria-hidden="true" /></button>
                {!practiceOnly && <button type="button" className="primary is-challenge" aria-label={locked ? `${SPEAKING_LEVELS.challenge.label}尚未解鎖` : `${SPEAKING_LEVELS.challenge.label} · ${challengeAction} · ${SPEAKING_LEVELS.challenge.how}`} onClick={() => onEnter("challenge")} disabled={locked}><span><strong>{locked ? "尚未解鎖" : SPEAKING_LEVELS.challenge.label}</strong><small>{SPEAKING_LEVELS.challenge.how}</small></span><FiChevronRight aria-hidden="true" /></button>}
                <button type="button" className="speaking-level-dialog__return" onClick={onClose}>返回地圖</button>
            </div>
        </section>
    </div>;
};
