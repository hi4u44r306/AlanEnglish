import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.95.0";

type JsonObject = Record<string, unknown>;

type StudentInput = {
    loginEmail: string;
    chineseName: string;
    englishName: string | null;
    classCode: "E1" | "E3" | "E5" | "E7";
    guardianName: string | null;
    guardianEmail: string | null;
    guardianPhone: string | null;
    enrolledAt: string;
    accessEndsAt: string | null;
    notes: string | null;
};

type CallerProfile = {
    id: number;
    firebase_uid: string;
    email: string | null;
    role: "student" | "teacher" | "admin";
    learner_type: string | null;
};

type FirebaseLookupResponse = {
    users?: Array<{
        localId?: string;
        email?: string;
        disabled?: boolean;
    }>;
};

type FirebaseSignupResponse = {
    localId: string;
    email: string;
    idToken: string;
    refreshToken?: string;
    expiresIn?: string;
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

class FirebaseApiError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string) {
        super(code);
        this.name = "FirebaseApiError";
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
const MAX_BODY_BYTES = 512 * 1024;
const MAX_PREVIEW_ROWS = 200;

const cleanText = (value: unknown, maxLength: number): string => {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLength);
};

const optionalText = (value: unknown, maxLength: number): string | null => {
    const cleaned = cleanText(value, maxLength);
    return cleaned || null;
};

const normalizeEmail = (value: unknown): string => (
    cleanText(value, 320).toLowerCase()
);

const isValidEmail = (value: string): boolean => (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
);

const isIsoDate = (value: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const taiwanToday = (): string => (
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date())
);

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

const json = (
    req: Request,
    status: number,
    body: JsonObject
): Response => new Response(JSON.stringify(body), {
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
        throw new HttpError(403, "ORIGIN_NOT_ALLOWED", "這個網站來源不允許使用學生帳號服務");
    }
};

const getFirebaseApiKey = (): string => {
    const apiKey = Deno.env.get("FIREBASE_WEB_API_KEY")?.trim();
    if (!apiKey) {
        throw new HttpError(500, "FIREBASE_CONFIG_MISSING", "Firebase 伺服器設定不完整");
    }
    return apiKey;
};

const firebaseRequest = async <T>(
    endpoint: string,
    body: JsonObject
): Promise<T> => {
    const apiKey = getFirebaseApiKey();
    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(apiKey)}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }
    );

    const payload = await response.json().catch(() => ({})) as {
        error?: { message?: string };
    } & T;

    if (!response.ok) {
        const code = cleanText(payload?.error?.message, 200) || "FIREBASE_REQUEST_FAILED";
        throw new FirebaseApiError(response.status, code);
    }

    return payload as T;
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

