import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";
import {
    createR2PresignedUrl,
    fetchR2,
    probeR2Bucket
} from "../_shared/r2.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const FIREBASE_PROJECT_ID = "alan-english-listening";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

const cleanText = (value: unknown, maxLength = 300) => String(value || "").trim().slice(0, maxLength);

const normalizeStoragePath = (value: unknown) => {
    const raw = cleanText(value, 2000);
    if (!raw) return "";
    if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, "");
    try {
        const url = new URL(raw);
        const marker = "/storage/v1/object/public/music/";
        const index = url.pathname.indexOf(marker);
        return index >= 0 ? decodeURIComponent(url.pathname.slice(index + marker.length)) : "";
    } catch { return ""; }
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
        if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Supabase 伺服器設定不完整" });

        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        const { data: caller, error: callerError } = await admin
            .from("students")
            .select("id,role")
            .eq("firebase_uid", firebaseUid)
            .maybeSingle();

        if (callerError) return json(500, { error: "無法讀取帳號資料" });
        if (!caller) return json(404, { error: "找不到 Alan English 帳號" });
        if (!["teacher", "admin"].includes(String(caller.role))) return json(403, { error: "只有老師與管理者可以管理音檔" });

        const isAdmin = String(caller.role) === "admin";
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action, 80);

        if (["r2_status", "prepare_r2_test", "confirm_r2_test", "migrate_r2_batch", "rollback_r2_track"].includes(action) && !isAdmin) {
            return json(403, { error: "只有管理員可以設定或搬移音檔儲存空間" });
        }

        if (action === "r2_status") {
            const [tracksResult, settingsResult] = await Promise.all([
                admin.from("music_tracks").select("id,storage_provider,storage_size_bytes,storage_migration_error"),
                admin.from("audio_storage_settings").select("upload_provider,r2_cors_configured_at,updated_at").eq("singleton", true).single()
            ]);
            if (tracksResult.error) throw tracksResult.error;
            if (settingsResult.error) throw settingsResult.error;
            let connection: Record<string, unknown> = { ok: false };
            try {
                connection = await probeR2Bucket();
            } catch (error) {
                connection = { ok: false, error: error instanceof Error ? error.message : "R2 連線失敗" };
            }
            const rows = tracksResult.data || [];
            return json(200, {
                success: true,
                connection,
                settings: settingsResult.data,
                totals: {
                    all: rows.length,
                    supabase: rows.filter((row: any) => row.storage_provider !== "r2").length,
                    r2: rows.filter((row: any) => row.storage_provider === "r2").length,
                    r2_bytes: rows.filter((row: any) => row.storage_provider === "r2")
                        .reduce((sum: number, row: any) => sum + Number(row.storage_size_bytes || 0), 0),
                    errors: rows.filter((row: any) => Boolean(row.storage_migration_error)).length
                }
            });
        }

        if (action === "prepare_r2_test") {
            await probeR2Bucket();
            const testKey = `_system/cors-test-${caller.id}.txt`;
            const signedUrl = await createR2PresignedUrl(testKey, "PUT", 10 * 60, "text/plain");
            return json(200, {
                success: true,
                test_key: testKey,
                upload: {
                    signed_url: signedUrl,
                    method: "PUT",
                    headers: { "Content-Type": "text/plain" }
                }
            });
        }

        if (action === "confirm_r2_test") {
            const testKey = cleanText(body?.test_key, 500);
            const expectedKey = `_system/cors-test-${caller.id}.txt`;
            if (testKey !== expectedKey) return json(400, { error: "R2 測試檔識別不正確" });
            const head = await fetchR2(testKey, { method: "HEAD" });
            if (!head.ok) return json(409, { error: "R2 尚未收到瀏覽器測試檔，不能啟用" });
            const cleanup = await fetchR2(testKey, { method: "DELETE" });
            if (!cleanup.ok && cleanup.status !== 404) throw new Error(`R2 測試檔清理失敗（HTTP ${cleanup.status}）`);
            const now = new Date().toISOString();
            const { data: settings, error } = await admin.from("audio_storage_settings")
                .update({ upload_provider: "r2", r2_cors_configured_at: now, updated_at: now })
                .eq("singleton", true)
                .select("upload_provider,r2_cors_configured_at,updated_at")
                .single();
            if (error) throw error;
            return json(200, { success: true, settings });
        }

        if (action === "migrate_r2_batch") {
            const { data: settings, error: settingsError } = await admin.from("audio_storage_settings")
                .select("upload_provider,r2_cors_configured_at")
                .eq("singleton", true)
                .single();
            if (settingsError) throw settingsError;
            if (settings.upload_provider !== "r2" || !settings.r2_cors_configured_at) {
                return json(409, { error: "請先完成瀏覽器 R2/CORS 測試，再搬移正式音檔" });
            }
            const limit = Math.max(1, Math.min(10, Math.round(Number(body?.limit) || 1)));
            const { data: candidates, error } = await admin.from("music_tracks")
                .select("id,audio_url,music_name,storage_provider")
                .neq("storage_provider", "r2")
                .not("audio_url", "is", null)
                .order("id", { ascending: true })
                .limit(limit);
            if (error) throw error;

            const results = [];
            for (const track of candidates || []) {
                const attemptedAt = new Date().toISOString();
                const path = normalizeStoragePath(track.audio_url);
                try {
                    if (!path) throw new Error("音檔路徑無效");
                    const { data: source, error: downloadError } = await admin.storage.from("music").download(path);
                    if (downloadError || !source) throw new Error(downloadError?.message || "Supabase 原始音檔不存在");
                    const bytes = await source.arrayBuffer();
                    const contentType = source.type || "audio/mpeg";
                    const upload = await fetchR2(path, {
                        method: "PUT",
                        headers: { "Content-Type": contentType },
                        body: bytes
                    });
                    if (!upload.ok) {
                        const detail = (await upload.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
                        throw new Error(`R2 上傳失敗（HTTP ${upload.status}）${detail ? `：${detail}` : ""}`);
                    }
                    const head = await fetchR2(path, { method: "HEAD" });
                    if (!head.ok) throw new Error(`R2 驗證失敗（HTTP ${head.status}）`);
                    const remoteSize = Number(head.headers.get("content-length") || bytes.byteLength);
                    if (remoteSize !== bytes.byteLength) throw new Error(`R2 檔案大小不符（${remoteSize}/${bytes.byteLength}）`);
                    const verifiedAt = new Date().toISOString();
                    const etag = (head.headers.get("etag") || upload.headers.get("etag") || "").replace(/^"|"$/g, "") || null;
                    const { error: updateError } = await admin.from("music_tracks").update({
                        storage_provider: "r2",
                        storage_size_bytes: remoteSize,
                        storage_etag: etag,
                        storage_verified_at: verifiedAt,
                        r2_migrated_at: verifiedAt,
                        storage_migration_attempted_at: attemptedAt,
                        storage_migration_error: null,
                        updated_at: verifiedAt
                    }).eq("id", track.id);
                    if (updateError) throw updateError;
                    results.push({ id: track.id, path, success: true, size: remoteSize, etag });
                } catch (migrationError) {
                    const message = migrationError instanceof Error ? migrationError.message : "音檔搬移失敗";
                    await admin.from("music_tracks").update({
                        storage_migration_attempted_at: attemptedAt,
                        storage_migration_error: message.slice(0, 1000)
                    }).eq("id", track.id);
                    results.push({ id: track.id, path, success: false, error: message });
                }
            }
            return json(200, {
                success: results.every(item => item.success),
                processed: results.length,
                migrated: results.filter(item => item.success).length,
                failed: results.filter(item => !item.success).length,
                complete: (candidates || []).length === 0,
                results
            });
        }

        if (action === "rollback_r2_track") {
            const trackId = Number(body?.track_id);
            if (!Number.isInteger(trackId) || trackId <= 0) return json(400, { error: "音檔編號不正確" });
            const { data: track, error } = await admin.from("music_tracks")
                .select("id,audio_url,storage_provider")
                .eq("id", trackId)
                .maybeSingle();
            if (error) throw error;
            if (!track) return json(404, { error: "找不到這個音檔" });
            const path = normalizeStoragePath(track.audio_url);
            const slash = path.lastIndexOf("/");
            const { data: sourceObjects, error: sourceError } = await admin.storage.from("music")
                .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 10 });
            if (sourceError) throw sourceError;
            if (!(sourceObjects || []).some((item: any) => item.name === path.slice(slash + 1))) {
                return json(409, { error: "Supabase 原始備份不存在，不能安全回復" });
            }
            const now = new Date().toISOString();
            const { error: updateError } = await admin.from("music_tracks").update({
                storage_provider: "supabase",
                storage_verified_at: now,
                storage_migration_error: null,
                updated_at: now
            }).eq("id", trackId);
            if (updateError) throw updateError;
            return json(200, { success: true, track_id: trackId, storage_provider: "supabase" });
        }

        if (action === "bootstrap") {
            const [categoriesResult, booksResult] = await Promise.all([
                admin.from("book_categories").select("id,name,code,sort_order,enabled").eq("enabled", true).order("sort_order"),
                admin.from("books").select("id,name,code,category_id,sort_order,enabled,archived_at").is("archived_at", null).order("category_id").order("sort_order")
            ]);
            const error = categoriesResult.error || booksResult.error;
            if (error) throw error;
            return json(200, { success: true, categories: categoriesResult.data || [], books: booksResult.data || [] });
        }

        if (action === "create_book") {
            const categoryId = Number(body?.category_id);
            const name = cleanText(body?.name, 120);
            const code = cleanText(body?.code, 80);
            if (!Number.isInteger(categoryId) || categoryId <= 0 || !name || !/^[A-Za-z0-9_-]{2,80}$/.test(code)) {
                return json(400, { error: "教材分類、名稱或 Code 格式不正確" });
            }
            const { data: category, error: categoryError } = await admin.from("book_categories").select("id").eq("id", categoryId).eq("enabled", true).maybeSingle();
            if (categoryError) throw categoryError;
            if (!category) return json(404, { error: "找不到教材分類" });
            const { data: lastBook } = await admin.from("books").select("sort_order").eq("category_id", categoryId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
            const { data: book, error } = await admin.from("books").insert({
                category_id: categoryId,
                name,
                code,
                sort_order: Number(lastBook?.sort_order || 0) + 1,
                enabled: true
            }).select("id,name,code,category_id,sort_order,enabled").single();
            if (error) return json(error.code === "23505" ? 409 : 500, { error: error.code === "23505" ? "這個教材 Code 已經存在" : `新增教材失敗：${error.message}` });
            return json(201, { success: true, book });
        }

        if (action === "list_tracks") {
            const bookId = Number(body?.book_id);
            if (!Number.isInteger(bookId) || bookId <= 0) return json(400, { error: "教材編號不正確" });
            const { data: tracks, error } = await admin.from("music_tracks").select("*").eq("book_id", bookId).order("sort_order").order("id");
            if (error) throw error;
            const paths = [...new Set((tracks || [])
                .filter((track: any) => track.storage_provider !== "r2")
                .map((track: any) => normalizeStoragePath(track.audio_url))
                .filter(Boolean))];
            const signedMap = new Map<string, string>();
            if (paths.length) {
                const { data: signed, error: signedError } = await admin.storage.from("music").createSignedUrls(paths, 60 * 60);
                if (signedError) throw signedError;
                for (const row of signed || []) if (row.path && row.signedUrl) signedMap.set(row.path, row.signedUrl);
            }
            await Promise.all((tracks || [])
                .filter((track: any) => track.storage_provider === "r2")
                .map(async (track: any) => {
                    const path = normalizeStoragePath(track.audio_url);
                    if (path) signedMap.set(`r2:${path}`, await createR2PresignedUrl(path, "GET", 60 * 60));
                }));
            return json(200, {
                success: true,
                tracks: (tracks || []).map((track: any) => {
                    const path = normalizeStoragePath(track.audio_url);
                    return {
                        ...track,
                        preview_url: signedMap.get(track.storage_provider === "r2" ? `r2:${path}` : path) || null
                    };
                })
            });
        }

        if (action === "check_track") {
            const bookId = Number(body?.book_id);
            const trackKey = cleanText(body?.track_key, 160);
            if (!Number.isInteger(bookId) || bookId <= 0 || !trackKey) return json(400, { error: "教材或音檔識別不正確" });
            const { data: track, error } = await admin.from("music_tracks").select("id,track_key,display_page,music_name,audio_url").eq("book_id", bookId).eq("track_key", trackKey).maybeSingle();
            if (error) throw error;
            return json(200, { success: true, exists: Boolean(track), track: track || null });
        }

        if (action === "create_upload") {
            const bookId = Number(body?.book_id);
            const storagePath = cleanText(body?.storage_path, 500).replace(/^\/+/, "");
            const trackKey = cleanText(body?.track_key, 160);
            const { data: book, error: bookError } = await admin.from("books").select("id,code").eq("id", bookId).eq("enabled", true).is("archived_at", null).maybeSingle();
            if (bookError) throw bookError;
            if (!book) return json(404, { error: "找不到教材" });
            if (!trackKey || !storagePath.startsWith(`${book.code}/`) || !storagePath.toLowerCase().endsWith(".mp3") || storagePath.includes("..")) {
                return json(400, { error: "音檔儲存路徑不正確" });
            }
            const { data: existing, error: existingError } = await admin.from("music_tracks").select("id").eq("book_id", bookId).eq("track_key", trackKey).maybeSingle();
            if (existingError) throw existingError;
            if (existing) return json(409, { error: "這個音檔已存在", code: "track_exists" });
            const { data: settings, error: settingsError } = await admin.from("audio_storage_settings")
                .select("upload_provider,r2_cors_configured_at")
                .eq("singleton", true)
                .single();
            if (settingsError) throw settingsError;
            if (settings.upload_provider === "r2") {
                if (!settings.r2_cors_configured_at) return json(503, { error: "R2 CORS 尚未設定，請由管理員先完成 R2 連線設定" });
                const signedUrl = await createR2PresignedUrl(storagePath, "PUT", 15 * 60, "audio/mpeg");
                return json(200, {
                    success: true,
                    provider: "r2",
                    upload: {
                        path: storagePath,
                        signed_url: signedUrl,
                        method: "PUT",
                        headers: { "Content-Type": "audio/mpeg" }
                    }
                });
            }
            const { data: upload, error } = await admin.storage.from("music").createSignedUploadUrl(storagePath, { upsert: false });
            if (error) throw error;
            return json(200, { success: true, provider: "supabase", upload });
        }

        if (action === "finalize_upload") {
            const bookId = Number(body?.book_id);
            const storagePath = cleanText(body?.storage_path, 500).replace(/^\/+/, "");
            const page = cleanText(body?.page, 120);
            const basePage = cleanText(body?.base_page, 120);
            const displayPage = cleanText(body?.display_page, 120);
            const trackType = cleanText(body?.track_type, 30);
            const partNumber = body?.part_number == null ? null : Number(body.part_number);
            const trackKey = cleanText(body?.track_key, 160);
            const musicName = cleanText(body?.music_name, 200);
            const sortOrder = Number(body?.sort_order);
            const storageProvider = cleanText(body?.storage_provider || "supabase", 20);
            if (!Number.isInteger(bookId) || !page || !displayPage || !trackKey || !musicName || !Number.isFinite(sortOrder) || !["main", "question", "answer"].includes(trackType)) {
                return json(400, { error: "音檔 Playlist 資料不完整" });
            }
            if (!["supabase", "r2"].includes(storageProvider)) return json(400, { error: "音檔儲存來源不正確" });
            const { data: book, error: bookError } = await admin.from("books").select("id,name,code").eq("id", bookId).eq("enabled", true).maybeSingle();
            if (bookError) throw bookError;
            if (!book || !storagePath.startsWith(`${book.code}/`) || storagePath.includes("..")) return json(400, { error: "教材或儲存路徑不正確" });
            let objectSize: number | null = null;
            let objectEtag: string | null = null;
            if (storageProvider === "r2") {
                const head = await fetchR2(storagePath, { method: "HEAD" });
                if (!head.ok) return json(409, { error: "R2 尚未收到音檔，請重新上傳" });
                objectSize = Number(head.headers.get("content-length") || 0) || null;
                objectEtag = (head.headers.get("etag") || "").replace(/^"|"$/g, "") || null;
            } else {
                const slash = storagePath.lastIndexOf("/");
                const folder = storagePath.slice(0, slash);
                const filename = storagePath.slice(slash + 1);
                const { data: objects, error: objectError } = await admin.storage.from("music").list(folder, { search: filename, limit: 10 });
                if (objectError) throw objectError;
                if (!(objects || []).some((item: any) => item.name === filename)) return json(409, { error: "Storage 尚未收到音檔，請重新上傳" });
            }
            const verifiedAt = new Date().toISOString();
            const { data: track, error } = await admin.from("music_tracks").insert({
                book_id: bookId, page, base_page: basePage || page, display_page: displayPage,
                track_type: trackType, part_number: Number.isInteger(partNumber) ? partNumber : null,
                track_key: trackKey, title: `${book.name} ${displayPage}`, music_name: musicName,
                audio_url: storagePath, sort_order: Math.round(sortOrder), enabled: true,
                storage_provider: storageProvider,
                storage_size_bytes: objectSize,
                storage_etag: objectEtag,
                storage_verified_at: verifiedAt
            }).select("*").single();
            if (error) {
                if (error.code === "23505") return json(200, { success: true, already_exists: true });
                throw error;
            }
            return json(201, { success: true, already_exists: false, track });
        }

        const trackId = Number(body?.track_id);
        if (!Number.isFinite(trackId)) return json(400, { error: "音檔編號不正確" });

        const { data: track, error: trackError } = await admin
            .from("music_tracks")
            .select("id,book_id,page,display_page,music_name,audio_url,title,storage_provider")
            .eq("id", trackId)
            .maybeSingle();

        if (trackError) return json(500, { error: "讀取音檔失敗" });
        if (!track) return json(404, { error: "找不到這個音檔" });

        if (action === "update_display_name") {
            const displayPage = String(body?.display_page || "").trim().replace(/\s+/g, " ").slice(0, 120);
            if (!displayPage) return json(400, { error: "顯示名稱不能空白" });

            const { data: updated, error } = await admin
                .from("music_tracks")
                .update({
                    display_page: displayPage,
                    title: displayPage,
                    updated_at: new Date().toISOString()
                })
                .eq("id", trackId)
                .select("*")
                .single();

            if (error) return json(500, { error: `修改名稱失敗：${error.message}` });
            return json(200, { success: true, track: updated });
        }

        if (action === "delete_track") {
            const [progressRes, assignmentRes] = await Promise.all([
                admin.from("student_track_progress").select("id", { count: "exact", head: true }).eq("track_id", trackId),
                admin.from("assignments").select("id", { count: "exact", head: true }).eq("track_id", trackId)
            ]);

            const progressCount = Number(progressRes.count || 0);
            const assignmentCount = Number(assignmentRes.count || 0);

            if (progressCount > 0 || assignmentCount > 0) {
                const reasons = [];
                if (progressCount > 0) reasons.push(`已有 ${progressCount} 筆學生播放紀錄`);
                if (assignmentCount > 0) reasons.push(`已被 ${assignmentCount} 份作業使用`);
                return json(409, {
                    error: `這個音檔目前不能刪除：${reasons.join("、")}。為了保護學生紀錄，請先處理相關資料。`,
                    details: { progress_count: progressCount, assignment_count: assignmentCount }
                });
            }

            const { error: deleteError } = await admin
                .from("music_tracks")
                .delete()
                .eq("id", trackId);

            if (deleteError) return json(500, { error: `刪除資料庫音檔失敗：${deleteError.message}` });

            let storageRemoved = true;
            if (track.audio_url) {
                if (track.storage_provider === "r2") {
                    const storageResponse = await fetchR2(normalizeStoragePath(track.audio_url), { method: "DELETE" });
                    if (!storageResponse.ok && storageResponse.status !== 404) {
                        storageRemoved = false;
                        console.error("R2 music storage cleanup failed", storageResponse.status);
                    }
                } else {
                    const { error: storageError } = await admin.storage
                        .from("music")
                        .remove([String(track.audio_url)]);
                    if (storageError) {
                        storageRemoved = false;
                        console.error("music storage cleanup failed", storageError);
                    }
                }
            }

            return json(200, {
                success: true,
                storage_removed: storageRemoved,
                deleted_track_id: trackId
            });
        }

        return json(400, { error: "不支援的操作" });
    } catch (error) {
        console.error("music-admin unexpected error", error);
        return json(500, { error: error instanceof Error ? error.message : "音檔管理發生錯誤" });
    }
});
