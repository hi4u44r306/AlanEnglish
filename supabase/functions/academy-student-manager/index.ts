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
        emailVerified?: boolean;
        disabled?: boolean;
    }>;
};

type FirebaseUser = {
    uid: string;
    email: string | null;
    emailVerified: boolean;
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
const INVITATION_TTL_HOURS = 72;
const RESERVED_EMAIL_DOMAINS = new Set([
    "example.com",
    "example.net",
    "example.org",
    "example.invalid",
    "localhost"
]);

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

const isReceivableEmail = (value: string): boolean => {
    if (!isValidEmail(value)) return false;
    const domain = value.split("@").pop()?.toLowerCase() || "";
    return Boolean(domain) && !domain.endsWith(".invalid") && !RESERVED_EMAIL_DOMAINS.has(domain);
};

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

const verifyFirebaseUser = async (token: string): Promise<FirebaseUser> => {
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
        email: normalizeEmail(user?.email) || null,
        emailVerified: user?.emailVerified === true
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

    if (!isReceivableEmail(loginEmail)) {
        throw new HttpError(400, "UNRECEIVABLE_LOGIN_EMAIL", "請使用本人或家長可以正常收信的 Email，不可使用虛構或測試信箱");
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

const createInvitationToken = (): string => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join("");
    return btoa(binary)
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
};

const hashInvitationToken = async (token: string): Promise<string> => {
    const bytes = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
};

const invitationError = (message: string): HttpError => {
    if (message.includes("invitation_not_found")) return new HttpError(404, "INVITATION_NOT_FOUND", "找不到這份學生邀請");
    if (message.includes("invitation_expired")) return new HttpError(410, "INVITATION_EXPIRED", "學生邀請已過期，請聯絡櫃檯重新建立");
    if (message.includes("invitation_not_active")) return new HttpError(409, "INVITATION_USED", "學生邀請已使用或已失效");
    if (message.includes("invitation_email_mismatch")) return new HttpError(409, "INVITATION_EMAIL_MISMATCH", "登入 Email 與邀請指定的 Email 不相符");
    if (message.includes("invitation_student_mismatch")) return new HttpError(403, "INVITATION_STUDENT_MISMATCH", "這份邀請不屬於目前登入帳號");
    if (message.includes("academy_student_account_already_exists") || message.includes("already_exists")) {
        return new HttpError(409, "ACCOUNT_ALREADY_EXISTS", "這個 Email 已經建立過 Alan English 帳號");
    }
    return new HttpError(500, "INVITATION_PROCESS_FAILED", "學生邀請處理失敗，請聯絡客服");
};

const createInvitation = async (
    req: Request,
    admin: SupabaseClient,
    caller: CallerProfile,
    body: JsonObject
): Promise<Response> => {
    requireStaff(caller);
    const input = normalizeStudentInput(body);

    const [{ data: existingStudent, error: studentError }, { data: classRow, error: classError }] = await Promise.all([
        admin.from("students").select("id").eq("email", input.loginEmail).maybeSingle(),
        admin.from("academy_classes").select("id,code,name_zh").eq("code", input.classCode).eq("is_active", true).maybeSingle()
    ]);

    if (studentError || classError) {
        throw new HttpError(500, "INVITATION_LOOKUP_FAILED", "無法確認學生邀請資料");
    }
    if (existingStudent?.id) {
        throw new HttpError(409, "LOGIN_EMAIL_EXISTS", "這個 Email 已經有 Alan English 帳號，請直接登入或使用忘記密碼");
    }
    if (!classRow?.id) {
        throw new HttpError(400, "INVALID_CLASS", "找不到指定的英文班班級");
    }

    const { data: existingInvite, error: invitationLookupError } = await admin
        .from("academy_account_invitations")
        .select("id")
        .eq("invited_email", input.loginEmail)
        .in("status", ["active", "claimed"])
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

    if (invitationLookupError) {
        throw new HttpError(500, "INVITATION_LOOKUP_FAILED", "無法檢查既有學生邀請");
    }
    if (existingInvite?.id) {
        throw new HttpError(409, "ACTIVE_INVITATION_EXISTS", "這個 Email 已有尚未完成的邀請，請先使用原邀請或將它撤銷");
    }

    const rawToken = createInvitationToken();
    const tokenHash = await hashInvitationToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000).toISOString();

    const { data, error } = await admin
        .from("academy_account_invitations")
        .insert({
            token_hash: tokenHash,
            token_hint: rawToken.slice(-8),
            invited_email: input.loginEmail,
            chinese_name: input.chineseName,
            english_name: input.englishName,
            class_id: classRow.id,
            guardian_name: input.guardianName,
            guardian_email: input.guardianEmail,
            guardian_phone: input.guardianPhone,
            enrolled_at: input.enrolledAt,
            access_ends_at: input.accessEndsAt,
            notes: input.notes,
            created_by: caller.id,
            expires_at: expiresAt
        })
        .select("id,invited_email,chinese_name,english_name,expires_at,status")
        .single();

    if (error) {
        console.error("academy invitation create failed", { code: error.code, message: error.message });
        throw new HttpError(500, "INVITATION_CREATE_FAILED", "學生邀請建立失敗");
    }

    const origin = requestOrigin(req) && ALLOWED_ORIGINS.has(requestOrigin(req)!)
        ? requestOrigin(req)!
        : "https://alanenglish.com.tw";
    const setupUrl = `${origin}/academy/invite?token=${encodeURIComponent(rawToken)}`;

    return json(req, 201, {
        success: true,
        invitation: {
            ...data,
            class_code: classRow.code,
            class_name: classRow.name_zh,
            setup_url: setupUrl,
            expires_in_hours: INVITATION_TTL_HOURS
        }
    });
};

const previewInvitation = async (
    req: Request,
    admin: SupabaseClient,
    body: JsonObject
): Promise<Response> => {
    const token = cleanText(body.token, 500);
    if (!token) throw new HttpError(400, "INVITATION_TOKEN_REQUIRED", "學生邀請連結不完整");
    const tokenHash = await hashInvitationToken(token);

    const { data, error } = await admin
        .from("academy_account_invitations")
        .select("id,status,invited_email,chinese_name,english_name,enrolled_at,access_ends_at,expires_at,academy_classes(code,name_zh)")
        .eq("token_hash", tokenHash)
        .maybeSingle();

    if (error) throw new HttpError(500, "INVITATION_PREVIEW_FAILED", "無法讀取學生邀請");
    if (!data?.id) throw new HttpError(404, "INVITATION_NOT_FOUND", "找不到這份學生邀請");
    if (new Date(data.expires_at).getTime() <= Date.now() || data.status === "expired") {
        throw new HttpError(410, "INVITATION_EXPIRED", "學生邀請已過期，請聯絡櫃檯重新建立");
    }
    if (!["active", "claimed"].includes(data.status)) {
        throw new HttpError(409, "INVITATION_USED", "學生邀請已使用或已撤銷");
    }

    const academyClass = Array.isArray(data.academy_classes)
        ? data.academy_classes[0]
        : data.academy_classes;

    return json(req, 200, {
        success: true,
        invitation: {
            status: data.status,
            invited_email: data.invited_email,
            chinese_name: data.chinese_name,
            english_name: data.english_name,
            class_code: academyClass?.code || null,
            class_name: academyClass?.name_zh || null,
            enrolled_at: data.enrolled_at,
            access_ends_at: data.access_ends_at,
            expires_at: data.expires_at
        }
    });
};

const claimInvitation = async (
    req: Request,
    admin: SupabaseClient,
    firebaseUser: FirebaseUser,
    body: JsonObject
): Promise<Response> => {
    const token = cleanText(body.token, 500);
    if (!token) throw new HttpError(400, "INVITATION_TOKEN_REQUIRED", "學生邀請連結不完整");
    if (!firebaseUser.email || !isReceivableEmail(firebaseUser.email)) {
        throw new HttpError(400, "RECEIVABLE_EMAIL_REQUIRED", "請使用本人或家長可以正常收信的 Email");
    }

    const tokenHash = await hashInvitationToken(token);
    const { data, error } = await admin.rpc("claim_academy_account_invitation", {
        p_token_hash: tokenHash,
        p_firebase_uid: firebaseUser.uid,
        p_login_email: firebaseUser.email
    });

    if (error) throw invitationError(error.message || "");

    return json(req, 200, {
        success: true,
        claim: data,
        email_verification_required: !firebaseUser.emailVerified
    });
};

const activateInvitation = async (
    req: Request,
    admin: SupabaseClient,
    firebaseUser: FirebaseUser,
    body: JsonObject
): Promise<Response> => {
    if (!firebaseUser.emailVerified) {
        throw new HttpError(403, "EMAIL_NOT_VERIFIED", "請先完成 Email 驗證");
    }
    const token = cleanText(body.token, 500);
    if (!token) throw new HttpError(400, "INVITATION_TOKEN_REQUIRED", "學生邀請連結不完整");
    const tokenHash = await hashInvitationToken(token);
    const { data, error } = await admin.rpc("activate_academy_account_invitation", {
        p_token_hash: tokenHash,
        p_firebase_uid: firebaseUser.uid
    });

    if (error) throw invitationError(error.message || "");
    return json(req, 200, { success: true, activation: data });
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

        const admin = getSupabaseAdmin();
        const rawBody = await req.json().catch(() => {
            throw new HttpError(400, "INVALID_JSON", "請求資料不是正確的 JSON");
        });
        const body = rawBody && typeof rawBody === "object"
            ? rawBody as JsonObject
            : {};
        const action = cleanText(body.action, 50);

        if (action === "preview_invitation") {
            return await previewInvitation(req, admin, body);
        }

        const token = extractFirebaseToken(req);
        const firebaseUser = await verifyFirebaseUser(token);

        if (action === "claim_invitation") {
            return await claimInvitation(req, admin, firebaseUser, body);
        }
        if (action === "activate_invitation") {
            return await activateInvitation(req, admin, firebaseUser, body);
        }

        const caller = await getCallerProfile(admin, firebaseUser.uid);

        if (action === "list_classes") {
            return await listClasses(req, admin, caller);
        }
        if (action === "preview_students") {
            return await previewStudents(req, admin, caller, body);
        }
        if (action === "create_student") {
            return await createStudent(req, admin, caller, body);
        }
        if (action === "create_invitation") {
            return await createInvitation(req, admin, caller, body);
        }
        if (action === "mark_password_changed") {
            return await markPasswordChanged(req, admin, caller);
        }

        throw new HttpError(400, "UNKNOWN_ACTION", "不支援的學生帳號操作");
    } catch (error) {
        return errorResponse(req, error);
    }
});