const verifyFirebaseUser = async (token: string): Promise<{
    uid: string;
    email: string | null;
}> => {
    let lookup: FirebaseLookupResponse;

    try {
        lookup = await firebaseRequest<FirebaseLookupResponse>("accounts:lookup", {
            idToken: token
        });
    } catch (error) {
        if (error instanceof FirebaseApiError) {
            throw new HttpError(401, "INVALID_FIREBASE_TOKEN", "Firebase 登入狀態已失效，請重新登入");
        }
        throw error;
    }

    const user = lookup.users?.[0];
    const uid = cleanText(user?.localId, 200);

    if (!uid || user?.disabled) {
        throw new HttpError(401, "INVALID_FIREBASE_USER", "Firebase 帳號不存在或已停用");
    }

    return {
        uid,
        email: normalizeEmail(user?.email) || null
    };
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

const getCallerProfile = async (
    admin: SupabaseClient,
    firebaseUid: string
): Promise<CallerProfile> => {
    const { data, error } = await admin
        .from("students")
        .select("id,firebase_uid,email,role,learner_type")
        .eq("firebase_uid", firebaseUid)
        .maybeSingle();

    if (error) {
        console.error("academy-student-manager caller lookup failed", {
            code: error.code,
            message: error.message
        });
        throw new HttpError(500, "CALLER_LOOKUP_FAILED", "無法確認目前帳號權限");
    }

    if (!data?.id || !data?.role) {
        throw new HttpError(403, "PROFILE_NOT_FOUND", "找不到 Alan English 帳號資料");
    }

    return data as CallerProfile;
};

const requireStaff = (caller: CallerProfile): void => {
    if (caller.role !== "teacher" && caller.role !== "admin") {
        throw new HttpError(403, "STAFF_REQUIRED", "只有老師或管理員可以建立學生帳號");
    }
};

const normalizeStudentInput = (body: JsonObject): StudentInput => {
    const loginEmail = normalizeEmail(body.login_email ?? body.email);
    const chineseName = cleanText(body.chinese_name, 100);
    const englishName = optionalText(body.english_name, 100);
    const classCode = cleanText(body.class_code ?? body.class, 10).toUpperCase();
    const guardianName = optionalText(body.guardian_name, 100);
    const guardianEmail = normalizeEmail(body.guardian_email) || null;
    const guardianPhone = optionalText(body.guardian_phone, 30);
    const enrolledAt = cleanText(body.enrolled_at, 10) || taiwanToday();
    const accessEndsAt = optionalText(body.access_ends_at, 10);
    const notes = optionalText(body.notes, 1000);

    if (!loginEmail || !isValidEmail(loginEmail)) {
        throw new HttpError(400, "INVALID_LOGIN_EMAIL", "學生登入 Email 格式不正確");
    }

    if (!chineseName) {
        throw new HttpError(400, "CHINESE_NAME_REQUIRED", "請輸入學生中文姓名");
    }

    if (!CLASS_CODES.has(classCode)) {
        throw new HttpError(400, "INVALID_CLASS", "班級只能選擇 E1、E3、E5 或 E7");
    }

    if (guardianEmail && !isValidEmail(guardianEmail)) {
        throw new HttpError(400, "INVALID_GUARDIAN_EMAIL", "家長 Email 格式不正確");
    }

    if (!isIsoDate(enrolledAt)) {
        throw new HttpError(400, "INVALID_ENROLLED_DATE", "入班日期格式必須是 YYYY-MM-DD");
    }

    if (accessEndsAt && !isIsoDate(accessEndsAt)) {
        throw new HttpError(400, "INVALID_ACCESS_END_DATE", "權限截止日格式必須是 YYYY-MM-DD");
    }

    if (accessEndsAt && accessEndsAt < enrolledAt) {
        throw new HttpError(400, "ACCESS_END_BEFORE_ENROLLMENT", "權限截止日不可早於入班日期");
    }

    return {
        loginEmail,
        chineseName,
        englishName,
        classCode: classCode as StudentInput["classCode"],
        guardianName,
        guardianEmail,
        guardianPhone,
        enrolledAt,
        accessEndsAt,
        notes
    };
};

const randomCharacters = (length: number): string => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, value => alphabet[value % alphabet.length]).join("");
};

const createTemporaryPassword = (): string => `Ae7!${randomCharacters(12)}`;

const createFirebaseAccount = async (
    input: StudentInput,
    temporaryPassword: string
): Promise<FirebaseSignupResponse> => {
    const displayName = input.englishName || input.chineseName;

    try {
        return await firebaseRequest<FirebaseSignupResponse>("accounts:signUp", {
            email: input.loginEmail,
            password: temporaryPassword,
            displayName,
            returnSecureToken: true
        });
    } catch (error) {
        if (!(error instanceof FirebaseApiError)) throw error;

        if (error.code.includes("EMAIL_EXISTS")) {
            throw new HttpError(409, "FIREBASE_EMAIL_EXISTS", "這個 Email 已經有 Firebase 帳號");
        }
        if (error.code.includes("OPERATION_NOT_ALLOWED")) {
            throw new HttpError(503, "PASSWORD_SIGNUP_DISABLED", "Firebase Email／密碼註冊目前未啟用");
        }
        if (error.code.includes("TOO_MANY_ATTEMPTS")) {
            throw new HttpError(429, "FIREBASE_RATE_LIMITED", "Firebase 建立次數過多，請稍後再試");
        }
        if (error.code.includes("WEAK_PASSWORD")) {
            throw new HttpError(400, "WEAK_TEMPORARY_PASSWORD", "臨時密碼未通過 Firebase 強度要求");
        }

        console.error("Firebase account creation failed", {
            status: error.status,
            code: error.code
        });
        throw new HttpError(502, "FIREBASE_CREATE_FAILED", "Firebase 學生帳號建立失敗");
    }
};

