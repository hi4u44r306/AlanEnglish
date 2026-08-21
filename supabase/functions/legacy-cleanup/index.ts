import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const FIREBASE_PROJECT_ID = "alan-english-listening";
const FIREBASE_DATABASE_URL = "https://alan-english-listening-default-rtdb.firebaseio.com";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);
const CONFIRM_PHRASE = "DELETE FIREBASE LEARNING LOGS";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const cleanText = (value: unknown, maxLength = 1000) => String(value || "")
    .trim()
    .slice(0, maxLength);

async function verifyFirebaseIdToken(token: string) {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: FIREBASE_PROJECT_ID
    });
    const uid = cleanText(payload.sub, 200);
    if (!uid) throw new Error("Firebase token 缺少 uid");
    return uid;
}

const firebaseRequest = async (
    token: string,
    path: string,
    options: { method?: "GET" | "PATCH"; body?: unknown; shallow?: boolean } = {}
) => {
    const method = options.method || "GET";
    const safePath = path
        .split("/")
        .filter(Boolean)
        .map(segment => encodeURIComponent(segment))
        .join("/");
    const query = new URLSearchParams({ auth: token });
    if (options.shallow) query.set("shallow", "true");
    const response = await fetch(`${FIREBASE_DATABASE_URL}/${safePath}.json?${query.toString()}`, {
        method,
        headers: {
            ...(method === "PATCH" ? { "Content-Type": "application/json" } : {})
        },
        body: method === "PATCH" ? JSON.stringify(options.body || {}) : undefined
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(data?.error || `Firebase RTDB request failed (${response.status})`);
    }
    return data;
};

const countEntries = (value: unknown) => value && typeof value === "object"
    ? Object.keys(value as Record<string, unknown>).length
    : 0;

const runWithConcurrency = async <T, R>(
    values: T[],
    worker: (value: T) => Promise<R>,
    concurrency = 5
) => {
    const results: R[] = new Array(values.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
        while (cursor < values.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await worker(values[index]);
        }
    });
    await Promise.all(runners);
    return results;
};

