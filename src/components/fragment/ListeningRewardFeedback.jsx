import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { listeningRewardText } from "../../utils/listeningRewardText";

const number = value => Number(value || 0).toLocaleString("zh-TW");

function ListeningRewardFeedback({ reward, onDismiss }) {
    const levels = Array.isArray(reward?.levels_gained) ? reward.levels_gained : [];
    const hasLevelUp = levels.length > 0 || Number(reward?.level_after || 1) > Number(reward?.level_before || 1);

    useEffect(() => {
        if (!reward || hasLevelUp) return undefined;
        const timer = window.setTimeout(onDismiss, 4200);
        return () => window.clearTimeout(timer);
    }, [hasLevelUp, onDismiss, reward]);

    if (!reward) return null;

    if (hasLevelUp) {
        return createPortal(
            <div className="level-up-celebration" role="dialog" aria-modal="true" aria-label="升等成功">
                <div className="level-up-confetti" aria-hidden="true">
                    {Array.from({ length: 14 }, (_, index) => <i key={index} />)}
                </div>
                <section className="level-up-card">
                    <span className="level-up-eyebrow">LEVEL UP!</span>
                    <strong className="level-up-number">Lv.{number(reward.level_after)}</strong>
                    <h2>太棒了，你升等了！</h2>
                    <p>這次獲得 <b>{number(reward.total_xp_added)} XP</b></p>
                    <div className="level-up-points">
                        <span>升等獎勵</span>
                        <strong>+{number(reward.level_points_added)} AE Points</strong>
                    </div>
                    <button type="button" onClick={onDismiss}>繼續學習</button>
                </section>
            </div>,
            document.body
        );
    }

    const masteryText = listeningRewardText(reward.reward_status);
    const title = masteryText
        ? (Number(reward.listening_xp_added) > 0 ? "自主熟練達成 +10 XP" : masteryText.title)
        : reward.eligible
        ? `有效聆聽 +${number(reward.listening_xp_added)} XP`
        : reward.limit_reached
            ? "今日聽力獎勵已達上限"
            : "這首今天已領過獎勵";
    const pointText = masteryText
        ? (Number(reward.listening_points_added) > 0 ? "獲得 +1 AE Point，每檔熟練獎勵限領一次" : masteryText.detail)
        : Number(reward.listening_points_added || 0) > 0
        ? `並獲得 +${number(reward.listening_points_added)} AE Point`
        : reward.limit_reached
            ? "仍可繼續播放與保留聆聽紀錄"
            : `再聽 ${number(reward.next_point_in)} 首不同音檔可得 1 點`;

    return (
        <aside className={`listening-reward-feedback${reward.eligible ? " is-earned" : ""}`} role="status">
            <div>
                <strong>{title}</strong>
                <span>{pointText}</span>
            </div>
            <small>{masteryText ? "今日自主" : "今日"} {number(reward.daily_rewarded_tracks)} / {number(reward.daily_track_limit)} 首</small>
            <button type="button" onClick={onDismiss} aria-label="關閉獎勵提示">×</button>
        </aside>
    );
}

export default ListeningRewardFeedback;
