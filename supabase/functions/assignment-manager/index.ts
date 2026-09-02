import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const FIREBASE_PROJECT_ID = "alan-english-listening";
const FIREBASE_ISSUER = "https://securetoken.google.com/" + FIREBASE_PROJECT_ID;
const FIREBASE_JWKS = createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

const json = (status: number, body: unknown) => new Response(
    JSON.stringify(body),
    {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
        }
    }
);

const taiwanDate = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
}).format(new Date());

const hasAiTask = (sourceType: string) => (
    sourceType === "ai_material" || sourceType === "mission_pack"
);

const hasListeningTask = (sourceType: string) => (
    sourceType === "music_track" || sourceType === "mission_pack"
);

const CLASS_CODES = new Set(["E1", "E3", "E5", "E7"]);

const isListeningRewardsV2Enabled = async (admin: any, studentId: number) => {
    const { data, error } = await admin
        .from("student_feature_rollouts")
        .select("enabled")
        .eq("student_id", studentId)
        .eq("feature_key", "listening_rewards_v2")
        .maybeSingle();
    if (error) {
        console.warn("assignment rollout lookup failed; using legacy progress", error.code);
        return false;
    }
    return data?.enabled === true;
};

const getManagedClassCodes = async (admin: any, caller: any) => {
    if (caller.role === "admin") return [...CLASS_CODES];
    if (caller.role !== "teacher") return [];
    const today = taiwanDate();
    const { data, error } = await admin.from("teacher_class_permissions")
        .select("can_publish,starts_at,ends_at,academy_classes(code)")
        .eq("teacher_id", caller.id).eq("can_publish", true).lte("starts_at", today)
        .or(`ends_at.is.null,ends_at.gte.${today}`);
    if (error) throw error;
    return (data || []).map((row: any) => Array.isArray(row.academy_classes) ? row.academy_classes[0]?.code : row.academy_classes?.code)
        .filter((code: string) => CLASS_CODES.has(code));
};

const getClassMaterial = async (admin: any, classCode: string) => {
    const today = taiwanDate();
    const { data: klass, error: classError } = await admin.from("academy_classes").select("id,code,name_zh")
        .eq("code", classCode).eq("is_active", true).maybeSingle();
    if (classError) throw classError;
    if (!klass) return null;
    const { data: setting, error } = await admin.from("academy_class_material_settings")
        .select("id,version,effective_from,effective_to,academy_class_material_books(book_id,books(id,name,code))")
        .eq("class_id", klass.id).eq("is_active", true).lte("effective_from", today)
        .or(`effective_to.is.null,effective_to.gte.${today}`).order("version", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return setting ? { klass, setting } : null;
};

async function verifyFirebaseIdToken(token: string) {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: FIREBASE_PROJECT_ID
    });
    const uid = String(payload.sub || "").trim();
    if (!uid) throw new Error("Firebase token 缺少 uid");
    return uid;
}

const sanitizeMaterial = (material: any) => {
    if (!material) return null;
    const content = material.content || {};
    return {
        id: material.id,
        title: material.title,
        material_type: material.material_type,
        difficulty: material.difficulty,
        topic: material.topic,
        content: {
            title: content.title,
            subtitle: content.subtitle,
            passage: content.passage,
            vocabulary: content.vocabulary || [],
            study_tip: content.study_tip,
            questions: Array.isArray(content.questions)
                ? content.questions.map((question: any) => ({
                    question: question.question,
                    options: Array.isArray(question.options) ? question.options : []
                }))
                : []
        }
    };
};

const getAssignmentTrackItems = async (admin: any, assignment: any) => {
    const { data, error } = await admin
        .from("assignment_track_items")
        .select("track_id,required_listens,sort_order")
        .eq("assignment_id", assignment.id)
        .order("sort_order");

    if (error) throw error;
    if (Array.isArray(data) && data.length) return data;
    if (!assignment.track_id) return [];

    return [{
        track_id: assignment.track_id,
        required_listens: Number(assignment.required_listens || 3),
        sort_order: 0
    }];
};

