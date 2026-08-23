import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "npm:jose@5";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const FIREBASE_PROJECT_ID = "alan-english-listening";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);
const FIREBASE_LINKS_URL = "https://alan-english-listening-default-rtdb.firebaseio.com/links.json";
const ALLOWED_CATEGORIES = new Set(["special", "exercise", "listening", "discovery", "speedphonics"]);

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});

const cleanText = (value: unknown, maxLength = 200) => String(value ?? "")
    .trim()
    .slice(0, maxLength);

const normalizeEmail = (value: unknown) => cleanText(value, 320).toLowerCase();

const normalizeCategory = (value: unknown, title: unknown = "") => {
    const explicit = cleanText(value, 40).toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");
    if (explicit === "workbook") return "exercise";
    if (explicit === "speed phonics" || explicit === "speedphonics") return "speedphonics";
    if (ALLOWED_CATEGORIES.has(explicit)) return explicit;

    const normalizedTitle = cleanText(title, 120).toLowerCase();
    if (normalizedTitle.includes("習作本")) return "exercise";
    if (normalizedTitle.includes("聽力本")) return "listening";
    if (normalizedTitle.includes("discovery")) return "discovery";
    if (normalizedTitle.includes("speed phonics") || normalizedTitle.includes("speedphonics")) return "speedphonics";
    return "special";
};

const normalizeSortOrder = (value: unknown, fallback = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(-100000, Math.min(100000, Math.trunc(parsed)));
};

const normalizeHttpUrl = (value: unknown) => {
    const text = cleanText(value, 2000);
    if (!text) return "";
    try {
        const parsed = new URL(text);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
        return parsed.toString();
    } catch {
        return "";
    }
};

type VerifiedFirebaseUser = {
    uid: string;
    email: string;
    payload: JWTPayload;
};

async function verifyFirebaseIdToken(token: string): Promise<VerifiedFirebaseUser> {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: FIREBASE_PROJECT_ID
    });
    const uid = cleanText(payload.sub, 200);
    if (!uid) throw new Error("Firebase token 缺少 uid");
    return {
        uid,
        email: normalizeEmail(payload.email),
        payload
    };
}

const getSupabaseAdmin = () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase 伺服器設定不完整");
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
};

const findCaller = async (admin: any, firebaseUser: VerifiedFirebaseUser) => {
    const { data: byUid, error: uidError } = await admin
        .from("students")
        .select("id,firebase_uid,email,name,role")
        .eq("firebase_uid", firebaseUser.uid)
        .maybeSingle();
    if (uidError) throw uidError;
    if (byUid) return byUid;

    if (!firebaseUser.email) return null;
    const { data: byEmail, error: emailError } = await admin
        .from("students")
        .select("id,firebase_uid,email,name,role")
        .ilike("email", firebaseUser.email)
        .maybeSingle();
    if (emailError) throw emailError;
    return byEmail || null;
};

const loadLinks = async (admin: any) => {
    const { data, error } = await admin
        .from("links")
        .select("id,firebase_key,title,url,category,sort_order,is_active,source,created_by,created_at,updated_at")
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });
    if (error) throw error;
    return data || [];
};

