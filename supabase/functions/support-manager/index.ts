import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";
import { ANONYMOUS_PLACEHOLDER_EMAIL, SYSTEM_SUBJECT_PREFIX, buildSystemReport } from "./system-report.ts";

const FIREBASE_PROJECT_ID = "alan-english-listening";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const ALLOWED_ORIGINS = new Set([
    "https://alanenglish.com.tw",
    "https://www.alanenglish.com.tw",
    "https://alan-english-listening.web.app",
    "https://alan-english-listening.firebaseapp.com",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000"
]);
const CATEGORIES = new Set(["account", "password", "payment", "activation_code", "ai_material", "course", "other"]);
const STATUSES = new Set(["open", "in_progress", "resolved", "closed"]);
const RESERVED_DOMAINS = new Set(["example.com", "example.net", "example.org", "example.invalid", "localhost"]);

const clean = (value: unknown, max = 500) => String(value || "").trim().slice(0, max);
const normalizeEmail = (value: unknown) => clean(value, 320).toLowerCase();
const isReceivableEmail = (email: string) => {
    const domain = email.split("@").pop() || "";
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !domain.endsWith(".invalid") && !RESERVED_DOMAINS.has(domain);
};
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

const verifyFirebase = async (req: Request) => {
    const header = req.headers.get("authorization") || "";
    if (!header.startsWith("Bearer ")) return null;
    const { payload } = await jwtVerify(header.slice(7), FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: FIREBASE_PROJECT_ID
    });
    return {
        uid: clean(payload.sub, 200),
        email: normalizeEmail(payload.email)
    };
};

