import React, { useCallback, useEffect, useState } from "react";
import { FiGift, FiPackage, FiRefreshCw, FiTarget } from "react-icons/fi";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { getRewards, redeemReward } from "../../services/gamificationService";
import useRewardGoal from "../../hooks/useRewardGoal";
import StudentGrowthCard from "../fragment/StudentGrowthCard";
import "./css/Gamification.scss";
import "./css/StudentRewards.scss";

const formatNumber = value => Number(value || 0).toLocaleString("zh-TW");
const STATUS_LABELS = {
    pending: "等待老師確認",
    approved: "已確認",
    ordered: "老師已訂購",
    ready: "獎品已到，可領取",
    completed: "已領取",
    cancelled: "已取消"
};

function Rewards() {
    const { firebaseUser, studentProfile } = useAuth();
    const hasRewardsAccess = studentProfile?.learner_type === "academy_student"
        && studentProfile?.membership?.effective_access?.plan_codes?.includes("academy_internal") === true;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [redeemingId, setRedeemingId] = useState(null);
    const [loadError, setLoadError] = useState(false);
    const [goalId, setGoalId] = useRewardGoal(firebaseUser?.uid);

    const load = useCallback(async () => {
        if (!firebaseUser || !hasRewardsAccess) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            setData(await getRewards(firebaseUser));
            setLoadError(false);
        } catch (error) {
            setLoadError(true);
            toast.error(error.message || "獎品商城讀取失敗");
        } finally {
            setLoading(false);
        }
    }, [firebaseUser, hasRewardsAccess]);

    useEffect(() => {
        load();
    }, [load]);

    const handleRedeem = async reward => {
        if (!firebaseUser || redeemingId) return;
        const confirmed = window.confirm(`確定要用 ${formatNumber(reward.points_cost)} P 兌換「${reward.name}」嗎？`);
        if (!confirmed) return;
        setRedeemingId(reward.id);
        try {
            await redeemReward(firebaseUser, reward.id);
            toast.success("兌換申請已送出，等待老師確認");
            await load();
        } catch (error) {
            toast.error(error.message || "兌換失敗");
        } finally {
            setRedeemingId(null);
        }
    };

    const balance = data?.balance || {};
    const rewards = data?.rewards || [];
    const redemptions = data?.redemptions || [];
    const redemptionAllowed = data?.redemption_allowed !== false;
    const hasBalance = data?.balance?.points_balance != null && Number.isFinite(Number(balance.points_balance));
    const points = hasBalance ? Number(balance.points_balance) : null;
    const availableGoals = rewards.filter(reward => Number(reward.stock_quantity) > 0 && Number.isFinite(Number(reward.points_cost)));
    const goal = availableGoals.find(reward => String(reward.id) === goalId)
        || [...availableGoals].sort((a, b) => Number(a.points_cost) - Number(b.points_cost))[0];
    const goalCost = goal ? Math.max(0, Number(goal.points_cost)) : 0;
    const goalRemaining = points != null ? Math.max(0, goalCost - points) : null;
    const goalProgress = points != null ? goalCost === 0 ? 100 : Math.min(100, Math.max(0, Math.round(points / goalCost * 100))) : null;

    if (!hasRewardsAccess) {
        return (
            <main className="gamification-page student-rewards">
                <section className="gamification-hero gamification-hero--rewards">
                    <div>
                        <h1>獎品商城</h1>
                        <p>AE Points 與獎品兌換只開放目前有效在校的英文班學生。你的 XP 與既有學習紀錄仍會保留。</p>
                    </div>
                </section>
                <section className="gamification-shop-section">
                    <div className="gamification-redemption-notice" role="status">目前帳號沒有獎品商城資格。</div>
                </section>
            </main>
        );
    }

    return (
        <main className="gamification-page student-rewards">
            <section className="gamification-hero gamification-hero--rewards">
                <div>
                    <h1>獎品商城</h1>
                    <p>選一個想得到的獎品，看看自己的學習離目標有多近。</p>
                </div>
                <button className="gamification-refresh" type="button" onClick={load} disabled={loading}>
                    <FiRefreshCw className={loading ? "is-spinning" : ""} />更新
                </button>
            </section>

            <StudentGrowthCard balance={data?.balance} loading={loading} error={loadError} pointsAccess onRetry={load}>
                <Link to="/student/dashboard">繼續今日學習</Link>
                <Link to="/student/settings">我的角色</Link>
                <a href="#my-redemptions">查看兌換進度</a>
            </StudentGrowthCard>

            {goal && hasBalance && <section className="student-rewards__goal" aria-labelledby="reward-goal-title">
                <div className="student-rewards__goal-image">{goal.image_url ? <img src={goal.image_url} alt="" /> : <FiGift aria-hidden="true" />}</div>
                <div className="student-rewards__goal-copy">
                    <h2 id="reward-goal-title"><FiTarget aria-hidden="true" />我的獎品目標</h2>
                    <h3>{goal.name}</h3>
                    <p aria-live="polite">{goalRemaining > 0 ? <>還差 <strong>{formatNumber(goalRemaining)} P</strong>，一步一步累積</> : "點數已足夠！可以在下方確認獎品後申請兌換。"}</p>
                    <progress max="100" value={goalProgress} aria-label={`距離${goal.name}的點數進度`} />
                    <div className="student-rewards__goal-count"><span>已有 {formatNumber(points)} P</span><span>目標 {formatNumber(goalCost)} P</span></div>
                    <small>可在下方換一個我的目標；重新開啟頁面會顯示點數門檻最低的有庫存獎品。</small>
                </div>
                <Link className="student-rewards__learn" to="/student/dashboard">繼續學習</Link>
            </section>}

            <section className="gamification-shop-section">
                <header><div><h2>挑選我的獎品</h2></div></header>
                {!redemptionAllowed && (
                    <div className="gamification-redemption-notice" role="status">
                        {data?.redemption_block_reason || "目前方案尚未開放兌換獎品。"}
                    </div>
                )}
                {loadError && <div className="student-rewards__error" role="status">獎品資料暫時無法更新，請重新讀取後再確認庫存與點數。<button type="button" onClick={load} disabled={loading}>重新讀取獎品</button></div>}
                {loading ? <div className="gamification-loading" role="status">獎品載入中…</div> : !data ? null : rewards.length === 0 ? (
                    <div className="gamification-empty">新獎品準備好後會出現在這裡。現在可以繼續學習、累積進步。</div>
                ) : (
                    <div className="gamification-reward-grid">
                        {rewards.map(reward => {
                            const enough = hasBalance && points >= Number(reward.points_cost || 0);
                            const inStock = Number(reward.stock_quantity || 0) > 0;
                            return (
                                <article className={`gamification-reward-card${goal?.id === reward.id ? " is-goal" : ""}`} key={reward.id}>
                                    <div className="gamification-reward-image">
                                        {reward.image_url ? <img src={reward.image_url} alt={reward.name} loading="lazy" /> : <FiGift aria-hidden="true" />}
                                        {!inStock && <span className="gamification-soldout">已兌換完</span>}
                                    </div>
                                    <div className="gamification-reward-copy">
                                        <span className="gamification-reward-stock">{reward.fulfillment_type === "digital" ? "數位獎品" : "實體獎品 · 每 30 天限兌換一次"} · 剩餘 {reward.stock_quantity} 份</span>
                                        <h3>{reward.name}</h3>
                                        <p>{reward.description || "完成學習任務累積點數，就可以把它帶回家。"}</p>
                                        <button className="student-rewards__choose-goal" type="button" aria-pressed={goal?.id === reward.id} aria-label={`設${reward.name}為我的目標`} disabled={!inStock} onClick={() => setGoalId(reward.id)}><FiTarget aria-hidden="true" />{goal?.id === reward.id ? "我的目標" : "設為目標"}</button>
                                        <div className="gamification-reward-bottom">
                                            <strong>{formatNumber(reward.points_cost)} P</strong>
                                            <button type="button" disabled={loadError || !redemptionAllowed || !enough || !inStock || Boolean(redeemingId)} onClick={() => handleRedeem(reward)}>
                                                {redeemingId === reward.id ? "兌換中…" : !redemptionAllowed ? "目前不可兌換" : !inStock ? "已兌換完" : !hasBalance ? "等待點數資料" : enough ? "我要兌換" : `還差 ${formatNumber(Number(reward.points_cost) - points)} P`}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="gamification-redemption-section" id="my-redemptions">
                <header><div><h2>我的兌換進度</h2></div></header>
                {loading ? <div className="gamification-loading">兌換紀錄載入中…</div> : !data ? <div className="gamification-empty">重新讀取成功後，這裡會顯示兌換紀錄。</div> : redemptions.length === 0 ? (
                    <div className="gamification-empty">還沒有兌換紀錄。申請兌換後，可以在這裡查看老師確認與領取進度。</div>
                ) : (
                    <div className="gamification-redemption-list">
                        {redemptions.map(item => (
                            <article key={item.id}>
                                <div className="gamification-redemption-icon"><FiPackage /></div>
                                <div><strong>{item.reward_name}</strong><span>{formatNumber(item.points_cost)} P</span></div>
                                <div className={`gamification-status status-${item.status}`}>{STATUS_LABELS[item.status] || item.status}</div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}

export default Rewards;
