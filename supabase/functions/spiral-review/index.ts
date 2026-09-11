import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { cleanText, verifyFirebaseRequest } from "../_shared/firebase-auth.ts";

const ALLOWED_ORIGINS = new Set([
    "https://alanenglish.com.tw",
    "https://www.alanenglish.com.tw",
    "https://alanenglish-student-test.netlify.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000"
]);
const CLASS_CODES = new Set(["E1", "E3", "E5", "E7"]);

const cors = (req: Request) => {
    const origin = req.headers.get("origin") || "";
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://alanenglish.com.tw",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin"
    };
};
const json = (req: Request, status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" }
});
const adminClient = () => createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { persistSession: false, autoRefreshToken: false } }
);
const positiveInteger = (value: unknown) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const taiwanDate = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
}).format(new Date());
const shuffle = <T>(items: T[]) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
};

const getManagedClasses = async (admin: any, caller: any) => {
    if (caller.role === "admin") return [...CLASS_CODES];
    if (caller.role !== "teacher") return [];
    const today = taiwanDate();
    const { data, error } = await admin.from("teacher_class_permissions")
        .select("can_publish,starts_at,ends_at,academy_classes(code)")
        .eq("teacher_id", caller.id)
        .eq("can_publish", true)
        .lte("starts_at", today)
        .or(`ends_at.is.null,ends_at.gte.${today}`);
    if (error) throw error;
    return (data || []).map((row: any) => Array.isArray(row.academy_classes)
        ? row.academy_classes[0]?.code
        : row.academy_classes?.code).filter((code: string) => CLASS_CODES.has(code));
};

