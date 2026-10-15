import React, { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { loadDepartedStudentActivity } from "../../services/academyStudentService";
import "./css/DepartedActivitySummary.scss";

const formatDate = value => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("zh-TW");
};

const STATS = [
    ["total_departed", "離校生總數"],
    ["returned_after_departure", "離校後回來登入過"],
    ["never_returned", "離校後沒再登入"],
    ["logged_in_last_30_days", "近 30 天有登入"],
    ["logged_in_last_90_days", "近 90 天有登入"]
];

export default function DepartedActivitySummary() {
    const { firebaseUser } = useAuth();
    const [report, setReport] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        if (!firebaseUser) return undefined;
        loadDepartedStudentActivity(firebaseUser)
            .then(result => { if (!cancelled) setReport(result); })
            .catch(reason => { if (!cancelled) setError(reason?.message || "目前無法讀取離校生統計"); });
        return () => { cancelled = true; };
    }, [firebaseUser]);

    if (error) return <section className="departed-activity" role="alert"><p>{error}</p></section>;
    if (!report) return <section className="departed-activity"><p>讀取離校生統計中…</p></section>;

    const { summary, students = [] } = report;
    if (!summary?.total_departed) {
        return <section className="departed-activity"><h2>離校生回訪統計</h2><p>目前還沒有離校生。有學生離校後，這裡會顯示他們有沒有回來登入。</p></section>;
    }

    return (
        <section className="departed-activity">
            <h2>離校生回訪統計</h2>
            <p className="departed-activity__hint">用來判斷離校生有沒有回來看，可作為是否推出 NT$299 基本會員的參考。</p>
            <ul className="departed-activity__stats">
                {STATS.map(([key, label]) => <li key={key}><strong>{summary[key] ?? 0}</strong><span>{label}</span></li>)}
            </ul>
            {students.length > 0 && (
                <table className="commerce-table">
                    <thead><tr><th>學生</th><th>原班級</th><th>離校日</th><th>最近登入</th><th>狀態</th></tr></thead>
                    <tbody>
                        {students.map(student => (
                            <tr key={student.id}>
                                <td>{student.display_name}</td>
                                <td>{student.class_code || "—"}</td>
                                <td>{formatDate(student.departed_on)}</td>
                                <td>{formatDate(student.last_login_at)}</td>
                                <td>{student.returned ? "離校後有回來" : "尚未回來"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}
