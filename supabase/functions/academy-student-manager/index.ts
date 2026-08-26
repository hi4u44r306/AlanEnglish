import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.95.0";
import { importPKCS8, SignJWT } from "npm:jose@5";

type JsonObject = Record<string, unknown>;

type StudentInput = {
    loginEmail: string;
    loginUsername: string | null;
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

type FirebaseServiceAccount = {
    project_id: string;
    client_email: string;
    private_key: string;
    token_uri?: string;
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
    "https://alanenglish-student-test.netlify.app",
    "https://staging--alanenglish.netlify.app",
    "https://alan-english-listening.web.app",
    "https://alan-english-listening.firebaseapp.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]);

const CLASS_CODES = new Set(["E1", "E3", "E5", "E7"]);
const MAX_BODY_BYTES = 512 * 1024;
const MAX_PREVIEW_ROWS = 200;
const MAX_BATCH_ROWS = 25;
const INVITATION_TTL_HOURS = 30 * 24;
const STUDENT_ACTIVATION_TTL_HOURS = 30 * 24;
const ACADEMY_LOGIN_DOMAIN = "login.alanenglish.com.tw";
const ACTIVATION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RESERVED_EMAIL_DOMAINS = new Set([
    "example.com",
    "example.net",
    "example.org",
    "example.invalid",
    "localhost"
]);

let firebaseAdminTokenCache: { token: string; expiresAt: number } | null = null;

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

const getFirebaseServiceAccount = (): FirebaseServiceAccount => {
    const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")?.trim();
    if (!raw) {
        throw new HttpError(
            503,
            "FIREBASE_ADMIN_NOT_CONFIGURED",
            "Firebase 管理員刪除尚未設定，請先使用停用功能"
        );
    }

    try {
        const account = JSON.parse(raw) as Partial<FirebaseServiceAccount>;
        if (!account.project_id || !account.client_email || !account.private_key) {
            throw new Error("missing service account fields");
        }
        return account as FirebaseServiceAccount;
    } catch {
        throw new HttpError(
            503,
            "FIREBASE_ADMIN_CONFIG_INVALID",
            "Firebase 管理員刪除設定不完整，請先使用停用功能"
        );
    }
};

const getFirebaseAdminAccessToken = async (): Promise<string> => {
    if (
        firebaseAdminTokenCache
        && firebaseAdminTokenCache.expiresAt > Date.now() + 60_000
    ) {
        return firebaseAdminTokenCache.token;
    }

    const account = getFirebaseServiceAccount();
    const issuedAt = Math.floor(Date.now() / 1000);
    const privateKey = await importPKCS8(account.private_key, "RS256");
    const assertion = await new SignJWT({
        scope: "https://www.googleapis.com/auth/identitytoolkit"
    })
        .setProtectedHeader({ alg: "RS256", typ: "JWT" })
        .setIssuer(account.client_email)
        .setSubject(account.client_email)
        .setAudience(account.token_uri || "https://oauth2.googleapis.com/token")
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + 3600)
        .sign(privateKey);

    const response = await fetch(
        account.token_uri || "https://oauth2.googleapis.com/token",
        {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion
            })
        }
    );
    const payload = await response.json().catch(() => ({})) as {
        access_token?: string;
        expires_in?: number;
    };

    if (!response.ok || !payload.access_token) {
        throw new HttpError(
            503,
            "FIREBASE_ADMIN_AUTH_FAILED",
            "Firebase 管理員驗證失敗，帳號尚未刪除"
        );
    }

    firebaseAdminTokenCache = {
        token: payload.access_token,
        expiresAt: Date.now() + Math.max(300, Number(payload.expires_in) || 3600) * 1000
    };
    return payload.access_token;
};

const deleteFirebaseAccountByUid = async (firebaseUid: string): Promise<void> => {
    if (!firebaseUid) return;

    const account = getFirebaseServiceAccount();
    const accessToken = await getFirebaseAdminAccessToken();
    const response = await fetch(
        "https://identitytoolkit.googleapis.com/v1/accounts:delete",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                localId: firebaseUid,
                targetProjectId: account.project_id
            })
        }
    );
    const payload = await response.json().catch(() => ({})) as {
        error?: { message?: string };
    };
    const errorCode = cleanText(payload?.error?.message, 160);

    if (!response.ok && !errorCode.includes("USER_NOT_FOUND")) {
        throw new HttpError(
            502,
            "FIREBASE_ACCOUNT_DELETE_FAILED",
            "Firebase 帳號刪除失敗，Supabase 資料未變更"
        );
    }
};

