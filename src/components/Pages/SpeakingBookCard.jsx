import React from "react";
import { FiChevronRight } from "react-icons/fi";
import { getSpeakingBookTheme } from "../../utils/speakingCartoonMap";

const SpeakingBookCard = ({ group, index, onOpen, rewardPolicy }) => {
    const theme = getSpeakingBookTheme(group.id);
    const completedCount = group.sections
        .flatMap(section => section.items)
        .filter(item => item.is_completed).length;
    const progressPercent = group.itemCount
        ? Math.round((completedCount / group.itemCount) * 100)
        : 0;
    const actionLabel = completedCount === group.itemCount && group.itemCount > 0
        ? "再次挑戰"
        : completedCount > 0 ? "繼續冒險" : "開始冒險";
    const rewardXp = Number(rewardPolicy?.xp);
    const rewardPoints = Number(rewardPolicy?.ae_points);
    const hasRewardPolicy = Number.isFinite(rewardXp) && Number.isFinite(rewardPoints);
    const rewardLabel = hasRewardPolicy
        ? `，每關首次通關 ${rewardXp} XP、最多 ${rewardPoints} AE Points`
        : "";

    return <button
        type="button"
        className={`speaking-book-card speaking-book-card--theme-${theme.id}`}
        style={{ "--book-primary": theme.color, "--book-deep": theme.color }}
        onClick={onOpen}
        aria-label={`開啟 ${group.label}，共 ${group.itemCount} 關，已完成 ${completedCount} 關${rewardLabel}`}
    >
        <span className="speaking-book-card__chapter" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <span className="speaking-book-card__content">
            <small className="speaking-book-card__eyebrow">{theme.title} · 第 {index + 1} 冊</small>
            <strong>{group.label}</strong>
            <span className="speaking-book-card__count">共 {group.itemCount} 關 · 已完成 {completedCount} 關</span>
            <span className="speaking-book-card__progress">
                <span
                    className="speaking-book-card__track"
                    role="progressbar"
                    aria-label={`${group.label} 完成進度`}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={progressPercent}
                ><span style={{ width: `${progressPercent}%` }} /></span>
            </span>
        </span>
        <span className="speaking-book-card__action">{actionLabel}<FiChevronRight aria-hidden="true" /></span>
    </button>;
};

export default SpeakingBookCard;
