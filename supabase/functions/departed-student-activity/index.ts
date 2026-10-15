// Admin-only, read-only: how many departed (離校/畢業) academy students have come back to the site.
// No writes. The role is read from the database, never from the request.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.95.0";
import {
    DepartedEnrollment,
    StudentActivity,
    latestDepartures,
    summarizeDepartedActivity
} from "./summarize.ts";

type JsonObject = Record<string, unknown>;

type CallerProfile = {
    id: number;
    firebase_uid: string;
    role: "student" | "teacher" | "admin";
};

class HttpError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.name = "HttpError";
        this.status = status;
        this.code = code;
    }
}

const ALLOWED_ORIGINS = new Set([
    "https://alanenglish.com.tw",
    "https://www.alanenglish.com.tw",
    "https://alan-english-listening.web.app",
    "https://alan-english-listening.firebaseapp.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]);

const MAX_BODY_BYTES = 4 * 1024;
const ID_CHUNK = 150;

const cleanText = (value: unknown, maxLength: number): string => {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLength);
};

const requestOrigin = (req: Request): string | null => req.headers.get("Origin")?.trim() || null;

const corsHeaders = (req: Request): Record<string, string> => {
    const origin = requestOrigin(req);
    const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://alanenglish.com.tw";
    return {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
    };
};

const json = (req: Request, status: number, body: JsonObject): Response => new Response(JSON.stringify(body), {
    status,
    headers: {
        ...corsHeaders(req),
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    }
});

const ensureAllowedOrigin = (req: Request): void => {
    const origin = requestOrigin(req);
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
        throw new HttpError(403, "ORIGIN_NOT_ALLOWED", "這個網站來源不允許使用離校生統計服務");
    }
};

const extractFirebaseToken = (req: Request): string => {
    const match = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim() || "";
    if (!token) throw new HttpError(401, "AUTH_REQUIRED", "請重新登入 Alan English");
    return token;
};

const verifyFirebaseUid = async (token: string): Promise<string> => {
    const apiKey = Deno.env.get("FIREBASE_WEB_API_KEY")?.trim();
    if (!apiKey) throw new HttpError(500, "FIREBASE_CONFIG_MISSING", "Firebase 伺服器設定不完整");

    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }) }
    );
    const payload = await response.json().catch(() => ({})) as { users?: Array<{ localId?: string; disabled?: boolean }> };
    const user = payload.users?.[0];
    const uid = cleanText(user?.localId, 200);
    if (!response.ok || !uid || user?.disabled) {
        throw new HttpError(401, "INVALID_FIREBASE_TOKEN", "Firebase 登入狀態已失效，請重新登入");
    }
    return uid;
};

const getSupabaseAdmin = (): SupabaseClient => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (!supabaseUrl || !serviceRoleKey) throw new HttpError(500, "SUPABASE_CONFIG_MISSING", "Supabase 伺服器設定不完整");
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
};

const getCallerProfile = async (admin: SupabaseClient, firebaseUid: string): Promise<CallerProfile> => {
    const { data, error } = await admin.from("students").select("id,firebase_uid,role").eq("firebase_uid", firebaseUid).maybeSingle();
    if (error) {
        console.error("departed-student-activity caller lookup failed", { code: error.code });
        throw new HttpError(500, "CALLER_LOOKUP_FAILED", "無法確認目前帳號權限");
    }
    if (!data?.id || !data?.role) throw new HttpError(403, "PROFILE_NOT_FOUND", "找不到 Alan English 帳號資料");
    return data as CallerProfile;
};

const requireAdmin = (caller: CallerProfile): void => {
    if (caller.role !== "admin") throw new HttpError(403, "ADMIN_REQUIRED", "只有管理員可以查看離校生統計");
};

const loadReport = async (req: Request, admin: SupabaseClient): Promise<Response> => {
    const [departedResult, currentResult] = await Promise.all([
        admin.from("academy_enrollments")
            .select("student_id,status,departed_at,access_ends_at,academy_classes(code)")
            .in("status", ["withdrawn", "graduated"])
            .limit(5000),
        admin.from("academy_enrollments")
            .select("student_id")
            .in("status", ["active", "paused"])
            .limit(5000)
    ]);
    if (departedResult.error || currentResult.error) {
        console.error("departed-student-activity enrollment lookup failed", {
            code: departedResult.error?.code || currentResult.error?.code
        });
        throw new HttpError(500, "ENROLLMENT_LOOKUP_FAILED", "目前無法讀取離校生資料");
    }

    const enrollments: DepartedEnrollment[] = (departedResult.data || []).map((row: any) => {
        const academyClass = Array.isArray(row.academy_classes) ? row.academy_classes[0] : row.academy_classes;
        return {
            student_id: Number(row.student_id),
            status: String(row.status),
            departed_at: row.departed_at ?? null,
            access_ends_at: row.access_ends_at ?? null,
            class_code: academyClass?.code ?? null
        };
    });
    const currentIds = new Set<number>((currentResult.data || []).map((row: any) => Number(row.student_id)));
    const departures = latestDepartures(enrollments, currentIds);

    const ids = [...departures.keys()];
    const students: StudentActivity[] = [];
    for (let index = 0; index < ids.length; index += ID_CHUNK) {
        const { data, error } = await admin
            .from("students")
            .select("id,name,chinese_name,english_name,account_status,last_login_at,last_active_at")
            .eq("role", "student")
            .in("id", ids.slice(index, index + ID_CHUNK));
        if (error) throw new HttpError(500, "STUDENT_LOOKUP_FAILED", "目前無法讀取離校生的登入紀錄");
        students.push(...(data || []) as StudentActivity[]);
    }

    return json(req, 200, { success: true, ...summarizeDepartedActivity(departures, students) });
};

const errorResponse = (req: Request, error: unknown): Response => {
    if (error instanceof HttpError) {
        return json(req, error.status, { success: false, code: error.code, error: error.message });
    }
    console.error("departed-student-activity unexpected error", { name: error instanceof Error ? error.name : "UnknownError" });
    return json(req, 500, { success: false, code: "UNEXPECTED_ERROR", error: "離校生統計服務發生未預期錯誤" });
};

Deno.serve(async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
        try {
            ensureAllowedOrigin(req);
            return new Response(null, { status: 204, headers: corsHeaders(req) });
        } catch (error) {
            return errorResponse(req, error);
        }
    }

    try {
        ensureAllowedOrigin(req);
        if (req.method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED", "只接受 POST 請求");
        const contentLength = Number(req.headers.get("Content-Length") || "0");
        if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
            throw new HttpError(413, "REQUEST_TOO_LARGE", "傳入資料超過允許大小");
        }

        const firebaseUid = await verifyFirebaseUid(extractFirebaseToken(req));
        const admin = getSupabaseAdmin();
        requireAdmin(await getCallerProfile(admin, firebaseUid));
        return await loadReport(req, admin);
    } catch (error) {
        return errorResponse(req, error);
    }
});
