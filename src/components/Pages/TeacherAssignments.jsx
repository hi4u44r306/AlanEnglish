import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    BookOpenCheck,
    CheckCircle2,
    Headphones,
    Layers3,
    Sparkles,
    Target
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
    createAssignment,
    getAssignmentResults,
    getTeacherAssignmentBootstrap,
    getTeacherAssignments
} from "../../services/assignmentService";
import "./css/Assignments.scss";

const todayTaiwan = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
}).format(new Date());

const includesAi = sourceType => (
    sourceType === "ai_material" || sourceType === "mission_pack"
);

const includesListening = sourceType => (
    sourceType === "music_track" || sourceType === "mission_pack"
);

const parseTrackLabel = value => {
    const text = String(value || "").trim();
    const unit = text.match(/Unit\s*(\d+)/i);
    if (unit) return { type: "Unit", number: Number(unit[1]) };
    const track = text.match(/Track\s*(\d+)/i);
    if (track) return { type: "Track", number: Number(track[1]) };
    const page = text.match(/P\s*(\d+)/i);
    if (page) return { type: "P", number: Number(page[1]) };
    const number = text.match(/(\d+)/);
    return number
        ? { type: "Track", number: Number(number[1]) }
        : null;
};

const sourceLabel = assignment => {
    if (assignment.source_type === "mission_pack") {
        return "完整任務包 · " + (assignment.track_count || 1) + " 檔";
    }
    if (assignment.source_type === "ai_material") return "AI 測驗";
    return "聽力 · " + (assignment.track_count || 1) + " 檔";
};

const resultSummary = (assignment, row) => {
    if (assignment.source_type === "mission_pack") {
        return (
            (row.task_completed_count || 0)
            + " / "
            + (row.total_tasks || 2)
            + " 任務 · AI "
            + (row.best_score || 0)
            + " 分 · 聽力 "
            + (row.completed_count || 0)
            + "/"
            + (row.total_tracks || 0)
        );
    }
    if (assignment.source_type === "ai_material") {
        return (row.best_score || 0) + " 分 · " + (row.attempt_count || 0) + " 次";
    }
    return (row.completed_count || 0) + " / " + (row.total_tracks || 0) + " 個音檔";
};

