import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FiAward, FiStar, FiZap } from "react-icons/fi";

const number = value => Number(value || 0).toLocaleString("zh-TW");

export default function SpeakingChallengeCompletion({ reward, onDismiss }) {
    const buttonRef = useRef(null);
    const levels = Array.isArray(reward?.levels_gained) ? reward.levels_gained : [];
    const didLevelUp = levels.length > 0 || Number(reward?.level_after || 1) > Number(reward?.level_before || 1);

    useEffect(() => {
        if (!reward) return undefined;
        buttonRef.current?.focus();
        const onKeyDown = event => {
            if (event.key === "Escape") onDismiss();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [onDismiss, reward]);

    if (!reward) return null;

    return createPortal(<div className="speaking-completion" role="dialog" aria-modal="true" aria-label="口說大挑戰完成">
        <div className="speaking-completion__confetti" aria-hidden="true">
            {Array.from({ length: 16 }, (_, index) => <i key={index} />)}
        </div>
        <section className="speaking-completion__card">
            <span className="speaking-completion__badge"><FiAward aria-hidden="true" /></span>
            <small>CHALLENGE COMPLETE!</small>
            <h2>太棒了，大挑戰完成！</h2>
            <p>每個大關卡的完成獎勵只能領一次。</p>
            <div className="speaking-completion__rewards">
                <div><FiZap aria-hidden="true" /><span>經驗值</span><strong>+{number(reward.xp_awarded)} XP</strong></div>
                <div><FiStar aria-hidden="true" /><span>學習點數</span><strong>{Number(reward.ae_points_awarded || 0) > 0 ? `+${number(reward.ae_points_awarded)} AE Points` : "在校生限定"}</strong></div>
            </div>
            {didLevelUp && <div className="speaking-completion__level" role="status">
                <span>LEVEL UP</span><strong>Lv.{number(reward.level_after)}</strong>
                {Number(reward.level_points_awarded || 0) > 0 && <small>升等再獲得 +{number(reward.level_points_awarded)} AE Points</small>}
            </div>}
            <button ref={buttonRef} type="button" onClick={onDismiss}>查看這題結果</button>
        </section>
    </div>, document.body);
}
