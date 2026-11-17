import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import { getWordIslandClassOverview, getWordIslandReportBootstrap } from "../../services/wordIslandReportService";
import "./css/TeacherWordIsland.scss";

// 老師端「單字島進度」：選班級，看每位學生佔領幾塊、升級幾塊、現在在哪座島、多久沒玩。
// 沒有「存到帳號」的學生，進度只在他自己的裝置上，老師看不到，所以不會被當成「沒玩」。
const GRADE = { 1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六" };
const STATUS = {
    never: { label: "還沒玩", tone: "gray" },
    normal: { label: "正常", tone: "green" },
    warning: { label: "一週沒玩", tone: "amber" },
    concern: { label: "兩週沒玩", tone: "orange" },
    critical: { label: "超過一個月沒玩", tone: "red" }
};
const FILTERS = [
    { key: "all", label: "全部" },
    { key: "idle", label: "7 天以上沒玩" },
    { key: "never", label: "還沒玩" },
    { key: "review", label: "有待複習" },
    { key: "local", label: "沒存到帳號" }
];
const matchFilter = (student, key) => {
    if (key === "idle") return student.recorded_to_account && ["warning", "concern", "critical"].includes(student.status_code);
    if (key === "never") return student.recorded_to_account && student.status_code === "never";
    if (key === "review") return student.review_total > 0;
    if (key === "local") return !student.recorded_to_account;
    return true;
};
const dayText = days => (days === null || days === undefined ? "還沒練習" : days === 0 ? "今天" : days === 1 ? "昨天" : `${days} 天前`);
const currentText = current => {
    if (!current) return "還沒開始";
    const grade = `${GRADE[current.level] || current.level}年級`;
    return current.all_done ? `${grade}・全部佔領` : `${grade}・第 ${current.island} 座島 ${current.claimed}/${current.total}`;
};
const timeText = iso => {
    try {
        return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
    } catch {
        return "";
    }
};

export default function TeacherWordIsland() {
    const { firebaseUser } = useAuth();
    const [classes, setClasses] = useState(null);
    const [classCode, setClassCode] = useState("");
    const [overview, setOverview] = useState(null);
    const [filter, setFilter] = useState("all");
    const [sort, setSort] = useState("name");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let alive = true;
        getWordIslandReportBootstrap(firebaseUser)
            .then(result => {
                if (!alive) return;
                setClasses(result.classes || []);
                setClassCode(prev => prev || (result.classes || [])[0] || "");
            })
            .catch(reason => { if (alive) { setClasses([]); setError(reason?.message || "讀取失敗"); } });
        return () => { alive = false; };
    }, [firebaseUser]);

    const load = useCallback(async code => {
        if (!code) return;
        setLoading(true);
        setError("");
        try {
            setOverview(await getWordIslandClassOverview(firebaseUser, code));
        } catch (reason) {
            setOverview(null);
            setError(reason?.message || "讀取失敗");
        } finally {
            setLoading(false);
        }
    }, [firebaseUser]);

    useEffect(() => { if (classCode) load(classCode); }, [classCode, load]);

    const students = useMemo(() => {
        const list = (overview?.students || []).filter(student => matchFilter(student, filter));
        const sorted = [...list];
        if (sort === "claimed") sorted.sort((a, b) => b.claimed_total - a.claimed_total);
        else if (sort === "idle") sorted.sort((a, b) => (b.inactive_days ?? -1) - (a.inactive_days ?? -1));
        else sorted.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
        return sorted;
    }, [overview, filter, sort]);

    const totals = overview?.totals;
    return (
        <main className="twi-page">
            <header className="twi-hero">
                <div>
                    <span>WORD ISLAND</span>
                    <h1>單字島進度</h1>
                    <p>看班上每位學生在單字島佔領了幾塊、升級了幾塊，以及多久沒練習。</p>
                </div>
                <div className="twi-controls">
                    {classes && classes.length > 1 && (
                        <div className="twi-classes" role="group" aria-label="選擇班級">
                            {classes.map(code => (
                                <button key={code} type="button" className={code === classCode ? "is-active" : ""} aria-pressed={code === classCode} onClick={() => setClassCode(code)}>{code}</button>
                            ))}
                        </div>
                    )}
                    <button type="button" className="twi-refresh" onClick={() => load(classCode)} disabled={loading || !classCode}><FiRefreshCw aria-hidden="true" />重新整理</button>
                </div>
            </header>

            {error && <p className="twi-notice is-error" role="alert">{error}</p>}
            {classes && classes.length === 0 && !error && <p className="twi-notice" role="status">你目前沒有可以查看的班級。需要的話，請管理員幫你開班級權限。</p>}
            {loading && !overview && <p className="twi-notice" role="status">讀取中…</p>}

            {overview && (
                <>
                    <p className="twi-time">{overview.class_code} 班・資料時間 {timeText(overview.generated_at)}</p>
                    <ul className="twi-stats" aria-label="班級統計">
                        <li><strong>{totals.students}</strong><span>班上人數</span></li>
                        <li><strong>{totals.recorded}</strong><span>有存到帳號</span></li>
                        <li><strong>{totals.inactive_7_days}</strong><span>7 天以上沒玩</span></li>
                        <li><strong>{totals.never_played}</strong><span>還沒玩過</span></li>
                    </ul>

                    <div className="twi-toolbar">
                        <div className="twi-filters" role="group" aria-label="篩選">
                            {FILTERS.map(item => (
                                <button key={item.key} type="button" className={filter === item.key ? "is-active" : ""} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}</button>
                            ))}
                        </div>
                        <label className="twi-sort">排序
                            <select value={sort} onChange={event => setSort(event.target.value)}>
                                <option value="name">姓名</option>
                                <option value="claimed">佔領最多</option>
                                <option value="idle">最久沒玩</option>
                            </select>
                        </label>
                    </div>

                    {students.length === 0 ? (
                        <p className="twi-notice" role="status">這個篩選沒有學生。</p>
                    ) : (
                        <ul className="twi-list">
                            {students.map(student => {
                                const status = STATUS[student.status_code] || STATUS.never;
                                const shown = student.recorded_to_account ? status : { label: "進度沒存到帳號", tone: "gray" };
                                const percent = student.current && student.current.total ? Math.round((student.current.claimed / student.current.total) * 100) : 0;
                                return (
                                    <li key={student.student_id} className="twi-student">
                                        <div className="twi-student__head">
                                            <strong>{student.name}</strong>
                                            <span className={`twi-badge is-${shown.tone}`}>{shown.label}</span>
                                        </div>
                                        {!student.recorded_to_account ? (
                                            <p className="twi-local">這位學生的單字島進度只存在他自己的裝置上，老師看不到，不代表他沒有玩。</p>
                                        ) : (
                                            <>
                                                <div className="twi-student__now">
                                                    <span>目前：{currentText(student.current)}</span>
                                                    <div className="twi-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`${student.name}目前這座島的進度`}><i style={{ width: `${percent}%` }} /></div>
                                                </div>
                                                <dl className="twi-numbers">
                                                    <div><dt>佔領</dt><dd>{student.claimed_total} 塊</dd></div>
                                                    <div><dt>升級</dt><dd>{student.upgraded_total} 塊</dd></div>
                                                    <div><dt>待複習</dt><dd>{student.review_total} 字</dd></div>
                                                    <div><dt>最近練習</dt><dd>{dayText(student.inactive_days)}</dd></div>
                                                </dl>
                                                {student.per_level.some(item => item.claimed > 0) && (
                                                    <details className="twi-levels">
                                                        <summary>各年級進度</summary>
                                                        <ul>
                                                            {student.per_level.filter(item => item.claimed > 0).map(item => (
                                                                <li key={item.level}>{GRADE[item.level] || item.level}年級：佔領 {item.claimed} 塊、升級 {item.upgraded} 塊，{item.islands_full}/{item.islands_total} 座島佔滿{item.review_islands > 0 ? `，${item.review_islands} 座島想複習` : ""}</li>
                                                            ))}
                                                        </ul>
                                                    </details>
                                                )}
                                            </>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            )}
        </main>
    );
}