const importFirebaseLinks = async (admin: any, firebaseToken: string, callerId: number) => {
    const databaseSecret = cleanText(Deno.env.get("FIREBASE_DATABASE_SECRET"), 4000);
    const firebaseCredential = databaseSecret || firebaseToken;
    const firebaseUrl = new URL(FIREBASE_LINKS_URL);
    firebaseUrl.searchParams.set("auth", firebaseCredential);

    const response = await fetch(firebaseUrl.toString(), {
        method: "GET",
        headers: { "Accept": "application/json" }
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const firebaseMessage = cleanText(payload?.error, 200);
        const permissionDenied = response.status === 401 || response.status === 403 || /permission denied/i.test(firebaseMessage);

        if (permissionDenied && !databaseSecret) {
            const error = new Error(
                "Firebase links 目前受 Realtime Database Rules 保護，且 Supabase 尚未設定 FIREBASE_DATABASE_SECRET。"
            );
            (error as any).code = "FIREBASE_DATABASE_CREDENTIAL_REQUIRED";
            throw error;
        }

        const detail = firebaseMessage ? `：${firebaseMessage}` : "";
        throw new Error(`Firebase links 讀取失敗${detail}`);
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return {
            imported: 0,
            skipped: 0,
            total: 0,
            credential: databaseSecret ? "database_secret" : "firebase_user_token"
        };
    }

    const now = new Date().toISOString();
    let skipped = 0;
    const rows = Object.entries(payload).flatMap(([firebaseKey, rawItem]: [string, any], index) => {
        const title = cleanText(rawItem?.title, 120);
        const url = normalizeHttpUrl(rawItem?.url);
        if (!title || !url) {
            skipped += 1;
            return [];
        }

        const legacyCreatedAt = Number(rawItem?.createdAt ?? rawItem?.created_at);
        const createdAt = Number.isFinite(legacyCreatedAt) && legacyCreatedAt > 0
            ? new Date(legacyCreatedAt).toISOString()
            : now;

        return [{
            firebase_key: cleanText(firebaseKey, 300),
            title,
            url,
            category: normalizeCategory(rawItem?.category, title),
            sort_order: normalizeSortOrder(rawItem?.sort_order ?? rawItem?.sortOrder, index * 10),
            is_active: rawItem?.is_active !== false && rawItem?.active !== false,
            source: "firebase_import",
            created_by: callerId,
            created_at: createdAt,
            updated_at: now
        }];
    });

    if (rows.length === 0) {
        return {
            imported: 0,
            skipped,
            total: Object.keys(payload).length,
            credential: databaseSecret ? "database_secret" : "firebase_user_token"
        };
    }

    const { error } = await admin
        .from("links")
        .upsert(rows, { onConflict: "firebase_key" });
    if (error) throw error;

    return {
        imported: rows.length,
        skipped,
        total: Object.keys(payload).length,
        credential: databaseSecret ? "database_secret" : "firebase_user_token"
    };
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    try {
        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
        if (!token) return json(401, { error: "請先登入 Alan English" });

        let firebaseUser: VerifiedFirebaseUser;
        try {
            firebaseUser = await verifyFirebaseIdToken(token);
        } catch (error) {
            console.error("link-manager Firebase token verify error", error);
            return json(401, { error: "登入驗證失敗，請重新登入" });
        }

        const admin = getSupabaseAdmin();
        const caller = await findCaller(admin, firebaseUser);
        if (!caller) return json(404, { error: "找不到 Alan English 帳號" });
        if (caller.role !== "admin") return json(403, { error: "只有管理員可以管理教材連結" });

        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action || "list", 80);

        if (action === "list") {
            return json(200, { success: true, links: await loadLinks(admin) });
        }

        if (action === "bootstrap") {
            const existing = await loadLinks(admin);
            if (existing.length > 0) {
                return json(200, { success: true, links: existing, migration: null });
            }
            const migration = await importFirebaseLinks(admin, token, Number(caller.id));
            return json(200, { success: true, links: await loadLinks(admin), migration });
        }

        if (action === "import_firebase") {
            const migration = await importFirebaseLinks(admin, token, Number(caller.id));
            return json(200, { success: true, links: await loadLinks(admin), migration });
        }

        if (action === "create") {
            const title = cleanText(body?.title, 120);
            const url = normalizeHttpUrl(body?.url);
            const category = normalizeCategory(body?.category, title);
            const sortOrder = normalizeSortOrder(body?.sort_order, 0);
            if (!title) return json(400, { error: "請輸入教材名稱" });
            if (!url) return json(400, { error: "網址格式不正確" });

            const { data, error } = await admin
                .from("links")
                .insert({
                    title,
                    url,
                    category,
                    sort_order: sortOrder,
                    is_active: body?.is_active !== false,
                    source: "manual",
                    created_by: caller.id,
                    updated_at: new Date().toISOString()
                })
                .select("id,firebase_key,title,url,category,sort_order,is_active,source,created_by,created_at,updated_at")
                .single();
            if (error) throw error;
            return json(201, { success: true, link: data });
        }

        if (action === "update") {
            const id = Number(body?.id);
            const title = cleanText(body?.title, 120);
            const url = normalizeHttpUrl(body?.url);
            const category = normalizeCategory(body?.category, title);
            if (!Number.isInteger(id) || id <= 0) return json(400, { error: "連結 id 不正確" });
            if (!title) return json(400, { error: "請輸入教材名稱" });
            if (!url) return json(400, { error: "網址格式不正確" });

            const { data, error } = await admin
                .from("links")
                .update({
                    title,
                    url,
                    category,
                    sort_order: normalizeSortOrder(body?.sort_order, 0),
                    is_active: body?.is_active !== false,
                    updated_at: new Date().toISOString()
                })
                .eq("id", id)
                .select("id,firebase_key,title,url,category,sort_order,is_active,source,created_by,created_at,updated_at")
                .maybeSingle();
            if (error) throw error;
            if (!data) return json(404, { error: "找不到連結" });
            return json(200, { success: true, link: data });
        }

        if (action === "delete") {
            const id = Number(body?.id);
            if (!Number.isInteger(id) || id <= 0) return json(400, { error: "連結 id 不正確" });
            const { error } = await admin.from("links").delete().eq("id", id);
            if (error) throw error;
            return json(200, { success: true });
        }

        return json(400, { error: "不支援的教材連結操作" });
    } catch (error) {
        console.error("link-manager unexpected error", error);
        const code = cleanText((error as any)?.code, 100) || null;
        return json(code === "FIREBASE_DATABASE_CREDENTIAL_REQUIRED" ? 409 : 500, {
            error: error instanceof Error ? error.message : "教材連結服務暫時無法使用",
            code
        });
    }
});
