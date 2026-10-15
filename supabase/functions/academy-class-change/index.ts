// Admin-only: change one academy student's class (promote or demote).
//
// Kept as its own small function (instead of one more action inside academy-student-manager) so a
// deployment of this feature can never touch account creation, login cards or CSV import.
// The database function change_academy_student_class() does the real work and is executable by
// service_role only; this function proves the caller is an admin first.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.95.0";

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

const CLASS_CODES = new Set(["E1", "E3", "E5", "E7"]);
const MAX_BODY_BYTES = 16 * 1024;

const CLASS_CHANGE_ERRORS: Record<string, [number, string]> = {
    ACADEMY_CHANGE_INVALID_INPUT: [400, "請選擇學生與生效日期"],
    ACADEMY_CHANGE_REASON_INVALID: [400, "請填寫 2 到 300 字的調整原因"],
    ACADEMY_ENROLLMENT_NOT_FOUND: [404, "這位學生目前沒有在英文班"],
    ACADEMY_ENROLLMENT_NOT_ACTIVE: [409, "這位學生目前是暫停狀態，請先恢復再調整班級"],
    ACADEMY_CLASS_INVALID: [400, "班級只能選擇 E1、E3、E5 或 E7"],
    ACADEMY_CLASS_UNCHANGED: [409, "學生已經在這個班級，不需要調整"],
    ACADEMY_CHANGE_DATE_IN_FUTURE: [400, "目前只能設定今天或過去的日期，不能預先安排未來的日期"],
    ACADEMY_CHANGE_DATE_BEFORE_ENROLLMENT: [400, "生效日期不能早於學生進入目前班級的日期"],
    ACADEMY_CHANGE_DATE_AFTER_ACCESS_END: [400, "生效日期晚於這位學生的權限截止日"],
    ACADEMY_CHANGE_DATE_AFTER_DEPARTURE: [400, "生效日期晚於這位學生已排定的離校日"]
};

const cleanText = (value: unknown, maxLength: number): string => {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLength);
};

const isIsoDate = (value: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const requestOrigin = (req: Request): string | null => (
    req.headers.get("Origin")?.trim() || null
);

const corsHeaders = (req: Request): Record<string, string> => {
    const origin = requestOrigin(req);
    const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin)
        ? origin
        : "https://alanenglish.com.tw";

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
        throw new HttpError(403, "ORIGIN_NOT_ALLOWED", "這個網站來源不允許使用調整班級服務");
    }
};

const extractFirebaseToken = (req: Request): string => {
    const authorization = req.headers.get("Authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim() || "";
    if (!token) {
        throw new HttpError(401, "AUTH_REQUIRED", "請重新登入 Alan English");
    }
    return token;
};

// Same check as academy-student-manager: ask Firebase whether the ID token is valid.
const verifyFirebaseUid = async (token: string): Promise<string> => {
    const apiKey = Deno.env.get("FIREBASE_WEB_API_KEY")?.trim();
    if (!apiKey) {
        throw new HttpError(500, "FIREBASE_CONFIG_MISSING", "Firebase 伺服器設定不完整");
    }

    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken: token })
        }
    );
    const payload = await response.json().catch(() => ({})) as {
        users?: Array<{ localId?: string; disabled?: boolean }>;
    };

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

    if (!supabaseUrl || !serviceRoleKey) {
        throw new HttpError(500, "SUPABASE_CONFIG_MISSING", "Supabase 伺服器設定不完整");
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
};

// The role always comes from the database, never from the request.
const getCallerProfile = async (admin: SupabaseClient, firebaseUid: string): Promise<CallerProfile> => {
    const { data, error } = await admin
        .from("students")
        .select("id,firebase_uid,role")
        .eq("firebase_uid", firebaseUid)
        .maybeSingle();

    if (error) {
        console.error("academy-class-change caller lookup failed", { code: error.code });
        throw new HttpError(500, "CALLER_LOOKUP_FAILED", "無法確認目前帳號權限");
    }
    if (!data?.id || !data?.role) {
        throw new HttpError(403, "PROFILE_NOT_FOUND", "找不到 Alan English 帳號資料");
    }
    return data as CallerProfile;
};

