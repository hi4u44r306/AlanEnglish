import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";
import { createR2PresignedUrl } from "../_shared/r2.ts";

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
const STAFF_ROLES = new Set(["teacher", "admin"]);
const SIGNED_URL_SECONDS = 60 * 60;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const cleanText = (value: unknown, maxLength = 300) => String(value || "")
    .trim()
    .slice(0, maxLength);

const relationOne = (value: any) => Array.isArray(value) ? value[0] || null : value || null;

const normalizeLevelProgress = (progress: any) => progress ? ({
    ...progress,
    learning_levels: relationOne(progress.learning_levels)
}) : null;

const normalizeBook = (book: any) => ({
    ...book,
    learning_levels: relationOne(book?.learning_levels)
});

async function verifyFirebaseIdToken(token: string) {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: FIREBASE_PROJECT_ID
    });
    const uid = cleanText(payload.sub, 200);
    if (!uid) throw new Error("Firebase token 缺少 uid");
    return uid;
}

const effectiveMembershipEnd = (membership: any) => {
    const candidates = [
        membership?.trial_ends_at,
        membership?.access_ends_at,
        membership?.current_period_end
    ]
        .map(value => value ? new Date(value).getTime() : Number.NaN)
        .filter(Number.isFinite);
    return candidates.length > 0 ? Math.max(...candidates) : null;
};

const membershipIsActive = (membership: any, role: string) => {
    if (STAFF_ROLES.has(role)) return true;
    const status = cleanText(membership?.status, 40);
    if (!["trialing", "active", "cancelled", "complimentary"].includes(status)) return false;
    const end = effectiveMembershipEnd(membership);
    return status === "cancelled" ? end !== null && end > Date.now() : end === null || end > Date.now();
};