const createBackup = async (
    admin: any,
    firebaseToken: string,
    target: any,
    callerId: number
) => {
    const logs = await firebaseRequest(firebaseToken, `student/${target.firebase_uid}`);
    const payload = {
        schema_version: 1,
        created_at: new Date().toISOString(),
        firebase_uid: target.firebase_uid,
        student_id: target.student_id || null,
        student_name: target.name || null,
        MusicLogfile: logs?.MusicLogfile || null,
        BookLogfile: logs?.BookLogfile || null
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `${stamp.slice(0, 10)}/${target.firebase_uid}-${stamp}.json`;
    const { error: uploadError } = await admin.storage
        .from("legacy-backups")
        .upload(path, new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), {
            contentType: "application/json",
            upsert: false
        });
    if (uploadError) throw uploadError;
    const musicCount = countEntries(payload.MusicLogfile);
    const bookCount = countEntries(payload.BookLogfile);
    const { error: logError } = await admin.from("legacy_cleanup_runs").insert({
        action: "backup",
        firebase_uid: target.firebase_uid,
        backup_path: path,
        music_log_count: musicCount,
        book_log_count: bookCount,
        status: "completed",
        performed_by: callerId
    });
    if (logError) throw logError;
    return { path, music_count: musicCount, book_count: bookCount };
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    try {
        const authHeader = req.headers.get("Authorization") || "";
        const firebaseToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
        if (!firebaseToken) return json(401, { error: "請先登入 Alan English" });
        let callerUid = "";
        try {
            callerUid = await verifyFirebaseIdToken(firebaseToken);
        } catch {
            return json(401, { error: "登入驗證失敗，請重新登入" });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "伺服器設定不完整" });
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data: caller, error: callerError } = await admin
            .from("students")
            .select("id,role")
            .eq("firebase_uid", callerUid)
            .maybeSingle();
        if (callerError) throw callerError;
        if (!caller || caller.role !== "admin") {
            return json(403, { error: "只有管理員可以處理舊 Firebase 學習資料" });
        }

        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action || "audit", 50);
        // Firebase ID token 仍受 RTDB Rules 約束。若舊規則不允許管理員盤點全部帳號，
        // 可暫時設定 FIREBASE_DATABASE_SECRET，完成遷移後再移除該 Secret。
        const firebaseCredential = cleanText(Deno.env.get("FIREBASE_DATABASE_SECRET"), 4000) || firebaseToken;

        if (action === "list_backups") {
            const { data: runs, error } = await admin
                .from("legacy_cleanup_runs")
                .select("id,action,firebase_uid,backup_path,music_log_count,book_log_count,status,error_message,created_at")
                .order("created_at", { ascending: false })
                .limit(200);
            if (error) throw error;
            const paths = (runs || []).map((run: any) => run.backup_path).filter(Boolean);
            const signedMap = new Map<string, string>();
            if (paths.length > 0) {
                const { data: signedRows, error: signedError } = await admin.storage
                    .from("legacy-backups")
                    .createSignedUrls(paths, 15 * 60);
                if (signedError) throw signedError;
                for (const item of signedRows || []) {
                    if (item.path && item.signedUrl) signedMap.set(item.path, item.signedUrl);
                }
            }
            return json(200, {
                success: true,
                backups: (runs || []).map((run: any) => ({
                    ...run,
                    download_url: run.backup_path ? signedMap.get(run.backup_path) || null : null
                }))
            });
        }

        const firebaseStudents = await firebaseRequest(firebaseCredential, "student", { shallow: true });
        const firebaseUids = firebaseStudents && typeof firebaseStudents === "object"
            ? Object.keys(firebaseStudents)
            : [];
        const { data: profiles, error: profilesError } = await admin
            .from("students")
            .select("id,firebase_uid,name,email")
            .not("firebase_uid", "is", null);
        if (profilesError) throw profilesError;
        const profileMap = new Map((profiles || []).map((profile: any) => [profile.firebase_uid, profile]));

        const auditRows = await runWithConcurrency(firebaseUids, async firebaseUid => {
            const [musicLog, bookLog] = await Promise.all([
                firebaseRequest(firebaseCredential, `student/${firebaseUid}/MusicLogfile`),
                firebaseRequest(firebaseCredential, `student/${firebaseUid}/BookLogfile`)
            ]);
            const profile = profileMap.get(firebaseUid) || null;
            let supabaseProgressCount = 0;
            if (profile?.id) {
                const { count, error } = await admin
                    .from("student_track_progress")
                    .select("id", { count: "exact", head: true })
                    .eq("student_id", profile.id);
                if (error) throw error;
                supabaseProgressCount = Number(count || 0);
            }
            const musicCount = countEntries(musicLog);
            const bookCount = countEntries(bookLog);
            return {
                firebase_uid: firebaseUid,
                student_id: profile?.id || null,
                name: profile?.name || null,
                email: profile?.email || null,
                music_log_count: musicCount,
                book_log_count: bookCount,
                supabase_progress_count: supabaseProgressCount,
                safe_to_cleanup: musicCount + bookCount === 0 || Boolean(profile?.id && supabaseProgressCount > 0)
            };
        });

        if (action === "audit") {
            const totals = auditRows.reduce((acc, row) => ({
                students: acc.students + 1,
                music_logs: acc.music_logs + row.music_log_count,
                book_logs: acc.book_logs + row.book_log_count,
                safe_students: acc.safe_students + (row.safe_to_cleanup ? 1 : 0),
                blocked_students: acc.blocked_students + (row.safe_to_cleanup ? 0 : 1)
            }), { students: 0, music_logs: 0, book_logs: 0, safe_students: 0, blocked_students: 0 });
            await admin.from("legacy_cleanup_runs").insert({
                action: "audit",
                music_log_count: totals.music_logs,
                book_log_count: totals.book_logs,
                status: "completed",
                performed_by: caller.id
            });
            return json(200, { success: true, totals, students: auditRows });
        }

        const requestedUids = Array.isArray(body?.firebase_uids)
            ? [...new Set(body.firebase_uids.map((value: unknown) => cleanText(value, 200)).filter(Boolean))]
            : [];
        if (requestedUids.length === 0 || requestedUids.length > 100) {
            return json(400, { error: "請明確選擇 1～100 個 Firebase 帳號" });
        }
        const targetRows = requestedUids.map(uid => auditRows.find(row => row.firebase_uid === uid)).filter(Boolean) as any[];
        if (targetRows.length !== requestedUids.length) {
            return json(404, { error: "部分 Firebase 帳號不存在，請重新執行盤點" });
        }

        if (action === "backup") {
            const backups = await runWithConcurrency(targetRows, target => (
                createBackup(admin, firebaseCredential, target, caller.id)
            ), 3);
            return json(200, { success: true, backups });
        }

        if (action === "cleanup") {
            if (cleanText(body?.confirm_phrase, 100) !== CONFIRM_PHRASE) {
                return json(400, { error: `請輸入確認文字：${CONFIRM_PHRASE}` });
            }
            const force = body?.force === true;
            const blocked = targetRows.filter(target => !target.safe_to_cleanup);
            if (blocked.length > 0 && !force) {
                return json(409, {
                    error: "有帳號尚未確認 Supabase 學習進度，已停止清除",
                    blocked
                });
            }

            const results: any[] = [];
            for (const target of targetRows) {
                let backup: any = null;
                try {
                    backup = await createBackup(admin, firebaseCredential, target, caller.id);
                    await firebaseRequest(firebaseCredential, `student/${target.firebase_uid}`, {
                        method: "PATCH",
                        body: { MusicLogfile: null, BookLogfile: null }
                    });
                    const [musicAfter, bookAfter] = await Promise.all([
                        firebaseRequest(firebaseCredential, `student/${target.firebase_uid}/MusicLogfile`),
                        firebaseRequest(firebaseCredential, `student/${target.firebase_uid}/BookLogfile`)
                    ]);
                    if (musicAfter !== null || bookAfter !== null) {
                        throw new Error("Firebase 刪除後驗證失敗");
                    }
                    await admin.from("legacy_cleanup_runs").insert({
                        action: "cleanup",
                        firebase_uid: target.firebase_uid,
                        backup_path: backup.path,
                        music_log_count: target.music_log_count,
                        book_log_count: target.book_log_count,
                        status: "completed",
                        performed_by: caller.id
                    });
                    results.push({
                        firebase_uid: target.firebase_uid,
                        status: "completed",
                        backup_path: backup.path,
                        recoverable: true
                    });
                } catch (error) {
                    await admin.from("legacy_cleanup_runs").insert({
                        action: "cleanup",
                        firebase_uid: target.firebase_uid,
                        backup_path: backup?.path || null,
                        music_log_count: target.music_log_count,
                        book_log_count: target.book_log_count,
                        status: "failed",
                        error_message: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error",
                        performed_by: caller.id
                    });
                    results.push({
                        firebase_uid: target.firebase_uid,
                        status: "failed",
                        error: error instanceof Error ? error.message : "清除失敗",
                        backup_path: backup?.path || null
                    });
                }
            }
            return json(200, {
                success: results.every(result => result.status === "completed"),
                results
            });
        }

        return json(400, { error: "不支援的 Firebase 清理操作" });
    } catch (error) {
        console.error("legacy-cleanup unexpected error", error);
        return json(500, {
            error: error instanceof Error ? error.message : "Firebase 清理服務暫時無法使用"
        });
    }
});