const rollbackFirebaseAccount = async (idToken: string): Promise<boolean> => {
    try {
        await firebaseRequest<JsonObject>("accounts:delete", { idToken });
        return true;
    } catch (error) {
        console.error("Firebase account rollback failed", {
            name: error instanceof Error ? error.name : "UnknownError",
            message: error instanceof Error ? error.message : "Unknown error"
        });
        return false;
    }
};

const createStudent = async (
    req: Request,
    admin: SupabaseClient,
    caller: CallerProfile,
    body: JsonObject
): Promise<Response> => {
    requireStaff(caller);
    const input = normalizeStudentInput(body);

    const { data: existing, error: existingError } = await admin
        .from("students")
        .select("id,email,firebase_uid")
        .eq("email", input.loginEmail)
        .maybeSingle();

    if (existingError) {
        throw new HttpError(500, "DUPLICATE_CHECK_FAILED", "無法檢查重複的學生 Email");
    }
    if (existing?.id) {
        throw new HttpError(409, "LOGIN_EMAIL_EXISTS", "這個 Email 已經存在學生資料");
    }

    const temporaryPassword = createTemporaryPassword();
    const firebaseAccount = await createFirebaseAccount(input, temporaryPassword);

    if (!firebaseAccount.localId || !firebaseAccount.idToken) {
        throw new HttpError(502, "INVALID_FIREBASE_RESPONSE", "Firebase 未回傳完整帳號資料");
    }

    const { data, error } = await admin.rpc("create_academy_student_account_record", {
        p_firebase_uid: firebaseAccount.localId,
        p_login_email: input.loginEmail,
        p_chinese_name: input.chineseName,
        p_class_code: input.classCode,
        p_created_by: caller.id,
        p_english_name: input.englishName,
        p_guardian_name: input.guardianName,
        p_guardian_email: input.guardianEmail,
        p_guardian_phone: input.guardianPhone,
        p_enrolled_at: input.enrolledAt,
        p_access_ends_at: input.accessEndsAt,
        p_notes: input.notes
    });

    if (error) {
        const rolledBack = await rollbackFirebaseAccount(firebaseAccount.idToken);
        console.error("Academy student database creation failed", {
            code: error.code,
            message: error.message,
            firebaseRolledBack: rolledBack
        });

        if (error.code === "23505") {
            throw new HttpError(409, "ACADEMY_STUDENT_EXISTS", "學生 Email 或 Firebase 帳號已存在");
        }
        if (error.code === "42501") {
            throw new HttpError(403, "STAFF_PERMISSION_REQUIRED", "目前帳號沒有建立學生的權限");
        }

        throw new HttpError(
            500,
            rolledBack ? "DATABASE_CREATE_FAILED" : "MANUAL_FIREBASE_CLEANUP_REQUIRED",
            rolledBack
                ? "學生資料建立失敗，Firebase 帳號已自動回收"
                : "學生資料建立失敗，而且 Firebase 帳號回收失敗；請暫停重試並查看 Function Logs"
        );
    }

    return json(req, 201, {
        success: true,
        account: data,
        credentials: {
            email: input.loginEmail,
            temporary_password: temporaryPassword,
            must_change_password: true,
            shown_once: true
        }
    });
};

