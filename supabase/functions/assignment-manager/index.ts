import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

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
    studentId: number
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

    const { data: progress, error } = await admin
        .from("student_track_progress")
        .select("track_id,play_count")
        .eq("student_id", studentId)
        .in("track_id", trackIds);

    if (error) throw error;

    const progressMap = new Map(
        (progress || []).map((item: any) => [
            Number(item.track_id),
            Number(item.play_count || 0)
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

        if (action === "teacher_bootstrap") {
            if (!isManager) {
                return json(403, { error: "只有老師與管理者可以發布作業" });
            }

            const [studentRes, materialRes, trackRes, bookRes] = await Promise.all([
                admin.from("students").select("class").eq("role", "student"),
                admin
                    .from("ai_generated_materials")
                    .select("id,title,material_type,difficulty,topic,created_at")
                    .eq("student_id", caller.id)
                    .order("created_at", { ascending: false })
                    .limit(100),
                admin
                    .from("music_tracks")
                    .select("id,book_id,page,display_page,track_type,part_number,sort_order")
                    .eq("enabled", true)
                    .order("book_id")
                    .order("sort_order")
                    .limit(2000),
                admin
                    .from("books")
                    .select("id,name,code")
                    .eq("enabled", true)
            ]);

            const bootstrapError = (
                studentRes.error || materialRes.error || trackRes.error || bookRes.error
            );
            if (bootstrapError) throw bootstrapError;

            const classes = Array.from(new Set(
                (studentRes.data || [])
                    .map((row: any) => row.class)
                    .filter(Boolean)
            )).sort();
            const booksById = new Map(
                (bookRes.data || []).map((book: any) => [Number(book.id), book])
            );

            return json(200, {
                success: true,
                classes,
                materials: materialRes.data || [],
                books: bookRes.data || [],
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
            const targetClass = String(body?.target_class || "").trim().slice(0, 80) || null;
            const assignedDate = String(body?.assigned_date || taiwanDate());
            const dueAt = body?.due_at
                ? new Date(String(body.due_at)).toISOString()
                : null;
            const passingScore = Math.min(
                100,
                Math.max(0, Number(body?.passing_score) || 90)
            );
            const requiredListens = Math.min(
                20,
                Math.max(1, Number(body?.required_listens) || 3)
            );

            if (!title) return json(400, { error: "請輸入作業名稱" });
            if (!["ai_material", "music_track", "mission_pack"].includes(sourceType)) {
                return json(400, { error: "作業類型不正確" });
            }

            let aiMaterialId: number | null = null;
            let trackId: number | null = null;
            let trackIds: number[] = [];

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

                const { data: validTracks, error } = await admin
                    .from("music_tracks")
                    .select("id")
                    .in("id", trackIds)
                    .eq("enabled", true);

                if (error) throw error;
                if ((validTracks || []).length !== trackIds.length) {
                    return json(404, { error: "部分音檔不存在或已停用" });
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

        if (action === "teacher_assignments") {
            if (!isManager) return json(403, { error: "權限不足" });

            let query = admin
                .from("assignments")
                .select("*")
                .order("assigned_date", { ascending: false })
                .order("created_at", { ascending: false })
                .limit(100);

            if (caller.role !== "admin") {
                query = query.eq("creator_id", caller.id);
            }

            const { data: assignments, error } = await query;
            if (error) return json(500, { error: "讀取作業失敗" });

            const listeningAssignmentIds = (assignments || [])
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
                assignments: (assignments || []).map((assignment: any) => ({
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
            if (hasListeningTask(assignment.source_type)) {
                trackItems = await getAssignmentTrackItems(admin, assignment);
                const trackIds = trackItems.map((item: any) => item.track_id);
                const { data, error } = await admin
                    .from("student_track_progress")
                    .select("student_id,track_id,play_count")
                    .in("track_id", trackIds.length ? trackIds : [-1])
                    .in("student_id", studentIds.length ? studentIds : [-1]);
                if (error) throw error;
                listeningProgressMap = new Map(
                    (data || []).map((item: any) => [
                        String(item.student_id) + ":" + String(item.track_id),
                        Number(item.play_count || 0)
                    ])
                );
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
                    const playCount = listeningProgressMap.get(
                        String(student.id) + ":" + String(item.track_id)
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
                    !assignment.target_class || assignment.target_class === caller.class
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
                    ? admin
                        .from("student_track_progress")
                        .select("track_id,play_count")
                        .eq("student_id", caller.id)
                        .in("track_id", trackIds)
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
                    Number(item.track_id),
                    Number(item.play_count || 0)
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
                    const playCount = trackProgressMap.get(Number(item.track_id)) || 0;
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
                student_class: caller.class || null
            });
        }

        if (action === "submit_assignment") {
            if (caller.role !== "student") {
                return json(403, { error: "只有學生可以提交作業" });
            }

            const assignmentId = Number(body?.assignment_id);
            const answers = Array.isArray(body?.answers) ? body.answers : [];
            const { data: assignment, error: assignmentError } = await admin
                .from("assignments")
                .select("*")
                .eq("id", assignmentId)
                .eq("enabled", true)
                .maybeSingle();

            if (assignmentError) throw assignmentError;
            if (!assignment || !hasAiTask(assignment.source_type)) {
                return json(400, { error: "這份作業不能提交選擇題" });
            }
            if (
                assignment.target_class
                && assignment.target_class !== caller.class
            ) {
                return json(403, { error: "這份作業不屬於你的班級" });
            }

            const { data: material, error: materialError } = await admin
                .from("ai_generated_materials")
                .select("id,content")
                .eq("id", assignment.ai_material_id)
                .maybeSingle();

            if (materialError) throw materialError;
            const questions = Array.isArray(material?.content?.questions)
                ? material.content.questions
                : [];
            if (!questions.length || answers.length !== questions.length) {
                return json(400, { error: "請完成所有題目後再提交" });
            }

            let correctCount = 0;
            const results = questions.map((question: any, index: number) => {
                const selected = String(answers[index] ?? "");
                const correctAnswer = String(question.answer ?? "");
                const correct = selected === correctAnswer;
                if (correct) correctCount += 1;
                return {
                    index,
                    selected,
                    correct,
                    correct_answer: correctAnswer,
                    explanation: question.explanation || ""
                };
            });
            const score = Math.round((correctCount / questions.length) * 100);
            const passed = score >= Number(assignment.passing_score || 90);
            const now = new Date().toISOString();

            const { error: attemptError } = await admin
                .from("assignment_attempts")
                .insert({
                    assignment_id: assignmentId,
                    student_id: caller.id,
                    score,
                    correct_count: correctCount,
                    total_questions: questions.length,
                    passed,
                    answers,
                    wrong_questions: results.filter((item: any) => !item.correct)
                });

            if (attemptError) throw attemptError;

            const { data: currentProgress, error: currentProgressError } = await admin
                .from("assignment_progress")
                .select("*")
                .eq("assignment_id", assignmentId)
                .eq("student_id", caller.id)
                .maybeSingle();

            if (currentProgressError) throw currentProgressError;

            const { data: progress, error: progressError } = await admin
                .from("assignment_progress")
                .upsert({
                    assignment_id: assignmentId,
                    student_id: caller.id,
                    best_score: Math.max(Number(currentProgress?.best_score || 0), score),
                    attempt_count: Number(currentProgress?.attempt_count || 0) + 1,
                    completed: Boolean(currentProgress?.completed) || passed,
                    completed_at: (
                        currentProgress?.completed_at || (passed ? now : null)
                    ),
                    last_attempt_at: now,
                    updated_at: now
                }, {
                    onConflict: "assignment_id,student_id"
                })
                .select("*")
                .single();

            if (progressError) throw progressError;

            const listeningProgress = hasListeningTask(assignment.source_type)
                ? await getStudentListeningProgress(admin, assignment, caller.id)
                : {
                    completed_count: 0,
                    total_tracks: 0,
                    completed: false,
                    tracks: []
                };
            const aiCompleted = Boolean(progress.completed);
            const overallCompleted = (
                aiCompleted
                && (
                    !hasListeningTask(assignment.source_type)
                    || listeningProgress.completed
                )
            );
            const totalTasks = (
                Number(hasAiTask(assignment.source_type))
                + Number(hasListeningTask(assignment.source_type))
            );
            const completedTasks = (
                Number(aiCompleted)
                + Number(
                    hasListeningTask(assignment.source_type)
                    && listeningProgress.completed
                )
            );

            return json(200, {
                success: true,
                score,
                correct_count: correctCount,
                total_questions: questions.length,
                passed,
                passing_score: assignment.passing_score,
                results,
                assignment_completed: overallCompleted,
                progress: {
                    ...progress,
                    ai: {
                        best_score: Number(progress.best_score || 0),
                        attempt_count: Number(progress.attempt_count || 0),
                        completed: aiCompleted,
                        completed_at: progress.completed_at || null
                    },
                    listening: listeningProgress,
                    task_completed_count: completedTasks,
                    total_tasks: totalTasks,
                    completed: overallCompleted
                }
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
