import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const FIREBASE_PROJECT_ID = "alan-english-listening";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const cleanText = (value: unknown, maxLength = 200) => String(value || "").trim().slice(0, maxLength);

async function verifyFirebaseIdToken(token: string) {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, { issuer: FIREBASE_ISSUER, audience: FIREBASE_PROJECT_ID });
    const uid = cleanText(payload.sub, 200);
    if (!uid) throw new Error("Firebase token 缺少 uid");
    return uid;
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    try {
        const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
        if (!token) return json(401, { error: "請先登入 Alan English" });
        let firebaseUid = "";
        try { firebaseUid = await verifyFirebaseIdToken(token); } catch { return json(401, { error: "登入驗證失敗，請重新登入" }); }
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "伺服器設定不完整" });
        const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: caller, error: callerError } = await admin.from("students").select("id,role").eq("firebase_uid", firebaseUid).maybeSingle();
        if (callerError) throw callerError;
        if (!caller || caller.role !== "admin") return json(403, { error: "只有管理員可以編輯教材導覽" });
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action, 80);

        if (action === "bootstrap") {
            const [categories, books] = await Promise.all([
                admin.from("book_categories").select("*").order("sort_order"),
                admin.from("books").select("*").order("category_id").order("sort_order")
            ]);
            const error = categories.error || books.error;
            if (error) throw error;
            return json(200, { success: true, categories: categories.data || [], books: books.data || [] });
        }

        if (action === "add_category") {
            const name = cleanText(body?.name, 120);
            const code = cleanText(body?.code, 80);
            if (!name || !/^[A-Za-z0-9_-]{2,80}$/.test(code)) return json(400, { error: "分類名稱或 Code 格式不正確" });
            const { data: last } = await admin.from("book_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
            const { data, error } = await admin.from("book_categories").insert({ name, code, sort_order: Number(last?.sort_order || 0) + 1, enabled: true }).select("*").single();
            if (error) return json(error.code === "23505" ? 409 : 500, { error: error.code === "23505" ? "分類 Code 已存在" : error.message });
            return json(201, { success: true, category: data });
        }

        if (action === "add_book") {
            const categoryId = Number(body?.category_id);
            const name = cleanText(body?.name, 120);
            const code = cleanText(body?.code, 80);
            if (!Number.isInteger(categoryId) || categoryId <= 0 || !name || !/^[A-Za-z0-9_-]{2,80}$/.test(code)) return json(400, { error: "教材資料格式不正確" });
            const { data: category } = await admin.from("book_categories").select("id").eq("id", categoryId).maybeSingle();
            if (!category) return json(404, { error: "找不到教材分類" });
            const { data: last } = await admin.from("books").select("sort_order").eq("category_id", categoryId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
            const { data, error } = await admin.from("books").insert({ category_id: categoryId, name, code, sort_order: Number(last?.sort_order || 0) + 1, enabled: true }).select("*").single();
            if (error) return json(error.code === "23505" ? 409 : 500, { error: error.code === "23505" ? "教材 Code 已存在" : error.message });
            return json(201, { success: true, book: data });
        }

        if (action === "update_book") {
            const bookId = Number(body?.book_id);
            if (!Number.isInteger(bookId) || bookId <= 0) return json(400, { error: "教材編號不正確" });
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (typeof body?.enabled === "boolean") updates.enabled = body.enabled;
            if (body?.name !== undefined) {
                const name = cleanText(body.name, 120);
                if (!name) return json(400, { error: "教材名稱不能空白" });
                updates.name = name;
            }
            if (body?.code !== undefined) {
                const code = cleanText(body.code, 80);
                if (!/^[A-Za-z0-9_-]{2,80}$/.test(code)) return json(400, { error: "教材 Code 格式不正確" });
                updates.code = code;
            }
            if (Object.keys(updates).length === 1) return json(400, { error: "沒有需要修改的欄位" });
            const { data, error } = await admin.from("books").update(updates).eq("id", bookId).select("*").single();
            if (error) return json(error.code === "23505" ? 409 : 500, { error: error.code === "23505" ? "教材 Code 已存在" : error.message });
            return json(200, { success: true, book: data });
        }

        if (action === "delete_book") {
            const bookId = Number(body?.book_id);
            if (!Number.isInteger(bookId) || bookId <= 0) return json(400, { error: "教材編號不正確" });
            const { count: trackCount, error: trackError } = await admin.from("music_tracks").select("id", { count: "exact", head: true }).eq("book_id", bookId);
            if (trackError) throw trackError;
            if (Number(trackCount || 0) > 0) return json(409, { error: `此教材仍有 ${trackCount} 個音檔，為保護學習紀錄不能永久刪除；請改用隱藏教材。` });
            const { error } = await admin.from("books").delete().eq("id", bookId);
            if (error) return json(409, { error: `教材仍被其他資料使用，無法刪除：${error.message}` });
            return json(200, { success: true });
        }

        if (action === "delete_category") {
            const categoryId = Number(body?.category_id);
            if (!Number.isInteger(categoryId) || categoryId <= 0) return json(400, { error: "分類編號不正確" });
            const { count, error: countError } = await admin.from("books").select("id", { count: "exact", head: true }).eq("category_id", categoryId);
            if (countError) throw countError;
            if (Number(count || 0) > 0) return json(409, { error: "分類下仍有教材，請先移除教材" });
            const { error } = await admin.from("book_categories").delete().eq("id", categoryId);
            if (error) throw error;
            return json(200, { success: true });
        }
        return json(400, { error: "不支援的教材管理操作" });
    } catch (error) {
        console.error("catalog-admin unexpected error", error);
        return json(500, { error: error instanceof Error ? error.message : "教材管理服務暫時無法使用" });
    }
});