const listClasses = async (
    req: Request,
    admin: SupabaseClient,
    caller: CallerProfile
): Promise<Response> => {
    requireStaff(caller);

    const { data, error } = await admin
        .from("academy_classes")
        .select("id,code,name_zh,sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

    if (error) {
        throw new HttpError(500, "CLASS_LIST_FAILED", "班級清單讀取失敗");
    }

    return json(req, 200, {
        success: true,
        classes: data || []
    });
};

const previewStudents = async (
    req: Request,
    admin: SupabaseClient,
    caller: CallerProfile,
    body: JsonObject
): Promise<Response> => {
    requireStaff(caller);

    if (!Array.isArray(body.rows) || body.rows.length === 0) {
        throw new HttpError(400, "ROWS_REQUIRED", "沒有可預覽的學生資料");
    }
    if (body.rows.length > MAX_PREVIEW_ROWS) {
        throw new HttpError(400, "TOO_MANY_ROWS", `一次最多預覽 ${MAX_PREVIEW_ROWS} 位學生`);
    }

    const previews = body.rows.map((rawRow, index) => {
        const source = rawRow && typeof rawRow === "object"
            ? rawRow as JsonObject
            : {};

        try {
            const normalized = normalizeStudentInput(source);
            return {
                row_number: index + 1,
                valid: true,
                errors: [] as string[],
                normalized
            };
        } catch (error) {
            const message = error instanceof HttpError ? error.message : "資料格式不正確";
            return {
                row_number: index + 1,
                valid: false,
                errors: [message],
                normalized: null as StudentInput | null
            };
        }
    });

    const emailCounts = new Map<string, number>();
    for (const row of previews) {
        const email = row.normalized?.loginEmail;
        if (email) emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
    }

    for (const row of previews) {
        const email = row.normalized?.loginEmail;
        if (email && (emailCounts.get(email) || 0) > 1) {
            row.valid = false;
            row.errors.push("CSV 內有重複的登入 Email");
        }
    }

    const emails = Array.from(new Set(
        previews
            .filter(row => row.normalized?.loginEmail)
            .map(row => row.normalized!.loginEmail)
    ));

    if (emails.length > 0) {
        const { data: existingStudents, error } = await admin
            .from("students")
            .select("email")
            .in("email", emails);

        if (error) {
            throw new HttpError(500, "PREVIEW_DUPLICATE_CHECK_FAILED", "無法檢查既有學生 Email");
        }

        const existingEmails = new Set(
            (existingStudents || []).map(item => normalizeEmail(item.email))
        );

        for (const row of previews) {
            const email = row.normalized?.loginEmail;
            if (email && existingEmails.has(email)) {
                row.valid = false;
                row.errors.push("這個登入 Email 已經存在");
            }
        }
    }

    const validCount = previews.filter(row => row.valid).length;

    return json(req, 200, {
        success: true,
        summary: {
            total: previews.length,
            valid: validCount,
            invalid: previews.length - validCount
        },
        rows: previews
    });
};

const markPasswordChanged = async (
    req: Request,
    admin: SupabaseClient,
    caller: CallerProfile
): Promise<Response> => {
    if (caller.role !== "student" || caller.learner_type !== "academy_student") {
        throw new HttpError(403, "ACADEMY_STUDENT_REQUIRED", "只有英文班學生需要完成臨時密碼更換");
    }

    const { data, error } = await admin.rpc("mark_academy_student_password_changed", {
        p_firebase_uid: caller.firebase_uid
    });

    if (error) {
        throw new HttpError(500, "PASSWORD_STATUS_UPDATE_FAILED", "密碼已更新，但狀態同步失敗");
    }

    return json(req, 200, {
        success: true,
        student_id: data,
        must_change_password: false
    });
};

const errorResponse = (req: Request, error: unknown): Response => {
    if (error instanceof HttpError) {
        return json(req, error.status, {
            success: false,
            code: error.code,
            error: error.message
        });
    }

    console.error("academy-student-manager unexpected error", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : "Unknown error"
    });

    return json(req, 500, {
        success: false,
        code: "UNEXPECTED_ERROR",
        error: "學生帳號服務發生未預期錯誤"
    });
};

Deno.serve(async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
        try {
            ensureAllowedOrigin(req);
            return new Response(null, {
                status: 204,
                headers: corsHeaders(req)
            });
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

        const token = extractFirebaseToken(req);
        const firebaseUser = await verifyFirebaseUser(token);
        const admin = getSupabaseAdmin();
        const caller = await getCallerProfile(admin, firebaseUser.uid);

        const rawBody = await req.json().catch(() => {
            throw new HttpError(400, "INVALID_JSON", "請求資料不是正確的 JSON");
        });
        const body = rawBody && typeof rawBody === "object"
            ? rawBody as JsonObject
            : {};
        const action = cleanText(body.action, 50);

        if (action === "list_classes") {
            return await listClasses(req, admin, caller);
        }
        if (action === "preview_students") {
            return await previewStudents(req, admin, caller, body);
        }
        if (action === "create_student") {
            return await createStudent(req, admin, caller, body);
        }
        if (action === "mark_password_changed") {
            return await markPasswordChanged(req, admin, caller);
        }

        throw new HttpError(400, "UNKNOWN_ACTION", "不支援的學生帳號操作");
    } catch (error) {
        return errorResponse(req, error);
    }
});