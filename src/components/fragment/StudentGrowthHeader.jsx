import React, { useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Link } from "react-router-dom";
import { FiAward } from "react-icons/fi";

const available = value => value != null && value !== "" && Number.isFinite(Number(value));
const number = value => Number(value).toLocaleString("zh-TW");
const compact = value => new Intl.NumberFormat("zh-TW", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value));
const taipeiDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function StudentGrowthHeader({ summary, loading = false, error, pointsAccess = false, onRetry }) {
    const [detail, setDetail] = useState("");
    const [today, setToday] = useState(taipeiDate);
    const balance = summary?.balance;
    const birthday = summary?.birthday;
    const hasLevel = available(balance?.level);
    const hasPoints = available(balance?.points_balance);
    const hasXp = available(balance?.total_xp);
    const remaining = hasXp && available(balance?.next_level_xp)
        ? Math.max(0, Number(balance.next_level_xp) - Number(balance.total_xp)) : null;
    const progress = available(balance?.progress_percent)
        ? Math.min(100, Math.max(0, Number(balance.progress_percent))) : null;
    const boosted = !error && birthday?.enabled && birthday.is_birthday_month
        && birthday.evaluated_on === today && birthday.xp_multiplier === 2;
    const status = error ? "尚未更新" : loading ? "讀取中" : "尚未讀取";
    const pointsLabel = pointsAccess ? "可用 AE Points" : "保留的 AE Points";

    // Expired daily confirmation must disappear even when the shell stays open overnight.
    useEffect(() => {
        if (!birthday) return undefined;
        const updateDate = () => setToday(taipeiDate());
        updateDate();
        const timer = window.setInterval(updateDate, 60000);
        window.addEventListener("focus", updateDate);
        return () => { window.clearInterval(timer); window.removeEventListener("focus", updateDate); };
    }, [birthday]);

    return <>
        <div className="ae-growth-header" aria-label="我的等級與點數" aria-busy={loading}>
            <button type="button" className="ae-growth-header__level" aria-label="查看成長詳情" onClick={() => setDetail("growth")}>
                <span className="ae-growth-header__mark" aria-hidden="true"><FiAward /></span>
                <span className="ae-growth-header__copy">
                    <span className="ae-growth-header__heading"><strong>{hasLevel ? `Lv.${compact(balance.level)}` : "—"}</strong>{boosted && <span className="ae-growth-header__boost">XP ×2</span>}</span>
                    {progress != null && <progress value={progress} max="100" aria-label="目前等級成長進度" />}
                    <small>{error || remaining == null ? status : <><span className="ae-growth-header__remaining">再 {compact(remaining)} XP 升級</span><span className="ae-growth-header__short">差 {compact(remaining)} XP</span></>}</small>
                </span>
            </button>
            <button type="button" className="ae-growth-header__points" aria-label={`查看點數詳情，${pointsLabel}${hasPoints ? ` ${number(balance.points_balance)} 點` : ` ${status}`}`} onClick={() => setDetail("points")}>
                <span className="ae-growth-header__coin" aria-hidden="true">A</span>
                <span><strong>{hasPoints ? compact(balance.points_balance) : "—"}</strong><small>AE Points</small></span>
            </button>
        </div>
        <Modal show={Boolean(detail)} onHide={() => setDetail("")} centered className="ae-growth-detail" aria-labelledby="growth-detail-title">
            <Modal.Header closeButton closeLabel="關閉詳情"><Modal.Title id="growth-detail-title">{detail === "points" ? pointsLabel : "我的成長"}</Modal.Title></Modal.Header>
            <Modal.Body>
                {detail === "points" ? <>
                    <p className="ae-growth-detail__value">{hasPoints ? `${number(balance.points_balance)} AE Points` : "點數尚未讀取"}</p>
                    <p>{pointsAccess ? "兌換使用點數，累積 XP 會保留。" : "目前無兌換資格，既有點數與 XP 保留。"}</p>
                    {pointsAccess && <Link to="/student/rewards" onClick={() => setDetail("")}>查看獎品與兌換紀錄</Link>}
                </> : <>
                    <p className="ae-growth-detail__value">{hasLevel ? `Lv.${number(balance.level)}` : "等級尚未讀取"}</p>
                    <p>累積經驗：{hasXp ? `${number(balance.total_xp)} XP` : "尚未讀取"}</p>
                    {remaining != null && <p>距離下一級還差 {number(remaining)} XP。</p>}
                    {boosted && <p>生日月有效學習 XP ×2，至 {birthday.ends_on}。AE Points 維持原獎勵規則。</p>}
                </>}
                {(error || (!balance && !loading)) && <div role="status">{balance ? "暫時無法更新，這裡顯示上次讀取的資料。" : "暫時無法讀取成長資料。"}{onRetry && <button type="button" onClick={onRetry} disabled={loading}>重新讀取成長</button>}</div>}
                {loading && <p role="status">正在讀取成長資料…</p>}
                <Link to="/student/settings" onClick={() => setDetail("")}>前往我的設定</Link>
            </Modal.Body>
        </Modal>
    </>;
}
