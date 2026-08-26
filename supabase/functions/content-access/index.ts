import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";
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

const isBookAuthorized = async (admin: any, student: any, effectiveAccess: any, book: any) => {
    if (STAFF_ROLES.has(student.role)) return true;
    if (!effectiveAccess.is_active || !effectiveAccess.features.listening) return false;
    if (book.content_scope === "showcase") return false;
    if (book.content_scope === "trial") {
        return effectiveAccess.learner_type === "trial_user"
            && effectiveAccess.plan_codes.includes("trial_7_day");
    }
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const direct = await admin.from("student_book_entitlements").select("id").eq("student_id", student.id)
        .eq("book_id", book.id).eq("status", "active").lte("starts_at", now)
        .is("revoked_at", null).or(`is_permanent.eq.true,ends_at.is.null,ends_at.gt.${now}`).limit(1);
    if (direct.error) throw direct.error;
    if (direct.data?.length) return true;

    const enrollment = await admin.from("academy_enrollments").select("id,class_id")
        .eq("student_id", student.id).eq("status", "active").lte("enrolled_at", today)
        .or(`access_ends_at.is.null,access_ends_at.gte.${today}`)
        .or(`scheduled_departure_at.is.null,scheduled_departure_at.gt.${today}`).limit(1).maybeSingle();
    if (enrollment.error) throw enrollment.error;
    if (enrollment.data) {
        const setting = await admin.from("academy_class_material_settings").select("id")
            .eq("class_id", enrollment.data.class_id).eq("is_active", true).lte("effective_from", today)
            .or(`effective_to.is.null,effective_to.gte.${today}`).order("version", { ascending: false }).limit(1).maybeSingle();
        if (setting.error) throw setting.error;
        if (setting.data) {
            const allowed = await admin.from("academy_class_material_books").select("id")
                .eq("setting_id", setting.data.id).eq("book_id", book.id).limit(1).maybeSingle();
            if (allowed.error) throw allowed.error;
            if (allowed.data) return true;
        }
    }
    const assignments = await admin.from("assignments").select("id,due_at")
        .eq("target_class", student.class).eq("enabled", true);
    if (assignments.error) throw assignments.error;
    const activeAssignmentIds = (assignments.data || [])
        .filter((assignment: any) => !assignment.due_at || assignment.due_at > now)
        .map((assignment: any) => assignment.id);
    if (!activeAssignmentIds.length) return false;
    const items = await admin.from("assignment_track_items").select("book_id_snapshot,track_id_snapshot,track_id")
        .in("assignment_id", activeAssignmentIds);
    if (items.error) throw items.error;
    if ((items.data || []).some((item: any) => Number(item.book_id_snapshot) === Number(book.id))) return true;
    const trackIds = [...new Set((items.data || []).map((item: any) => Number(item.track_id_snapshot || item.track_id)).filter(Boolean))];
    if (!trackIds.length) return false;
    const legacyTrack = await admin.from("music_tracks").select("id").in("id", trackIds).eq("book_id", book.id).limit(1);
    if (legacyTrack.error) throw legacyTrack.error;
    return Boolean(legacyTrack.data?.length);
};

async function verifyFirebaseIdToken(token: string) {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: FIREBASE_PROJECT_ID
    });
    const uid = cleanText(payload.sub, 200);
    if (!uid) throw new Error("Firebase token 缺少 uid");
    return uid;
}

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

        const [effectiveAccess, levelResult] = await Promise.all([
            loadEffectiveAccess(admin, Number(student.id)),
            admin
                .from("student_level_progress")
                .select("unlocked_rank,current_level_id,learning_levels(id,code,name_zh,name_en,rank,badge_color)")
                .eq("student_id", student.id)
                .maybeSingle()
        ]);
        if (levelResult.error) throw levelResult.error;
        const levelProgress = normalizeLevelProgress(levelResult.data);
        const staff = STAFF_ROLES.has(student.role);
        const active = effectiveAccess.is_active;
        const listeningAllowed = effectiveAccess.features.listening;
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
                    .select("id,category_id,name,code,sort_order,enabled,required_level_id,content_scope,description,preview_image_url,learning_levels(id,code,name_zh,name_en,rank,badge_color)")
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
            const books = await Promise.all((booksResult.data || []).map(async (rawBook: any) => {
                const book = normalizeBook(rawBook);
                const requiredRank = Number(book.learning_levels?.rank || 1);
                const authorized = await isBookAuthorized(admin, student, effectiveAccess, book);
                return {
                    ...book,
                    required_rank: requiredRank,
                    entitled: authorized,
                    locked: !staff && (!active || !listeningAllowed || !authorized || requiredRank > unlockedRank),
                    lock_reason: !active ? "membership_required" : !authorized ? "book_entitlement_required" : requiredRank > unlockedRank ? "level_locked" : null,
                    acquisition: authorized ? null : book.content_scope === "trial" ? "/freetrial" : "/materials"
                };
            }));
            return json(200, {
                success: true,
                access: {
                    membership_active: active,
                    role: student.role,
                    learner_type: effectiveAccess.learner_type,
                    effective_access_end: effectiveAccess.effective_access_end,
                    days_remaining: effectiveAccess.days_remaining,
                    plan_codes: effectiveAccess.plan_codes,
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
                .select("id,category_id,name,code,sort_order,enabled,required_level_id,content_scope,description,preview_image_url,learning_levels(id,code,name_zh,name_en,rank,badge_color)")
                .eq("code", bookCode)
                .eq("enabled", true)
                .is("archived_at", null)
                .maybeSingle();
            if (bookError) throw bookError;
            if (!book) return json(404, { error: "找不到教材" });
            const normalizedBook = normalizeBook(book);

            if (!await isBookAuthorized(admin, student, effectiveAccess, normalizedBook)) {
                return json(403, {
                    error: "尚未取得這本教材，請購買教材包或使用有效班級／贈送權限",
                    code: "book_entitlement_required",
                    acquisition: normalizedBook.content_scope === "trial" ? "/freetrial" : "/materials"
                });
            }

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
                .select("id,book_id,page,title,music_name,audio_url,image,sort_order,track_type,part_number,display_page,track_key,base_page,storage_provider,transcript_en,transcript_zh,subtitle_cues,subtitle_status")
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
                        transcript_en: track.subtitle_status === "published" ? track.transcript_en : null,
                        transcript_zh: track.subtitle_status === "published" ? track.transcript_zh : null,
                        subtitle_cues: track.subtitle_status === "published" ? track.subtitle_cues : [],
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