Deno.serve(async req => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    if (req.method !== "POST") return json(req, 405, { success: false, error: "Method not allowed" });
    const origin = req.headers.get("origin") || "";
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
        return json(req, 403, { success: false, error: "這個網站來源不允許使用客服服務" });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const action = clean(body.action, 40) || "submit";
        let firebaseUser: Awaited<ReturnType<typeof verifyFirebase>> = null;
        try {
            firebaseUser = await verifyFirebase(req);
        } catch {
            if (action !== "submit" && action !== "system_report") return json(req, 401, { success: false, error: "登入驗證失敗，請重新登入" });
        }
        const admin = adminClient();

        if (action === "submit") {
            if (clean(body.website, 200)) return json(req, 200, { success: true });
            const name = clean(body.name, 100);
            const email = normalizeEmail(body.email || firebaseUser?.email);
            const category = clean(body.category, 40);
            const subject = clean(body.subject, 160);
            const message = clean(body.message, 4000);
            if (subject.startsWith(SYSTEM_SUBJECT_PREFIX)) return json(req, 400, { success: false, error: "主旨不能以「系統回報」開頭。" });
            if (!name || !isReceivableEmail(email) || !CATEGORIES.has(category) || subject.length < 3 || message.length < 10) {
                return json(req, 400, { success: false, error: "請完整填寫姓名、可收信 Email、問題類別、主旨與問題內容。" });
            }

            let studentId = null;
            if (firebaseUser?.uid) {
                const { data } = await admin.from("students").select("id").eq("firebase_uid", firebaseUser.uid).maybeSingle();
                studentId = data?.id || null;
            }

            const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { count } = await admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("requester_email", email).not("subject", "like", `${SYSTEM_SUBJECT_PREFIX}%`).gte("created_at", since);
            if ((count || 0) >= 3) return json(req, 429, { success: false, error: "一小時內送出次數已達上限，請稍後再試。" });

            const { data, error } = await admin.from("support_tickets").insert({
                student_id: studentId,
                requester_name: name,
                requester_email: email,
                category,
                subject,
                message,
                status: "open"
            }).select("id, created_at").single();
            if (error) throw error;
            return json(req, 200, { success: true, ticket: data });
        }

        if (action === "system_report") {
            // 身分只信任 token 驗證後查到的學生資料；前端傳來的姓名、信箱一律忽略。查不到學生資料的一律當匿名。
            let student: { id: number; name: string | null; chinese_name: string | null; role: string | null } | null = null;
            if (firebaseUser?.uid) {
                const { data } = await admin.from("students").select("id, name, chinese_name, role").eq("firebase_uid", firebaseUser.uid).maybeSingle();
                student = data || null;
            }
            const requesterEmail = student && firebaseUser?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(firebaseUser.email) ? firebaseUser.email : ANONYMOUS_PLACEHOLDER_EMAIL;
            const identity = {
                studentId: student?.id ?? null,
                name: student ? (clean(student.chinese_name, 60) || clean(student.name, 60) || `學生 #${student.id}`) : "未登入訪客",
                role: student?.role ?? null,
                email: requesterEmail === ANONYMOUS_PLACEHOLDER_EMAIL ? null : requesterEmail
            };
            const report = buildSystemReport(body, identity);
            if (!report) return json(req, 400, { success: false, error: "回報資料不正確" });

            // 同一份回報（補送）直接回傳既有案件，不重複新增
            const duplicate = await admin.from("support_tickets").select("id, created_at").like("subject", `%r:${report.reportId.slice(0, 12)}`).limit(1);
            if (duplicate.data?.length) return json(req, 200, { success: true, ticket: duplicate.data[0], duplicate: true });

            const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const prefixLike = `${SYSTEM_SUBJECT_PREFIX}%`;
            // 同一個人、同一種錯誤，一小時內若還有未結案的案件就不再新增
            let sameKind = admin.from("support_tickets").select("id, created_at").like("subject", `%#${report.signature} r:%`).in("status", ["open", "in_progress"]).gte("created_at", since).limit(1);
            sameKind = student ? sameKind.eq("student_id", student.id) : sameKind.eq("requester_email", ANONYMOUS_PLACEHOLDER_EMAIL);
            const same = await sameKind;
            if (same.data?.length) return json(req, 200, { success: true, ticket: same.data[0], duplicate: true });

            // 三層限流：個人（已登入）或匿名總量，再加全站總量，保護後台列表
            let personal = admin.from("support_tickets").select("id", { count: "exact", head: true }).like("subject", prefixLike).gte("created_at", since);
            personal = student ? personal.eq("student_id", student.id) : personal.eq("requester_email", ANONYMOUS_PLACEHOLDER_EMAIL);
            const { count: personalCount } = await personal;
            if ((personalCount || 0) >= (student ? 3 : 20)) return json(req, 429, { success: false, error: "已收到你的回報，請稍後再試。" });
            const { count: globalCount } = await admin.from("support_tickets").select("id", { count: "exact", head: true }).like("subject", prefixLike).gte("created_at", since);
            if ((globalCount || 0) >= 60) return json(req, 429, { success: false, error: "目前回報人數較多，請稍後再試。" });

            const { data, error } = await admin.from("support_tickets").insert({
                student_id: student?.id ?? null,
                requester_name: identity.name.slice(0, 100),
                requester_email: requesterEmail,
                category: "other",
                subject: report.subject,
                message: report.message,
                status: "open",
                priority: report.priority
            }).select("id, created_at").single();
            if (error) throw error;
            return json(req, 200, { success: true, ticket: data });
        }

        if (!firebaseUser?.uid) return json(req, 401, { success: false, error: "請先登入" });
        const { data: caller } = await admin.from("students").select("id, role").eq("firebase_uid", firebaseUser.uid).maybeSingle();
        if (caller?.role !== "admin") return json(req, 403, { success: false, error: "只有管理員可以操作客服案件" });

        if (action === "list") {
            const kind = clean(body.kind, 20);
            let query = admin.from("support_tickets").select("id, requester_name, requester_email, category, subject, message, status, priority, admin_note, created_at, updated_at, resolved_at");
            if (kind === "system") query = query.like("subject", `${SYSTEM_SUBJECT_PREFIX}%`);
            else if (kind === "customer") query = query.not("subject", "like", `${SYSTEM_SUBJECT_PREFIX}%`);
            const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
            if (error) throw error;
            return json(req, 200, { success: true, tickets: data || [] });
        }

        if (action === "update") {
            const id = Number(body.id);
            const status = clean(body.status, 30);
            if (!Number.isInteger(id) || !STATUSES.has(status)) return json(req, 400, { success: false, error: "客服案件資料不正確" });
            const updates = {
                status,
                admin_note: clean(body.admin_note, 4000) || null,
                resolved_at: ["resolved", "closed"].includes(status) ? new Date().toISOString() : null,
                resolved_by: ["resolved", "closed"].includes(status) ? caller.id : null,
                updated_at: new Date().toISOString()
            };
            const { data, error } = await admin.from("support_tickets").update(updates).eq("id", id).select("*").single();
            if (error) throw error;
            return json(req, 200, { success: true, ticket: data });
        }

        return json(req, 400, { success: false, error: "不支援的操作" });
    } catch (error) {
        console.error("support-manager error", error);
        return json(req, 500, { success: false, error: "客服服務暫時無法使用" });
    }
});
