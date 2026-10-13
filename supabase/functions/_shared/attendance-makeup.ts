export const ATTENDANCE_STATUSES = new Set(["present", "late", "absent", "leave"]);
// 缺席與請假的學生才需要補課。
export const ABSENT_STATUSES = new Set(["absent", "leave"]);

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

// Accepts a single YouTube video link in any common form and returns the canonical watch URL.
// Playlists and other hosts are rejected so a makeup button can only open a known video.
export const normalizeYouTubeUrl = (value: unknown) => {
    let parsed: URL;
    try {
        parsed = new URL(String(value ?? "").trim());
    } catch {
        return "";
    }
    if (parsed.protocol !== "https:") return "";
    const host = parsed.hostname.replace(/^(www|m)\./, "");
    let id = "";
    if (host === "youtu.be") id = parsed.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com") {
        const [, kind, segment] = parsed.pathname.split("/");
        if (kind === "watch") id = parsed.searchParams.get("v") || "";
        else if (kind === "embed" || kind === "shorts" || kind === "live") id = segment || "";
    }
    return YOUTUBE_ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : "";
};

export const normalizeSeconds = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 86400 ? parsed : null;
};

export const isValidSessionDate = (value: string, today: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value && value <= today;
};

// Start of the class day in Taiwan; listening before this does not count as makeup.
export const sessionStartIso = (sessionDate: string) => new Date(`${sessionDate}T00:00:00+08:00`).toISOString();

const ITEM_COLUMNS = "id,session_id,item_type,sort_order,title,book_id,video_segment_id,video_url,start_seconds,end_seconds,track_id,assignment_id";

export const loadActiveItems = async (admin: any, sessionIds: number[]) => {
    if (!sessionIds.length) return [];
    const { data, error } = await admin.from("class_session_progress_items")
        .select(ITEM_COLUMNS).in("session_id", sessionIds).eq("is_active", true)
        .order("sort_order").order("id");
    if (error) throw error;
    return data || [];
};

// Which (item, student) pairs are finished, and which items the student may tick by hand.
// Videos are self-reported; listening and listening homework reuse the records that
// record-play already validated, so nothing here trusts a browser-reported completion.
export const loadCompletion = async (admin: any, items: any[], sessionDates: Map<number, string>, studentIds: number[]) => {
    const done = new Set<string>();
    const selfMarkable = new Set<number>();
    if (!items.length || !studentIds.length) return { done, selfMarkable };

    const assignmentIds = [...new Set(items.filter(item => item.item_type === "assignment" && item.assignment_id).map(item => Number(item.assignment_id)))];
    const trackIds = [...new Set(items.filter(item => item.item_type === "listening" && item.track_id).map(item => Number(item.track_id)))];
    const earliest = [...sessionDates.values()].sort()[0];

    const [selfRes, listenRes, assignmentTrackRes, assignmentProgressRes] = await Promise.all([
        admin.from("makeup_item_completions").select("progress_item_id,student_id")
            .in("progress_item_id", items.map(item => item.id)).in("student_id", studentIds),
        trackIds.length
            ? admin.from("listening_coverage_sessions").select("student_id,track_id,completed_at")
                .in("track_id", trackIds).in("student_id", studentIds).eq("count_recorded", true)
                .gte("completed_at", sessionStartIso(earliest)).limit(5000)
            : Promise.resolve({ data: [], error: null }),
        assignmentIds.length
            ? admin.from("assignment_track_items").select("assignment_id,track_id").in("assignment_id", assignmentIds)
            : Promise.resolve({ data: [], error: null }),
        assignmentIds.length
            ? admin.from("assignment_listening_progress").select("assignment_id,student_id,track_id")
                .in("assignment_id", assignmentIds).in("student_id", studentIds).eq("completed", true)
            : Promise.resolve({ data: [], error: null })
    ]);
    for (const res of [selfRes, listenRes, assignmentTrackRes, assignmentProgressRes]) if (res.error) throw res.error;

    const selfDone = new Set((selfRes.data || []).map((row: any) => `${row.progress_item_id}:${row.student_id}`));
    const assignmentTrackCount = new Map<number, number>();
    for (const row of assignmentTrackRes.data || []) {
        assignmentTrackCount.set(Number(row.assignment_id), (assignmentTrackCount.get(Number(row.assignment_id)) || 0) + 1);
    }
    const assignmentDoneCount = new Map<string, number>();
    for (const row of assignmentProgressRes.data || []) {
        const key = `${row.assignment_id}:${row.student_id}`;
        assignmentDoneCount.set(key, (assignmentDoneCount.get(key) || 0) + 1);
    }

    for (const item of items) {
        const sessionStart = Date.parse(sessionStartIso(sessionDates.get(Number(item.session_id)) || earliest));
        const requiredTracks = item.item_type === "assignment" ? assignmentTrackCount.get(Number(item.assignment_id)) || 0 : 0;
        if (item.item_type === "video" || (item.item_type === "assignment" && requiredTracks === 0)) selfMarkable.add(Number(item.id));
        for (const studentId of studentIds) {
            const key = `${item.id}:${studentId}`;
            if (selfMarkable.has(Number(item.id))) {
                if (selfDone.has(key)) done.add(key);
            } else if (item.item_type === "listening") {
                const listened = (listenRes.data || []).some((row: any) => (
                    Number(row.student_id) === studentId
                    && Number(row.track_id) === Number(item.track_id)
                    && Date.parse(row.completed_at) >= sessionStart
                ));
                if (listened) done.add(key);
            } else if ((assignmentDoneCount.get(`${item.assignment_id}:${studentId}`) || 0) >= requiredTracks) {
                done.add(key);
            }
        }
    }
    return { done, selfMarkable };
};

