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
const MIXED_ASSIGNMENT_ITEM_TYPES = new Set(["listening", "ai_quiz", "pronunciation"]);

const cleanText = (value: unknown, maxLength: number) => String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const positiveInteger = (value: unknown, fallback = 0) => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
};

const normalizedPromptList = (value: unknown) => Array.from(new Set(
    (Array.isArray(value) ? value : [])
        .map(item => cleanText(item, 500))
        .filter(Boolean)
)).slice(0, 30);

const normalizeQuestionSnapshot = (content: any) => {
    const questions = Array.isArray(content?.questions) ? content.questions : [];
    const valid = questions.map((question: any) => {
        const options = Array.isArray(question?.options)
            ? question.options.map((option: any) => cleanText(option, 500)).filter(Boolean)
            : [];
        const answer = cleanText(question?.answer, 500);
        const text = cleanText(question?.question, 1000);
        const explanation = cleanText(question?.explanation, 1600);
        if (!text || options.length !== 4 || new Set(options).size !== 4 || !options.includes(answer) || !explanation) {
            return null;
        }
        return { question: text, options, answer, explanation };
    }).filter(Boolean);
    return valid.length === questions.length && valid.length > 0 ? valid : null;
};

const getContentSnapshot = (rows: any[]) => rows.map(row => ({
    id: Number(row.id),
    page_label: cleanText(row.page_label, 80),
    page_number: Number.isInteger(Number(row.page_number)) ? Number(row.page_number) : null,
    source_text: String(row.source_text || "").trim(),
    pronunciation_prompts: normalizedPromptList(row.pronunciation_prompts),
    version: Number(row.version || 1)
}));

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

const getPublishedPageContent = async (admin: any, bookId: number, contentIds: number[]) => {
    const uniqueIds = Array.from(new Set(contentIds.filter(Number.isFinite)));
    if (!uniqueIds.length) return [];
    const { data, error } = await admin
        .from("book_page_learning_content")
        .select("id,book_id,page_label,page_number,source_text,pronunciation_prompts,status,version")
        .eq("book_id", bookId)
        .eq("status", "published")
        .in("id", uniqueIds);
    if (error) throw error;
    if ((data || []).length !== uniqueIds.length) {
        throw new Error("請先選擇目標教材中已發布且含核准文字的頁面來源");
    }
    if ((data || []).some((row: any) => !String(row.source_text || "").trim())) {
        throw new Error("AI 與發音作業的每個頁面都必須先填入核准文字來源");
    }
    return getContentSnapshot(data || []);
};

