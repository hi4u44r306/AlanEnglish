import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { getLeaderboard } from "../../services/learningProgressService";
import "./css/Platform.scss";

const PERIODS = [{ value: "week", label: "本週" }, { value: "month", label: "本月" }, { value: "all", label: "累積" }];

function LearningLeaderboard() {
    const { firebaseUser } = useAuth();
    const [period, setPeriod] = useState("week");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!firebaseUser) return;
        setLoading(true);
        try { setData(await getLeaderboard(firebaseUser, period)); }
        catch (error) { toast.error(error.message || "排行榜讀取失敗"); }
        finally { setLoading(false); }
    }, [firebaseUser, period]);

    useEffect(() => { load(); }, [load]);

    return <main className="platform-page"><header className="platform-hero"><div><span className="platform-eyebrow">LEADERBOARD</span><h1>學習排行榜</h1><p>聽力 1 點、完成作業 10 點、AI 教材及格 5 點、複習答對 2 點、會話練習 2 點。</p></div><div className="platform-segment">{PERIODS.map(item => <button className={period === item.value ? "active" : ""} key={item.value} onClick={() => setPeriod(item.value)}>{item.label}</button>)}</div></header>{loading ? <div className="platform-loading">排行榜載入中…</div> : <section className="platform-ranking">{(data?.leaderboard || []).length === 0 ? <div className="platform-empty">這個期間還沒有學習紀錄。</div> : data.leaderboard.map((row, index) => <article className={row.is_current_user ? "is-me" : ""} key={`${row.student_id}-${index}`}><div className={`platform-rank rank-${index + 1}`}>{index < 3 ? ["🥇", "🥈", "🥉"][index] : index + 1}</div><div><strong>{row.student_name}</strong><span>{row.class ? `${row.class} 班` : "Alan English"}{row.is_current_user ? " · 你" : ""}</span></div><strong>{Number(row.points || row.total_points || 0).toLocaleString()} 點</strong></article>)}</section>}</main>;
}

export default LearningLeaderboard;