const requireAdmin = (caller: CallerProfile): void => {
    if (caller.role !== "admin") {
        throw new HttpError(403, "ADMIN_REQUIRED", "只有管理員可以調整學生班級");
    }
};

const changeStudentClass = async (
    req: Request,
    admin: SupabaseClient,
    caller: CallerProfile,
    body: JsonObject
): Promise<Response> => {
    requireAdmin(caller);

    const studentId = Number(body.student_id);
    if (!Number.isSafeInteger(studentId) || studentId <= 0) {
        throw new HttpError(400, "STUDENT_ID_REQUIRED", "缺少要調整班級的學生");
    }
    const classCode = cleanText(body.class_code, 8).toUpperCase();
    if (!CLASS_CODES.has(classCode)) {
        throw new HttpError(400, "INVALID_CLASS", "班級只能選擇 E1、E3、E5 或 E7");
    }
    const effectiveOn = cleanText(body.effective_on, 10);
    if (!isIsoDate(effectiveOn)) {
        throw new HttpError(400, "INVALID_EFFECTIVE_DATE", "生效日期格式必須是 YYYY-MM-DD");
    }
    const reason = cleanText(body.reason, 300);
    if (reason.length < 2) {
        throw new HttpError(400, "CLASS_CHANGE_REASON_REQUIRED", "請填寫調整原因（至少 2 個字）");
    }

    const { data: student, error: studentError } = await admin
        .from("students")
        .select("id,role")
        .eq("id", studentId)
        .maybeSingle();
    if (studentError) throw new HttpError(500, "STUDENT_LOOKUP_FAILED", "目前無法確認學生帳號");
    if (!student?.id || student.role !== "student") {
        throw new HttpError(404, "STUDENT_NOT_FOUND", "找不到這位學生");
    }

    const { data, error } = await admin.rpc("change_academy_student_class", {
        p_student_id: studentId,
        p_to_class_code: classCode,
        p_effective_on: effectiveOn,
        p_reason: reason,
        p_changed_by: caller.id
    });
    if (error) {
        const message = cleanText(error.message, 80);
        const known = CLASS_CHANGE_ERRORS[message];
        if (known) throw new HttpError(known[0], message, known[1]);
        console.error("change_academy_student_class failed", { code: error.code });
        throw new HttpError(500, "CLASS_CHANGE_FAILED", "調整班級失敗，請稍後再試；若持續發生請聯絡管理員檢查");
    }

    return json(req, 200, { success: true, change: data });
};

const errorResponse = (req: Request, error: unknown): Response => {
    if (error instanceof HttpError) {
        return json(req, error.status, { success: false, code: error.code, error: error.message });
    }

    console.error("academy-class-change unexpected error", {
        name: error instanceof Error ? error.name : "UnknownError"
    });
    return json(req, 500, { success: false, code: "UNEXPECTED_ERROR", error: "調整班級服務發生未預期錯誤" });
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

        if (req.method !== "POST") {
            throw new HttpError(405, "METHOD_NOT_ALLOWED", "只接受 POST 請求");
        }
        const contentLength = Number(req.headers.get("Content-Length") || "0");
        if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
            throw new HttpError(413, "REQUEST_TOO_LARGE", "傳入資料超過允許大小");
        }

        const firebaseUid = await verifyFirebaseUid(extractFirebaseToken(req));
        const admin = getSupabaseAdmin();
        const caller = await getCallerProfile(admin, firebaseUid);

        const rawBody = await req.json().catch(() => {
            throw new HttpError(400, "INVALID_JSON", "請求資料不是正確的 JSON");
        });
        const body = rawBody && typeof rawBody === "object" ? rawBody as JsonObject : {};

        return await changeStudentClass(req, admin, caller, body);
    } catch (error) {
        return errorResponse(req, error);
    }
});
