import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";
import {
    ABSENT_STATUSES,
    ATTENDANCE_STATUSES,
    isValidSessionDate,
    normalizeSeconds,
    normalizeYouTubeUrl,
    sessionStartIso
} from "../_shared/attendance-makeup.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});

const fail = (status: number, message: string, code: string | null = null) => (
    Object.assign(new Error(message), { status, code, expose: true })
);

const CLASS_CODES = new Set(["E1", "E3", "E5", "E7"]);
const MAX_ITEMS_PER_SESSION = 30;
const MAKEUP_WINDOW_DAYS = 60;

const taiwanDate = (offsetDays = 0) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
}).format(new Date(Date.now() + offsetDays * 86400000));

const cleanText = (value: unknown, maxLength: number) => String(value ?? "").trim().slice(0, maxLength);

const positiveInteger = (value: unknown) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const joined = (value: any) => Array.isArray(value) ? value[0] : value;

const getManagedClassCodes = async (admin: any, caller: any) => {
    if (caller.role === "admin") return [...CLASS_CODES];
    if (caller.role !== "teacher") return [];
    const today = taiwanDate();
    const { data, error } = await admin.from("teacher_class_permissions")
        .select("can_publish,starts_at,ends_at,academy_classes(code)")
        .eq("teacher_id", caller.id).eq("can_publish", true).lte("starts_at", today)
        .or(`ends_at.is.null,ends_at.gte.${today}`);
    if (error) throw error;
    return (data || []).map((row: any) => joined(row.academy_classes)?.code)
        .filter((code: string) => CLASS_CODES.has(code));
};

const getClass = async (admin: any, classCode: string) => {
    const { data, error } = await admin.from("academy_classes").select("id,code,name_zh")
        .eq("code", classCode).eq("is_active", true).maybeSingle();
    if (error) throw error;
    return data || null;
};