const TeacherAssignments = () => {
    const { firebaseUser } = useAuth();
    const [classes, setClasses] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [tracks, setTracks] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [results, setResults] = useState(null);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [bookId, setBookId] = useState("");
    const [trackIds, setTrackIds] = useState([]);
    const [rangeStart, setRangeStart] = useState("");
    const [rangeEnd, setRangeEnd] = useState("");
    const [form, setForm] = useState({
        title: "",
        description: "",
        source_type: "mission_pack",
        source_id: "",
        target_class: "",
        assigned_date: todayTaiwan(),
        due_date: todayTaiwan(),
        passing_score: 90,
        required_listens: 3
    });

    const books = useMemo(() => {
        const map = new Map();
        tracks.forEach(track => {
            if (track.book) map.set(String(track.book.id), track.book);
        });
        return Array.from(map.values());
    }, [tracks]);

    const visibleTracks = useMemo(
        () => tracks.filter(track => String(track.book_id) === String(bookId)),
        [tracks, bookId]
    );

    const rangeType = useMemo(() => {
        const counts = { P: 0, Unit: 0, Track: 0 };
        visibleTracks.forEach(track => {
            const parsed = parseTrackLabel(track.display_page || track.page);
            if (parsed) counts[parsed.type] = (counts[parsed.type] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return sorted[0]?.[1] ? sorted[0][0] : "Track";
    }, [visibleTracks]);

    const load = useCallback(async () => {
        if (!firebaseUser) return;
        setLoading(true);
        try {
            const [bootstrap, list] = await Promise.all([
                getTeacherAssignmentBootstrap(firebaseUser),
                getTeacherAssignments(firebaseUser)
            ]);
            setClasses(bootstrap.classes || []);
            setMaterials(bootstrap.materials || []);
            setTracks(bootstrap.tracks || []);
            setAssignments(list.assignments || []);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    }, [firebaseUser]);

    useEffect(() => {
        load();
    }, [load]);

    const updateForm = (field, value) => {
        setForm(current => ({ ...current, [field]: value }));
    };

    const changeType = sourceType => {
        updateForm("source_type", sourceType);
        setMessage("");
    };

    const toggleTrack = id => {
        setTrackIds(current => (
            current.includes(id)
                ? current.filter(trackId => trackId !== id)
                : [...current, id]
        ));
    };

    const chooseRange = () => {
        const start = Number(rangeStart);
        const end = Number(rangeEnd);
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            setMessage("請輸入起始與結束編號");
            return;
        }

        const min = Math.min(start, end);
        const max = Math.max(start, end);
        const selectedIds = visibleTracks
            .filter(track => {
                const parsed = parseTrackLabel(track.display_page || track.page);
                return (
                    parsed
                    && parsed.type === rangeType
                    && parsed.number >= min
                    && parsed.number <= max
                );
            })
            .map(track => track.id);

        if (!selectedIds.length) {
            setMessage(
                "找不到 "
                + rangeType
                + " "
                + min
                + "～"
                + rangeType
                + " "
                + max
                + " 音檔"
            );
            return;
        }

        setTrackIds(selectedIds);
        setMessage(
            "已選取 "
            + rangeType
            + " "
            + min
            + "～"
            + rangeType
            + " "
            + max
            + "，共 "
            + selectedIds.length
            + " 個音檔。"
        );
    };

    const submit = async event => {
        event.preventDefault();
        const hasAi = includesAi(form.source_type);
        const hasListening = includesListening(form.source_type);

        if (!form.title.trim()) {
            setMessage("請輸入作業名稱");
            return;
        }
        if (hasAi && !form.source_id) {
            setMessage("請選擇 AI 教材");
            return;
        }
        if (hasListening && !trackIds.length) {
            setMessage("請至少選擇一個聽力音檔");
            return;
        }

        setSaving(true);
        setMessage("");
        try {
            await createAssignment(firebaseUser, {
                title: form.title.trim(),
                description: form.description.trim(),
                source_type: form.source_type,
                ai_material_id: hasAi ? Number(form.source_id) : null,
                track_ids: hasListening ? trackIds : [],
                required_listens: Number(form.required_listens) || 3,
                target_class: form.target_class || null,
                assigned_date: form.assigned_date,
                due_at: form.due_date
                    ? new Date(form.due_date + "T23:59:00+08:00").toISOString()
                    : null,
                passing_score: Number(form.passing_score) || 90
            });

            if (form.source_type === "mission_pack") {
                setMessage(
                    "完整任務包已發布："
                    + trackIds.length
                    + " 個音檔＋1 份 AI 測驗。"
                );
            } else if (form.source_type === "music_track") {
                setMessage("聽力作業已發布，共 " + trackIds.length + " 個音檔。");
            } else {
                setMessage("AI 測驗作業已發布。");
            }

            setForm(current => ({
                ...current,
                title: "",
                description: "",
                source_id: ""
            }));
            setTrackIds([]);
            setBookId("");
            setRangeStart("");
            setRangeEnd("");
            await load();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSaving(false);
        }
    };

    const openResults = async assignment => {
        setResultsLoading(true);
        setResults(null);
        try {
            setResults(await getAssignmentResults(firebaseUser, assignment.id));
            window.setTimeout(() => {
                document.getElementById("assignment-results")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }, 80);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setResultsLoading(false);
        }
    };

    const hasAi = includesAi(form.source_type);
    const hasListening = includesListening(form.source_type);
    const taskCount = Number(hasAi) + Number(hasListening);

    return (
        <main className="assignment-page teacher-assignment-page">
            <section className="assignment-hero">
                <div>
                    <span>TEACHER MISSION BUILDER</span>
                    <h1>發布課後任務包</h1>
                    <p>一次安排聽力、AI 教材與選擇題；學生必須完成所有步驟才算交作業。</p>
                </div>
                <div className="assignment-date-card">
                    <strong>{todayTaiwan()}</strong>
                    <span>台灣日期</span>
                </div>
            </section>

            {message && <div className="assignment-message">{message}</div>}

            <section className="assignment-layout">
                <form className="assignment-card assignment-form" onSubmit={submit}>
                    <div className="assignment-card-heading">
                        <span>NEW MISSION</span>
                        <h2>建立新的學習任務</h2>
                        <p>建議使用完整任務包，讓學生先聽、再讀、最後完成測驗。</p>
                    </div>

                    <div className="assignment-source-tabs assignment-source-tabs--cards">
                        <button
                            type="button"
                            className={form.source_type === "mission_pack" ? "active" : ""}
                            onClick={() => changeType("mission_pack")}
                        >
                            <Layers3 aria-hidden="true" size={21} />
                            <span>
                                <strong>完整任務包</strong>
                                <small>聽力＋AI 測驗</small>
                            </span>
                            <em>推薦</em>
                        </button>
                        <button
                            type="button"
                            className={form.source_type === "ai_material" ? "active" : ""}
                            onClick={() => changeType("ai_material")}
                        >
                            <Sparkles aria-hidden="true" size={21} />
                            <span>
                                <strong>AI 測驗</strong>
                                <small>閱讀＋選擇題</small>
                            </span>
                        </button>
                        <button
                            type="button"
                            className={form.source_type === "music_track" ? "active" : ""}
                            onClick={() => changeType("music_track")}
                        >
                            <Headphones aria-hidden="true" size={21} />
                            <span>
                                <strong>聽力練習</strong>
                                <small>指定教材音檔</small>
                            </span>
                        </button>
                    </div>

                    <div className="assignment-form-section">
                        <div className="assignment-form-section__heading">
                            <span>1</span>
                            <div>
                                <strong>作業基本資料</strong>
                                <small>學生會先看到名稱與說明</small>
                            </div>
                        </div>
                        <label>
                            <span>作業名稱</span>
                            <input
                                value={form.title}
                                onChange={event => updateForm("title", event.target.value)}
                                placeholder="例如：Workbook 1 P22～P32 課後任務"
                            />
                        </label>
                        <label>
                            <span>作業說明（選填）</span>
                            <textarea
                                rows="3"
                                value={form.description}
                                onChange={event => updateForm("description", event.target.value)}
                                placeholder="例如：先完成指定音檔，再閱讀 AI 教材並挑戰 90 分。"
                            />
                        </label>
                    </div>

                    {hasListening && (
                        <div className="assignment-form-section assignment-form-section--listening">
                            <div className="assignment-form-section__heading">
                                <span>2</span>
                                <div>
                                    <strong>聽力任務</strong>
                                    <small>每個指定音檔都必須聽滿次數</small>
                                </div>
                                <Headphones aria-hidden="true" size={19} />
                            </div>

                            <div className="assignment-track-picker">
                                <label>
                                    <span>選擇教材</span>
                                    <select
                                        value={bookId}
                                        onChange={event => {
                                            setBookId(event.target.value);
                                            setTrackIds([]);
                                            setRangeStart("");
                                            setRangeEnd("");
                                        }}
                                    >
                                        <option value="">請選擇教材...</option>
                                        {books.map(book => (
                                            <option key={book.id} value={book.id}>{book.name}</option>
                                        ))}
                                    </select>
                                </label>

                                {bookId && (
                                    <>
                                        <div className="assignment-range">
                                            <strong>快速選擇{rangeType === "P" ? "頁碼" : "音檔"}範圍</strong>
                                            <div>
                                                <span>{rangeType}</span>
                                                <input
                                                    type="number"
                                                    value={rangeStart}
                                                    onChange={event => setRangeStart(event.target.value)}
                                                    placeholder="1"
                                                />
                                                <span>～ {rangeType}</span>
                                                <input
                                                    type="number"
                                                    value={rangeEnd}
                                                    onChange={event => setRangeEnd(event.target.value)}
                                                    placeholder="3"
                                                />
                                                <button type="button" onClick={chooseRange}>選取範圍</button>
                                            </div>
                                        </div>

                                        <div className="assignment-track-toolbar">
                                            <strong>選擇音檔（已選 {trackIds.length}）</strong>
                                            <div>
                                                <button
                                                    type="button"
                                                    onClick={() => setTrackIds(visibleTracks.map(track => track.id))}
                                                >
                                                    全選
                                                </button>
                                                <button type="button" onClick={() => setTrackIds([])}>清除</button>
                                            </div>
                                        </div>

                                        <div className="assignment-track-list">
                                            {visibleTracks.map(track => (
                                                <label
                                                    key={track.id}
                                                    className={trackIds.includes(track.id) ? "selected" : ""}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={trackIds.includes(track.id)}
                                                        onChange={() => toggleTrack(track.id)}
                                                    />
                                                    <span>{track.display_page || track.page}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {hasAi && (
                        <div className="assignment-form-section assignment-form-section--ai">
                            <div className="assignment-form-section__heading">
                                <span>{hasListening ? "3" : "2"}</span>
                                <div>
                                    <strong>AI 教材與選擇題</strong>
                                    <small>提交前不顯示答案，達標才完成</small>
                                </div>
                                <Sparkles aria-hidden="true" size={19} />
                            </div>
                            <label>
                                <span>選擇我的 AI 教材</span>
                                <select
                                    value={form.source_id}
                                    onChange={event => updateForm("source_id", event.target.value)}
                                >
                                    <option value="">請選擇...</option>
                                    {materials.map(material => (
                                        <option key={material.id} value={material.id}>
                                            {material.title}
                                            {material.difficulty ? " · " + material.difficulty : ""}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div className="assignment-ai-helper">
                                <span>
                                    {materials.length
                                        ? "找不到適合教材？可以先建立一份新的 AI 練習。"
                                        : "目前還沒有可發布的 AI 教材。"}
                                </span>
                                <Link to="/student/ai-generator">前往 AI 教材產生器</Link>
                            </div>
                        </div>
                    )}

                    <div className="assignment-form-section assignment-form-section--rules">
                        <div className="assignment-form-section__heading">
                            <span>{taskCount + 2}</span>
                            <div>
                                <strong>完成標準與發布範圍</strong>
                                <small>設定班級、日期與每項任務的要求</small>
                            </div>
                            <Target aria-hidden="true" size={19} />
                        </div>

                        <div className="assignment-form-grid">
                            <label>
                                <span>班級</span>
                                <select
                                    value={form.target_class}
                                    onChange={event => updateForm("target_class", event.target.value)}
                                >
                                    <option value="">全部學生</option>
                                    {classes.map(className => (
                                        <option key={className} value={className}>
                                            {className} 班
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {hasListening && (
                                <label>
                                    <span>每個音檔需聽</span>
                                    <select
                                        value={form.required_listens}
                                        onChange={event => updateForm("required_listens", event.target.value)}
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 10].map(number => (
                                            <option key={number} value={number}>{number} 次</option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            {hasAi && (
                                <label>
                                    <span>測驗及格標準</span>
                                    <select
                                        value={form.passing_score}
                                        onChange={event => updateForm("passing_score", event.target.value)}
                                    >
                                        <option value="90">90 分</option>
                                        <option value="80">80 分</option>
                                        <option value="100">100 分</option>
                                    </select>
                                </label>
                            )}

                            <label>
                                <span>發布日期</span>
                                <input
                                    type="date"
                                    value={form.assigned_date}
                                    onChange={event => updateForm("assigned_date", event.target.value)}
                                />
                            </label>

                            <label>
                                <span>截止日期</span>
                                <input
                                    type="date"
                                    value={form.due_date}
                                    onChange={event => updateForm("due_date", event.target.value)}
                                />
                            </label>
                        </div>
                    </div>

                    <div className="assignment-publish-summary">
                        <div>
                            <CheckCircle2 aria-hidden="true" size={21} />
                            <span>
                                <strong>{taskCount} 個完成條件</strong>
                                <small>
                                    {hasListening && (trackIds.length + " 個音檔")}
                                    {hasListening && hasAi && " ＋ "}
                                    {hasAi && ("AI 測驗 " + form.passing_score + " 分")}
                                </small>
                            </span>
                        </div>
                        <button
                            className="assignment-primary"
                            type="submit"
                            disabled={saving || loading}
                        >
                            {saving ? "發布中..." : "發布任務包"}
                        </button>
                    </div>
                </form>

                <section className="assignment-card assignment-history">
                    <div className="assignment-card-heading">
                        <span>HISTORY</span>
                        <h2>已發布作業</h2>
                        <p>查看學生完成狀況與各步驟進度。</p>
                    </div>

                    {loading ? (
                        <div className="assignment-empty">載入中...</div>
                    ) : assignments.length ? (
                        <div className="assignment-list">
                            {assignments.map(assignment => (
                                <article key={assignment.id}>
                                    <div>
                                        <strong>{assignment.title}</strong>
                                        <span>
                                            {assignment.target_class
                                                ? assignment.target_class + " 班"
                                                : "全部學生"}
                                            {" · "}
                                            {assignment.assigned_date}
                                        </span>
                                    </div>
                                    <div className="assignment-history-actions">
                                        <span className={"assignment-kind " + assignment.source_type}>
                                            {sourceLabel(assignment)}
                                        </span>
                                        <button type="button" onClick={() => openResults(assignment)}>
                                            查看進度
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="assignment-empty">
                            <BookOpenCheck aria-hidden="true" size={28} />
                            <strong>尚未發布作業</strong>
                            <span>建立第一份課後任務包吧。</span>
                        </div>
                    )}
                </section>
            </section>

            {(results || resultsLoading) && (
                <section
                    className="assignment-card assignment-results"
                    id="assignment-results"
                >
                    <div className="assignment-card-heading">
                        <span>RESULTS</span>
                        <h2>{resultsLoading ? "載入中..." : results.assignment?.title}</h2>
                    </div>

                    {!resultsLoading && (
                        <div className="assignment-result-table">
                            <div className="assignment-result-row header">
                                <span>學生</span>
                                <span>班級</span>
                                <span>成績 / 進度</span>
                                <span>狀態</span>
                            </div>
                            {(results.rows || []).map(row => (
                                <div className="assignment-result-row" key={row.student.id}>
                                    <span>{row.student.name}</span>
                                    <span>{row.student.class || "—"}</span>
                                    <span>{resultSummary(results.assignment, row)}</span>
                                    <span>{row.completed ? "✅ 已完成" : "⏳ 未完成"}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </main>
    );
};

export default TeacherAssignments;