const getActiveStudentClass = async (admin: any, studentId: number) => {
    const today = taiwanDate();
    const { data, error } = await admin.from("academy_enrollments")
        .select("scheduled_departure_at,academy_classes(code)")
        .eq("student_id", studentId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    const classCode = Array.isArray(data?.academy_classes) ? data.academy_classes[0]?.code : data?.academy_classes?.code;
    return data && CLASS_CODES.has(classCode) && (!data.scheduled_departure_at || data.scheduled_departure_at > today)
        ? classCode
        : null;
};

const getClassBookIds = async (admin: any, classCode: string) => {
    const today = taiwanDate();
    const { data: klass, error: classError } = await admin.from("academy_classes")
        .select("id").eq("code", classCode).eq("is_active", true).maybeSingle();
    if (classError) throw classError;
    if (!klass) return [];
    const { data: setting, error } = await admin.from("academy_class_material_settings")
        .select("academy_class_material_books(book_id)")
        .eq("class_id", klass.id)
        .eq("is_active", true)
        .lte("effective_from", today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return (setting?.academy_class_material_books || []).map((row: any) => Number(row.book_id)).filter(Boolean);
};

const cleanCards = (value: unknown) => {
    const cards = Array.isArray(value) ? value : [];
    const seen = new Set<string>();
    return cards.map((card: any, index: number) => ({
        card_type: cleanText(card?.card_type, 20) === "sentence" ? "sentence" : "word",
        prompt_en: cleanText(card?.prompt_en, 240),
        meaning_zh: cleanText(card?.meaning_zh, 240) || null,
        example_sentence: cleanText(card?.example_sentence, 500) || null,
        sort_order: index
    })).filter(card => {
        const key = card.prompt_en.toLocaleLowerCase("en-US");
        if (!card.prompt_en || /_{2,}|\[\s*\]|\(\s*\)|（\s*）/.test(card.prompt_en) || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const addAutoCard = (target: any[], seen: Set<string>, card: any) => {
    const prompt = cleanText(card?.prompt_en ?? card?.text ?? card?.english ?? card?.sentence ?? card?.word, 240)
        .replace(/^\s*\d+[.)]\s*/, "").trim();
    if (!prompt || /_{2,}|\[\s*\]|\(\s*\)|（\s*）/.test(prompt) || !/[A-Za-z]/.test(prompt)) return;
    const key = prompt.toLocaleLowerCase("en-US");
    if (seen.has(key)) return;
    seen.add(key);
    target.push({
        card_type: cleanText(card?.card_type, 20) === "sentence" || /\s/.test(prompt) ? "sentence" : "word",
        prompt_en: prompt,
        meaning_zh: cleanText(card?.meaning_zh ?? card?.meaning ?? card?.translation, 240) || null,
        example_sentence: cleanText(card?.example_sentence ?? card?.example, 500) || null
    });
};

const buildAutoCards = (rows: any[]) => {
    const cards: any[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
        const prompts = Array.isArray(row.pronunciation_prompts) ? row.pronunciation_prompts : [];
        for (const prompt of prompts) addAutoCard(cards, seen, typeof prompt === "string" ? { prompt_en: prompt } : prompt);
    }
    return cards.slice(0, 80);
};

const getPublishedPageRows = async (admin: any, bookId: number, pageStart: number, pageEnd: number) => {
    const { data, error } = await admin.from("book_page_spiral_review_content")
        .select("id,book_id,page_label,page_number,source_note,pronunciation_prompts,version")
        .eq("book_id", bookId).eq("status", "published")
        .gte("page_number", pageStart).lte("page_number", pageEnd)
        .order("page_number").order("version", { ascending: false });
    if (error) throw error;
    const latestByPage = new Map<number, any>();
    for (const row of data || []) {
        const pageNumber = Number(row.page_number);
        if (Number.isInteger(pageNumber) && !latestByPage.has(pageNumber)) {
            latestByPage.set(pageNumber, row);
        }
    }
    const missingPages = [];
    for (let page = pageStart; page <= pageEnd; page += 1) if (!latestByPage.has(page)) missingPages.push(page);
    return { rows: [...latestByPage.values()], missingPages };
};

const buildStudentQueue = async (admin: any, caller: any) => {
    const classCode = await getActiveStudentClass(admin, Number(caller.id));
    const today = taiwanDate();
    if (!classCode) return { class_code: null, due_count: 0, cards: [] };

    const { data: assignments, error: assignmentError } = await admin.from("spiral_review_assignments")
        .select("id,target_class,assigned_date,due_at,spiral_review_units!inner(id,title,page_start,page_end,status,books(id,name,code))")
        .eq("target_class", classCode)
        .eq("enabled", true)
        .eq("spiral_review_units.status", "published")
        .lte("assigned_date", today)
        .order("assigned_date", { ascending: false });
    if (assignmentError) throw assignmentError;
    const validAssignments = (assignments || []).filter((assignment: any) => assignment.spiral_review_units?.id);
    const assignmentIds = validAssignments.map((assignment: any) => Number(assignment.id));
    if (!assignmentIds.length) return { class_code: classCode, due_count: 0, cards: [] };

    const unitIds = [...new Set(validAssignments.map((assignment: any) => Number(assignment.spiral_review_units.id)))];
    const [{ data: cards, error: cardError }, { data: progress, error: progressError }] = await Promise.all([
        admin.from("spiral_review_cards").select("id,unit_id,card_type,prompt_en,meaning_zh,example_sentence,sort_order").in("unit_id", unitIds).order("sort_order"),
        admin.from("student_spiral_review_progress").select("assignment_id,card_id,review_step,next_review_at").eq("student_id", caller.id).in("assignment_id", assignmentIds)
    ]);
    if (cardError || progressError) throw cardError || progressError;

    const cardsByUnit = new Map<number, any[]>();
    for (const card of cards || []) cardsByUnit.set(Number(card.unit_id), [...(cardsByUnit.get(Number(card.unit_id)) || []), card]);
    const progressMap = new Map((progress || []).map((row: any) => [`${row.assignment_id}:${row.card_id}`, row]));
    const dueCards: any[] = [];

    for (const assignment of validAssignments) {
        const unit: any = assignment.spiral_review_units;
        const unitCards = cardsByUnit.get(Number(unit.id)) || [];
        for (const card of unitCards) {
            const cardProgress = progressMap.get(`${assignment.id}:${card.id}`);
            if (cardProgress?.next_review_at && cardProgress.next_review_at > today) continue;
            const distractors = shuffle(unitCards.filter(item => Number(item.id) !== Number(card.id))).slice(0, 5);
            if (distractors.length < 4) continue;
            dueCards.push({
                assignment_id: Number(assignment.id),
                card_id: Number(card.id),
                audio_text: card.prompt_en,
                hint_zh: card.meaning_zh,
                review_step: Number(cardProgress?.review_step || 0),
                unit: {
                    id: Number(unit.id), title: unit.title, page_start: unit.page_start, page_end: unit.page_end,
                    book: Array.isArray(unit.books) ? unit.books[0] : unit.books
                },
                choices: shuffle([card, ...distractors]).map(choice => ({ id: Number(choice.id), label: choice.prompt_en }))
            });
        }
    }
    return { class_code: classCode, due_count: dueCards.length, cards: shuffle(dueCards).slice(0, 20) };
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    if (req.method !== "POST") return json(req, 405, { success: false, error: "Method not allowed" });
    const origin = req.headers.get("origin") || "";
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json(req, 403, { success: false, error: "這個網站來源不允許使用螺旋複習" });

    try {
        const admin = adminClient();
        const caller = await verifyFirebaseRequest(req, admin);
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body.action, 50);

        if (action === "teacher_bootstrap") {
            const classes = await getManagedClasses(admin, caller);
            if (!classes.length) return json(req, 403, { success: false, error: "目前沒有可發布複習的班級權限" });
            const classBookEntries = await Promise.all(classes.map(async classCode => [classCode, await getClassBookIds(admin, classCode)]));
            const bookIdsByClass = Object.fromEntries(classBookEntries);
            const allBookIds = [...new Set(classBookEntries.flatMap(([, ids]) => ids))];
            const [{ data: books, error }, { data: sources, error: sourceError }] = await Promise.all([
                allBookIds.length
                    ? admin.from("books").select("id,name,code,content_scope").in("id", allBookIds).eq("content_scope", "formal").order("id")
                    : Promise.resolve({ data: [], error: null }),
                allBookIds.length
                    ? admin.from("book_page_spiral_review_content").select("book_id,page_number,source_note,version").in("book_id", allBookIds).eq("status", "published").order("version", { ascending: false })
                    : Promise.resolve({ data: [], error: null })
            ]);
            if (error || sourceError) throw error || sourceError;
            const sourcePagesByBook: Record<string, number[]> = {};
            for (const source of sources || []) {
                const page = Number(source.page_number);
                const key = String(source.book_id);
                if (!Number.isInteger(page)) continue;
                sourcePagesByBook[key] = [...new Set([...(sourcePagesByBook[key] || []), page])].sort((a, b) => a - b);
            }
            return json(req, 200, { success: true, classes, books: books || [], book_ids_by_class: bookIdsByClass, source_pages_by_book: sourcePagesByBook });
        }

        if (action === "preview_cards") {
            const classes = await getManagedClasses(admin, caller);
            const targetClass = cleanText(body.target_class, 10).toUpperCase();
            const bookId = positiveInteger(body.book_id);
            const pageStart = positiveInteger(body.page_start);
            const pageEnd = positiveInteger(body.page_end);
            if (!classes.includes(targetClass)) return json(req, 403, { success: false, error: "您沒有這個班級的發布權限" });
            if (!bookId || !pageStart || !pageEnd || pageEnd < pageStart || pageEnd - pageStart >= 80) {
                return json(req, 400, { success: false, error: "請確認教材與頁碼範圍" });
            }
            const allowedBookIds = await getClassBookIds(admin, targetClass);
            if (!allowedBookIds.includes(bookId)) return json(req, 403, { success: false, error: "這本教材不在目標班級目前生效的教材設定中" });
            const { rows, missingPages } = await getPublishedPageRows(admin, bookId, pageStart, pageEnd);
            if (missingPages.length) {
                return json(req, 409, { success: false, code: "PAGE_SOURCE_MISSING", missing_pages: missingPages, error: `以下頁碼尚未完成教材文字核准：P${missingPages.join("、P")}` });
            }
            const cards = buildAutoCards(rows);
            if (cards.length < 6) return json(req, 409, { success: false, code: "NOT_ENOUGH_CARDS", error: "這個範圍經人工核准的單字／句子不足 6 張，請擴大頁碼範圍；寫字頁、歌曲與未確認圖片題不會自動出題" });
            return json(req, 200, { success: true, cards, source_pages: rows.map(row => Number(row.page_number)) });
        }

        if (action === "create_review") {
            const classes = await getManagedClasses(admin, caller);
            const targetClass = cleanText(body.target_class, 10).toUpperCase();
            const bookId = positiveInteger(body.book_id);
            const pageStart = positiveInteger(body.page_start);
            const pageEnd = positiveInteger(body.page_end);
            const title = cleanText(body.title, 160);
            const unitLabel = cleanText(body.unit_label, 80) || null;
            const assignedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.assigned_date || "")) ? body.assigned_date : taiwanDate();
            const cards = cleanCards(body.cards);
            if (!classes.includes(targetClass)) return json(req, 403, { success: false, error: "您沒有這個班級的發布權限" });
            if (!bookId || !pageStart || !pageEnd || pageEnd < pageStart || pageEnd - pageStart >= 80 || !title) {
                return json(req, 400, { success: false, error: "請確認教材、標題與頁碼範圍" });
            }
            if (cards.length < 6 || cards.length > 80) {
                return json(req, 400, { success: false, error: "每份聽音選字複習需有 6–80 張不重複字卡" });
            }
            const allowedBookIds = await getClassBookIds(admin, targetClass);
            if (!allowedBookIds.includes(bookId)) {
                return json(req, 403, { success: false, error: "這本教材不在目標班級目前生效的教材設定中" });
            }
            const { missingPages } = await getPublishedPageRows(admin, bookId, pageStart, pageEnd);
            if (missingPages.length) return json(req, 409, { success: false, error: "教材文字來源已變更，請重新自動產生字卡後再發布" });
            const { data: book, error: bookError } = await admin.from("books").select("id").eq("id", bookId).eq("content_scope", "formal").maybeSingle();
            if (bookError) throw bookError;
            if (!book) return json(req, 404, { success: false, error: "找不到這本正式教材" });

            const { data: unit, error: unitError } = await admin.from("spiral_review_units").insert({
                book_id: bookId, title, unit_label: unitLabel, page_start: pageStart, page_end: pageEnd,
                status: "published", created_by: caller.id
            }).select("id").single();
            if (unitError) throw unitError;
            try {
                const { error: cardError } = await admin.from("spiral_review_cards").insert(cards.map(card => ({ ...card, unit_id: unit.id })));
                if (cardError) throw cardError;
                const { data: assignment, error: assignmentError } = await admin.from("spiral_review_assignments").insert({
                    unit_id: unit.id, target_class: targetClass, assigned_date: assignedDate, enabled: true, created_by: caller.id
                }).select("id").single();
                if (assignmentError) throw assignmentError;
                return json(req, 200, { success: true, unit_id: Number(unit.id), assignment_id: Number(assignment.id), card_count: cards.length });
            } catch (error) {
                await admin.from("spiral_review_units").delete().eq("id", unit.id);
                throw error;
            }
        }

        if (action === "student_queue") {
            if (caller.role !== "student") return json(req, 403, { success: false, error: "只有學生帳號可以進行複習" });
            return json(req, 200, { success: true, ...(await buildStudentQueue(admin, caller)) });
        }

        if (action === "submit_answer") {
            if (caller.role !== "student") return json(req, 403, { success: false, error: "只有學生帳號可以提交答案" });
            const assignmentId = positiveInteger(body.assignment_id);
            const cardId = positiveInteger(body.card_id);
            const selectedCardId = positiveInteger(body.selected_card_id);
            const requestKey = cleanText(body.request_key, 80);
            if (!assignmentId || !cardId || !selectedCardId || !/^[0-9a-f-]{36}$/i.test(requestKey)) {
                return json(req, 400, { success: false, error: "作答資料不完整" });
            }
            const { data, error } = await admin.rpc("submit_spiral_review_answer", {
                p_student_id: caller.id,
                p_assignment_id: assignmentId,
                p_card_id: cardId,
                p_selected_card_id: selectedCardId,
                p_request_key: requestKey
            });
            if (error) throw error;
            const result = data?.[0];
            return json(req, 200, { success: true, ...result });
        }

        return json(req, 400, { success: false, error: "不支援的螺旋複習操作" });
    } catch (error) {
        console.error("spiral-review error", error);
        const status = Number((error as any)?.status || 500);
        return json(req, status, { success: false, error: status >= 500 ? "螺旋複習服務暫時無法使用" : (error as Error).message });
    }
});