const buildMixedAssignmentDraft = async (
    admin: any,
    caller: any,
    classMaterial: any,
    rawItems: unknown
) => {
    const allowedBookIds = new Set(
        (classMaterial.setting.academy_class_material_books || []).map((row: any) => Number(row.book_id))
    );
    const items = Array.isArray(rawItems) ? rawItems : [];
    if (!items.length || items.length > 3) {
        throw new Error("混合作業至少要有 1 個、最多 3 個活動");
    }
    const seenTypes = new Set<string>();
    const draftItems: any[] = [];

    for (let index = 0; index < items.length; index += 1) {
        const rawItem: any = items[index] || {};
        const itemType = cleanText(rawItem.item_type, 40);
        if (!MIXED_ASSIGNMENT_ITEM_TYPES.has(itemType) || seenTypes.has(itemType)) {
            throw new Error("每種活動最多只能加入一次，且只支援聽力、AI 選擇題或發音練習");
        }
        seenTypes.add(itemType);
        const bookId = positiveInteger(rawItem.book_id);
        if (!allowedBookIds.has(bookId)) {
            throw new Error("活動教材必須來自目標班級目前生效的教材");
        }

        if (itemType === "listening") {
            const trackIds = Array.from(new Set(
                (Array.isArray(rawItem.track_ids) ? rawItem.track_ids : [])
                    .map((item: any) => positiveInteger(item))
                    .filter(Boolean)
            )).slice(0, 120);
            if (!trackIds.length) throw new Error("聽力活動至少要選擇一個音檔");
            const requiredListens = Math.min(10, Math.max(1, positiveInteger(rawItem.required_listens, 3)));
            const { data: tracks, error } = await admin
                .from("music_tracks")
                .select("id,book_id,page,display_page,track_type,part_number,sort_order")
                .eq("book_id", bookId)
                .eq("enabled", true)
                .in("id", trackIds);
            if (error) throw error;
            if ((tracks || []).length !== trackIds.length) {
                throw new Error("部分聽力音檔不存在、已停用或不屬於選定教材");
            }
            const orderedTracks = trackIds.map(id => (tracks || []).find((track: any) => Number(track.id) === id));
            draftItems.push({
                item_type: itemType,
                book_id: bookId,
                page_from_label: cleanText(rawItem.page_from_label, 80) || null,
                page_to_label: cleanText(rawItem.page_to_label, 80) || null,
                config: { required_listens: requiredListens },
                content_snapshot: { tracks: orderedTracks.map((track: any) => ({
                    id: Number(track.id), page: track.page, display_page: track.display_page,
                    track_type: track.track_type, part_number: track.part_number, sort_order: track.sort_order
                })) },
                track_items: orderedTracks.map((track: any, trackIndex: number) => ({
                    track_id: Number(track.id),
                    required_listens: requiredListens,
                    book_id_snapshot: bookId,
                    track_id_snapshot: Number(track.id),
                    sort_order: trackIndex
                }))
            });
            continue;
        }

        const pageContentIds = Array.from(new Set(
            (Array.isArray(rawItem.page_content_ids) ? rawItem.page_content_ids : [])
                .map((item: any) => positiveInteger(item))
                .filter(Boolean)
        ));
        const pageContent = await getPublishedPageContent(admin, bookId, pageContentIds);

        if (itemType === "ai_quiz") {
            const aiMaterialId = positiveInteger(rawItem.ai_material_id);
            const { data: material, error } = await admin
                .from("ai_generated_materials")
                .select("id,title,material_type,difficulty,topic,question_count,content")
                .eq("id", aiMaterialId)
                .eq("student_id", caller.id)
                .maybeSingle();
            if (error) throw error;
            const questions = normalizeQuestionSnapshot(material?.content);
            if (!material || !questions) {
                throw new Error("請選擇你已檢閱、且題目完整的 AI 教材作為全班共用題組");
            }
            draftItems.push({
                item_type: itemType,
                book_id: bookId,
                page_from_label: cleanText(rawItem.page_from_label, 80) || pageContent[0]?.page_label || null,
                page_to_label: cleanText(rawItem.page_to_label, 80) || pageContent.at(-1)?.page_label || null,
                config: { passing_score: Math.min(100, Math.max(0, Number(rawItem.passing_score) || 80)) },
                content_snapshot: { page_content: pageContent },
                ai_item: {
                    ai_material_id: Number(material.id),
                    passing_score: Math.min(100, Math.max(0, Number(rawItem.passing_score) || 80)),
                    question_snapshot: {
                        title: cleanText(material.title, 200),
                        material_type: cleanText(material.material_type, 80),
                        difficulty: cleanText(material.difficulty, 80),
                        topic: cleanText(material.topic, 200) || null,
                        questions
                    }
                }
            });
            continue;
        }

        const requestedPromptKeys = new Set(
            (Array.isArray(rawItem.prompt_keys) ? rawItem.prompt_keys : [])
                .map((item: any) => cleanText(item, 500))
                .filter(Boolean)
        );
        const availablePrompts = pageContent.flatMap((content: any) => (
            content.pronunciation_prompts.map((prompt: string) => ({
                content_id: content.id,
                page_label: content.page_label,
                prompt_key: `${content.id}:${prompt}`,
                reference_text: prompt
            }))
        ));
        const prompts = availablePrompts.filter((prompt: any) => requestedPromptKeys.has(prompt.prompt_key));
        if (!prompts.length || prompts.length !== requestedPromptKeys.size) {
            throw new Error("請只選擇已在核准頁面文字中設定的發音提示句");
        }
        const completionMode = rawItem.completion_mode === "target_score" ? "target_score" : "practice";
        const targetScore = completionMode === "target_score"
            ? Math.min(100, Math.max(40, Number(rawItem.target_score) || 80))
            : null;
        const maxScoredAttempts = Math.min(5, Math.max(1, positiveInteger(rawItem.max_scored_attempts, 3)));
        draftItems.push({
            item_type: itemType,
            book_id: bookId,
            page_from_label: cleanText(rawItem.page_from_label, 80) || pageContent[0]?.page_label || null,
            page_to_label: cleanText(rawItem.page_to_label, 80) || pageContent.at(-1)?.page_label || null,
            config: { completion_mode: completionMode, target_score: targetScore, max_scored_attempts: maxScoredAttempts },
            content_snapshot: { page_content: pageContent },
            pronunciation_prompts: prompts.map((prompt: any, promptIndex: number) => ({
                prompt_key: prompt.prompt_key,
                page_label: prompt.page_label,
                reference_text: prompt.reference_text,
                completion_mode: completionMode,
                target_score: targetScore,
                max_scored_attempts: maxScoredAttempts,
                sort_order: promptIndex
            }))
        });
    }
    return draftItems;
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
            const [pageContentRes, aiMaterialsRes] = await Promise.all([
                bookIds.length
                    ? admin
                        .from("book_page_learning_content")
                        .select("id,book_id,page_label,page_number,source_text,pronunciation_prompts,status,version,updated_at")
                        .in("book_id", bookIds)
                        .neq("status", "archived")
                        .order("book_id")
                        .order("page_number")
                        .order("version", { ascending: false })
                        .limit(1000)
                    : Promise.resolve({ data: [], error: null }),
                admin
                    .from("ai_generated_materials")
                    .select("id,title,material_type,difficulty,topic,question_count,content,created_at")
                    .eq("student_id", caller.id)
                    .order("created_at", { ascending: false })
                    .limit(100)
            ]);
            if (pageContentRes.error || aiMaterialsRes.error) {
                throw pageContentRes.error || aiMaterialsRes.error;
            }
            const booksById = new Map(books.map((book: any) => [Number(book.id), book]));

            return json(200, {
                success: true,
                classes,
                class_materials: classMaterials.map((entry: any) => ({
                    class_code: entry.klass.code, setting_id: entry.setting.id,
                    books: (entry.setting.academy_class_material_books || []).map((row: any) => Array.isArray(row.books) ? row.books[0] : row.books)
                })),
                books,
                page_content: (pageContentRes.data || []).map((row: any) => ({
                    ...row,
                    source_text: String(row.source_text || ""),
                    pronunciation_prompts: normalizedPromptList(row.pronunciation_prompts)
                })),
                ai_materials: (aiMaterialsRes.data || []).map((material: any) => ({
                    id: Number(material.id),
                    title: cleanText(material.title, 200),
                    material_type: cleanText(material.material_type, 80),
                    difficulty: cleanText(material.difficulty, 80),
                    topic: cleanText(material.topic, 200) || null,
                    question_count: Number(material.question_count || 0),
                    question_count_verified: normalizeQuestionSnapshot(material.content)?.length || 0,
                    created_at: material.created_at || null
                })),
                tracks: (trackRes.data || []).map((track: any) => ({
                    ...track,
                    book: booksById.get(Number(track.book_id)) || null
                }))
            });
        }

        if (action === "upsert_page_learning_content") {
            if (!isManager) return json(403, { error: "只有老師與管理者可以管理教材頁面來源" });
            const targetClass = cleanText(body?.target_class, 80);
            const bookId = positiveInteger(body?.book_id);
            const pageLabel = cleanText(body?.page_label, 80);
            const sourceText = String(body?.source_text || "").trim().slice(0, 12000);
            const prompts = normalizedPromptList(body?.pronunciation_prompts);
            const requestedStatus = cleanText(body?.status, 20) === "published" ? "published" : "draft";

            if (!CLASS_CODES.has(targetClass)) return json(400, { error: "請選擇目標班級" });
            if (!bookId || !pageLabel) return json(400, { error: "請選擇教材並填寫頁碼或單元標籤" });
            const managedCodes = await getManagedClassCodes(admin, caller);
            if (!managedCodes.includes(targetClass)) return json(403, { error: "你沒有管理這個班級的權限" });
            const classMaterial = await getClassMaterial(admin, targetClass);
            const allowedBookIds = new Set((classMaterial?.setting.academy_class_material_books || []).map((row: any) => Number(row.book_id)));
            if (!allowedBookIds.has(bookId)) return json(403, { error: "教材必須屬於目標班級目前生效的教材" });
            if (requestedStatus === "published" && !sourceText) {
                return json(400, { error: "發布頁面來源前，必須填入老師已核對的教材文字" });
            }

            const { data: latest, error: latestError } = await admin
                .from("book_page_learning_content")
                .select("id,version,source_text,pronunciation_prompts,status")
                .eq("book_id", bookId)
                .eq("page_label", pageLabel)
                .order("version", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (latestError) throw latestError;
            if (
                latest
                && String(latest.source_text || "").trim() === sourceText
                && JSON.stringify(normalizedPromptList(latest.pronunciation_prompts)) === JSON.stringify(prompts)
                && latest.status === requestedStatus
            ) {
                return json(200, { success: true, unchanged: true, content: latest });
            }

            const pageNumberMatch = pageLabel.match(/(?:^|\D)(\d+)(?:\D|$)/);
            const { data: saved, error: saveError } = await admin
                .from("book_page_learning_content")
                .insert({
                    book_id: bookId,
                    page_label: pageLabel,
                    page_number: pageNumberMatch ? Number(pageNumberMatch[1]) : null,
                    source_text: sourceText || null,
                    pronunciation_prompts: prompts,
                    status: requestedStatus,
                    version: Number(latest?.version || 0) + 1,
                    created_by: caller.id,
                    updated_by: caller.id,
                    updated_at: new Date().toISOString()
                })
                .select("id,book_id,page_label,page_number,source_text,pronunciation_prompts,status,version,updated_at")
                .single();
            if (saveError) throw saveError;
            return json(200, { success: true, content: saved });
        }

        if (action === "preview_assignment_v2" || action === "create_assignment_v2") {
            if (!isManager) return json(403, { error: "只有老師與管理者可以發布作業" });
            const title = cleanText(body?.title, 160);
            const description = cleanText(body?.description, 1000) || null;
            const targetClass = cleanText(body?.target_class, 80);
            const assignedDate = cleanText(body?.assigned_date, 20) || taiwanDate();
            const dueAt = body?.due_at ? new Date(String(body.due_at)).toISOString() : null;
            if (!title) return json(400, { error: "請輸入作業名稱" });
            if (!CLASS_CODES.has(targetClass)) return json(400, { error: "必須選擇 E1、E3、E5 或 E7 目標班級" });
            if (body?.due_at && Number.isNaN(Date.parse(String(body.due_at)))) return json(400, { error: "截止日期格式不正確" });
            const managedCodes = await getManagedClassCodes(admin, caller);
            if (!managedCodes.includes(targetClass)) return json(403, { error: "你沒有管理這個班級的權限" });
            const classMaterial = await getClassMaterial(admin, targetClass);
            if (!classMaterial) return json(409, { error: "這個班級尚未設定生效教材" });
            const draftItems = await buildMixedAssignmentDraft(admin, caller, classMaterial, body?.items);
            const preview = {
                title,
                description,
                target_class: targetClass,
                assigned_date: assignedDate,
                due_at: dueAt,
                total_items: draftItems.length,
                items: draftItems.map((item, sortOrder) => ({
                    sort_order: sortOrder,
                    item_type: item.item_type,
                    book_id: item.book_id,
                    page_from_label: item.page_from_label,
                    page_to_label: item.page_to_label,
                    track_count: item.track_items?.length || 0,
                    question_count: item.ai_item?.question_snapshot?.questions?.length || 0,
                    pronunciation_prompt_count: item.pronunciation_prompts?.length || 0,
                    config: item.config
                }))
            };
            if (action === "preview_assignment_v2") return json(200, { success: true, preview });

            const { data: assignment, error: assignmentError } = await admin
                .from("assignments")
                .insert({
                    creator_id: caller.id,
                    title,
                    description,
                    source_type: "multi_activity_v2",
                    target_class: targetClass,
                    assigned_date: assignedDate,
                    due_at: dueAt,
                    class_material_setting_id: classMaterial.setting.id,
                    enabled: true,
                    schema_version: 2
                })
                .select("*")
                .single();
            if (assignmentError) throw assignmentError;

            try {
                for (let sortOrder = 0; sortOrder < draftItems.length; sortOrder += 1) {
                    const item = draftItems[sortOrder];
                    const { data: savedItem, error: itemError } = await admin
                        .from("assignment_items")
                        .insert({
                            assignment_id: assignment.id,
                            item_type: item.item_type,
                            book_id_snapshot: item.book_id,
                            page_from_label: item.page_from_label,
                            page_to_label: item.page_to_label,
                            config: item.config,
                            content_snapshot: item.content_snapshot,
                            sort_order: sortOrder
                        })
                        .select("id")
                        .single();
                    if (itemError) throw itemError;
                    if (item.track_items?.length) {
                        const { error } = await admin.from("assignment_track_items").insert(item.track_items.map((track: any) => ({
                            assignment_id: assignment.id,
                            assignment_item_id: savedItem.id,
                            ...track
                        })));
                        if (error) throw error;
                    }
                    if (item.ai_item) {
                        const { error } = await admin.from("assignment_ai_items").insert({
                            assignment_item_id: savedItem.id,
                            ...item.ai_item
                        });
                        if (error) throw error;
                    }
                    if (item.pronunciation_prompts?.length) {
                        const { error } = await admin.from("assignment_pronunciation_prompts").insert(item.pronunciation_prompts.map((prompt: any) => ({
                            assignment_item_id: savedItem.id,
                            ...prompt
                        })));
                        if (error) throw error;
                    }
                }
            } catch (error) {
                await admin.from("assignments").delete().eq("id", assignment.id);
                throw error;
            }
            return json(200, { success: true, assignment, preview });
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

            const v2AssignmentIds = visibleAssignments
                .filter((assignment: any) => assignment.source_type === "multi_activity_v2" && Number(assignment.schema_version) === 2)
                .map((assignment: any) => assignment.id);
            const { data: v2Items, error: v2ItemError } = v2AssignmentIds.length
                ? await admin
                    .from("assignment_items")
                    .select("assignment_id,item_type")
                    .in("assignment_id", v2AssignmentIds)
                : { data: [], error: null };
            if (v2ItemError) throw v2ItemError;

            const counts = new Map<number, number>();
            for (const item of items || []) {
                const assignmentId = Number(item.assignment_id);
                counts.set(assignmentId, (counts.get(assignmentId) || 0) + 1);
            }
            const v2Counts = new Map<number, { total: number; listening: number }>();
            for (const item of v2Items || []) {
                const assignmentId = Number(item.assignment_id);
                const current = v2Counts.get(assignmentId) || { total: 0, listening: 0 };
                current.total += 1;
                if (item.item_type === "listening") current.listening += 1;
                v2Counts.set(assignmentId, current);
            }

            return json(200, {
                success: true,
                assignments: visibleAssignments.map((assignment: any) => ({
                    ...assignment,
                    track_count: assignment.source_type === "multi_activity_v2"
                        ? (v2Counts.get(Number(assignment.id))?.listening || 0)
                        : (counts.get(Number(assignment.id)) || 0),
                    total_tasks: assignment.source_type === "multi_activity_v2"
                        ? (v2Counts.get(Number(assignment.id))?.total || 0)
                        : (Number(hasAiTask(assignment.source_type)) + Number(hasListeningTask(assignment.source_type)))
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
            if (assignment.source_type === "multi_activity_v2" && Number(assignment.schema_version) === 2) {
                return json(409, {
                    error: "混合作業 V2 的學生逐項進度將在下一階段啟用；目前可發布與保留不可變快照，但尚不可查看學生完成結果。",
                    code: "assignment_v2_results_not_ready"
                });
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
