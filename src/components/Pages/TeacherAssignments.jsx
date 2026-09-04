import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    BookOpenCheck,
    CheckCircle2,
    Headphones,
    Target,
    Trash2
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
    createAssignment,
    createAssignmentV2,
    deleteAssignment,
    getAssignmentResults,
    getTeacherAssignmentBootstrap,
    getTeacherAssignments,
    previewAssignmentV2,
    upsertPageLearningContent
} from "../../services/assignmentService";
import {
    groupSelectedTracks,
    mergeTrackIds,
    removeTrackIds
} from "./assignmentTrackSelection";
import "./css/Assignments.scss";

const todayTaiwan = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
}).format(new Date());

const formatDateTime = value => {
    if (!value) return "";
    return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
};

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
    if (assignment.source_type === "multi_activity_v2") {
        return "混合作業 V2 · " + (assignment.total_tasks || 0) + " 個活動";
    }
    if (assignment.source_type === "mission_pack") {
        return "完整任務包 · " + (assignment.track_count || 1) + " 檔";
    }
    if (assignment.source_type === "ai_material") return "AI 測驗";
    return "聽力 · " + (assignment.track_count || 1) + " 檔";
};

const resultSummary = (assignment, row) => {
    if (assignment.source_type === "multi_activity_v2") {
        return (row.task_completed_count || 0) + " / " + (row.total_tasks || 0) + " 個活動";
    }
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
    const [tracks, setTracks] = useState([]);
    const [classMaterials, setClassMaterials] = useState([]);
    const [pageContent, setPageContent] = useState([]);
    const [aiMaterials, setAiMaterials] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [message, setMessage] = useState("");
    const [results, setResults] = useState(null);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [bookId, setBookId] = useState("");
    const [trackIds, setTrackIds] = useState([]);
    const [rangeStart, setRangeStart] = useState("");
    const [rangeEnd, setRangeEnd] = useState("");
    const [mixedMode, setMixedMode] = useState(false);
    const [includeAiQuiz, setIncludeAiQuiz] = useState(false);
    const [includePronunciation, setIncludePronunciation] = useState(false);
    const [sourceBookId, setSourceBookId] = useState("");
    const [selectedPageContentIds, setSelectedPageContentIds] = useState([]);
    const [selectedAiMaterialId, setSelectedAiMaterialId] = useState("");
    const [selectedPromptKeys, setSelectedPromptKeys] = useState([]);
    const [preview, setPreview] = useState(null);
    const [savingSource, setSavingSource] = useState(false);
    const [sourceForm, setSourceForm] = useState({
        page_label: "",
        source_text: "",
        pronunciation_prompts: ""
    });
    const [form, setForm] = useState({
        title: "",
        description: "",
        source_type: "music_track",
        target_class: "",
        assigned_date: todayTaiwan(),
        due_date: todayTaiwan(),
        required_listens: 3
    });

    const books = useMemo(() => {
        const map = new Map();
        tracks.forEach(track => {
            if (track.book) map.set(String(track.book.id), track.book);
        });
        const target = classMaterials.find(item => item.class_code === form.target_class);
        const allowedIds = new Set((target?.books || []).map(book => String(book.id)));
        return Array.from(map.values()).filter(book => !form.target_class || allowedIds.has(String(book.id)));
    }, [classMaterials, form.target_class, tracks]);

    const visibleTracks = useMemo(
        () => tracks.filter(track => String(track.book_id) === String(bookId)),
        [tracks, bookId]
    );

    const latestPageContent = useMemo(() => {
        const latest = new Map();
        pageContent.forEach(item => {
            const key = String(item.book_id) + ":" + String(item.page_label);
            const current = latest.get(key);
            if (!current || Number(item.version || 0) > Number(current.version || 0)) latest.set(key, item);
        });
        return Array.from(latest.values());
    }, [pageContent]);

    const visiblePageContent = useMemo(
        () => latestPageContent.filter(item => String(item.book_id) === String(sourceBookId)),
        [latestPageContent, sourceBookId]
    );

    const selectedPageContent = useMemo(
        () => latestPageContent.filter(item => selectedPageContentIds.includes(item.id)),
        [latestPageContent, selectedPageContentIds]
    );

    const availablePrompts = useMemo(() => selectedPageContent.flatMap(item => (
        (item.pronunciation_prompts || []).map(prompt => ({
            key: String(item.id) + ":" + prompt,
            page_label: item.page_label,
            prompt
        }))
    )), [selectedPageContent]);

    const selectedTrackGroups = useMemo(
        () => groupSelectedTracks(tracks, trackIds),
        [tracks, trackIds]
    );

    const selectedTrackIdsByBook = useMemo(() => {
        const counts = new Map();
        selectedTrackGroups.forEach(group => {
            counts.set(String(group.book.id), group.tracks.length);
        });
        return counts;
    }, [selectedTrackGroups]);

    const currentBookSelectedCount = selectedTrackIdsByBook.get(String(bookId)) || 0;

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
            setTracks(bootstrap.tracks || []);
            setClassMaterials(bootstrap.class_materials || []);
            setPageContent(bootstrap.page_content || []);
            setAiMaterials(bootstrap.ai_materials || []);
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

    const togglePageContent = id => {
        setSelectedPageContentIds(current => (
            current.includes(id) ? current.filter(item => item !== id) : [...current, id]
        ));
    };

    const togglePrompt = key => {
        setSelectedPromptKeys(current => (
            current.includes(key) ? current.filter(item => item !== key) : [...current, key]
        ));
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

        setTrackIds(current => mergeTrackIds(current, selectedIds));
        setMessage(
            "已加入 "
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

        if (!form.title.trim()) {
            setMessage("請輸入作業名稱");
            return;
        }
        if (!mixedMode && !trackIds.length) {
            setMessage("請至少選擇一個聽力音檔");
            return;
        }

        const selectedTrackGroupsForV2 = groupSelectedTracks(tracks, trackIds);
        if (mixedMode && trackIds.length && selectedTrackGroupsForV2.length > 1) {
            setMessage("混合作業 V2 的聽力活動目前一次請選擇同一本教材；可拆成兩份作業發布。");
            return;
        }
        if (mixedMode && (includeAiQuiz || includePronunciation) && !selectedPageContentIds.length) {
            setMessage("AI 或發音活動必須先選擇已發布的教材頁面來源。");
            return;
        }
        if (mixedMode && includeAiQuiz && !selectedAiMaterialId) {
            setMessage("請選擇你已檢閱的 AI 題組。");
            return;
        }
        if (mixedMode && includePronunciation && !selectedPromptKeys.length) {
            setMessage("請至少選擇一個已核准的發音提示句。");
            return;
        }

        setSaving(true);
        setMessage("");
        try {
            const basePayload = {
                title: form.title.trim(),
                description: form.description.trim(),
                target_class: form.target_class || null,
                assigned_date: form.assigned_date,
                due_at: form.due_date
                    ? new Date(form.due_date + "T23:59:00+08:00").toISOString()
                    : null
            };
            if (mixedMode) {
                const listeningGroup = selectedTrackGroupsForV2[0];
                const items = [];
                if (listeningGroup?.tracks?.length) {
                    items.push({
                        item_type: "listening",
                        book_id: listeningGroup.book.id,
                        track_ids: listeningGroup.tracks.map(track => track.id),
                        required_listens: Number(form.required_listens) || 3
                    });
                }
                if (includeAiQuiz) {
                    items.push({
                        item_type: "ai_quiz",
                        book_id: Number(sourceBookId),
                        page_content_ids: selectedPageContentIds,
                        ai_material_id: Number(selectedAiMaterialId),
                        passing_score: 80
                    });
                }
                if (includePronunciation) {
                    items.push({
                        item_type: "pronunciation",
                        book_id: Number(sourceBookId),
                        page_content_ids: selectedPageContentIds,
                        prompt_keys: selectedPromptKeys,
                        completion_mode: "practice",
                        max_scored_attempts: 3
                    });
                }
                const created = await createAssignmentV2(firebaseUser, { ...basePayload, items });
                setMessage("混合作業已發布，共 " + (created.preview?.total_items || items.length) + " 個活動。");
            } else {
                await createAssignment(firebaseUser, {
                    ...basePayload,
                    source_type: "music_track",
                    track_ids: trackIds,
                    required_listens: Number(form.required_listens) || 3
                });
                setMessage("聽力作業已發布，共 " + trackIds.length + " 個音檔。");
            }

            setForm(current => ({
                ...current,
                title: "",
                description: ""
            }));
            setTrackIds([]);
            setBookId("");
            setRangeStart("");
            setRangeEnd("");
            setSelectedPageContentIds([]);
            setSelectedPromptKeys([]);
            setSelectedAiMaterialId("");
            setPreview(null);
            await load();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSaving(false);
        }
    };

    const previewMixedAssignment = async () => {
        const selectedTrackGroupsForV2 = groupSelectedTracks(tracks, trackIds);
        if (!form.title.trim() || !form.target_class) {
            setMessage("請先填寫作業名稱與班級，才能預覽。");
            return;
        }
        if (selectedTrackGroupsForV2.length > 1) {
            setMessage("混合作業 V2 的聽力活動目前一次請選擇同一本教材。");
            return;
        }
        const items = [];
        if (selectedTrackGroupsForV2[0]?.tracks?.length) {
            items.push({
                item_type: "listening",
                book_id: selectedTrackGroupsForV2[0].book.id,
                track_ids: selectedTrackGroupsForV2[0].tracks.map(track => track.id),
                required_listens: Number(form.required_listens) || 3
            });
        }
        if (includeAiQuiz) items.push({
            item_type: "ai_quiz", book_id: Number(sourceBookId),
            page_content_ids: selectedPageContentIds, ai_material_id: Number(selectedAiMaterialId), passing_score: 80
        });
        if (includePronunciation) items.push({
            item_type: "pronunciation", book_id: Number(sourceBookId),
            page_content_ids: selectedPageContentIds, prompt_keys: selectedPromptKeys,
            completion_mode: "practice", max_scored_attempts: 3
        });
        if (!items.length) {
            setMessage("請至少加入一個活動後再預覽。");
            return;
        }
        setSaving(true);
        setMessage("");
        try {
            const response = await previewAssignmentV2(firebaseUser, {
                title: form.title.trim(), description: form.description.trim(),
                target_class: form.target_class, assigned_date: form.assigned_date,
                due_at: form.due_date ? new Date(form.due_date + "T23:59:00+08:00").toISOString() : null,
                items
            });
            setPreview(response.preview || null);
            setMessage("已完成唯讀預覽，確認後再發布作業。");
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSaving(false);
        }
    };

    const savePageSource = async status => {
        if (!form.target_class || !sourceBookId || !sourceForm.page_label.trim()) {
            setMessage("請先選擇作業班級、教材並填寫頁碼或單元標籤。");
            return;
        }
        setSavingSource(true);
        setMessage("");
        try {
            await upsertPageLearningContent(firebaseUser, {
                target_class: form.target_class,
                book_id: Number(sourceBookId),
                page_label: sourceForm.page_label,
                source_text: sourceForm.source_text,
                pronunciation_prompts: sourceForm.pronunciation_prompts.split("\n"),
                status
            });
            setSourceForm({ page_label: "", source_text: "", pronunciation_prompts: "" });
            setMessage(status === "published" ? "頁面來源已發布，可加入 AI 或發音作業。" : "頁面來源草稿已儲存。");
            await load();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSavingSource(false);
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

    const handleDelete = async assignment => {
        const confirmed = window.confirm(
            `確定要刪除「${assignment.title}」嗎？刪除後學生將不再看到這份作業，既有進度紀錄會保留。`
        );
        if (!confirmed) return;

        setDeletingId(assignment.id);
        setMessage("");
        try {
            await deleteAssignment(firebaseUser, assignment.id);
            setAssignments(current => current.filter(item => item.id !== assignment.id));
            setResults(null);
            setMessage(`已刪除「${assignment.title}」。`);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setDeletingId(null);
        }
    };

    const taskCount = mixedMode
        ? Number(trackIds.length > 0) + Number(includeAiQuiz) + Number(includePronunciation)
        : 1;

    return (
        <main className="assignment-page teacher-assignment-page">
            <section className="assignment-hero">
                <div>
                    <span>TEACHER MISSION BUILDER</span>
                    <h1>發布班級學習作業</h1>
                    <p>可維持純聽力作業，或用混合作業 V2 組合聽力、共用 AI 題組與發音練習。</p>
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
                        <p>在校英文班學生已包含 AI 與發音練習；V2 會將教師核准的共用題組與發音提示一併發布。</p>
                    </div>

                    <div className="assignment-source-tabs" aria-label="作業模式">
                        <button type="button" className={!mixedMode ? "active" : ""} onClick={() => setMixedMode(false)}>
                            純聽力作業
                        </button>
                        <button type="button" className={mixedMode ? "active" : ""} onClick={() => setMixedMode(true)}>
                            混合作業 V2
                        </button>
                    </div>

                    {!mixedMode && <div className="assignment-listening-only-note">
                        <Headphones aria-hidden="true" size={21} />
                        <span>
                            <strong>聽力練習</strong>
                            <small>指定教材音檔與次數，維持現有學生作業流程。</small>
                        </span>
                    </div>}

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
                                placeholder="例如：請完成 Workbook 1 P22～P32，每個音檔聆聽 3 次。"
                            />
                        </label>
                        <label>
                            <span>發布班級</span>
                            <select
                                value={form.target_class}
                                onChange={event => {
                                    updateForm("target_class", event.target.value);
                                    setBookId("");
                                    setSourceBookId("");
                                    setTrackIds([]);
                                    setSelectedPageContentIds([]);
                                    setSelectedPromptKeys([]);
                                }}
                            >
                                <option value="">請先選擇班級</option>
                                {classes.map(className => <option key={className} value={className}>{className} 班</option>)}
                            </select>
                        </label>
                    </div>

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
                                    <span>新增或切換教材</span>
                                    <select
                                        value={bookId}
                                        onChange={event => {
                                            setBookId(event.target.value);
                                            setRangeStart("");
                                            setRangeEnd("");
                                        }}
                                    >
                                        <option value="">請選擇教材...</option>
                                        {books.map(book => (
                                            <option key={book.id} value={book.id}>
                                                {book.name}
                                                {selectedTrackIdsByBook.get(String(book.id))
                                                    ? "（已選 " + selectedTrackIdsByBook.get(String(book.id)) + "）"
                                                    : ""}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                {trackIds.length > 0 && (
                                    <section className="assignment-selected-tracks" aria-label="已選聽力內容">
                                        <div className="assignment-selected-tracks__heading">
                                            <div>
                                                <strong>已選聽力內容</strong>
                                                <span>
                                                    {selectedTrackGroups.length} 本教材 · {trackIds.length} 個音檔
                                                </span>
                                            </div>
                                            <button type="button" onClick={() => setTrackIds([])}>全部清除</button>
                                        </div>
                                        <div className="assignment-selected-tracks__groups">
                                            {selectedTrackGroups.map(group => (
                                                <article key={group.book.id}>
                                                    <div>
                                                        <strong>{group.book.name}</strong>
                                                        <span>{group.tracks.length} 個音檔</span>
                                                    </div>
                                                    <p>
                                                        {group.tracks.map(track => (
                                                            <span key={track.id}>{track.display_page || track.page}</span>
                                                        ))}
                                                    </p>
                                                    <div className="assignment-selected-tracks__actions">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setBookId(String(group.book.id));
                                                                setRangeStart("");
                                                                setRangeEnd("");
                                                            }}
                                                        >
                                                            繼續選擇
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setTrackIds(current => removeTrackIds(
                                                                current,
                                                                group.tracks.map(track => track.id)
                                                            ))}
                                                        >
                                                            移除此教材
                                                        </button>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    </section>
                                )}

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
                                            <strong>
                                                選擇音檔（此教材已選 {currentBookSelectedCount}，全部 {trackIds.length}）
                                            </strong>
                                            <div>
                                                <button
                                                    type="button"
                                                    onClick={() => setTrackIds(current => mergeTrackIds(
                                                        current,
                                                        visibleTracks.map(track => track.id)
                                                    ))}
                                                >
                                                    全選此教材
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setTrackIds(current => removeTrackIds(
                                                        current,
                                                        visibleTracks.map(track => track.id)
                                                    ))}
                                                >
                                                    清除此教材
                                                </button>
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

                    {mixedMode && <div className="assignment-form-section assignment-form-section--mixed">
                        <div className="assignment-form-section__heading">
                            <span>3</span>
                            <div>
                                <strong>AI 與發音活動</strong>
                                <small>先建立老師核對過的頁面文字，再選擇要加入的活動。</small>
                            </div>
                            <BookOpenCheck aria-hidden="true" size={19} />
                        </div>

                        <div className="assignment-listening-only-note">
                            <label><input type="checkbox" checked={includeAiQuiz} onChange={event => setIncludeAiQuiz(event.target.checked)} /> 加入共用 AI 選擇題</label>
                            <label><input type="checkbox" checked={includePronunciation} onChange={event => setIncludePronunciation(event.target.checked)} /> 加入發音練習</label>
                        </div>

                        {(includeAiQuiz || includePronunciation) && <div className="assignment-track-picker">
                            <label>
                                <span>教材頁面來源</span>
                                <select value={sourceBookId} onChange={event => {
                                    setSourceBookId(event.target.value);
                                    setSelectedPageContentIds([]);
                                    setSelectedPromptKeys([]);
                                }}>
                                    <option value="">請先選擇班級後，再選擇教材</option>
                                    {books.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}
                                </select>
                            </label>

                            {sourceBookId && <section className="assignment-selected-tracks" aria-label="教材頁面來源管理">
                                <div className="assignment-selected-tracks__heading">
                                    <div><strong>已發布的頁面來源</strong><span>只有含老師核准文字的頁面可加入 AI／發音活動</span></div>
                                </div>
                                {visiblePageContent.length ? visiblePageContent.map(item => (
                                    <label key={item.id} className={selectedPageContentIds.includes(item.id) ? "selected" : ""}>
                                        <input type="checkbox" disabled={item.status !== "published"} checked={selectedPageContentIds.includes(item.id)} onChange={() => togglePageContent(item.id)} />
                                        <strong>{item.page_label}</strong> · {item.status === "published" ? "已發布" : "草稿"}
                                        {item.pronunciation_prompts?.length ? ` · ${item.pronunciation_prompts.length} 句發音` : ""}
                                    </label>
                                )) : <p>尚未建立頁面來源，請在下方新增。</p>}
                            </section>}

                            <div className="assignment-form-grid">
                                <label><span>頁碼／Unit 標籤</span><input value={sourceForm.page_label} onChange={event => setSourceForm(current => ({ ...current, page_label: event.target.value }))} placeholder="例如：P22 或 Unit 3" /></label>
                                <label><span>發音提示句（每行一句）</span><textarea rows="3" value={sourceForm.pronunciation_prompts} onChange={event => setSourceForm(current => ({ ...current, pronunciation_prompts: event.target.value }))} placeholder="I can read.&#10;Can you help me?" /></label>
                            </div>
                            <label><span>老師核對過的教材文字</span><textarea rows="5" value={sourceForm.source_text} onChange={event => setSourceForm(current => ({ ...current, source_text: event.target.value }))} placeholder="請輸入可供 AI 出題與教師核對的教材文字；只有頁碼不足以生成題目。" /></label>
                            <div className="assignment-selected-tracks__actions">
                                <button type="button" disabled={savingSource} onClick={() => savePageSource("draft")}>{savingSource ? "儲存中..." : "儲存草稿"}</button>
                                <button type="button" disabled={savingSource} onClick={() => savePageSource("published")}>核對後發布頁面來源</button>
                            </div>

                            {includeAiQuiz && <label>
                                <span>共用 AI 題組（學生不會重新生成，也不消耗個人額度）</span>
                                <select value={selectedAiMaterialId} onChange={event => setSelectedAiMaterialId(event.target.value)}>
                                    <option value="">請選擇你已檢閱的 AI 教材</option>
                                    {aiMaterials.filter(item => item.question_count_verified > 0).map(item => (
                                        <option key={item.id} value={item.id}>{item.title} · {item.question_count_verified} 題</option>
                                    ))}
                                </select>
                            </label>}

                            {includePronunciation && <section className="assignment-selected-tracks" aria-label="發音提示句">
                                <div className="assignment-selected-tracks__heading"><div><strong>選擇發音提示句</strong><span>每句最多計分 3 次，原始錄音不會保存。</span></div></div>
                                {availablePrompts.length ? availablePrompts.map(item => <label key={item.key} className={selectedPromptKeys.includes(item.key) ? "selected" : ""}><input type="checkbox" checked={selectedPromptKeys.includes(item.key)} onChange={() => togglePrompt(item.key)} /> <strong>{item.page_label}</strong> · {item.prompt}</label>) : <p>請先勾選有發音提示句的已發布頁面來源。</p>}
                            </section>}
                        </div>}
                    </div>}

                    <div className="assignment-form-section assignment-form-section--rules">
                        <div className="assignment-form-section__heading">
                            <span>{mixedMode ? 4 : taskCount + 2}</span>
                            <div>
                                <strong>完成標準與發布範圍</strong>
                                <small>設定班級、日期與每項任務的要求</small>
                            </div>
                            <Target aria-hidden="true" size={19} />
                        </div>

                        <div className="assignment-form-grid">
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
                                <small>{trackIds.length} 個音檔{mixedMode ? ` · ${selectedPageContentIds.length} 個頁面來源` : ""}</small>
                            </span>
                        </div>
                        <div className="assignment-history-buttons">
                            {mixedMode && <button className="assignment-primary" type="button" disabled={saving || loading} onClick={previewMixedAssignment}>先預覽</button>}
                            <button className="assignment-primary" type="submit" disabled={saving || loading || (mixedMode && taskCount === 0)}>
                                {saving ? "處理中..." : mixedMode ? "確認發布混合作業" : "發布作業"}
                            </button>
                        </div>
                    </div>

                    {mixedMode && preview && <section className="assignment-selected-tracks" aria-label="混合作業發布預覽">
                        <div className="assignment-selected-tracks__heading"><div><strong>發布預覽</strong><span>{preview.target_class} 班 · {preview.total_items} 個活動</span></div></div>
                        {(preview.items || []).map(item => <p key={item.sort_order}>{item.sort_order + 1}. {item.item_type === "listening" ? `聽力 ${item.track_count} 檔，每檔 ${item.config?.required_listens} 次` : item.item_type === "ai_quiz" ? `AI 選擇題 ${item.question_count} 題` : `發音練習 ${item.pronunciation_prompt_count} 句`}</p>)}
                    </section>}
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
                                        <div className="assignment-history-buttons">
                                            <button type="button" onClick={() => openResults(assignment)}>
                                                查看進度
                                            </button>
                                            <button
                                                type="button"
                                                className="assignment-delete"
                                                onClick={() => handleDelete(assignment)}
                                                disabled={deletingId === assignment.id}
                                            >
                                                <Trash2 aria-hidden="true" size={15} />
                                                {deletingId === assignment.id ? "刪除中..." : "刪除功課"}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="assignment-empty">
                            <BookOpenCheck aria-hidden="true" size={28} />
                            <strong>尚未發布作業</strong>
                            <span>建立第一份課後聽力作業吧。</span>
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
                            {(results.rows || []).map(row => {
                                const latestAttempt = row.latest_attempt;
                                const wrongQuestions = latestAttempt?.wrong_questions || [];

                                return (
                                    <div className="assignment-result-entry" key={row.student.id}>
                                        <div className="assignment-result-row">
                                            <span>{row.student.name}</span>
                                            <span>{row.student.class || "—"}</span>
                                            <span>{resultSummary(results.assignment, row)}</span>
                                            <span>{row.completed ? "✅ 已完成" : "⏳ 未完成"}</span>
                                        </div>

                                        {latestAttempt && (
                                            <details className={
                                                "assignment-wrong-review "
                                                + (wrongQuestions.length ? "has-wrong" : "perfect")
                                            }>
                                                <summary>
                                                    <span>
                                                        最近一次 {latestAttempt.score} 分
                                                        {latestAttempt.attempted_at
                                                            ? " · " + formatDateTime(latestAttempt.attempted_at)
                                                            : ""}
                                                    </span>
                                                    <strong>
                                                        {wrongQuestions.length
                                                            ? "查看 " + wrongQuestions.length + " 題錯題"
                                                            : "本次沒有錯題"}
                                                    </strong>
                                                </summary>

                                                {wrongQuestions.length > 0 && (
                                                    <div className="assignment-wrong-list">
                                                        {wrongQuestions.map((question, index) => (
                                                            <article key={`${row.student.id}-${question.index}-${index}`}>
                                                                <span>Q{Number(question.index || 0) + 1}</span>
                                                                <div>
                                                                    <strong>{question.question || "題目內容"}</strong>
                                                                    <p className="student-answer">
                                                                        學生答案：{question.selected_answer || "未作答"}
                                                                    </p>
                                                                    <p className="correct-answer">
                                                                        正確答案：{question.correct_answer || "—"}
                                                                    </p>
                                                                    {question.explanation && (
                                                                        <small>{question.explanation}</small>
                                                                    )}
                                                                </div>
                                                            </article>
                                                        ))}
                                                    </div>
                                                )}
                                            </details>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}
        </main>
    );
};

export default TeacherAssignments;