const updateFirebasePasswordByUid = async (
    firebaseUid: string,
    password: string
): Promise<void> => {
    const account = getFirebaseServiceAccount();
    const accessToken = await getFirebaseAdminAccessToken();
    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/accounts:update`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                localId: firebaseUid,
                password,
                validSince: String(Math.floor(Date.now() / 1000))
            })
        }
    );
    const payload = await response.json().catch(() => ({})) as {
        error?: { message?: string };
    };

    if (!response.ok) {
        console.error("Firebase password update failed", {
            status: response.status,
            code: cleanText(payload?.error?.message, 120) || "UNKNOWN"
        });
        throw new HttpError(502, "FIREBASE_PASSWORD_UPDATE_FAILED", "目前無法設定登入密碼，請稍後再試");
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

const requireAdmin = (caller: CallerProfile): void => {
    if (caller.role !== "admin") {
        throw new HttpError(403, "ADMIN_REQUIRED", "只有管理員可以批次建立學生帳號");
    }
};

const normalizeLoginUsername = (value: unknown): string => cleanText(value, 32)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const generatedLoginUsername = (englishName: string | null): string => {
    const namePart = normalizeLoginUsername(englishName).slice(0, 20);
    const prefix = /^[a-z]/.test(namePart) ? namePart : "student";
    return `${prefix}${randomCharacters(5).toLowerCase()}`;
};

const normalizeStudentInput = (
    body: JsonObject,
    options: { requireReceivableEmail?: boolean } = {}
): StudentInput => {
    const chineseName = cleanText(body.chinese_name, 100);
    const englishName = cleanText(body.english_name, 100);
    const requestedUsername = normalizeLoginUsername(body.login_username ?? body.username);
    const loginUsername = options.requireReceivableEmail
        ? null
        : requestedUsername || generatedLoginUsername(englishName);
    const loginEmail = options.requireReceivableEmail
        ? normalizeEmail(body.login_email ?? body.email)
        : `${loginUsername}@${ACADEMY_LOGIN_DOMAIN}`;
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

    if (options.requireReceivableEmail && !isReceivableEmail(loginEmail)) {
        throw new HttpError(400, "UNRECEIVABLE_LOGIN_EMAIL", "請使用本人或家長可以正常收信的 Email，不可使用虛構或測試信箱");
    }

    if (loginUsername && !/^[a-z][a-z0-9]{4,31}$/.test(loginUsername)) {
        throw new HttpError(400, "INVALID_LOGIN_USERNAME", "登入帳號需為 5～32 個小寫英文字母或數字，且第一個字必須是英文字母");
    }

    if (!chineseName) {
        throw new HttpError(400, "CHINESE_NAME_REQUIRED", "請輸入學生中文姓名");
    }

    if (!englishName) {
        throw new HttpError(400, "ENGLISH_NAME_REQUIRED", "請輸入學生英文姓名");
    }

    if (!/^[A-Za-z][A-Za-z .'-]*$/.test(englishName)) {
        throw new HttpError(400, "INVALID_ENGLISH_NAME", "英文姓名請使用英文字母，可包含空格、句點、撇號或連字號");
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
        loginUsername,
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
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const characters = Array.from(
        bytes,
        byte => ACTIVATION_CODE_ALPHABET[byte % ACTIVATION_CODE_ALPHABET.length]
    ).join("");

    return `AE-${characters.slice(0, 4)}-${characters.slice(4, 8)}-${characters.slice(8, 12)}`;
};

const normalizeInvitationToken = (value: unknown): string => {
    const token = cleanText(value, 500);
    const compact = token.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");

    if (/^AE[A-HJ-NP-Z2-9]{12}$/.test(compact)) {
        return `AE-${compact.slice(2, 6)}-${compact.slice(6, 10)}-${compact.slice(10, 14)}`;
    }

    // Keep legacy URL-safe invitation tokens case-sensitive.
    return token;
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
    const input = normalizeStudentInput(body, { requireReceivableEmail: true });

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
    const activationUrl = `${origin}/academy/activate`;

    return json(req, 201, {
        success: true,
        invitation: {
            ...data,
            class_code: classRow.code,
            class_name: classRow.name_zh,
            activation_code: rawToken,
            activation_url: activationUrl,
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
    const token = normalizeInvitationToken(body.token);
    if (!token) throw new HttpError(400, "INVITATION_TOKEN_REQUIRED", "學生邀請連結不完整");
    const accountEmail = normalizeEmail(body.account_email);
    if (body.account_email && !isReceivableEmail(accountEmail)) {
        throw new HttpError(400, "RECEIVABLE_EMAIL_REQUIRED", "請輸入可正常收信的登入 Email");
    }
    const tokenHash = await hashInvitationToken(token);

    const { data, error } = await admin
        .from("academy_account_invitations")
        .select("id,status,invited_email,chinese_name,english_name,enrolled_at,access_ends_at,expires_at,academy_classes(code,name_zh)")
        .eq("token_hash", tokenHash)
        .maybeSingle();

    if (error) throw new HttpError(500, "INVITATION_PREVIEW_FAILED", "無法讀取學生邀請");
    if (!data?.id) throw new HttpError(404, "INVITATION_NOT_FOUND", "找不到這份學生邀請");
    if (accountEmail && data.invited_email.toLowerCase() !== accountEmail) {
        throw new HttpError(404, "INVITATION_NOT_FOUND", "帳號或開通碼不正確");
    }
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
    const token = normalizeInvitationToken(body.token);
    if (!token) throw new HttpError(400, "INVITATION_TOKEN_REQUIRED", "學生邀請連結不完整");
    if (!firebaseUser.email || !isReceivableEmail(firebaseUser.email)) {
        throw new HttpError(400, "RECEIVABLE_EMAIL_REQUIRED", "請使用本人或家長可以正常收信的 Email");
    }
    const dateOfBirth = normalizeDateOfBirth(body.date_of_birth);

    const tokenHash = await hashInvitationToken(token);
    const { data, error } = await admin.rpc("claim_academy_account_invitation", {
        p_token_hash: tokenHash,
        p_firebase_uid: firebaseUser.uid,
        p_login_email: firebaseUser.email,
        p_date_of_birth: dateOfBirth
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
    const token = normalizeInvitationToken(body.token);
    if (!token) throw new HttpError(400, "INVITATION_TOKEN_REQUIRED", "學生邀請連結不完整");
    const tokenHash = await hashInvitationToken(token);
    const { data, error } = await admin.rpc("activate_academy_account_invitation", {
        p_token_hash: tokenHash,
        p_firebase_uid: firebaseUser.uid
    });

    if (error) throw invitationError(error.message || "");
    return json(req, 200, { success: true, activation: data });
};

const listInvitations = async (
    req: Request,
    admin: SupabaseClient,
    caller: CallerProfile
): Promise<Response> => {
    requireStaff(caller);

    const { data, error } = await admin
        .from("academy_account_invitations")
        .select("id,status,invited_email,chinese_name,english_name,enrolled_at,access_ends_at,expires_at,claimed_by_student_id,claimed_at,completed_at,created_at,academy_classes(code,name_zh)")
        .order("created_at", { ascending: false })
        .limit(500);

    if (error) {
        throw new HttpError(500, "INVITATION_LIST_FAILED", "無法讀取學生開通狀態");
    }

    const invitations = (data || []).map(invitation => {
        const academyClass = Array.isArray(invitation.academy_classes)
            ? invitation.academy_classes[0]
            : invitation.academy_classes;
        const status = invitation.status === "active" && new Date(invitation.expires_at).getTime() <= Date.now()
            ? "expired"
            : invitation.status;

        return {
            id: invitation.id,
            status,
            invited_email: invitation.invited_email,
            chinese_name: invitation.chinese_name,
            english_name: invitation.english_name,
            class_code: academyClass?.code || null,
            class_name: academyClass?.name_zh || null,
            enrolled_at: invitation.enrolled_at,
            access_ends_at: invitation.access_ends_at,
            expires_at: invitation.expires_at,
            claimed_by_student_id: invitation.claimed_by_student_id,
            claimed_at: invitation.claimed_at,
            completed_at: invitation.completed_at,
            created_at: invitation.created_at
        };
    });

    return json(req, 200, { success: true, invitations });
};

const createStudentActivationToken = (): string => randomCharacters(40);

const createStudentRecoveryCode = (): string => {
    const compact = randomCharacters(12).toUpperCase();
    return `AE-${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}`;
};

const normalizeRecoveryCode = (value: unknown): string => cleanText(value, 32)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const validateStudentPassword = (value: unknown): string => {
    const password = typeof value === "string" ? value : "";
    if (password.length < 6) {
        throw new HttpError(400, "INVALID_STUDENT_PASSWORD", "登入密碼至少需要 6 個字元");
    }
    return password;
};

const normalizeDateOfBirth = (value: unknown, { required = false } = {}): string | null => {
    const date = cleanText(value, 10);
    if (!date) {
        if (required) throw new HttpError(400, "DATE_OF_BIRTH_REQUIRED", "請填寫出生年月日");
        return null;
    }
    if (!isIsoDate(date) || date < "1900-01-01" || date > taiwanToday()) {
        throw new HttpError(400, "INVALID_DATE_OF_BIRTH", "出生年月日格式不正確");
    }
    return date;
};

const ACCOUNT_DELETE_BLOCKER_LABELS: Record<string, string> = {
    payment_or_access_history: "付款、兌換或加購紀錄",
    learning_history: "學習、作業、聽力或 AI 紀錄",
    academic_history: "分班或班級異動紀錄",
    reward_history: "XP、AE Points 或獎品兌換紀錄",
    support_history: "客服案件紀錄",
    staff_created_records: "由此帳號建立的管理資料"
};

const deleteStudentAccount = async (
    req: Request,
    admin: SupabaseClient,
    caller: CallerProfile,
    body: JsonObject
): Promise<Response> => {
    requireAdmin(caller);
    const studentId = Number(body.student_id);
    const confirmationEmail = normalizeEmail(body.confirmation_email);
    if (!Number.isSafeInteger(studentId) || studentId <= 0) {
        throw new HttpError(400, "STUDENT_ID_REQUIRED", "缺少要刪除的學生帳號編號");
    }

    const { data: eligibilityData, error: eligibilityError } = await admin.rpc(
        "get_student_account_deletion_eligibility",
        {
            p_actor_id: caller.id,
            p_target_student_id: studentId
        }
    );
    if (eligibilityError) {
        const message = String(eligibilityError.message || "");
        if (message.includes("student_account_not_found")) {
            throw new HttpError(404, "ACCOUNT_NOT_FOUND", "找不到要刪除的學生帳號");
        }
        if (message.includes("staff_account_delete_forbidden")) {
            throw new HttpError(403, "STAFF_DELETE_FORBIDDEN", "教師與管理員帳號不可永久刪除");
        }
        throw new HttpError(500, "DELETE_PREFLIGHT_FAILED", "無法確認帳號是否可安全刪除");
    }

    const eligibility = (eligibilityData || {}) as {
        email?: string;
        firebase_uid?: string;
        can_delete?: boolean;
        blockers?: string[];
    };
    const targetEmail = normalizeEmail(eligibility.email);
    if (!targetEmail || confirmationEmail !== targetEmail) {
        throw new HttpError(400, "CONFIRMATION_EMAIL_MISMATCH", "請輸入完整 Email 確認永久刪除");
    }

    if (!eligibility.can_delete) {
        const blockerText = (eligibility.blockers || [])
            .map(code => ACCOUNT_DELETE_BLOCKER_LABELS[code] || code)
            .join("、");
        throw new HttpError(
            409,
            "ACCOUNT_HAS_HISTORY",
            `此帳號有${blockerText || "需保留的正式紀錄"}，只能停用，不能永久刪除`
        );
    }

    await deleteFirebaseAccountByUid(cleanText(eligibility.firebase_uid, 200));

    const { data: deleted, error: deleteError } = await admin.rpc(
        "delete_unstarted_student_account",
        {
            p_actor_id: caller.id,
            p_target_student_id: studentId
        }
    );
    if (deleteError) {
        const message = String(deleteError.message || "");
        if (message.includes("account_delete_blocked")) {
            throw new HttpError(
                409,
                "ACCOUNT_BECAME_INELIGIBLE",
                "帳號狀態剛剛發生變更；Firebase 已移除，但學習資料已保留，請聯絡系統管理員確認"
            );
        }
        throw new HttpError(
            500,
            "DATABASE_ACCOUNT_DELETE_FAILED",
            "Firebase 已移除，但 Supabase 帳號清理失敗，請聯絡系統管理員確認"
        );
    }

    return json(req, 200, {
        success: true,
        deletion: deleted
    });
};

const deleteInvitation = async (
    req: Request,
    admin: SupabaseClient,
    caller: CallerProfile,
    body: JsonObject
): Promise<Response> => {
    requireAdmin(caller);
    const invitationId = Number(body.invitation_id);
    const confirmationEmail = normalizeEmail(body.confirmation_email);
    if (!Number.isSafeInteger(invitationId) || invitationId <= 0) {
        throw new HttpError(400, "INVITATION_ID_REQUIRED", "缺少待開通邀請編號");
    }

    const { data: invitation, error: invitationError } = await admin
        .from("academy_account_invitations")
        .select("id,status,invited_email,claimed_by_student_id")
        .eq("id", invitationId)
        .maybeSingle();
    if (invitationError) {
        throw new HttpError(500, "INVITATION_LOOKUP_FAILED", "無法確認待開通邀請");
    }
    if (!invitation?.id) {
        throw new HttpError(404, "INVITATION_NOT_FOUND", "找不到待開通邀請");
    }
    if (normalizeEmail(invitation.invited_email) !== confirmationEmail) {
        throw new HttpError(400, "CONFIRMATION_EMAIL_MISMATCH", "請輸入完整 Email 確認刪除邀請");
    }
    if (invitation.claimed_by_student_id) {
        throw new HttpError(
            409,
            "INVITATION_ALREADY_CLAIMED",
            "學生已建立 Firebase 帳號，請從帳號清單永久刪除該學生"
        );
    }
    if (invitation.status === "completed") {
        throw new HttpError(409, "INVITATION_COMPLETED", "已完成的開通紀錄不可單獨刪除");
    }

    const { error: deleteError } = await admin
        .from("academy_account_invitations")
        .delete()
        .eq("id", invitation.id)
        .is("claimed_by_student_id", null);
    if (deleteError) {
        throw new HttpError(500, "INVITATION_DELETE_FAILED", "待開通邀請刪除失敗");
    }

    return json(req, 200, {
        success: true,
        invitation_id: invitation.id,
        deleted: true
    });
};

const sendPasswordReset = async (
    req: Request,
    admin: SupabaseClient,
    caller: CallerProfile,
    body: JsonObject
): Promise<Response> => {
    requireStaff(caller);
    const email = normalizeEmail(body.email);
    if (!isReceivableEmail(email)) {
        throw new HttpError(400, "RECEIVABLE_EMAIL_REQUIRED", "請使用可以正常收信的 Email");
    }

    let targetQuery = admin
        .from("students")
        .select("id,role,email")
        .eq("email", email);
    if (caller.role === "teacher") targetQuery = targetQuery.eq("role", "student");

    const { data: target, error: targetError } = await targetQuery.maybeSingle();
    if (targetError) throw new HttpError(500, "ACCOUNT_LOOKUP_FAILED", "無法確認學生帳號");
    if (!target?.id) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "找不到可管理的學生帳號");

    try {
        await firebaseRequest<JsonObject>("accounts:sendOobCode", {
            requestType: "PASSWORD_RESET",
            email
        });
    } catch (error) {
        if (error instanceof FirebaseApiError) {
            if (error.code.includes("TOO_MANY_ATTEMPTS")) {
                throw new HttpError(429, "FIREBASE_RATE_LIMITED", "重設信寄送次數過多，請稍後再試");
            }
            if (error.code.includes("EMAIL_NOT_FOUND")) {
                throw new HttpError(404, "FIREBASE_ACCOUNT_NOT_FOUND", "Firebase 找不到這個學生帳號");
            }
        }
        throw error;
    }

    return json(req, 200, {
        success: true,
        email,
        message: "密碼重設信已寄出"
    });
};

const createStudentAccount = async (
    req: Request,
    admin: SupabaseClient,
    caller: CallerProfile,
    input: StudentInput
): Promise<{ account: unknown; credentials: JsonObject }> => {
    const { data: existing, error: existingError } = await admin
        .from("students")
        .select("id,email,firebase_uid")
        .eq("email", input.loginEmail)
        .maybeSingle();

    if (existingError) {
        throw new HttpError(500, "DUPLICATE_CHECK_FAILED", "無法檢查重複的學生帳號");
    }
    if (existing?.id) {
        throw new HttpError(409, "LOGIN_USERNAME_EXISTS", "這個登入帳號已經存在，請換一個帳號名稱");
    }

    const hiddenBootstrapPassword = createTemporaryPassword();
    const activationToken = createStudentActivationToken();
    const recoveryCodes = [createStudentRecoveryCode(), createStudentRecoveryCode()];
    const [activationTokenHash, ...recoveryCodeHashes] = await Promise.all([
        hashInvitationToken(activationToken),
        ...recoveryCodes.map(code => hashInvitationToken(normalizeRecoveryCode(code)))
    ]);
    const firebaseAccount = await createFirebaseAccount(input, hiddenBootstrapPassword);

    if (!firebaseAccount.localId || !firebaseAccount.idToken) {
        throw new HttpError(502, "INVALID_FIREBASE_RESPONSE", "Firebase 未回傳完整帳號資料");
    }

    const activationExpiresAt = new Date(
        Date.now() + STUDENT_ACTIVATION_TTL_HOURS * 60 * 60 * 1000
    ).toISOString();
    const { data, error } = await admin.rpc("create_academy_student_login_record", {
        p_firebase_uid: firebaseAccount.localId,
        p_internal_email: input.loginEmail,
        p_login_username: input.loginUsername,
        p_chinese_name: input.chineseName,
        p_class_code: input.classCode,
        p_created_by: caller.id,
        p_activation_token_hash: activationTokenHash,
        p_activation_token_hint: activationToken.slice(-8),
        p_activation_expires_at: activationExpiresAt,
        p_recovery_code_hashes: recoveryCodeHashes,
        p_recovery_code_hints: recoveryCodes.map(code => code.slice(-4)),
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
            throw new HttpError(409, "ACADEMY_STUDENT_EXISTS", "學生登入帳號已存在，請重新建立");
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

    const safeAccount = data && typeof data === "object"
        ? structuredClone(data) as JsonObject
        : data;
    if (safeAccount && typeof safeAccount === "object") {
        const student = safeAccount.student;
        if (student && typeof student === "object") {
            delete (student as JsonObject).email;
        }
    }
    const origin = requestOrigin(req) && ALLOWED_ORIGINS.has(requestOrigin(req)!)
        ? requestOrigin(req)!
        : "https://alanenglish.com.tw";

    return {
        account: safeAccount,
        credentials: {
            username: input.loginUsername,
            activation_url: `${origin}/academy/student-setup?token=${encodeURIComponent(activationToken)}`,
            activation_code: activationToken,
            activation_expires_at: activationExpiresAt,
            recovery_codes: recoveryCodes,
            must_change_password: true,
            shown_once: true
        }
    };
};

const createStudent = async (
    req: Request,
    admin: SupabaseClient,
    caller: CallerProfile,
    body: JsonObject
): Promise<Response> => {
    requireStaff(caller);
    const result = await createStudentAccount(
        req,
        admin,
        caller,
        normalizeStudentInput(body)
    );

    return json(req, 201, {
        success: true,
        ...result
    });
};

const reissueStudentLoginCard = async (
    req: Request,
    admin: SupabaseClient,
    caller: CallerProfile,
    body: JsonObject
): Promise<Response> => {
    requireAdmin(caller);
    const studentId = Number(body.student_id);
    if (!Number.isSafeInteger(studentId) || studentId <= 0) {
        throw new HttpError(400, "STUDENT_ID_REQUIRED", "缺少要重新發卡的學生帳號");
    }

    const { data: student, error: studentError } = await admin
        .from("students")
        .select("id,name,login_username,authentication_method,account_status,activated_at")
        .eq("id", studentId)
        .maybeSingle();
    if (studentError) throw new HttpError(500, "STUDENT_LOOKUP_FAILED", "目前無法確認學生帳號");
    if (!student?.id || student.authentication_method !== "academy_username") {
        throw new HttpError(404, "ACADEMY_LOGIN_NOT_FOUND", "找不到可重新發卡的英文班學生帳號");
    }
    if (student.account_status === "archived") {
        throw new HttpError(409, "ACCOUNT_ARCHIVED", "已停用帳號無法重新發登入卡，請先恢復帳號");
    }
    if (student.activated_at) {
        throw new HttpError(409, "ACCOUNT_ALREADY_ACTIVATED", "這個學生帳號已啟用，請改用登入卡復原碼重設密碼");
    }

    const activationToken = createStudentActivationToken();
    const recoveryCodes = [createStudentRecoveryCode(), createStudentRecoveryCode()];
    const [activationTokenHash, ...recoveryCodeHashes] = await Promise.all([
        hashInvitationToken(activationToken),
        ...recoveryCodes.map(code => hashInvitationToken(normalizeRecoveryCode(code)))
    ]);
    const now = new Date().toISOString();
    const activationExpiresAt = new Date(
        Date.now() + STUDENT_ACTIVATION_TTL_HOURS * 60 * 60 * 1000
    ).toISOString();

    const [{ error: oldTokenError }, { error: oldCodeError }] = await Promise.all([
        admin.from("academy_student_activation_tokens").update({ revoked_at: now })
            .eq("student_id", student.id).is("used_at", null).is("revoked_at", null),
        admin.from("academy_student_recovery_codes").update({ revoked_at: now })
            .eq("student_id", student.id).is("used_at", null).is("revoked_at", null)
    ]);
    if (oldTokenError || oldCodeError) {
        throw new HttpError(500, "LOGIN_CARD_REVOKE_FAILED", "無法使舊登入卡失效，請稍後再試");
    }

    const { error: tokenError } = await admin.from("academy_student_activation_tokens").insert({
        student_id: student.id,
        token_hash: activationTokenHash,
        token_hint: activationToken.slice(-8),
        expires_at: activationExpiresAt,
        created_by: caller.id
    });
    if (tokenError) {
        throw new HttpError(500, "LOGIN_CARD_CREATE_FAILED", "新的登入卡建立失敗，請稍後再試");
    }

    const { error: recoveryError } = await admin.from("academy_student_recovery_codes").insert(
        recoveryCodes.map((code, index) => ({
            student_id: student.id,
            code_hash: recoveryCodeHashes[index],
            code_hint: code.slice(-4),
            created_by: caller.id
        }))
    );
    if (recoveryError) {
        await admin.from("academy_student_activation_tokens").update({ revoked_at: now })
            .eq("student_id", student.id).eq("token_hash", activationTokenHash)
            .is("used_at", null).is("revoked_at", null);
        throw new HttpError(500, "RECOVERY_CARD_CREATE_FAILED", "新的復原碼建立失敗，請稍後再試");
    }

    const origin = requestOrigin(req) && ALLOWED_ORIGINS.has(requestOrigin(req)!)
        ? requestOrigin(req)!
        : "https://alanenglish.com.tw";
    return json(req, 200, {
        success: true,
        account: { id: student.id, name: student.name, username: student.login_username },
        credentials: {
            username: student.login_username,
            activation_url: `${origin}/academy/student-setup?token=${encodeURIComponent(activationToken)}`,
            activation_expires_at: activationExpiresAt,
            recovery_codes: recoveryCodes,
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
                normalized: {
                    ...normalized,
                    loginEmail: undefined
                }
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

    const usernameCounts = new Map<string, number>();
    for (const row of previews) {
        const username = row.normalized?.loginUsername;
        if (username) usernameCounts.set(username, (usernameCounts.get(username) || 0) + 1);
    }

    for (const row of previews) {
        const username = row.normalized?.loginUsername;
        if (username && (usernameCounts.get(username) || 0) > 1) {
            row.valid = false;
            row.errors.push("CSV 內有重複的登入帳號");
        }
    }

    const usernames = Array.from(new Set(
        previews
            .filter(row => row.normalized?.loginUsername)
            .map(row => row.normalized!.loginUsername!)
    ));

    if (usernames.length > 0) {
        const { data: existingStudents, error } = await admin
            .from("students")
            .select("login_username")
            .in("login_username", usernames);

        if (error) {
            throw new HttpError(500, "PREVIEW_DUPLICATE_CHECK_FAILED", "無法檢查既有學生帳號");
        }

        const existingUsernames = new Set(
            (existingStudents || []).map(item => normalizeLoginUsername(item.login_username))
        );

        for (const row of previews) {
            const username = row.normalized?.loginUsername;
            if (username && existingUsernames.has(username)) {
                row.valid = false;
                row.errors.push("這個登入帳號已經存在");
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

const createdStudentId = (account: unknown): number | null => {
    if (!account || typeof account !== "object") return null;
    const student = (account as JsonObject).student;
    if (!student || typeof student !== "object") return null;
    const value = (student as JsonObject).id;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const batchCreateStudents = async (
    req: Request,
    admin: SupabaseClient,
    caller: CallerProfile,
    body: JsonObject
): Promise<Response> => {
    requireAdmin(caller);

    const requestId = cleanText(body.request_id, 36).toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)) {
        throw new HttpError(400, "INVALID_REQUEST_ID", "批次識別碼格式不正確，請重新載入後再試");
    }
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
        throw new HttpError(400, "ROWS_REQUIRED", "沒有可以批次建立的學生資料");
    }
    if (body.rows.length > MAX_BATCH_ROWS) {
        throw new HttpError(400, "TOO_MANY_BATCH_ROWS", `一次最多建立 ${MAX_BATCH_ROWS} 位學生`);
    }

    const preparedRows = body.rows.map((rawRow, index) => {
        const source = rawRow && typeof rawRow === "object"
            ? rawRow as JsonObject
            : {};
        const fallbackUsername = normalizeLoginUsername(source.login_username ?? source.username)
            || `第 ${index + 1} 列自動產生`;

        try {
            return {
                rowNumber: index + 1,
                identifier: fallbackUsername,
                input: normalizeStudentInput(source),
                error: null as HttpError | null
            };
        } catch (error) {
            return {
                rowNumber: index + 1,
                identifier: fallbackUsername,
                input: null as StudentInput | null,
                error: error instanceof HttpError
                    ? error
                    : new HttpError(400, "INVALID_ROW", "資料格式不正確")
            };
        }
    });

    const usernameCounts = new Map<string, number>();
    for (const row of preparedRows) {
        if (row.input) {
            const username = row.input.loginUsername || "";
            usernameCounts.set(username, (usernameCounts.get(username) || 0) + 1);
        }
    }
    for (const row of preparedRows) {
        if (row.input && (usernameCounts.get(row.input.loginUsername || "") || 0) > 1) {
            row.error = new HttpError(400, "DUPLICATE_USERNAME_IN_BATCH", "CSV 內有重複的登入帳號");
            row.input = null;
        }
    }

    const { data: batch, error: batchError } = await admin
        .from("academy_student_import_batches")
        .insert({
            request_id: requestId,
            created_by: caller.id,
            total_rows: preparedRows.length,
            status: "processing"
        })
        .select("id")
        .single();

    if (batchError) {
        if (batchError.code === "23505") {
            throw new HttpError(
                409,
                "BATCH_ALREADY_SUBMITTED",
                "這批資料已送出過。為避免重複建立，請重新載入並確認帳號管理結果"
            );
        }
        throw new HttpError(500, "BATCH_AUDIT_CREATE_FAILED", "無法建立批次操作紀錄");
    }

    const results: JsonObject[] = [];
    let successCount = 0;
    let failureCount = 0;
    let auditComplete = true;

    for (const row of preparedRows) {
        let result: JsonObject;

        if (row.error || !row.input) {
            const error = row.error || new HttpError(400, "INVALID_ROW", "資料格式不正確");
            failureCount += 1;
            result = {
                row_number: row.rowNumber,
                login_username: row.identifier,
                audit_login_email: row.input?.loginEmail || `${row.identifier}@${ACADEMY_LOGIN_DOMAIN}`,
                status: "failed",
                code: error.code,
                error: error.message
            };
        } else {
            try {
                const created = await createStudentAccount(req, admin, caller, row.input);
                successCount += 1;
                result = {
                    row_number: row.rowNumber,
                    login_username: row.input.loginUsername,
                    audit_login_email: row.input.loginEmail,
                    status: "success",
                    account: created.account,
                    credentials: created.credentials
                };
            } catch (error) {
                const handled = error instanceof HttpError
                    ? error
                    : new HttpError(500, "ROW_CREATE_FAILED", "學生帳號建立失敗");
                failureCount += 1;
                result = {
                    row_number: row.rowNumber,
                    login_username: row.input.loginUsername,
                    audit_login_email: row.input.loginEmail,
                    status: "failed",
                    code: handled.code,
                    error: handled.message
                };
            }
        }

        results.push(result);

        const { error: resultAuditError } = await admin
            .from("academy_student_import_results")
            .insert({
                batch_id: batch.id,
                row_number: result.row_number,
                login_email: result.audit_login_email,
                student_id: result.status === "success"
                    ? createdStudentId(result.account)
                    : null,
                status: result.status,
                error_code: result.code || null,
                error_message: result.error || null
            });

        if (resultAuditError) {
            auditComplete = false;
            console.error("academy student batch row audit failed", {
                batchId: batch.id,
                rowNumber: row.rowNumber,
                code: resultAuditError.code,
                message: resultAuditError.message
            });
        }

        delete result.audit_login_email;
    }

    const finalStatus = failureCount === 0 ? "completed" : "completed_with_errors";
    const { error: batchUpdateError } = await admin
        .from("academy_student_import_batches")
        .update({
            status: finalStatus,
            success_count: successCount,
            failure_count: failureCount,
            completed_at: new Date().toISOString()
        })
        .eq("id", batch.id);

    if (batchUpdateError) {
        auditComplete = false;
        console.error("academy student batch audit update failed", {
            batchId: batch.id,
            code: batchUpdateError.code,
            message: batchUpdateError.message
        });
    }

    return json(req, 200, {
        success: true,
        batch_id: batch.id,
        request_id: requestId,
        audit_complete: auditComplete,
        summary: {
            total: preparedRows.length,
            succeeded: successCount,
            failed: failureCount
        },
        results
    });
};

const getActivationRecord = async (
    admin: SupabaseClient,
    token: string
): Promise<any> => {
    const tokenHash = await hashInvitationToken(token);
    const { data, error } = await admin
        .from("academy_student_activation_tokens")
        .select("id,student_id,expires_at,used_at,revoked_at,students!academy_student_activation_tokens_student_id_fkey!inner(id,name,chinese_name,english_name,firebase_uid,login_username,authentication_method,account_status)")
        .eq("token_hash", tokenHash)
        .maybeSingle();
    if (error) throw new HttpError(500, "ACTIVATION_LOOKUP_FAILED", "目前無法確認啟用資料");
    if (!data?.id) throw new HttpError(404, "ACTIVATION_NOT_FOUND", "啟用連結不存在或已失效");
    if (data.revoked_at || data.used_at) throw new HttpError(409, "ACTIVATION_ALREADY_USED", "這份啟用資料已使用或已失效");
    if (new Date(data.expires_at).getTime() <= Date.now()) {
        throw new HttpError(410, "ACTIVATION_EXPIRED", "啟用期限已過，請向老師重新領取登入卡");
    }
    const student = Array.isArray(data.students) ? data.students[0] : data.students;
    if (
        !student?.firebase_uid
        || student.authentication_method !== "academy_username"
        || student.account_status === "archived"
    ) {
        throw new HttpError(409, "ACTIVATION_ACCOUNT_UNAVAILABLE", "這個學生帳號目前無法啟用");
    }
    return { ...data, student };
};

const previewStudentActivation = async (
    req: Request,
    admin: SupabaseClient,
    body: JsonObject
): Promise<Response> => {
    const token = cleanText(body.token, 200);
    if (!token) throw new HttpError(400, "ACTIVATION_TOKEN_REQUIRED", "啟用連結不完整");
    const record = await getActivationRecord(admin, token);
    return json(req, 200, {
        success: true,
        student: {
            name: record.student.name,
            chinese_name: record.student.chinese_name || record.student.name,
            english_name: record.student.english_name,
            username: record.student.login_username
        },
        expires_at: record.expires_at
    });
};

const activateStudentLogin = async (
    req: Request,
    admin: SupabaseClient,
    body: JsonObject
): Promise<Response> => {
    const token = cleanText(body.token, 200);
    if (!token) throw new HttpError(400, "ACTIVATION_TOKEN_REQUIRED", "啟用連結不完整");
    const password = validateStudentPassword(body.password ?? body.pin);
    const chineseName = cleanText(body.chinese_name, 100);
    const englishName = cleanText(body.english_name, 100);
    if (!chineseName) throw new HttpError(400, "CHINESE_NAME_REQUIRED", "請輸入學生中文姓名");
    if (!englishName) throw new HttpError(400, "ENGLISH_NAME_REQUIRED", "請輸入學生英文姓名");
    if (!/^[A-Za-z][A-Za-z .'-]*$/.test(englishName)) {
        throw new HttpError(400, "INVALID_ENGLISH_NAME", "英文姓名請使用英文字母，可包含空格、句點、撇號或連字號");
    }
    const record = await getActivationRecord(admin, token);

    await updateFirebasePasswordByUid(record.student.firebase_uid, password);
    const now = new Date().toISOString();
    const [{ error: tokenError }, { error: studentError }] = await Promise.all([
        admin
            .from("academy_student_activation_tokens")
            .update({ used_at: now })
            .eq("id", record.id)
            .is("used_at", null)
            .is("revoked_at", null),
        admin
            .from("students")
            .update({
                name: chineseName,
                chinese_name: chineseName,
                english_name: englishName,
                must_change_password: false,
                password_changed_at: now,
                activated_at: now,
                temporary_password_issued_at: null
            })
            .eq("id", record.student.id)
    ]);
    if (tokenError || studentError) {
        console.error("Academy student activation audit failed", {
            tokenCode: tokenError?.code || null,
            studentCode: studentError?.code || null
        });
        throw new HttpError(500, "ACTIVATION_SAVE_FAILED", "密碼已設定，但啟用狀態寫入失敗，請聯絡老師");
    }

    return json(req, 200, {
        success: true,
        username: record.student.login_username,
        message: "登入密碼設定完成"
    });
};

const recoverStudentLogin = async (
    req: Request,
    admin: SupabaseClient,
    body: JsonObject
): Promise<Response> => {
    const username = normalizeLoginUsername(body.username);
    const recoveryCode = normalizeRecoveryCode(body.recovery_code);
    const password = validateStudentPassword(body.password ?? body.pin);
    if (!/^[a-z][a-z0-9]{4,31}$/.test(username) || recoveryCode.length < 10) {
        throw new HttpError(400, "INVALID_RECOVERY_DETAILS", "帳號或復原碼不正確");
    }
    const codeHash = await hashInvitationToken(recoveryCode);
    const { data, error } = await admin
        .from("academy_student_recovery_codes")
        .select("id,student_id,used_at,revoked_at,students!academy_student_recovery_codes_student_id_fkey!inner(id,firebase_uid,login_username,authentication_method,account_status)")
        .eq("code_hash", codeHash)
        .maybeSingle();
    const student = Array.isArray(data?.students) ? data.students[0] : data?.students;
    if (
        error
        || !data?.id
        || data.used_at
        || data.revoked_at
        || normalizeLoginUsername(student?.login_username) !== username
        || student?.authentication_method !== "academy_username"
        || student?.account_status === "archived"
    ) {
        throw new HttpError(404, "RECOVERY_NOT_FOUND", "帳號或復原碼不正確，或這組復原碼已使用");
    }

    await updateFirebasePasswordByUid(student.firebase_uid, password);
    const now = new Date().toISOString();
    const [{ error: codeError }, { error: studentError }] = await Promise.all([
        admin
            .from("academy_student_recovery_codes")
            .update({ used_at: now })
            .eq("id", data.id)
            .is("used_at", null)
            .is("revoked_at", null),
        admin
            .from("students")
            .update({ must_change_password: false, password_changed_at: now })
            .eq("id", student.id)
    ]);
    if (codeError || studentError) {
        console.error("Academy student recovery audit failed", {
            codeError: codeError?.code || null,
            studentError: studentError?.code || null
        });
        throw new HttpError(500, "RECOVERY_SAVE_FAILED", "密碼已更新，但復原狀態寫入失敗，請聯絡老師");
    }
    return json(req, 200, { success: true, username, message: "新的登入密碼已設定" });
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
        if (action === "preview_student_activation") {
            return await previewStudentActivation(req, admin, body);
        }
        if (action === "activate_student_login") {
            return await activateStudentLogin(req, admin, body);
        }
        if (action === "recover_student_login") {
            return await recoverStudentLogin(req, admin, body);
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
        if (action === "list_invitations") {
            return await listInvitations(req, admin, caller);
        }
        if (action === "delete_student_account") {
            return await deleteStudentAccount(req, admin, caller, body);
        }
        if (action === "delete_invitation") {
            return await deleteInvitation(req, admin, caller, body);
        }
        if (action === "send_password_reset") {
            return await sendPasswordReset(req, admin, caller, body);
        }
        if (action === "create_student") {
            return await createStudent(req, admin, caller, body);
        }
        if (action === "reissue_student_login_card") {
            return await reissueStudentLoginCard(req, admin, caller, body);
        }
        if (action === "batch_create_students") {
            return await batchCreateStudents(req, admin, caller, body);
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