const normalizeStoragePath = (value: unknown) => {
    const raw = cleanText(value, 2000);
    if (!raw) return "";
    if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, "");
    try {
        const url = new URL(raw);
        const markers = ["/storage/v1/object/public/music/", "/storage/v1/object/sign/music/"];
        for (const marker of markers) {
            const index = url.pathname.indexOf(marker);
            if (index >= 0) return decodeURIComponent(url.pathname.slice(index + marker.length));
        }
    } catch {
        return "";
    }
    return "";
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    try {
        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
        if (!token) return json(401, { error: "請先登入 Alan English" });

        let firebaseUid = "";
        try {
            firebaseUid = await verifyFirebaseIdToken(token);
        } catch {
            return json(401, { error: "登入驗證失敗，請重新登入" });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "伺服器設定不完整" });
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        const { data: student, error: studentError } = await admin
            .from("students")
            .select("id,name,role")
            .eq("firebase_uid", firebaseUid)
            .maybeSingle();
        if (studentError) throw studentError;
        if (!student) return json(404, { error: "找不到 Alan English 帳號" });

        const [membershipResult, levelResult] = await Promise.all([
            admin
                .from("memberships")
                .select("status,trial_ends_at,access_ends_at,current_period_end,subscription_plans(code,features)")
                .eq("student_id", student.id)
                .maybeSingle(),
            admin
                .from("student_level_progress")
                .select("unlocked_rank,current_level_id,learning_levels(id,code,name_zh,name_en,rank,badge_color)")
                .eq("student_id", student.id)
                .maybeSingle()
        ]);
        if (membershipResult.error) throw membershipResult.error;
        if (levelResult.error) throw levelResult.error;
        const membership = membershipResult.data;
        const levelProgress = normalizeLevelProgress(levelResult.data);
        const staff = STAFF_ROLES.has(student.role);
        const active = membershipIsActive(membership, student.role);
        const accessPlan = relationOne(membership?.subscription_plans);
        const listeningAllowed = staff || !accessPlan || accessPlan.features?.listening === true;
        const unlockedRank = staff ? 999 : Number(levelProgress?.unlocked_rank || 1);

        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action || "catalog", 50);

        if (action === "catalog") {
            const [categoriesResult, booksResult, levelsResult] = await Promise.all([
                admin
                    .from("book_categories")
                    .select("id,name,code,sort_order,enabled")
                    .eq("enabled", true)
                    .order("sort_order", { ascending: true }),
                admin
                    .from("books")
                    .select("id,category_id,name,code,sort_order,enabled,required_level_id,learning_levels(id,code,name_zh,name_en,rank,badge_color)")
                    .eq("enabled", true)
                    .is("archived_at", null)
                    .order("sort_order", { ascending: true }),
                admin
                    .from("learning_levels")
                    .select("id,code,name_zh,name_en,rank,description,badge_color")
                    .eq("enabled", true)
                    .order("rank", { ascending: true })
            ]);
            const firstError = [categoriesResult.error, booksResult.error, levelsResult.error].find(Boolean);
            if (firstError) throw firstError;
            const books = (booksResult.data || []).map((rawBook: any) => {
                const book = normalizeBook(rawBook);
                const requiredRank = Number(book.learning_levels?.rank || 1);
                return {
                    ...book,
                    required_rank: requiredRank,
                    locked: !staff && (!active || !listeningAllowed || requiredRank > unlockedRank)
                };
            });
            return json(200, {
                success: true,
                access: {
                    membership_active: active,
                    role: student.role,
                    unlocked_rank: unlockedRank,
                    current_level: levelProgress?.learning_levels || null
                },
                levels: levelsResult.data || [],
                categories: (categoriesResult.data || []).map((category: any) => ({
                    ...category,
                    books: books.filter((book: any) => book.category_id === category.id)
                }))
            });
        }

        if (action === "book") {
            if (!active) {
                return json(402, {
                    error: "會員使用期限已結束，請續訂或輸入教材啟用碼",
                    code: "membership_required"
                });
            }
            if (!listeningAllowed) {
                return json(403, { error: "目前方案不包含分級聽力教材，請升級方案", code: "plan_upgrade_required" });
            }
            const bookCode = cleanText(body?.book_code, 120);
            if (!bookCode) return json(400, { error: "缺少教材代碼" });
            const { data: book, error: bookError } = await admin
                .from("books")
                .select("id,category_id,name,code,sort_order,enabled,required_level_id,learning_levels(id,code,name_zh,name_en,rank,badge_color)")
                .eq("code", bookCode)
                .eq("enabled", true)
                .is("archived_at", null)
                .maybeSingle();
            if (bookError) throw bookError;
            if (!book) return json(404, { error: "找不到教材" });
            const normalizedBook = normalizeBook(book);

            const requiredRank = Number(normalizedBook.learning_levels?.rank || 1);
            if (!staff && requiredRank > unlockedRank) {
                return json(403, {
                    error: `這本教材需要通過 ${normalizedBook.learning_levels?.name_zh || "下一級"} 晉級測驗`,
                    code: "level_locked",
                    required_level: normalizedBook.learning_levels,
                    unlocked_rank: unlockedRank
                });
            }

            const { data: tracks, error: tracksError } = await admin
                .from("music_tracks")
                .select("id,book_id,page,title,music_name,audio_url,image,sort_order,track_type,part_number,display_page,track_key,base_page,storage_provider")
                .eq("book_id", normalizedBook.id)
                .eq("enabled", true)
                .order("sort_order", { ascending: true });
            if (tracksError) throw tracksError;

            const supabasePaths = (tracks || [])
                .filter((track: any) => track.storage_provider !== "r2")
                .map((track: any) => normalizeStoragePath(track.audio_url));
            const validPaths = [...new Set(supabasePaths.filter(Boolean))];
            const signedUrlMap = new Map<string, string>();
            if (validPaths.length > 0) {
                const { data: signedRows, error: signedError } = await admin.storage
                    .from("music")
                    .createSignedUrls(validPaths, SIGNED_URL_SECONDS);
                if (signedError) throw signedError;
                for (const row of signedRows || []) {
                    if (row.path && row.signedUrl) signedUrlMap.set(row.path, row.signedUrl);
                }
            }

            const r2Tracks = (tracks || []).filter((track: any) => track.storage_provider === "r2");
            await Promise.all(r2Tracks.map(async (track: any) => {
                const path = normalizeStoragePath(track.audio_url);
                if (path) signedUrlMap.set(`r2:${path}`, await createR2PresignedUrl(path, "GET", SIGNED_URL_SECONDS));
            }));

            return json(200, {
                success: true,
                book: {
                    ...normalizedBook,
                    required_rank: requiredRank,
                    locked: false
                },
                tracks: (tracks || []).map((track: any) => {
                    const path = normalizeStoragePath(track.audio_url);
                    return {
                        ...track,
                        storage_path: path,
                        audio_url: signedUrlMap.get(track.storage_provider === "r2" ? `r2:${path}` : path) || null
                    };
                }),
                signed_url_expires_in: SIGNED_URL_SECONDS
            });
        }

        return json(400, { error: "不支援的教材操作" });
    } catch (error) {
        console.error("content-access unexpected error", error);
        return json(500, {
            error: error instanceof Error ? error.message : "教材服務暫時無法使用"
        });
    }
});
