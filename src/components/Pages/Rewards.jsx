import React, { useCallback, useEffect, useState } from "react";
import { FiGift, FiPackage, FiRefreshCw, FiStar } from "react-icons/fi";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { getRewards, redeemReward } from "../../services/gamificationService";
import "./css/Gamification.scss";

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

    const load = useCallback(async () => {
        if (!firebaseUser || !hasRewardsAccess) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            setData(await getRewards(firebaseUser));
        } catch (error) {
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

    if (!hasRewardsAccess) {
        return (
            <main className="gamification-page">
                <section className="gamification-hero gamification-hero--rewards">
                    <div>
                        <span className="gamification-eyebrow"><FiGift /> AE REWARDS</span>
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
        <main className="gamification-page">
            <section className="gamification-hero gamification-hero--rewards">
                <div>
                    <span className="gamification-eyebrow"><FiGift /> AE REWARDS</span>
                    <h1>獎品商城</h1>
                    <p>完成聽力、作業與遊戲可以拿到 AE Points。點數可以兌換獎品，XP 與排行榜名次不會被扣掉。</p>
                </div>
                <button className="gamification-refresh" type="button" onClick={load} disabled={loading}>
                    <FiRefreshCw className={loading ? "is-spinning" : ""} />更新
                </button>
            </section>

            <section className="gamification-balance-grid">
                <article><span><FiStar /> LEVEL</span><strong>Lv.{balance.level || 1}</strong><small>下一級 {formatNumber(balance.next_level_xp)} XP</small></article>
                <article><span>TOTAL XP</span><strong>{formatNumber(balance.total_xp)} XP</strong><small>XP 永久累積</small></article>
                <article className="is-points"><span>AE POINTS</span><strong>{formatNumber(balance.points_balance)} P</strong><small>可以拿來兌換獎品</small></article>
            </section>

            <section className="gamification-shop-section">
                <header><div><span>REWARD SHOP</span><h2>選一個想努力得到的獎品</h2></div></header>
                {!redemptionAllowed && (
                    <div className="gamification-redemption-notice" role="status">
                        {data?.redemption_block_reason || "目前方案尚未開放兌換獎品。"}
                    </div>
                )}
                {loading ? <div className="gamification-loading">獎品載入中…</div> : rewards.length === 0 ? (
                    <div className="gamification-empty">目前還沒有上架獎品。</div>
                ) : (
                    <div className="gamification-reward-grid">
                        {rewards.map(reward => {
                            const enough = Number(balance.points_balance || 0) >= Number(reward.points_cost || 0);
                            const inStock = Number(reward.stock_quantity || 0) > 0;
                            return (
                                <article className="gamification-reward-card" key={reward.id}>
                                    <div className="gamification-reward-image">
                                        {reward.image_url ? <img src={reward.image_url} alt={reward.name} /> : <FiGift />}
                                        {!inStock && <span className="gamification-soldout">已兌換完</span>}
                                    </div>
                                    <div className="gamification-reward-copy">
                                        <span className="gamification-reward-stock">{reward.fulfillment_type === "digital" ? "數位獎品" : "實體獎品 · 每 30 天限兌換一次"} · 剩餘 {reward.stock_quantity} 份</span>
                                        <h3>{reward.name}</h3>
                                        <p>{reward.description || "完成學習任務累積點數，就可以把它帶回家。"}</p>
                                        <div className="gamification-reward-bottom">
                                            <strong>{formatNumber(reward.points_cost)} P</strong>
                                            <button type="button" disabled={!redemptionAllowed || !enough || !inStock || redeemingId === reward.id} onClick={() => handleRedeem(reward)}>
                                                {redeemingId === reward.id ? "兌換中…" : !redemptionAllowed ? "正式方案可兌換" : !inStock ? "已兌換完" : enough ? "我要兌換" : `還差 ${formatNumber(Number(reward.points_cost) - Number(balance.points_balance || 0))} P`}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="gamification-redemption-section">
                <header><div><span>MY REDEMPTIONS</span><h2>我的兌換進度</h2></div></header>
                {redemptions.length === 0 ? (
                    <div className="gamification-empty">還沒有兌換紀錄。</div>
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