const getClassBooks = async (admin: any, classId: number) => {
    const today = taiwanDate();
    const { data, error } = await admin.from("academy_class_material_settings")
        .select("id,academy_class_material_books(book_id,books(id,name,code))")
        .eq("class_id", classId).eq("is_active", true).lte("effective_from", today)
        .or(`effective_to.is.null,effective_to.gte.${today}`).order("version", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return (data?.academy_class_material_books || [])
        .map((row: any) => joined(row.books)).filter(Boolean);
};

const getRoster = async (admin: any, classId: number) => {
    const today = taiwanDate();
    const { data, error } = await admin.from("academy_enrollments")
        .select("student_id,scheduled_departure_at,students(id,name,chinese_name,english_name,role,account_status)")
        .eq("class_id", classId).eq("status", "active");
    if (error) throw error;
    return (data || [])
        .filter((row: any) => !row.scheduled_departure_at || row.scheduled_departure_at > today)
        .map((row: any) => joined(row.students))
        .filter((student: any) => student?.role === "student" && (!student.account_status || student.account_status === "active"))
        .map((student: any) => ({
            id: Number(student.id),
            name: student.chinese_name || student.name || student.english_name || "學生",
            english_name: student.english_name || null
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name, "zh-Hant"));
};

const getActiveStudentClass = async (admin: any, studentId: number) => {
    const today = taiwanDate();
    const { data, error } = await admin.from("academy_enrollments")
        .select("class_id,scheduled_departure_at,academy_classes(code)")
        .eq("student_id", studentId).eq("status", "active").limit(1).maybeSingle();
    if (error) throw error;
    const code = joined(data?.academy_classes)?.code;
    return data && CLASS_CODES.has(code) && (!data.scheduled_departure_at || data.scheduled_departure_at > today)
        ? { id: Number(data.class_id), code }
        : null;
};

const requireManagedClass = async (admin: any, caller: any, classCodeInput: unknown) => {
    if (caller.role !== "teacher" && caller.role !== "admin") throw fail(403, "只有老師與管理員可以點名");
    const classCode = cleanText(classCodeInput, 4).toUpperCase();
    if (!CLASS_CODES.has(classCode)) throw fail(400, "請選擇 E1、E3、E5 或 E7");
    const managed = await getManagedClassCodes(admin, caller);
    if (!managed.includes(classCode)) throw fail(403, "你沒有這個班級的權限");
    const klass = await getClass(admin, classCode);
    if (!klass) throw fail(404, "找不到班級");
    return klass;
};

const ITEM_COLUMNS = "id,session_id,item_type,sort_order,title,book_id,video_segment_id,video_url,start_seconds,end_seconds,track_id,assignment_id";

const loadActiveItems = async (admin: any, sessionIds: number[]) => {
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
const loadCompletion = async (admin: any, items: any[], sessionDates: Map<number, string>, studentIds: number[]) => {
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

const loadClassOptions = async (admin: any, klass: any) => {
    const books = await getClassBooks(admin, Number(klass.id));
    const bookIds = books.map((book: any) => Number(book.id));
    const [trackRes, segmentRes, assignmentRes] = await Promise.all([
        bookIds.length
            ? admin.from("music_tracks").select("id,book_id,title,music_name,page,display_page,sort_order")
                .in("book_id", bookIds).eq("enabled", true).order("book_id").order("sort_order").limit(2000)
            : Promise.resolve({ data: [], error: null }),
        bookIds.length
            ? admin.from("book_video_segments").select("id,book_id,title,page_from,page_to,video_url,start_seconds,end_seconds")
                .in("book_id", bookIds).eq("is_active", true).order("book_id").order("page_from").order("start_seconds")
            : Promise.resolve({ data: [], error: null }),
        admin.from("assignments").select("id,title,assigned_date,due_at,schema_version")
            .eq("target_class", klass.code).eq("enabled", true)
            .order("assigned_date", { ascending: false }).order("created_at", { ascending: false }).limit(30)
    ]);
    for (const res of [trackRes, segmentRes, assignmentRes]) if (res.error) throw res.error;
    return {
        books,
        tracks: (trackRes.data || []).map((track: any) => ({
            id: Number(track.id),
            book_id: Number(track.book_id),
            title: track.title || track.music_name || `音檔 ${track.id}`,
            page: track.display_page || track.page || null
        })),
        video_segments: segmentRes.data || [],
        assignments: assignmentRes.data || []
    };
};

const loadSessionView = async (admin: any, klass: any, sessionDate: string) => {
    const roster = await getRoster(admin, Number(klass.id));
    const { data: session, error } = await admin.from("class_sessions")
        .select("id,session_date,note,updated_at").eq("class_id", klass.id).eq("session_date", sessionDate).maybeSingle();
    if (error) throw error;
    if (!session) return { roster, session: null, attendance: [], items: [], makeup: [] };

    const [attendanceRes, items] = await Promise.all([
        admin.from("class_session_attendance").select("student_id,status").eq("session_id", session.id),
        loadActiveItems(admin, [Number(session.id)])
    ]);
    if (attendanceRes.error) throw attendanceRes.error;
    const attendance = attendanceRes.data || [];
    const absentIds = attendance.filter((row: any) => ABSENT_STATUSES.has(row.status)).map((row: any) => Number(row.student_id));
    const { done } = await loadCompletion(admin, items, new Map([[Number(session.id), session.session_date]]), absentIds);
    return {
        roster,
        session,
        attendance,
        items,
        makeup: absentIds.map((studentId: number) => ({
            student_id: studentId,
            total: items.length,
            done: items.filter((item: any) => done.has(`${item.id}:${studentId}`)).length
        }))
    };
};

// Rebuilds every item from server-side records; only ids, titles and manual video times come from the browser.
const buildItems = async (admin: any, klass: any, rawItems: unknown) => {
    const list = Array.isArray(rawItems) ? rawItems : [];
    if (list.length > MAX_ITEMS_PER_SESSION) throw fail(400, `一堂課最多 ${MAX_ITEMS_PER_SESSION} 個進度項目`);
    const options = await loadClassOptions(admin, klass);
    const bookIds = new Set(options.books.map((book: any) => Number(book.id)));
    const tracks = new Map(options.tracks.map((track: any) => [track.id, track]));
    const segments = new Map(options.video_segments.map((segment: any) => [Number(segment.id), segment]));
    const assignments = new Map(options.assignments.map((assignment: any) => [Number(assignment.id), assignment]));

    return list.map((raw: any, index: number) => {
        const type = cleanText(raw?.item_type, 20);
        const base = { id: positiveInteger(raw?.id) || null, item_type: type, sort_order: index };
        if (type === "video") {
            const segment = segments.get(positiveInteger(raw?.video_segment_id));
            if (segment) {
                return {
                    ...base, title: segment.title, book_id: Number(segment.book_id), video_segment_id: Number(segment.id),
                    video_url: segment.video_url, start_seconds: segment.start_seconds, end_seconds: segment.end_seconds,
                    track_id: null, assignment_id: null
                };
            }
            const videoUrl = normalizeYouTubeUrl(raw?.video_url);
            const start = normalizeSeconds(raw?.start_seconds) ?? 0;
            const end = normalizeSeconds(raw?.end_seconds);
            const bookId = positiveInteger(raw?.book_id);
            if (!videoUrl) throw fail(400, "影片請貼上單支 YouTube 影片網址");
            if (end !== null && end <= start) throw fail(400, "影片結束時間要晚於開始時間");
            if (bookId && !bookIds.has(bookId)) throw fail(400, "影片的教材不屬於這個班級");
            return {
                ...base, title: cleanText(raw?.title, 160) || "習作本影片", book_id: bookId || null, video_segment_id: null,
                video_url: videoUrl, start_seconds: start, end_seconds: end, track_id: null, assignment_id: null
            };
        }
        if (type === "listening") {
            const track = tracks.get(positiveInteger(raw?.track_id));
            if (!track) throw fail(400, "聽力音檔不屬於這個班級的教材");
            return {
                ...base, title: track.title, book_id: track.book_id, video_segment_id: null, video_url: null,
                start_seconds: null, end_seconds: null, track_id: track.id, assignment_id: null
            };
        }
        if (type === "assignment") {
            const assignment = assignments.get(positiveInteger(raw?.assignment_id));
            if (!assignment) throw fail(400, "作業不屬於這個班級或已停用");
            return {
                ...base, title: cleanText(assignment.title, 160) || "老師指定的作業", book_id: null, video_segment_id: null,
                video_url: null, start_seconds: null, end_seconds: null, track_id: null, assignment_id: Number(assignment.id)
            };
        }
        throw fail(400, "不支援的進度項目");
    });
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Supabase 伺服器設定不完整" });
        const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

        const caller = await verifyFirebaseRequest(req, admin);
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action, 60);
        const isManager = caller.role === "teacher" || caller.role === "admin";

        if (action === "teacher_bootstrap") {
            if (!isManager) throw fail(403, "只有老師與管理員可以點名");
            const classes = (await getManagedClassCodes(admin, caller)).sort();
            return json(200, { success: true, classes, today: taiwanDate(), can_manage_segments: caller.role === "admin" });
        }

        if (action === "teacher_session") {
            const klass = await requireManagedClass(admin, caller, body?.class_code);
            const sessionDate = cleanText(body?.session_date, 10) || taiwanDate();
            if (!isValidSessionDate(sessionDate, taiwanDate())) throw fail(400, "上課日期不正確，不能選未來的日期");
            const [view, options] = await Promise.all([loadSessionView(admin, klass, sessionDate), loadClassOptions(admin, klass)]);
            return json(200, { success: true, class_code: klass.code, session_date: sessionDate, ...view, options });
        }

        if (action === "save_session") {
            const klass = await requireManagedClass(admin, caller, body?.class_code);
            const sessionDate = cleanText(body?.session_date, 10);
            if (!isValidSessionDate(sessionDate, taiwanDate())) throw fail(400, "上課日期不正確，不能選未來的日期");

            const roster = await getRoster(admin, Number(klass.id));
            const rosterIds = new Set(roster.map((student: any) => student.id));
            const attendance = (Array.isArray(body?.attendance) ? body.attendance : []).map((row: any) => ({
                student_id: positiveInteger(row?.student_id),
                status: cleanText(row?.status, 12)
            }));
            if (attendance.some((row: any) => !rosterIds.has(row.student_id) || !ATTENDANCE_STATUSES.has(row.status))) {
                throw fail(400, "點名資料包含不在這個班級的學生或不支援的狀態");
            }
            if (new Set(attendance.map((row: any) => row.student_id)).size !== attendance.length) throw fail(400, "同一位學生不能重複點名");
            const items = await buildItems(admin, klass, body?.items);
            const now = new Date().toISOString();

            const { data: session, error: sessionError } = await admin.from("class_sessions")
                .upsert({
                    class_id: klass.id, session_date: sessionDate, teacher_id: caller.id,
                    note: cleanText(body?.note, 500) || null, updated_at: now
                }, { onConflict: "class_id,session_date" })
                .select("id").single();
            if (sessionError) throw sessionError;

            if (attendance.length) {
                const { error } = await admin.from("class_session_attendance").upsert(
                    attendance.map((row: any) => ({ ...row, session_id: session.id, marked_by: caller.id, updated_at: now })),
                    { onConflict: "session_id,student_id" }
                );
                if (error) throw error;
            }

            // Items keep their id when edited so a student's finished makeup is not lost;
            // removed items are switched off instead of deleted.
            const existing = await loadActiveItems(admin, [Number(session.id)]);
            const existingIds = new Set(existing.map((item: any) => Number(item.id)));
            const keptIds = new Set<number>();
            for (const item of items) {
                const { id, ...fields } = item;
                if (id && existingIds.has(id)) {
                    keptIds.add(id);
                    const { error } = await admin.from("class_session_progress_items")
                        .update({ ...fields, updated_at: now }).eq("id", id).eq("session_id", session.id);
                    if (error) throw error;
                } else {
                    const { error } = await admin.from("class_session_progress_items").insert({ ...fields, session_id: session.id });
                    if (error) throw error;
                }
            }
            const removedIds = [...existingIds].filter(id => !keptIds.has(id));
            if (removedIds.length) {
                const { error } = await admin.from("class_session_progress_items")
                    .update({ is_active: false, updated_at: now }).in("id", removedIds).eq("session_id", session.id);
                if (error) throw error;
            }

            return json(200, { success: true, class_code: klass.code, session_date: sessionDate, ...await loadSessionView(admin, klass, sessionDate) });
        }

        if (action === "teacher_makeup_overview") {
            const klass = await requireManagedClass(admin, caller, body?.class_code);
            const { data: sessions, error } = await admin.from("class_sessions").select("id,session_date")
                .eq("class_id", klass.id).gte("session_date", taiwanDate(-MAKEUP_WINDOW_DAYS))
                .order("session_date", { ascending: false });
            if (error) throw error;
            const sessionIds = (sessions || []).map((session: any) => Number(session.id));
            if (!sessionIds.length) return json(200, { success: true, class_code: klass.code, sessions: [] });

            const [attendanceRes, items, roster] = await Promise.all([
                admin.from("class_session_attendance").select("session_id,student_id,status")
                    .in("session_id", sessionIds).in("status", [...ABSENT_STATUSES]),
                loadActiveItems(admin, sessionIds),
                getRoster(admin, Number(klass.id))
            ]);
            if (attendanceRes.error) throw attendanceRes.error;
            const names = new Map(roster.map((student: any) => [student.id, student.name]));
            const absences = (attendanceRes.data || []).filter((row: any) => names.has(Number(row.student_id)));
            const { done } = await loadCompletion(
                admin, items,
                new Map((sessions || []).map((session: any) => [Number(session.id), session.session_date])),
                [...new Set(absences.map((row: any) => Number(row.student_id)))]
            );
            return json(200, {
                success: true,
                class_code: klass.code,
                sessions: (sessions || []).map((session: any) => {
                    const sessionItems = items.filter((item: any) => Number(item.session_id) === Number(session.id));
                    return {
                        id: session.id,
                        session_date: session.session_date,
                        total: sessionItems.length,
                        students: absences.filter((row: any) => Number(row.session_id) === Number(session.id)).map((row: any) => ({
                            student_id: row.student_id,
                            name: names.get(Number(row.student_id)),
                            status: row.status,
                            done: sessionItems.filter((item: any) => done.has(`${item.id}:${row.student_id}`)).length
                        }))
                    };
                }).filter((session: any) => session.students.length)
            });
        }

        if (action === "save_video_segment" || action === "delete_video_segment") {
            if (caller.role !== "admin") throw fail(403, "只有管理員可以維護影片時間對照表");
            const id = positiveInteger(body?.id);
            const now = new Date().toISOString();
            if (action === "delete_video_segment") {
                if (!id) throw fail(400, "對照資料 id 不正確");
                const { error } = await admin.from("book_video_segments").update({ is_active: false, updated_at: now }).eq("id", id);
                if (error) throw error;
                return json(200, { success: true });
            }
            const bookId = positiveInteger(body?.book_id);
            const pageFrom = positiveInteger(body?.page_from);
            const pageTo = positiveInteger(body?.page_to) || pageFrom;
            const videoUrl = normalizeYouTubeUrl(body?.video_url);
            const start = normalizeSeconds(body?.start_seconds) ?? 0;
            const end = normalizeSeconds(body?.end_seconds);
            const title = cleanText(body?.title, 120);
            if (!bookId) throw fail(400, "請選擇教材");
            if (!pageFrom || pageFrom > 999 || pageTo < pageFrom || pageTo > 999) throw fail(400, "頁碼範圍不正確");
            if (!videoUrl) throw fail(400, "影片請貼上單支 YouTube 影片網址");
            if (end !== null && end <= start) throw fail(400, "影片結束時間要晚於開始時間");
            const { data: book, error: bookError } = await admin.from("books").select("id,name").eq("id", bookId).maybeSingle();
            if (bookError) throw bookError;
            if (!book) throw fail(404, "找不到教材");
            const fields = {
                book_id: bookId, page_from: pageFrom, page_to: pageTo, video_url: videoUrl, start_seconds: start, end_seconds: end,
                title: title || `${book.name} P.${pageFrom}${pageTo > pageFrom ? `–${pageTo}` : ""}`, is_active: true, updated_at: now
            };
            const query = id
                ? admin.from("book_video_segments").update(fields).eq("id", id)
                : admin.from("book_video_segments").insert({ ...fields, created_by: caller.id });
            const { data, error } = await query.select("id,book_id,title,page_from,page_to,video_url,start_seconds,end_seconds").maybeSingle();
            if (error) throw error;
            if (!data) throw fail(404, "找不到對照資料");
            return json(200, { success: true, segment: data });
        }

        if (action === "student_makeups" || action === "complete_makeup_item") {
            if (caller.role !== "student") throw fail(403, "補課只提供英文班學生使用");
            const access = await loadEffectiveAccess(admin, Number(caller.id));
            if (!access.is_active) throw fail(402, "會員使用期限已結束，無法使用補課", "membership_required");
            const klass = access.features.assignments ? await getActiveStudentClass(admin, Number(caller.id)) : null;
            if (!klass) throw fail(403, "目前帳號不包含英文班補課", "makeup_not_available");

            // Only sessions of the class the student is in now, the same isolation homework uses.
            const { data: sessions, error } = await admin.from("class_sessions").select("id,session_date,note")
                .eq("class_id", klass.id).gte("session_date", taiwanDate(-MAKEUP_WINDOW_DAYS))
                .order("session_date", { ascending: false });
            if (error) throw error;
            const sessionIds = (sessions || []).map((session: any) => Number(session.id));
            const attendanceRes = sessionIds.length
                ? await admin.from("class_session_attendance").select("session_id,status")
                    .eq("student_id", caller.id).in("session_id", sessionIds).in("status", [...ABSENT_STATUSES])
                : { data: [], error: null };
            if (attendanceRes.error) throw attendanceRes.error;
            const missed = new Map((attendanceRes.data || []).map((row: any) => [Number(row.session_id), row.status]));
            const missedSessions = (sessions || []).filter((session: any) => missed.has(Number(session.id)));
            const items = await loadActiveItems(admin, missedSessions.map((session: any) => Number(session.id)));
            const completion = await loadCompletion(
                admin, items,
                new Map(missedSessions.map((session: any) => [Number(session.id), session.session_date])),
                [Number(caller.id)]
            );

            if (action === "complete_makeup_item") {
                const itemId = positiveInteger(body?.item_id);
                if (!items.some((item: any) => Number(item.id) === itemId)) throw fail(404, "找不到這個補課項目");
                if (!completion.selfMarkable.has(itemId)) throw fail(400, "這個項目完成聽力或作業後會自動打勾");
                const { error: completeError } = await admin.from("makeup_item_completions")
                    .upsert({ progress_item_id: itemId, student_id: caller.id }, { onConflict: "progress_item_id,student_id", ignoreDuplicates: true });
                if (completeError) throw completeError;
                return json(200, { success: true, item_id: itemId });
            }

            const bookIds = [...new Set(items.map((item: any) => Number(item.book_id)).filter(Boolean))];
            const assignmentIds = [...new Set(items.map((item: any) => Number(item.assignment_id)).filter(Boolean))];
            const [bookRes, assignmentRes] = await Promise.all([
                bookIds.length ? admin.from("books").select("id,name,code").in("id", bookIds) : Promise.resolve({ data: [], error: null }),
                assignmentIds.length
                    ? admin.from("assignments").select("id,schema_version,enabled").in("id", assignmentIds)
                    : Promise.resolve({ data: [], error: null })
            ]);
            if (bookRes.error) throw bookRes.error;
            if (assignmentRes.error) throw assignmentRes.error;
            const books = new Map((bookRes.data || []).map((book: any) => [Number(book.id), book]));
            const assignments = new Map((assignmentRes.data || []).map((assignment: any) => [Number(assignment.id), assignment]));

            return json(200, {
                success: true,
                class_code: klass.code,
                sessions: missedSessions.map((session: any) => ({
                    id: session.id,
                    session_date: session.session_date,
                    status: missed.get(Number(session.id)),
                    note: session.note,
                    items: items.filter((item: any) => Number(item.session_id) === Number(session.id)).map((item: any) => {
                        const book = books.get(Number(item.book_id));
                        const assignment = assignments.get(Number(item.assignment_id));
                        return {
                            id: item.id,
                            item_type: item.item_type,
                            title: item.title,
                            book_name: book?.name || null,
                            done: completion.done.has(`${item.id}:${caller.id}`),
                            self_markable: completion.selfMarkable.has(Number(item.id)),
                            video_url: item.video_url,
                            start_seconds: item.start_seconds,
                            end_seconds: item.end_seconds,
                            book_code: item.item_type === "listening" ? book?.code || null : null,
                            track_id: item.track_id,
                            task_key: assignment?.enabled ? `${Number(assignment.schema_version) === 2 ? "v2" : "v1"}-${assignment.id}` : null
                        };
                    })
                })).filter((session: any) => session.items.length)
            });
        }

        return json(400, { error: "不支援的點名操作" });
    } catch (error) {
        const status = Number((error as any)?.status) || 500;
        if (status >= 500) console.error("attendance-manager unexpected error", error);
        return json(status, {
            error: status < 500 && error instanceof Error ? error.message : "點名與補課服務暫時無法使用",
            code: (error as any)?.code || null
        });
    }
});