const getStudentListeningProgress = async (
    admin: any,
    assignment: any,
    studentId: number,
    useAssignmentProgress = false
) => {
    const items = await getAssignmentTrackItems(admin, assignment);
    const trackIds = items.map((item: any) => item.track_id);

    if (!trackIds.length) {
        return {
            completed_count: 0,
            total_tracks: 0,
            completed: false,
            tracks: []
        };
    }

    let progressQuery = admin
        .from(useAssignmentProgress ? "assignment_listening_progress" : "student_track_progress")
        .select(useAssignmentProgress ? "track_id,valid_listen_count" : "track_id,play_count")
        .eq("student_id", studentId)
        .in("track_id", trackIds);
    if (useAssignmentProgress) {
        progressQuery = progressQuery.eq("assignment_id", assignment.id);
    }
    const { data: progress, error } = await progressQuery;

    if (error) throw error;

    const progressMap = new Map(
        (progress || []).map((item: any) => [
            Number(item.track_id),
            Number(useAssignmentProgress ? item.valid_listen_count : item.play_count || 0)
        ])
    );
    const tracks = items.map((item: any) => {
        const requiredListens = Number(item.required_listens || assignment.required_listens || 3);
        const playCount = progressMap.get(Number(item.track_id)) || 0;
        return {
            track_id: item.track_id,
            required_listens: requiredListens,
            play_count: playCount,
            completed: playCount >= requiredListens
        };
    });
    const completedCount = tracks.filter((item: any) => item.completed).length;

    return {
        completed_count: completedCount,
        total_tracks: tracks.length,
        completed: tracks.length > 0 && completedCount === tracks.length,
        tracks
    };
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
        return json(405, { error: "Method not allowed" });
    }

    try {
        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7).trim()
            : "";

        if (!token) return json(401, { error: "請先登入 Alan English" });

        let firebaseUid = "";
        try {
            firebaseUid = await verifyFirebaseIdToken(token);
        } catch {
            return json(401, { error: "登入驗證失敗，請重新登入" });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !serviceRoleKey) {
            return json(500, { error: "Supabase 伺服器設定不完整" });
        }

        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });
        const { data: caller, error: callerError } = await admin
            .from("students")
            .select("id,name,email,class,role")
            .eq("firebase_uid", firebaseUid)
            .maybeSingle();

        if (callerError) throw callerError;
        if (!caller) return json(404, { error: "找不到 Alan English 帳號" });

        const body = await req.json().catch(() => ({}));
        const action = String(body?.action || "");
        const isManager = caller.role === "teacher" || caller.role === "admin";
        let effectiveAccess: any = null;
        let listeningRewardsV2Enabled = false;

        if (!isManager) {
            listeningRewardsV2Enabled = await isListeningRewardsV2Enabled(
                admin,
                Number(caller.id)
            );
            effectiveAccess = await loadEffectiveAccess(admin, Number(caller.id));
            if (!effectiveAccess.is_active) {
                return json(402, { error: "會員使用期限已結束，無法使用學生作業", code: "membership_required" });
            }
            if (!effectiveAccess.features.assignments) {
                return json(403, { error: "目前帳號不包含班級作業", code: "assignments_not_available" });
            }
        }

        if (action === "teacher_bootstrap") {
            if (!isManager) {
                return json(403, { error: "只有老師與管理者可以發布作業" });
            }

            const classes = await getManagedClassCodes(admin, caller);
            const classMaterials = (await Promise.all(classes.map(code => getClassMaterial(admin, code)))).filter(Boolean);
            const bookRows = classMaterials.flatMap((entry: any) => entry.setting.academy_class_material_books || []);
            const books = [...new Map(bookRows.map((row: any) => {
                const book = Array.isArray(row.books) ? row.books[0] : row.books;
                return [Number(row.book_id), book];
            })).values()].filter(Boolean);
            const bookIds = books.map((book: any) => Number(book.id));
            const trackRes = bookIds.length ? await admin.from("music_tracks")
                .select("id,book_id,page,display_page,track_type,part_number,sort_order")
                .in("book_id", bookIds).eq("enabled", true).order("book_id").order("sort_order").limit(2000)
                : { data: [], error: null };
            if (trackRes.error) throw trackRes.error;
            const booksById = new Map(books.map((book: any) => [Number(book.id), book]));

            return json(200, {
                success: true,
                classes,
                class_materials: classMaterials.map((entry: any) => ({
                    class_code: entry.klass.code, setting_id: entry.setting.id,
                    books: (entry.setting.academy_class_material_books || []).map((row: any) => Array.isArray(row.books) ? row.books[0] : row.books)
                })),
                books,
                tracks: (trackRes.data || []).map((track: any) => ({
                    ...track,
                    book: booksById.get(Number(track.book_id)) || null
                }))
            });
        }

        if (action === "create_assignment") {
            if (!isManager) {
                return json(403, { error: "只有老師與管理者可以發布作業" });
            }

            const title = String(body?.title || "").trim().slice(0, 160);
            const description = String(body?.description || "").trim().slice(0, 1000) || null;
            const sourceType = String(body?.source_type || "");
            const targetClass = String(body?.target_class || "").trim().slice(0, 80);
            const assignedDate = String(body?.assigned_date || taiwanDate());
            const dueAt = body?.due_at
                ? new Date(String(body.due_at)).toISOString()
                : null;
            const passingScore = Math.min(
                100,
                Math.max(0, Number(body?.passing_score) || 90)
            );
            const requiredListens = Math.min(
                10,
                Math.max(1, Number(body?.required_listens) || 3)
            );

            if (!title) return json(400, { error: "請輸入作業名稱" });
            if (!CLASS_CODES.has(targetClass)) return json(400, { error: "必須選擇 E1、E3、E5 或 E7 目標班級，不能使用空白代表全部學生" });
            const managedCodes = await getManagedClassCodes(admin, caller);
            if (!managedCodes.includes(targetClass)) return json(403, { error: "你沒有管理這個班級的權限" });
            const classMaterial = await getClassMaterial(admin, targetClass);
            if (!classMaterial) return json(409, { error: "這個班級尚未設定生效教材" });
            if (sourceType !== "music_track") {
                return json(403, {
                    error: "AI 教材需要學生個別加購，目前班級作業只能發布聽力練習"
                });
            }

            let aiMaterialId: number | null = null;
            let trackId: number | null = null;
            let trackIds: number[] = [];
            let validTracks: any[] = [];

            if (hasAiTask(sourceType)) {
                aiMaterialId = Number(body?.ai_material_id);
                if (!Number.isFinite(aiMaterialId)) {
                    return json(400, { error: "請選擇 AI 教材" });
                }

                const { data: material, error } = await admin
                    .from("ai_generated_materials")
                    .select("id")
                    .eq("id", aiMaterialId)
                    .eq("student_id", caller.id)
                    .maybeSingle();

                if (error) throw error;
                if (!material) {
                    return json(403, { error: "只能發布你自己的 AI 教材" });
                }
            }

            if (hasListeningTask(sourceType)) {
                trackIds = Array.from(new Set(
                    (
                        Array.isArray(body?.track_ids)
                            ? body.track_ids
                            : [body?.track_id]
                    )
                        .map(Number)
                        .filter(Number.isFinite)
                ));

                if (!trackIds.length) {
                    return json(400, { error: "請至少選擇一個聽力音檔" });
                }

                const validTrackResult = await admin
                    .from("music_tracks")
                    .select("id,book_id")
                    .in("id", trackIds)
                    .eq("enabled", true);
                if (validTrackResult.error) throw validTrackResult.error;
                validTracks = validTrackResult.data || [];
                if ((validTracks || []).length !== trackIds.length) {
                    return json(404, { error: "部分音檔不存在或已停用" });
                }
                const allowedBookIds = (classMaterial.setting.academy_class_material_books || []).map((row: any) => Number(row.book_id));
                if (validTracks.some((track: any) => !allowedBookIds.includes(Number(track.book_id)))) {
                    return json(403, { error: "音檔必須來自目標班級已啟用的教材" });
                }
                trackId = trackIds[0];
            }

            const { data: assignment, error } = await admin
                .from("assignments")
                .insert({
                    creator_id: caller.id,
                    title,
                    description,
                    source_type: sourceType,
                    ai_material_id: aiMaterialId,
                    track_id: trackId,
                    target_class: targetClass,
                    assigned_date: assignedDate,
                    due_at: dueAt,
                    passing_score: passingScore,
                    required_listens: requiredListens,
                    class_material_setting_id: classMaterial.setting.id,
                    enabled: true
                })
                .select("*")
                .single();

            if (error) {
                return json(500, { error: "發布作業失敗：" + error.message });
            }

            if (hasListeningTask(sourceType)) {
                const { error: itemError } = await admin
                    .from("assignment_track_items")
                    .insert(trackIds.map((id, index) => ({
                        ...(() => {
                            const selected = validTracks.find((track: any) => Number(track.id) === Number(id));
                            return { book_id_snapshot: selected?.book_id || null, track_id_snapshot: id };
                        })(),
                        assignment_id: assignment.id,
                        track_id: id,
                        required_listens: requiredListens,
                        sort_order: index
                    })));

                if (itemError) {
                    await admin.from("assignments").delete().eq("id", assignment.id);
                    return json(500, {
                        error: "建立聽力清單失敗：" + itemError.message
                    });
                }
            }

            return json(200, {
                success: true,
                assignment,
                track_count: trackIds.length,
                total_tasks: Number(hasAiTask(sourceType)) + Number(hasListeningTask(sourceType))
            });
        }

        if (action === "delete_assignment") {
            if (!isManager) {
                return json(403, { error: "只有老師與管理者可以刪除作業" });
            }

            const assignmentId = Number(body?.assignment_id);
            if (!Number.isFinite(assignmentId)) {
                return json(400, { error: "作業編號不正確" });
            }

            let assignmentQuery = admin
                .from("assignments")
                .select("id,creator_id,title,target_class,enabled")
                .eq("id", assignmentId);

            if (caller.role !== "admin") {
                assignmentQuery = assignmentQuery.eq("creator_id", caller.id);
            }

            const { data: assignment, error: assignmentError } = await assignmentQuery.maybeSingle();
            if (assignmentError) throw assignmentError;
            if (!assignment) {
                return json(404, { error: "找不到可刪除的作業" });
            }
            const managedCodes = await getManagedClassCodes(admin, caller);
            if (!managedCodes.includes(assignment.target_class)) return json(403, { error: "你已沒有管理這個班級的權限" });

            let deleteQuery = admin
                .from("assignments")
                .update({ enabled: false })
                .eq("id", assignment.id);

            if (caller.role !== "admin") {
                deleteQuery = deleteQuery.eq("creator_id", caller.id);
            }

            const { error: deleteError } = await deleteQuery;

            if (deleteError) {
                return json(500, { error: "刪除作業失敗" });
            }

            return json(200, {
                success: true,
                assignment_id: assignment.id
            });
        }

        if (action === "teacher_assignments") {
            if (!isManager) return json(403, { error: "權限不足" });

            let query = admin
                .from("assignments")
                .select("*")
                .eq("enabled", true)
                .order("assigned_date", { ascending: false })
                .order("created_at", { ascending: false })
                .limit(100);

            if (caller.role !== "admin") {
                query = query.eq("creator_id", caller.id);
            }

            const { data: assignments, error } = await query;
            if (error) return json(500, { error: "讀取作業失敗" });
            const managedCodes = await getManagedClassCodes(admin, caller);
            const visibleAssignments = (assignments || []).filter((assignment: any) => managedCodes.includes(assignment.target_class));

            const listeningAssignmentIds = visibleAssignments
                .filter((assignment: any) => hasListeningTask(assignment.source_type))
                .map((assignment: any) => assignment.id);
            const { data: items, error: itemError } = listeningAssignmentIds.length
                ? await admin
                    .from("assignment_track_items")
                    .select("assignment_id,track_id,required_listens")
                    .in("assignment_id", listeningAssignmentIds)
                : { data: [], error: null };

            if (itemError) throw itemError;

            const counts = new Map<number, number>();
            for (const item of items || []) {
                const assignmentId = Number(item.assignment_id);
                counts.set(assignmentId, (counts.get(assignmentId) || 0) + 1);
            }

            return json(200, {
                success: true,
                assignments: visibleAssignments.map((assignment: any) => ({
                    ...assignment,
                    track_count: counts.get(Number(assignment.id)) || 0,
                    total_tasks: (
                        Number(hasAiTask(assignment.source_type))
                        + Number(hasListeningTask(assignment.source_type))
                    )
                }))
            });
        }

        if (action === "assignment_results") {
            if (!isManager) return json(403, { error: "權限不足" });

            const assignmentId = Number(body?.assignment_id);
            const { data: assignment, error: assignmentError } = await admin
                .from("assignments")
                .select("*")
                .eq("id", assignmentId)
                .maybeSingle();

            if (assignmentError) throw assignmentError;
            if (!assignment) return json(404, { error: "找不到這份作業" });
            if (
                caller.role !== "admin"
                && Number(assignment.creator_id) !== Number(caller.id)
            ) {
                return json(403, { error: "你不能查看這份作業" });
            }
            const managedCodes = await getManagedClassCodes(admin, caller);
            if (!managedCodes.includes(assignment.target_class)) return json(403, { error: "你已沒有管理這個班級的權限" });

            let studentQuery = admin
                .from("students")
                .select("id,name,email,class")
                .eq("role", "student")
                .order("name");

            if (assignment.target_class) {
                studentQuery = studentQuery.eq("class", assignment.target_class);
            }

            const { data: students, error: studentError } = await studentQuery;
            if (studentError) throw studentError;
            const studentIds = (students || []).map((student: any) => student.id);

            let aiProgressMap = new Map<number, any>();
            let latestAttemptMap = new Map<number, any>();
            let assignmentQuestions: any[] = [];
            if (hasAiTask(assignment.source_type)) {
                const [progressRes, attemptRes, materialRes] = await Promise.all([
                    admin
                        .from("assignment_progress")
                        .select("*")
                        .eq("assignment_id", assignmentId)
                        .in("student_id", studentIds.length ? studentIds : [-1]),
                    admin
                        .from("assignment_attempts")
                        .select("student_id,score,correct_count,total_questions,passed,wrong_questions,created_at")
                        .eq("assignment_id", assignmentId)
                        .in("student_id", studentIds.length ? studentIds : [-1])
                        .order("created_at", { ascending: false })
                        .limit(2000),
                    assignment.ai_material_id
                        ? admin
                            .from("ai_generated_materials")
                            .select("content")
                            .eq("id", assignment.ai_material_id)
                            .maybeSingle()
                        : Promise.resolve({ data: null, error: null })
                ]);

                const aiResultError = (
                    progressRes.error || attemptRes.error || materialRes.error
                );
                if (aiResultError) throw aiResultError;
                aiProgressMap = new Map(
                    (progressRes.data || []).map((item: any) => [
                        Number(item.student_id),
                        item
                    ])
                );
                for (const attempt of attemptRes.data || []) {
                    const studentId = Number(attempt.student_id);
                    if (!latestAttemptMap.has(studentId)) {
                        latestAttemptMap.set(studentId, attempt);
                    }
                }
                assignmentQuestions = Array.isArray(materialRes.data?.content?.questions)
                    ? materialRes.data.content.questions
                    : [];
            }

            let trackItems: any[] = [];
            let listeningProgressMap = new Map<string, number>();
            let v2StudentIds = new Set<number>();
            if (hasListeningTask(assignment.source_type)) {
                trackItems = await getAssignmentTrackItems(admin, assignment);
                const trackIds = trackItems.map((item: any) => item.track_id);
                const rolloutRes = studentIds.length
                    ? await admin
                        .from("student_feature_rollouts")
                        .select("student_id")
                        .eq("feature_key", "listening_rewards_v2")
                        .eq("enabled", true)
                        .in("student_id", studentIds)
                    : { data: [], error: null };
                if (rolloutRes.error) throw rolloutRes.error;
                v2StudentIds = new Set(
                    (rolloutRes.data || []).map((row: any) => Number(row.student_id))
                );
                const legacyStudentIds = studentIds.filter(
                    (studentId: number) => !v2StudentIds.has(Number(studentId))
                );
                const canaryStudentIds = studentIds.filter(
                    (studentId: number) => v2StudentIds.has(Number(studentId))
                );
                const [legacyProgressRes, assignmentProgressRes] = await Promise.all([
                    legacyStudentIds.length
                        ? admin
                            .from("student_track_progress")
                            .select("student_id,track_id,play_count")
                            .in("track_id", trackIds.length ? trackIds : [-1])
                            .in("student_id", legacyStudentIds)
                        : Promise.resolve({ data: [], error: null }),
                    canaryStudentIds.length
                        ? admin
                            .from("assignment_listening_progress")
                            .select("student_id,track_id,valid_listen_count")
                            .eq("assignment_id", assignment.id)
                            .in("track_id", trackIds.length ? trackIds : [-1])
                            .in("student_id", canaryStudentIds)
                        : Promise.resolve({ data: [], error: null })
                ]);
                if (legacyProgressRes.error || assignmentProgressRes.error) {
                    throw legacyProgressRes.error || assignmentProgressRes.error;
                }
                listeningProgressMap = new Map([
                    ...(legacyProgressRes.data || []).map((item: any) => [
                        "legacy:" + String(item.student_id) + ":" + String(item.track_id),
                        Number(item.play_count || 0)
                    ]),
                    ...(assignmentProgressRes.data || []).map((item: any) => [
                        "v2:" + String(item.student_id) + ":" + String(item.track_id),
                        Number(item.valid_listen_count || 0)
                    ])
                ] as [string, number][]);
            }

            const rows = (students || []).map((student: any) => {
                const aiProgress = aiProgressMap.get(Number(student.id));
                const latestAttempt = latestAttemptMap.get(Number(student.id));
                const latestWrongQuestions = Array.isArray(latestAttempt?.wrong_questions)
                    ? latestAttempt.wrong_questions.map((item: any) => {
                        const questionIndex = Number(item?.index);
                        const question = assignmentQuestions[questionIndex] || {};
                        return {
                            index: Number.isFinite(questionIndex) ? questionIndex : 0,
                            question: String(question?.question || ""),
                            selected_answer: String(
                                item?.selected_answer ?? item?.selected ?? ""
                            ),
                            correct_answer: String(
                                item?.correct_answer ?? question?.answer ?? ""
                            ),
                            explanation: String(
                                item?.explanation ?? question?.explanation ?? ""
                            )
                        };
                    })
                    : [];
                const aiCompleted = hasAiTask(assignment.source_type)
                    ? Boolean(aiProgress?.completed)
                    : true;
                const listeningTracks = trackItems.map((item: any) => {
                    const requiredListens = Number(item.required_listens || assignment.required_listens || 3);
                    const progressMode = v2StudentIds.has(Number(student.id))
                        ? "v2:"
                        : "legacy:";
                    const playCount = listeningProgressMap.get(
                        progressMode + String(student.id) + ":" + String(item.track_id)
                    ) || 0;
                    return {
                        track_id: item.track_id,
                        required_listens: requiredListens,
                        play_count: playCount,
                        completed: playCount >= requiredListens
                    };
                });
                const completedCount = listeningTracks.filter(
                    (item: any) => item.completed
                ).length;
                const listeningCompleted = hasListeningTask(assignment.source_type)
                    ? listeningTracks.length > 0 && completedCount === listeningTracks.length
                    : true;
                const totalTasks = (
                    Number(hasAiTask(assignment.source_type))
                    + Number(hasListeningTask(assignment.source_type))
                );
                const taskCompletedCount = (
                    Number(hasAiTask(assignment.source_type) && aiCompleted)
                    + Number(hasListeningTask(assignment.source_type) && listeningCompleted)
                );

                return {
                    student,
                    listening_progress_mode: v2StudentIds.has(Number(student.id))
                        ? "assignment_window"
                        : "legacy_lifetime",
                    best_score: Number(aiProgress?.best_score || 0),
                    attempt_count: Number(aiProgress?.attempt_count || 0),
                    completed_count: completedCount,
                    total_tracks: listeningTracks.length,
                    task_completed_count: taskCompletedCount,
                    total_tasks: totalTasks,
                    ai: {
                        best_score: Number(aiProgress?.best_score || 0),
                        attempt_count: Number(aiProgress?.attempt_count || 0),
                        completed: hasAiTask(assignment.source_type) && aiCompleted
                    },
                    latest_attempt: latestAttempt
                        ? {
                            score: Number(latestAttempt.score || 0),
                            correct_count: Number(latestAttempt.correct_count || 0),
                            total_questions: Number(latestAttempt.total_questions || 0),
                            passed: Boolean(latestAttempt.passed),
                            attempted_at: latestAttempt.created_at || null,
                            wrong_questions: latestWrongQuestions
                        }
                        : null,
                    listening: {
                        completed_count: completedCount,
                        total_tracks: listeningTracks.length,
                        completed: hasListeningTask(assignment.source_type) && listeningCompleted,
                        tracks: listeningTracks
                    },
                    completed: aiCompleted && listeningCompleted
                };
            });

            return json(200, {
                success: true,
                assignment: {
                    ...assignment,
                    track_count: trackItems.length,
                    total_tasks: (
                        Number(hasAiTask(assignment.source_type))
                        + Number(hasListeningTask(assignment.source_type))
                    )
                },
                rows
            });
        }

        if (action === "student_assignments") {
            if (caller.role !== "student") {
                return json(403, { error: "只有學生帳號會顯示今日作業" });
            }

            const today = taiwanDate();
            const { data: enrollment, error: enrollmentError } = await admin.from("academy_enrollments")
                .select("id,scheduled_departure_at,academy_classes(code)")
                .eq("student_id", caller.id).eq("status", "active").limit(1).maybeSingle();
            if (enrollmentError) throw enrollmentError;
            const enrollmentClass = Array.isArray(enrollment?.academy_classes) ? enrollment.academy_classes[0]?.code : enrollment?.academy_classes?.code;
            if (!enrollment || !CLASS_CODES.has(enrollmentClass) || (enrollment.scheduled_departure_at && enrollment.scheduled_departure_at <= today)) {
                return json(200, { success: true, assignments: [], today, student_class: null });
            }
            const { data: allAssignments, error } = await admin
                .from("assignments")
                .select("*")
                .eq("enabled", true)
                .lte("assigned_date", today)
                .order("assigned_date", { ascending: false })
                .order("created_at", { ascending: false });

            if (error) throw error;

            const assignments = (allAssignments || []).filter(
                (assignment: any) => (
                    assignment.target_class === enrollmentClass
                    && assignment.source_type === "music_track"
                )
            );
            const assignmentIds = assignments.map((assignment: any) => assignment.id);
            const aiMaterialIds = assignments
                .filter((assignment: any) => hasAiTask(assignment.source_type))
                .map((assignment: any) => assignment.ai_material_id)
                .filter(Boolean);
            const listeningAssignmentIds = assignments
                .filter((assignment: any) => hasListeningTask(assignment.source_type))
                .map((assignment: any) => assignment.id);

            const [materialRes, aiProgressRes, trackItemRes] = await Promise.all([
                aiMaterialIds.length
                    ? admin
                        .from("ai_generated_materials")
                        .select("id,title,material_type,difficulty,topic,content")
                        .in("id", aiMaterialIds)
                    : Promise.resolve({ data: [], error: null }),
                assignmentIds.length
                    ? admin
                        .from("assignment_progress")
                        .select("*")
                        .in("assignment_id", assignmentIds)
                        .eq("student_id", caller.id)
                    : Promise.resolve({ data: [], error: null }),
                listeningAssignmentIds.length
                    ? admin
                        .from("assignment_track_items")
                        .select("assignment_id,track_id,required_listens,sort_order")
                        .in("assignment_id", listeningAssignmentIds)
                        .order("sort_order")
                    : Promise.resolve({ data: [], error: null })
            ]);

            const batchError = (
                materialRes.error || aiProgressRes.error || trackItemRes.error
            );
            if (batchError) throw batchError;

            const materialMap = new Map(
                (materialRes.data || []).map((material: any) => [
                    Number(material.id),
                    material
                ])
            );
            const aiProgressMap = new Map(
                (aiProgressRes.data || []).map((item: any) => [
                    Number(item.assignment_id),
                    item
                ])
            );
            const itemsByAssignment = new Map<number, any[]>();
            for (const item of trackItemRes.data || []) {
                const assignmentId = Number(item.assignment_id);
                const current = itemsByAssignment.get(assignmentId) || [];
                current.push(item);
                itemsByAssignment.set(assignmentId, current);
            }

            for (const assignment of assignments) {
                if (
                    hasListeningTask(assignment.source_type)
                    && !(itemsByAssignment.get(Number(assignment.id)) || []).length
                    && assignment.track_id
                ) {
                    itemsByAssignment.set(Number(assignment.id), [{
                        assignment_id: assignment.id,
                        track_id: assignment.track_id,
                        required_listens: Number(assignment.required_listens || 3),
                        sort_order: 0
                    }]);
                }
            }

            const trackIds = Array.from(new Set(
                Array.from(itemsByAssignment.values())
                    .flat()
                    .map((item: any) => item.track_id)
            ));
            const [trackRes, trackProgressRes] = await Promise.all([
                trackIds.length
                    ? admin
                        .from("music_tracks")
                        .select("id,book_id,page,display_page,track_type,part_number")
                        .in("id", trackIds)
                    : Promise.resolve({ data: [], error: null }),
                trackIds.length
                    ? (
                        listeningRewardsV2Enabled
                            ? admin
                                .from("assignment_listening_progress")
                                .select("assignment_id,track_id,valid_listen_count")
                                .eq("student_id", caller.id)
                                .in("assignment_id", listeningAssignmentIds)
                                .in("track_id", trackIds)
                            : admin
                                .from("student_track_progress")
                                .select("track_id,play_count")
                                .eq("student_id", caller.id)
                                .in("track_id", trackIds)
                    )
                    : Promise.resolve({ data: [], error: null })
            ]);

            if (trackRes.error || trackProgressRes.error) {
                throw trackRes.error || trackProgressRes.error;
            }

            const bookIds = Array.from(new Set(
                (trackRes.data || []).map((track: any) => track.book_id)
            ));
            const bookRes = bookIds.length
                ? await admin
                    .from("books")
                    .select("id,name,code")
                    .in("id", bookIds)
                : { data: [], error: null };

            if (bookRes.error) throw bookRes.error;

            const bookMap = new Map(
                (bookRes.data || []).map((book: any) => [Number(book.id), book])
            );
            const trackMap = new Map(
                (trackRes.data || []).map((track: any) => [Number(track.id), track])
            );
            const trackProgressMap = new Map(
                (trackProgressRes.data || []).map((item: any) => [
                    listeningRewardsV2Enabled
                        ? String(item.assignment_id) + ":" + String(item.track_id)
                        : String(item.track_id),
                    Number(
                        listeningRewardsV2Enabled
                            ? item.valid_listen_count
                            : item.play_count || 0
                    )
                ])
            );

            const result = assignments.map((assignment: any) => {
                const includesAi = hasAiTask(assignment.source_type);
                const includesListening = hasListeningTask(assignment.source_type);
                const aiProgress = aiProgressMap.get(Number(assignment.id));
                const aiCompleted = includesAi && Boolean(aiProgress?.completed);
                const trackItems = itemsByAssignment.get(Number(assignment.id)) || [];
                const trackDetails = trackItems.map((item: any) => {
                    const track = trackMap.get(Number(item.track_id));
                    const progressKey = listeningRewardsV2Enabled
                        ? String(assignment.id) + ":" + String(item.track_id)
                        : String(item.track_id);
                    const playCount = trackProgressMap.get(progressKey) || 0;
                    const requiredListens = Number(
                        item.required_listens || assignment.required_listens || 3
                    );
                    return {
                        track: track
                            ? {
                                ...track,
                                book: bookMap.get(Number(track.book_id)) || null
                            }
                            : null,
                        required_listens: requiredListens,
                        play_count: playCount,
                        completed: playCount >= requiredListens
                    };
                });
                const completedTrackCount = trackDetails.filter(
                    (item: any) => item.completed
                ).length;
                const listeningCompleted = (
                    includesListening
                    && trackDetails.length > 0
                    && completedTrackCount === trackDetails.length
                );
                const totalTasks = Number(includesAi) + Number(includesListening);
                const completedTaskCount = (
                    Number(aiCompleted) + Number(listeningCompleted)
                );

                return {
                    ...assignment,
                    has_ai_task: includesAi,
                    has_listening_task: includesListening,
                    listening_progress_mode: listeningRewardsV2Enabled
                        ? "assignment_window"
                        : "legacy_lifetime",
                    total_tasks: totalTasks,
                    material: includesAi
                        ? sanitizeMaterial(materialMap.get(Number(assignment.ai_material_id)))
                        : null,
                    tracks: trackDetails,
                    track: trackDetails[0]?.track || null,
                    progress: {
                        best_score: Number(aiProgress?.best_score || 0),
                        attempt_count: Number(aiProgress?.attempt_count || 0),
                        completed_at: aiProgress?.completed_at || null,
                        completed_count: completedTrackCount,
                        total_tracks: trackDetails.length,
                        ai: {
                            best_score: Number(aiProgress?.best_score || 0),
                            attempt_count: Number(aiProgress?.attempt_count || 0),
                            completed: aiCompleted,
                            completed_at: aiProgress?.completed_at || null
                        },
                        listening: {
                            completed_count: completedTrackCount,
                            total_tracks: trackDetails.length,
                            completed: listeningCompleted
                        },
                        task_completed_count: completedTaskCount,
                        total_tasks: totalTasks,
                        completed: completedTaskCount === totalTasks && totalTasks > 0
                    }
                };
            });

            return json(200, {
                success: true,
                assignments: result,
                today,
                student_class: enrollmentClass
            });
        }

        if (action === "submit_assignment") {
            if (caller.role !== "student") {
                return json(403, { error: "只有學生可以提交作業" });
            }

            const assignmentId = Number(body?.assignment_id);
            const { data: assignment, error: assignmentError } = await admin
                .from("assignments")
                .select("id,source_type")
                .eq("id", assignmentId)
                .eq("enabled", true)
                .maybeSingle();

            if (assignmentError) throw assignmentError;
            if (!assignment || !hasAiTask(assignment.source_type)) {
                return json(400, { error: "這份作業不能提交選擇題" });
            }
            return json(410, {
                error: "AI 班級作業已停止作答；歷史成績仍會保留",
                code: "legacy_ai_assignment_read_only"
            });
        }

        return json(400, { error: "不支援的操作" });
    } catch (error) {
        console.error(error);
        return json(500, {
            error: error instanceof Error
                ? error.message
                : "作業系統發生錯誤"
        });
    }
});