export type MakeupSummary = Array<{
    date: string;
    status: string;
    items: Array<{ item_type: string; title: string; done: boolean }>;
    total: number;
    done: number;
}>;

// One student's missed classes between two dates (inclusive), with what was taught and
// how much of the makeup is finished. Used by the weekly report that parents read.
export const loadStudentMakeupSummary = async (admin: any, studentId: number, fromDate: string, toDate: string): Promise<MakeupSummary> => {
    const { data, error } = await admin.from("class_session_attendance")
        .select("status,class_sessions!inner(id,session_date)")
        .eq("student_id", studentId).in("status", [...ABSENT_STATUSES])
        .gte("class_sessions.session_date", fromDate).lte("class_sessions.session_date", toDate);
    if (error) throw error;
    const missed = (data || []).map((row: any) => {
        const session = Array.isArray(row.class_sessions) ? row.class_sessions[0] : row.class_sessions;
        return { id: Number(session.id), date: String(session.session_date), status: String(row.status) };
    }).sort((a: any, b: any) => a.date.localeCompare(b.date));
    if (!missed.length) return [];

    const items = await loadActiveItems(admin, missed.map((session: any) => session.id));
    const { done } = await loadCompletion(admin, items, new Map(missed.map((session: any) => [session.id, session.date])), [studentId]);
    return missed.map((session: any) => {
        const sessionItems = items.filter((item: any) => Number(item.session_id) === session.id)
            .map((item: any) => ({ item_type: item.item_type, title: item.title, done: done.has(`${item.id}:${studentId}`) }));
        return {
            date: session.date,
            status: session.status,
            items: sessionItems,
            total: sessionItems.length,
            done: sessionItems.filter((item: any) => item.done).length
        };
    });
};

const MAKEUP_TYPE_LABEL: Record<string, string> = { video: "影片", listening: "聽力", assignment: "作業" };

// Plain-text lines for the parent message; empty when the student missed nothing.
export const describeMakeupForFamily = (summary: MakeupSummary) => summary.map(session => {
    const [, month, day] = session.date.split("-");
    const label = `${Number(month)}/${Number(day)}（${session.status === "leave" ? "請假" : "缺席"}）`;
    if (!session.total) return `${label}：老師尚未登記當天的上課內容。`;
    const content = session.items.map(item => `${MAKEUP_TYPE_LABEL[item.item_type] || "內容"}「${item.title}」`).join("、");
    const progress = session.done >= session.total ? "補課已全部完成" : `補課完成 ${session.done}／${session.total} 項`;
    return `${label}上課內容：${content}。${progress}。`;
});
