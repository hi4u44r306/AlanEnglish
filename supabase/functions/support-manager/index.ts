import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const FIREBASE_PROJECT_ID = "alan-english-listening";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const ALLOWED_ORIGINS = new Set([
    "https://alanenglish.com.tw",
    "https://www.alanenglish.com.tw",
    "https://staging--alanenglish.netlify.app",
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
            if (action !== "submit") return json(req, 401, { success: false, error: "登入驗證失敗，請重新登入" });
        }
        const admin = adminClient();

        if (action === "submit") {
            if (clean(body.website, 200)) return json(req, 200, { success: true });
            const name = clean(body.name, 100);
            const email = normalizeEmail(body.email || firebaseUser?.email);
            const category = clean(body.category, 40);
            const subject = clean(body.subject, 160);
            const message = clean(body.message, 4000);
            if (!name || !isReceivableEmail(email) || !CATEGORIES.has(category) || subject.length < 3 || message.length < 10) {
                return json(req, 400, { success: false, error: "請完整填寫姓名、可收信 Email、問題類別、主旨與問題內容。" });
            }

            let studentId = null;
            if (firebaseUser?.uid) {
                const { data } = await admin.from("students").select("id").eq("firebase_uid", firebaseUser.uid).maybeSingle();
                studentId = data?.id || null;
            }

            const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { count } = await admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("requester_email", email).gte("created_at", since);
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

        if (!firebaseUser?.uid) return json(req, 401, { success: false, error: "請先登入" });
        const { data: caller } = await admin.from("students").select("id, role").eq("firebase_uid", firebaseUser.uid).maybeSingle();
        if (caller?.role !== "admin") return json(req, 403, { success: false, error: "只有管理員可以操作客服案件" });

        if (action === "list") {
            const { data, error } = await admin.from("support_tickets").select("id, requester_name, requester_email, category, subject, message, status, priority, admin_note, created_at, updated_at, resolved_at").order("created_at", { ascending: false }).limit(200);
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
