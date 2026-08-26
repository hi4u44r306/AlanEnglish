import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "npm:jose@5";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";
import {
    ACADEMY_AI_ADDON_PLAN_CODE,
    BASIC_MEMBERSHIP_PLAN_CODE,
    GENERAL_AI_ADDON_PLAN_CODE,
    getMembershipPricingEligibility,
    isAiAddonPlanCode
} from "../_shared/membership-pricing.ts";

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
const ACCOUNT_ROLES = new Set(["student", "teacher", "admin"]);
const MEMBERSHIP_STATUSES = new Set([
    "pending_verification",
    "trialing",
    "active",
    "past_due",
    "cancelled",
    "expired",
    "suspended",
    "complimentary"
]);
const MEMBERSHIP_SOURCES = new Set([
    "public_signup",
    "stripe",
    "activation_code",
    "material_purchase",
    "admin_grant",
    "legacy"
]);

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const cleanText = (value: unknown, maxLength = 200) => String(value || "")
    .trim()
    .slice(0, maxLength);

const relationOne = (value: any) => Array.isArray(value) ? value[0] || null : value || null;

const normalizeLevelProgress = (progress: any) => progress ? ({
    ...progress,
    learning_levels: relationOne(progress.learning_levels)
}) : null;

const normalizeEmail = (value: unknown) => cleanText(value, 320).toLowerCase();

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const RESERVED_EMAIL_DOMAINS = new Set(["example.com", "example.net", "example.org", "example.invalid", "localhost"]);
const isReceivableEmail = (value: string) => {
    const domain = value.split("@").pop() || "";
    return isEmail(value) && !domain.endsWith(".invalid") && !RESERVED_EMAIL_DOMAINS.has(domain);
};

const numberOrNull = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const isoOrNull = (value: unknown) => {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const normalizeDateOfBirth = (value: unknown): string => {
    const date = cleanText(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("出生年月日格式不正確");
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < "1900-01-01") {
        throw new Error("出生年月日格式不正確");
    }
    const taipeiParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const taipeiToday = `${taipeiParts.find(part => part.type === "year")?.value}-${taipeiParts.find(part => part.type === "month")?.value}-${taipeiParts.find(part => part.type === "day")?.value}`;
    if (date > taipeiToday) throw new Error("出生年月日不可晚於今天");
    return date;
};

const positiveInteger = (value: unknown) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const sha256 = async (value: string) => {
    const bytes = new TextEncoder().encode(value);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return Array.from(digest).map(byte => byte.toString(16).padStart(2, "0")).join("");
};

const normalizeActivationCode = (value: unknown) => cleanText(value, 80)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const createActivationCode = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const body = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
    return `AE-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
};

type VerifiedFirebaseUser = {
    uid: string;
    email: string;
    emailVerified: boolean;
    payload: JWTPayload;
};

async function verifyFirebaseIdToken(token: string): Promise<VerifiedFirebaseUser> {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: FIREBASE_PROJECT_ID
    });
    const uid = cleanText(payload.sub, 200);
    if (!uid) throw new Error("Firebase token 缺少 uid");
    return {
        uid,
        email: normalizeEmail(payload.email),
        emailVerified: payload.email_verified === true,
        payload
    };
}

const getSupabaseAdmin = () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase 伺服器設定不完整");
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
};

const getEffectiveAccessEnd = (membership: any) => {
    const candidates = [
        membership?.access_ends_at,
        membership?.trial_ends_at,
        membership?.current_period_end
    ]
        .map(value => value ? new Date(value).getTime() : Number.NaN)
        .filter(Number.isFinite);
    return candidates.length > 0 ? new Date(Math.max(...candidates)).toISOString() : null;
};

const serializeMembership = (
    membership: any,
    role: string,
    effectiveAccess: any = null,
    aiAddonSubscription: any = null
) => {
    const staff = STAFF_ROLES.has(role);
    const status = cleanText(membership?.status || (staff ? "complimentary" : "expired"), 40);
    const hasEffectiveAccess = effectiveAccess && typeof effectiveAccess === "object";
    const effectiveEnd = hasEffectiveAccess
        ? effectiveAccess.effective_access_end || null
        : getEffectiveAccessEnd(membership);
    const endTime = effectiveEnd ? new Date(effectiveEnd).getTime() : null;
    const timeActive = status === "cancelled"
        ? endTime !== null && endTime > Date.now()
        : endTime === null || endTime > Date.now();
    const statusActive = ["trialing", "active", "cancelled", "complimentary"].includes(status);
    const isActive = hasEffectiveAccess
        ? effectiveAccess.is_active === true
        : staff || (statusActive && timeActive);
    const daysRemaining = hasEffectiveAccess
        ? effectiveAccess.days_remaining ?? null
        : endTime === null
            ? null
            : Math.max(0, Math.ceil((endTime - Date.now()) / (24 * 60 * 60 * 1000)));

    return {
        id: membership?.id || null,
        status,
        source: membership?.source || null,
        trial_started_at: membership?.trial_started_at || null,
        trial_ends_at: membership?.trial_ends_at || null,
        access_started_at: membership?.access_started_at || null,
        access_ends_at: membership?.access_ends_at || null,
        current_period_end: membership?.current_period_end || null,
        cancel_at_period_end: Boolean(membership?.cancel_at_period_end),
        stripe_subscription_status: membership?.stripe_subscription_status || null,
        has_stripe_customer: Boolean(membership?.stripe_customer_id),
        effective_access_end: effectiveEnd,
        is_active: isActive,
        days_remaining: daysRemaining,
        requires_email_verification: status === "pending_verification",
        plan: relationOne(membership?.subscription_plans) || membership?.plan || null,
        effective_access: hasEffectiveAccess ? effectiveAccess : null,
        ai_addon_subscription: aiAddonSubscription
    };
};

const loadAiAddonSubscription = async (admin: any, effectiveAccess: any) => {
    const grant = Array.isArray(effectiveAccess?.grants)
        ? effectiveAccess.grants.find((item: any) => (
            isAiAddonPlanCode(item?.plan_code)
            && item?.source === "stripe"
        ))
        : null;
    const grantId = Number(grant?.id || 0);
    if (!Number.isInteger(grantId) || grantId <= 0) return null;

    const { data, error } = await admin
        .from("student_access_grants")
        .select("status,stripe_subscription_status,current_period_end,ends_at,cancel_at_period_end")
        .eq("id", grantId)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
        status: cleanText(data.status, 40) || null,
        stripe_subscription_status: cleanText(data.stripe_subscription_status, 60) || null,
        current_period_end: isoOrNull(data.current_period_end || data.ends_at),
        cancel_at_period_end: data.cancel_at_period_end === true
    };
};

const membershipSelect = `
    id,
    student_id,
    status,
    source,
    trial_started_at,
    trial_ends_at,
    access_started_at,
    access_ends_at,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_subscription_status,
    current_period_end,
    cancel_at_period_end,
    last_payment_at,
    created_at,
    updated_at,
    subscription_plans (
        id,
        code,
        name,
        description,
        price_twd,
        billing_interval,
        trial_days,
        ai_daily_limit,
        features,
        stripe_price_id,
        is_public,
        enabled
    )
`;

const loadMembership = async (admin: any, studentId: number) => {
    const { data, error } = await admin
        .from("memberships")
        .select(membershipSelect)
        .eq("student_id", studentId)
        .maybeSingle();
    if (error) throw error;
    return data || null;
};

const ensureMembership = async (
    admin: any,
    student: any,
    firebaseUser: VerifiedFirebaseUser,
    options: { publicSignup?: boolean } = {}
) => {
    let membership = await loadMembership(admin, Number(student.id));
    const staff = STAFF_ROLES.has(student.role);

    if (!membership) {
        const { data: defaultPlan } = await admin
            .from("subscription_plans")
            .select("id")
            .eq(
                "code",
                options.publicSignup
                    ? "trial_7_day"
                    : student.plan === "listeningonly"
                        ? "listening_monthly"
                        : "all_access_monthly"
            )
            .maybeSingle();

        const initialStatus = options.publicSignup && !firebaseUser.emailVerified
            ? "pending_verification"
            : options.publicSignup
                ? "trialing"
                : "complimentary";
        const now = new Date();
        const trialEnd = options.publicSignup && firebaseUser.emailVerified
            ? new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString()
            : null;

        const { error: insertError } = await admin.from("memberships").insert({
            student_id: student.id,
            plan_id: defaultPlan?.id || null,
            status: staff ? "complimentary" : initialStatus,
            source: options.publicSignup ? "public_signup" : "legacy",
            trial_started_at: trialEnd ? now.toISOString() : null,
            trial_ends_at: trialEnd,
            access_started_at: trialEnd ? now.toISOString() : now.toISOString(),
            access_ends_at: trialEnd
        });
        if (insertError) throw insertError;
        membership = await loadMembership(admin, Number(student.id));
    }

    if (
        membership?.status === "pending_verification"
        && firebaseUser.emailVerified
        && student.role === "student"
    ) {
        const trialDays = Number(relationOne(membership?.subscription_plans)?.trial_days || 7);
        const now = new Date();
        const trialEnd = new Date(now.getTime() + (trialDays * 24 * 60 * 60 * 1000));
        const { error: trialError } = await admin
            .from("memberships")
            .update({
                status: "trialing",
                source: "public_signup",
                trial_started_at: now.toISOString(),
                trial_ends_at: trialEnd.toISOString(),
                access_started_at: now.toISOString(),
                access_ends_at: trialEnd.toISOString(),
                updated_at: now.toISOString()
            })
            .eq("id", membership.id);
        if (trialError) throw trialError;
        membership = await loadMembership(admin, Number(student.id));
    }

    const serialized = serializeMembership(membership, student.role);
    if (
        !serialized.is_active
        && ["trialing", "active", "cancelled"].includes(serialized.status)
        && serialized.effective_access_end
        && new Date(serialized.effective_access_end).getTime() <= Date.now()
    ) {
        const { error: expireError } = await admin
            .from("memberships")
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("id", membership.id);
        if (!expireError) {
            membership = { ...membership, status: "expired" };
        }
    }

    return membership;
};

const ensureLevelProgress = async (admin: any, student: any, publicSignup = false) => {
    const { data: existing, error: existingError } = await admin
        .from("student_level_progress")
        .select("student_id,current_level_id,unlocked_rank,total_points,last_promoted_at,learning_levels(id,code,name_zh,name_en,rank,description,badge_color)")
        .eq("student_id", student.id)
        .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return existing;

    const targetCode = publicSignup ? "starter" : "pre_intermediate";
    const { data: level, error: levelError } = await admin
        .from("learning_levels")
        .select("id,code,name_zh,name_en,rank,description,badge_color")
        .eq("code", targetCode)
        .single();
    if (levelError) throw levelError;

    const { error: insertError } = await admin.from("student_level_progress").insert({
        student_id: student.id,
        current_level_id: level.id,
        unlocked_rank: level.rank,
        total_points: 0
    });
    if (insertError) throw insertError;
    return {
        student_id: student.id,
        current_level_id: level.id,
        unlocked_rank: level.rank,
        total_points: 0,
        last_promoted_at: null,
        learning_levels: level
    };
};

const profilePayload = (
    student: any,
    membership: any,
    levelProgress: any,
    effectiveAccess: any = null,
    aiAddonSubscription: any = null
) => ({
    id: student.id,
    firebase_uid: student.firebase_uid,
    name: student.name,
    chinese_name: student.chinese_name || student.name,
    english_name: student.english_name || null,
    date_of_birth: student.date_of_birth || null,
    email: student.authentication_method === "academy_username" ? null : student.email,
    login_username: student.login_username || null,
    authentication_method: student.authentication_method || "email",
    activated_at: student.activated_at || null,
    class: student.class,
    role: student.role || "student",
    plan: student.plan,
    learner_type: student.learner_type || null,
    account_status: student.account_status || "active",
    archived_at: student.archived_at || null,
    user_image: student.user_image,
    total_time_played: student.total_time_played,
    current_time_played: student.current_time_played,
    created_at: student.created_at,
    updated_at: student.updated_at,
    last_login_at: student.last_login_at,
    last_active_at: student.last_active_at,
    last_learning_at: student.last_learning_at,
    membership: serializeMembership(
        membership,
        student.role || "student",
        effectiveAccess,
        aiAddonSubscription
    ),
    level: levelProgress ? {
        current_level_id: levelProgress.current_level_id,
        unlocked_rank: levelProgress.unlocked_rank,
        total_points: levelProgress.total_points,
        last_promoted_at: levelProgress.last_promoted_at,
        ...(relationOne(levelProgress.learning_levels) || {})
    } : null
});

const findCaller = async (admin: any, firebaseUser: VerifiedFirebaseUser) => {
    const { data: byUid, error: uidError } = await admin
        .from("students")
        .select("*")
        .eq("firebase_uid", firebaseUser.uid)
        .maybeSingle();
    if (uidError) throw uidError;
    if (byUid) return byUid;

    if (!firebaseUser.email) return null;
    const { data: byEmail, error: emailError } = await admin
        .from("students")
        .select("*")
        .ilike("email", firebaseUser.email)
        .maybeSingle();
    if (emailError) throw emailError;
    if (!byEmail) return null;
    if (byEmail.firebase_uid && byEmail.firebase_uid !== firebaseUser.uid) {
        throw new Error("這個 Email 已綁定其他 Firebase 帳號");
    }

    if (!byEmail.firebase_uid) {
        const { data: bound, error: bindError } = await admin
            .from("students")
            .update({ firebase_uid: firebaseUser.uid, updated_at: new Date().toISOString() })
            .eq("id", byEmail.id)
            .select("*")
            .single();
        if (bindError) throw bindError;
        return bound;
    }
    return byEmail;
};

const loadCompleteProfile = async (
    admin: any,
    student: any,
    firebaseUser: VerifiedFirebaseUser,
    publicSignup = false
) => {
    const [membership, levelProgress] = await Promise.all([
        ensureMembership(admin, student, firebaseUser, { publicSignup }),
        ensureLevelProgress(admin, student, publicSignup)
    ]);
    const effectiveAccess = await loadEffectiveAccess(admin, Number(student.id));
    const aiAddonSubscription = await loadAiAddonSubscription(admin, effectiveAccess);
    return profilePayload(
        student,
        membership,
        levelProgress,
        effectiveAccess,
        aiAddonSubscription
    );
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    try {
        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
        if (!token) return json(401, { error: "請先登入 Alan English" });

        let firebaseUser: VerifiedFirebaseUser;
        try {
            firebaseUser = await verifyFirebaseIdToken(token);
        } catch (error) {
            console.error("Firebase token verify error", error);
            return json(401, { error: "登入驗證失敗，請重新登入" });
        }

        const admin = getSupabaseAdmin();
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action || "profile", 80);

        if (action === "complete_signup") {
            const requestedName = cleanText(body?.name, 80);
            const guardianEmail = normalizeEmail(body?.guardian_email);
            if (!firebaseUser.email || !isReceivableEmail(firebaseUser.email)) {
                return json(400, { error: "請使用本人或家長可以正常收信的 Email，不可使用虛構或臨時信箱" });
            }
            if (!requestedName) return json(400, { error: "請輸入學生姓名" });
            if (guardianEmail && !isEmail(guardianEmail)) {
                return json(400, { error: "家長 Email 格式不正確" });
            }

            let student = await findCaller(admin, firebaseUser);
            if (!student) {
                const { data: defaultPlan, error: planError } = await admin
                    .from("subscription_plans")
                    .select("id")
                    .eq("code", "trial_7_day")
                    .single();
                if (planError) throw planError;

                const { data: created, error: createError } = await admin
                    .from("students")
                    .insert({
                        firebase_uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        name: requestedName,
                        role: "student",
                        class: null,
                        plan: "allcover",
                        user_image: "6C9570CC-B276-424C-857F-11BBDD21C99B.png",
                        total_time_played: 0,
                        current_time_played: 0
                    })
                    .select("*")
                    .single();
                if (createError) throw createError;
                student = created;

                const now = new Date();
                const trialEnd = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
                const { error: membershipError } = await admin.from("memberships").insert({
                    student_id: student.id,
                    plan_id: defaultPlan.id,
                    status: firebaseUser.emailVerified ? "trialing" : "pending_verification",
                    source: "public_signup",
                    trial_started_at: firebaseUser.emailVerified ? now.toISOString() : null,
                    trial_ends_at: firebaseUser.emailVerified ? trialEnd.toISOString() : null,
                    access_started_at: firebaseUser.emailVerified ? now.toISOString() : null,
                    access_ends_at: firebaseUser.emailVerified ? trialEnd.toISOString() : null
                });
                if (membershipError) throw membershipError;
            } else if (student.role !== "student") {
                return json(409, { error: "這個 Email 已是工作人員帳號，請直接登入" });
            }

            if (student.name !== requestedName) {
                const { data: renamed, error: renameError } = await admin
                    .from("students")
                    .update({ name: requestedName, updated_at: new Date().toISOString() })
                    .eq("id", student.id)
                    .select("*")
                    .single();
                if (renameError) throw renameError;
                student = renamed;
            }

            if (guardianEmail) {
                const { error: guardianError } = await admin
                    .from("guardian_contacts")
                    .upsert({
                        student_id: student.id,
                        guardian_name: cleanText(body?.guardian_name, 80) || null,
                        email: guardianEmail,
                        preferred_channel: "email",
                        notification_enabled: true,
                        updated_at: new Date().toISOString()
                    }, { onConflict: "student_id" });
                if (guardianError) throw guardianError;
            }

            const profile = await loadCompleteProfile(admin, student, firebaseUser, true);
            return json(200, {
                success: true,
                profile,
                email_verification_required: !firebaseUser.emailVerified
            });
        }

        let caller = await findCaller(admin, firebaseUser);
        let autoCreatedPublicSignup = false;
        if (!caller && action === "profile" && firebaseUser.email && isEmail(firebaseUser.email)) {
            const fallbackName = cleanText(
                firebaseUser.payload?.name || firebaseUser.email.split("@")[0],
                80
            ) || "Student";
            const { data: created, error: createError } = await admin
                .from("students")
                .insert({
                    firebase_uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    name: fallbackName,
                    role: "student",
                    class: null,
                    plan: "allcover",
                    user_image: "6C9570CC-B276-424C-857F-11BBDD21C99B.png",
                    total_time_played: 0,
                    current_time_played: 0
                })
                .select("*")
                .single();
            if (createError) {
                if (createError.code !== "23505") throw createError;
                caller = await findCaller(admin, firebaseUser);
            } else {
                caller = created;
                autoCreatedPublicSignup = true;
            }
        }
        if (!caller) return json(404, { error: "找不到 Alan English 帳號" });

        if ((caller.account_status || "active") !== "active") {
            return json(403, {
                error: "這個帳號目前已停用，請聯絡 Alan English 客服或櫃檯",
                code: "ACCOUNT_ARCHIVED"
            });
        }

        if (action === "profile" || action === "status") {
            const profile = await loadCompleteProfile(
                admin,
                caller,
                firebaseUser,
                autoCreatedPublicSignup
            );
            return json(200, { success: true, profile });
        }

        if (action === "update_student_profile") {
            if (caller.role !== "student") return json(403, { error: "目前只有學生可以更新自己的基本資料" });
            let dateOfBirth = "";
            try {
                dateOfBirth = normalizeDateOfBirth(body?.date_of_birth);
            } catch (error) {
                return json(400, { error: error instanceof Error ? error.message : "出生年月日格式不正確" });
            }
            const { data, error } = await admin
                .from("students")
                .update({ date_of_birth: dateOfBirth, updated_at: new Date().toISOString() })
                .eq("id", caller.id)
                .eq("firebase_uid", firebaseUser.uid)
                .select("date_of_birth")
                .single();
            if (error) throw error;
            return json(200, { success: true, profile: { date_of_birth: data?.date_of_birth || null } });
        }

        if (action === "notifications") {
            const limit = Math.min(100, Math.max(1, positiveInteger(body?.limit) || 30));
            const beforeTimestamp = typeof body?.before === "string" ? Date.parse(body.before) : NaN;
            const before = Number.isFinite(beforeTimestamp) ? new Date(beforeTimestamp).toISOString() : null;
            const nowIso = new Date().toISOString();
            let query = admin
                .from("student_notifications")
                .select("id,notification_type,title,body,metadata,read_at,expires_at,created_at")
                .eq("student_id", caller.id)
                .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
                .order("created_at", { ascending: false });
            if (before) query = query.lt("created_at", before);
            const { data, error } = await query.limit(limit + 1);
            if (error) throw error;
            const hasMore = (data || []).length > limit;
            const notifications = (data || []).slice(0, limit);
            return json(200, {
                success: true,
                notifications,
                unread_count: notifications.filter((item: any) => !item.read_at).length,
                has_more: hasMore,
                next_before: hasMore ? notifications.at(-1)?.created_at || null : null
            });
        }

        if (action === "mark_notification_read") {
            const notificationId = positiveInteger(body?.notification_id);
            if (!notificationId) return json(400, { error: "通知資料不正確" });
            const { error } = await admin
                .from("student_notifications")
                .update({ read_at: new Date().toISOString() })
                .eq("id", notificationId)
                .eq("student_id", caller.id)
                .is("read_at", null);
            if (error) throw error;
            return json(200, { success: true });
        }

        if (action === "plans") {
            let pricingEligibility = getMembershipPricingEligibility({
                role: caller.role,
                learnerType: caller.learner_type || null,
                hasActiveAcademyEnrollment: false,
                hasAcademyHistory: false,
                hasActiveBasicMembership: false
            });
            let activePlanCodes = new Set<string>();
            if (caller.role === "student") {
                const [enrollmentResult, effectiveAccess] = await Promise.all([
                    admin
                    .from("academy_enrollments")
                    .select("id,status")
                    .eq("student_id", caller.id),
                    loadEffectiveAccess(admin, Number(caller.id))
                ]);
                if (enrollmentResult.error) throw enrollmentResult.error;
                const enrollments = Array.isArray(enrollmentResult.data) ? enrollmentResult.data : [];
                activePlanCodes = new Set(effectiveAccess.plan_codes);
                pricingEligibility = getMembershipPricingEligibility({
                    role: caller.role,
                    learnerType: caller.learner_type || null,
                    hasActiveAcademyEnrollment: enrollments.some((item: any) => item?.status === "active"),
                    hasAcademyHistory: enrollments.length > 0,
                    hasActiveBasicMembership: activePlanCodes.has(BASIC_MEMBERSHIP_PLAN_CODE)
                });
            }
            const { data: plans, error } = await admin
                .from("subscription_plans")
                .select("id,code,name,description,price_twd,billing_interval,trial_days,ai_daily_limit,features,stripe_price_id,is_public,enabled,sort_order,access_model")
                .eq("enabled", true)
                .order("sort_order", { ascending: true });
            if (error) throw error;
            const visiblePlans = (plans || []).filter((plan: any) => {
                if (caller.role === "admin") return true;
                if (plan.is_public !== true) return false;
                if (plan.code === BASIC_MEMBERSHIP_PLAN_CODE) {
                    return pricingEligibility.canUseBasicMembership;
                }
                if (plan.code === ACADEMY_AI_ADDON_PLAN_CODE) {
                    return pricingEligibility.canUseAcademyAiAddon || activePlanCodes.has(plan.code);
                }
                if (plan.code === GENERAL_AI_ADDON_PLAN_CODE) {
                    return pricingEligibility.canUseGeneralAiAddon || activePlanCodes.has(plan.code);
                }
                return false;
            });
            return json(200, {
                success: true,
                plans: visiblePlans.map((plan: any) => ({
                    ...plan,
                    offer_label: plan.code === BASIC_MEMBERSHIP_PLAN_CODE
                        ? "基本會員"
                        : plan.code === ACADEMY_AI_ADDON_PLAN_CODE
                            ? "英文班／離校生 AI 優惠"
                            : plan.code === GENERAL_AI_ADDON_PLAN_CODE
                                ? "一般會員 AI 加購"
                                : "月費訂閱",
                    checkout_ready: Boolean(plan.stripe_price_id && plan.price_twd !== null),
                    stripe_price_id: caller.role === "admin" ? plan.stripe_price_id : undefined
                }))
            });
        }

        if (action === "redeem_code") {
            if (caller.role !== "student") return json(400, { error: "工作人員帳號不需要使用啟用碼" });
            const normalizedCode = normalizeActivationCode(body?.code);
            if (normalizedCode.length < 10) return json(400, { error: "啟用碼格式不正確" });
            const codeHash = await sha256(normalizedCode);
            const { data, error } = await admin.rpc("redeem_activation_code", {
                p_student_id: caller.id,
                p_code_hash: codeHash
            });
            if (error) {
                const message = String(error.message || "");
                if (message.includes("code_not_found")) return json(404, { error: "找不到這組啟用碼" });
                if (message.includes("code_expired")) return json(410, { error: "這組啟用碼已過期" });
                if (message.includes("code_exhausted") || message.includes("code_not_active")) {
                    return json(409, { error: "這組啟用碼已無法使用" });
                }
                if (message.includes("code_already_redeemed")) return json(409, { error: "你已經使用過這組啟用碼" });
                if (message.includes("membership_already_unlimited")) return json(409, { error: "你的帳號目前已有永久使用權" });
                throw error;
            }
            const membership = await loadMembership(admin, Number(caller.id));
            const effectiveAccess = await loadEffectiveAccess(admin, Number(caller.id));
            return json(200, {
                success: true,
                redemption: data,
                membership: serializeMembership(membership, caller.role, effectiveAccess)
            });
        }

        if (action === "list_accounts") {
            if (!STAFF_ROLES.has(caller.role)) return json(403, { error: "沒有帳號管理權限" });
            let query = admin
                .from("students")
                .select(`
                    id,firebase_uid,email,login_username,authentication_method,activated_at,name,role,class,plan,learner_type,account_status,archived_at,archive_reason,must_change_password,password_changed_at,user_image,created_at,updated_at,last_login_at,last_active_at,last_learning_at,
                    memberships(${membershipSelect}),
                    student_level_progress:student_level_progress!student_level_progress_student_id_fkey(student_id,current_level_id,unlocked_rank,total_points,last_promoted_at,learning_levels(id,code,name_zh,name_en,rank,badge_color))
                `)
                .order("name", { ascending: true });
            if (caller.role === "teacher") query = query.eq("role", "student");
            const { data: accounts, error } = await query;
            if (error) throw error;
            const normalizedAccounts = await Promise.all((accounts || []).map(async (account: any) => {
                const effectiveAccess = await loadEffectiveAccess(admin, Number(account.id));
                return {
                    ...account,
                    membership: serializeMembership(
                        relationOne(account.memberships),
                        account.role,
                        effectiveAccess
                    ),
                    level: normalizeLevelProgress(relationOne(account.student_level_progress)),
                    memberships: undefined,
                    student_level_progress: undefined
                };
            }));
            return json(200, {
                success: true,
                accounts: normalizedAccounts
            });
        }

        if (action === "update_account") {
            if (!STAFF_ROLES.has(caller.role)) return json(403, { error: "沒有帳號編輯權限" });
            const targetId = numberOrNull(body?.id);
            const name = cleanText(body?.name, 80);
            const requestedRole = cleanText(body?.role, 20);
            const classType = cleanText(body?.class, 20) || null;
            if (!targetId || !name) return json(400, { error: "帳號資料不完整" });

            const { data: target, error: targetError } = await admin
                .from("students")
                .select("id,firebase_uid,email,name,role,class,plan,learner_type,account_status")
                .eq("id", targetId)
                .maybeSingle();
            if (targetError) throw targetError;
            if (!target) return json(404, { error: "找不到帳號" });
            if (caller.role === "teacher" && target.role !== "student") {
                return json(403, { error: "教師只能編輯學生帳號" });
            }

            let nextRole = target.role;
            if (caller.role === "admin" && requestedRole) {
                if (!ACCOUNT_ROLES.has(requestedRole)) return json(400, { error: "帳號角色不正確" });
                if (target.firebase_uid === caller.firebase_uid && requestedRole !== "admin") {
                    return json(403, { error: "不能降低目前登入管理員的權限" });
                }
                nextRole = requestedRole;
            }

            if (nextRole === "student" && !classType) {
                return json(400, { error: "英文班學生必須設定班級" });
            }
            const { data: updated, error: updateError } = await admin
                .from("students")
                .update({
                    name,
                    role: nextRole,
                    class: nextRole === "student" ? classType : null,
                    learner_type: nextRole === "student" ? "academy_student" : null,
                    updated_at: new Date().toISOString()
                })
                .eq("id", target.id)
                .select("*")
                .single();
            if (updateError) throw updateError;

            let membership = await loadMembership(admin, Number(updated.id));
            if (STAFF_ROLES.has(nextRole) && membership?.status !== "complimentary") {
                const { error: staffMembershipError } = await admin
                    .from("memberships")
                    .update({
                        status: "complimentary",
                        source: "admin_grant",
                        access_ends_at: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", membership.id);
                if (staffMembershipError) throw staffMembershipError;
                membership = await loadMembership(admin, Number(updated.id));
            }
            const level = await ensureLevelProgress(admin, updated, false);
            const effectiveAccess = await loadEffectiveAccess(admin, Number(updated.id));
            return json(200, {
                success: true,
                account: profilePayload(updated, membership, level, effectiveAccess)
            });
        }

        if (action === "archive_account" || action === "restore_account") {
            if (caller.role !== "admin") return json(403, { error: "只有管理員可以停用或恢復帳號" });
            const targetId = numberOrNull(body?.id);
            if (!targetId) return json(400, { error: "缺少帳號編號" });
            if (Number(targetId) === Number(caller.id)) {
                return json(403, { error: "不能停用目前登入的管理員帳號" });
            }

            const { data: target, error: targetError } = await admin
                .from("students")
                .select("id,role,account_status")
                .eq("id", targetId)
                .maybeSingle();
            if (targetError) throw targetError;
            if (!target) return json(404, { error: "找不到帳號" });
            if (target.role !== "student") {
                return json(403, { error: "教師與管理員帳號不可在此停用" });
            }

            const restoring = action === "restore_account";
            const now = new Date().toISOString();
            const reason = cleanText(body?.reason, 300) || null;
            const { data: updated, error: updateError } = await admin
                .from("students")
                .update(restoring ? {
                    account_status: "active",
                    archived_at: null,
                    archived_by: null,
                    archive_reason: null,
                    updated_at: now
                } : {
                    account_status: "archived",
                    archived_at: now,
                    archived_by: caller.id,
                    archive_reason: reason,
                    updated_at: now
                })
                .eq("id", target.id)
                .select("id,firebase_uid,email,login_username,authentication_method,activated_at,name,role,class,plan,learner_type,account_status,archived_at,archive_reason,user_image,created_at,updated_at,last_login_at,last_active_at,last_learning_at")
                .single();
            if (updateError) throw updateError;

            const membership = await loadMembership(admin, Number(updated.id));
            const level = await ensureLevelProgress(admin, updated, false);
            const effectiveAccess = await loadEffectiveAccess(admin, Number(updated.id));
            return json(200, {
                success: true,
                account: profilePayload(updated, membership, level, effectiveAccess)
            });
        }

        if (action === "admin_dashboard") {
            if (caller.role !== "admin") return json(403, { error: "只有管理員可以查看會員管理" });
            const [plansResult, codesResult, membersResult, emailSettingsResult] = await Promise.all([
                admin.from("subscription_plans").select("*").order("sort_order", { ascending: true }),
                admin.from("activation_codes")
                    .select("id,code_hint,plan_id,duration_days,max_redemptions,redemption_count,status,expires_at,note,created_at,subscription_plans(id,code,name)")
                    .order("created_at", { ascending: false })
                    .limit(200),
                admin.from("students")
                    .select(`id,name,email,role,class,plan,memberships(${membershipSelect})`)
                    .order("name", { ascending: true }),
                admin.from("guardian_email_settings").select("*").eq("id", 1).maybeSingle()
            ]);
            const firstError = [plansResult.error, codesResult.error, membersResult.error, emailSettingsResult.error].find(Boolean);
            if (firstError) throw firstError;
            const members = await Promise.all((membersResult.data || []).map(async (account: any) => {
                const effectiveAccess = await loadEffectiveAccess(admin, Number(account.id));
                return {
                    id: account.id,
                    name: account.name,
                    email: account.email,
                    role: account.role,
                    class: account.class,
                    plan: account.plan,
                    membership: serializeMembership(
                        relationOne(account.memberships),
                        account.role,
                        effectiveAccess
                    )
                };
            }));
            const summary = members.reduce((acc: Record<string, number>, item: any) => {
                const key = item.membership.status || "missing";
                acc[key] = (acc[key] || 0) + 1;
                if (item.membership.is_active) acc.active_total = (acc.active_total || 0) + 1;
                return acc;
            }, { active_total: 0, total: members.length });

            return json(200, {
                success: true,
                plans: plansResult.data || [],
                codes: (codesResult.data || []).map((code: any) => ({
                    ...code,
                    subscription_plans: relationOne(code.subscription_plans)
                })),
                members,
                email_settings: emailSettingsResult.data || null,
                summary
            });
        }

        if (action === "admin_update_plan") {
            if (caller.role !== "admin") return json(403, { error: "只有管理員可以修改方案" });
            const planId = numberOrNull(body?.id);
            const name = cleanText(body?.name, 100);
            const description = cleanText(body?.description, 500) || null;
            const priceTwd = numberOrNull(body?.price_twd);
            const trialDays = Number(body?.trial_days);
            const aiDailyLimit = Number(body?.ai_daily_limit);
            const stripePriceId = cleanText(body?.stripe_price_id, 200) || null;
            const isPublic = body?.is_public === true;
            const enabled = body?.enabled !== false;
            const requestedFeatures = body?.features && typeof body.features === "object" ? body.features : {};
            const features = Object.fromEntries(
                ["listening", "ai_materials", "conversation", "assignments", "review"]
                    .map(key => [key, requestedFeatures[key] === true])
            );
            if (!planId || !name) return json(400, { error: "方案資料不完整" });
            if (priceTwd !== null && (!Number.isInteger(priceTwd) || priceTwd < 0 || priceTwd > 1000000)) {
                return json(400, { error: "價格必須是 0～1,000,000 的整數" });
            }
            if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 90) {
                return json(400, { error: "試用天數必須介於 0～90 天" });
            }
            if (!Number.isInteger(aiDailyLimit) || aiDailyLimit < 0 || aiDailyLimit > 100) {
                return json(400, { error: "AI 每日額度必須介於 0～100 次" });
            }
            if (stripePriceId && !stripePriceId.startsWith("price_")) {
                return json(400, { error: "Stripe Price ID 必須以 price_ 開頭" });
            }
            if (isPublic && (priceTwd === null || !stripePriceId)) {
                return json(400, { error: "公開方案前必須設定價格與 Stripe Price ID" });
            }
            const { data: plan, error } = await admin
                .from("subscription_plans")
                .update({
                    name,
                    description,
                    price_twd: priceTwd,
                    trial_days: trialDays,
                    ai_daily_limit: aiDailyLimit,
                    stripe_price_id: stripePriceId,
                    features,
                    is_public: isPublic,
                    enabled,
                    updated_at: new Date().toISOString()
                })
                .eq("id", planId)
                .select("*")
                .single();
            if (error) throw error;
            return json(200, { success: true, plan });
        }

        if (action === "admin_generate_codes") {
            if (caller.role !== "admin") return json(403, { error: "只有管理員可以產生啟用碼" });
            const quantity = Number(body?.quantity || 1);
            const durationDays = Number(body?.duration_days || 30);
            const maxRedemptions = Number(body?.max_redemptions || 1);
            const planId = numberOrNull(body?.plan_id);
            const expiresAt = isoOrNull(body?.expires_at);
            const note = cleanText(body?.note, 300) || null;
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
                return json(400, { error: "每次可以產生 1～100 組啟用碼" });
            }
            if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3660) {
                return json(400, { error: "使用天數必須介於 1～3660 天" });
            }
            if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 100000) {
                return json(400, { error: "可兌換次數設定不正確" });
            }
            if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
                return json(400, { error: "到期日必須晚於現在" });
            }
            if (planId) {
                const { data: plan, error: planError } = await admin
                    .from("subscription_plans")
                    .select("id")
                    .eq("id", planId)
                    .eq("enabled", true)
                    .maybeSingle();
                if (planError) throw planError;
                if (!plan) return json(400, { error: "找不到指定方案" });
            }

            const plainCodes: string[] = [];
            const rows: any[] = [];
            for (let index = 0; index < quantity; index += 1) {
                const code = createActivationCode();
                const normalized = normalizeActivationCode(code);
                plainCodes.push(code);
                rows.push({
                    code_hash: await sha256(normalized),
                    code_hint: `${code.slice(0, 7)}••••${code.slice(-4)}`,
                    plan_id: planId,
                    duration_days: durationDays,
                    max_redemptions: maxRedemptions,
                    status: "active",
                    expires_at: expiresAt,
                    note,
                    created_by: caller.id
                });
            }
            const { data: saved, error } = await admin
                .from("activation_codes")
                .insert(rows)
                .select("id,code_hint,plan_id,duration_days,max_redemptions,status,expires_at,note,created_at");
            if (error) throw error;
            return json(201, {
                success: true,
                codes: (saved || []).map((item: any, index: number) => ({ ...item, code: plainCodes[index] })),
                warning: "完整啟用碼只會在這次顯示，請立即安全保存。"
            });
        }

        if (action === "admin_grant_access") {
            if (caller.role !== "admin") return json(403, { error: "只有管理員可以調整會員權限" });
            const studentId = numberOrNull(body?.student_id);
            const planId = numberOrNull(body?.plan_id);
            const durationDays = Number(body?.duration_days || 30);
            const source = cleanText(body?.source || "admin_grant", 40);
            if (!studentId || !planId || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3660) {
                return json(400, { error: "會員、方案與使用天數設定不正確" });
            }
            if (!MEMBERSHIP_SOURCES.has(source) || source === "public_signup" || source === "stripe") {
                return json(400, { error: "權限來源設定不正確" });
            }
            const { data: target, error: targetError } = await admin
                .from("students")
                .select("id,role")
                .eq("id", studentId)
                .maybeSingle();
            if (targetError) throw targetError;
            if (!target || target.role !== "student") return json(404, { error: "找不到學生帳號" });

            const { data: plan, error: planError } = await admin
                .from("subscription_plans")
                .select("id,code,name,enabled")
                .eq("id", planId)
                .eq("enabled", true)
                .maybeSingle();
            if (planError) throw planError;
            if (!plan) return json(400, { error: "找不到可用方案" });

            const { data: existingGrants, error: grantsError } = await admin
                .from("student_access_grants")
                .select("id,ends_at")
                .eq("student_id", studentId)
                .eq("plan_id", planId)
                .eq("status", "active")
                .is("revoked_at", null)
                .order("ends_at", { ascending: false, nullsFirst: true })
                .limit(1);
            if (grantsError) throw grantsError;

            const latestGrant = existingGrants?.[0] || null;
            if (latestGrant && latestGrant.ends_at === null) {
                return json(409, { error: "此學生已擁有這個方案的永久使用權" });
            }

            const now = new Date();
            const existingEndTime = latestGrant?.ends_at
                ? new Date(latestGrant.ends_at).getTime()
                : 0;
            const startsAt = new Date(Math.max(now.getTime(), existingEndTime));
            const endsAt = new Date(startsAt.getTime() + (durationDays * 24 * 60 * 60 * 1000));
            const { data: grant, error: grantError } = await admin
                .from("student_access_grants")
                .insert({
                    student_id: studentId,
                    plan_id: planId,
                    source,
                    status: "active",
                    starts_at: startsAt.toISOString(),
                    ends_at: endsAt.toISOString(),
                    metadata: {
                        granted_by_student_id: caller.id,
                        duration_days: durationDays,
                        plan_code: plan.code
                    }
                })
                .select("*")
                .single();
            if (grantError) throw grantError;

            const membership = await loadMembership(admin, studentId);
            const effectiveAccess = await loadEffectiveAccess(admin, studentId);
            return json(200, {
                success: true,
                grant,
                membership: serializeMembership(membership, "student", effectiveAccess)
            });
        }

        if (action === "admin_set_membership_status") {
            if (caller.role !== "admin") return json(403, { error: "只有管理員可以調整會員狀態" });
            const studentId = numberOrNull(body?.student_id);
            const status = cleanText(body?.status, 40);
            if (!studentId || !MEMBERSHIP_STATUSES.has(status)) {
                return json(400, { error: "會員狀態設定不正確" });
            }
            if (["trialing", "active"].includes(status)) {
                return json(400, { error: "請使用延長權限功能啟用會員" });
            }
            const { data: membership, error } = await admin
                .from("memberships")
                .update({ status, updated_at: new Date().toISOString() })
                .eq("student_id", studentId)
                .select(membershipSelect)
                .single();
            if (error) throw error;
            const effectiveAccess = await loadEffectiveAccess(admin, studentId);
            return json(200, {
                success: true,
                membership: serializeMembership(membership, "student", effectiveAccess)
            });
        }

        if (action === "admin_update_email_settings") {
            if (caller.role !== "admin") return json(403, { error: "只有管理員可以調整寄信設定" });
            const enabled = body?.enabled === true;
            const sendWeekday = Number(body?.send_weekday);
            const sendHour = Number(body?.send_hour);
            const fromName = cleanText(body?.from_name, 100) || "Alan English";
            const fromEmail = normalizeEmail(body?.from_email) || null;
            const replyTo = normalizeEmail(body?.reply_to) || null;
            if (!Number.isInteger(sendWeekday) || sendWeekday < 0 || sendWeekday > 6) {
                return json(400, { error: "寄送星期設定不正確" });
            }
            if (!Number.isInteger(sendHour) || sendHour < 0 || sendHour > 23) {
                return json(400, { error: "寄送時間設定不正確" });
            }
            if (fromEmail && !isEmail(fromEmail)) return json(400, { error: "寄件 Email 格式不正確" });
            if (replyTo && !isEmail(replyTo)) return json(400, { error: "回覆 Email 格式不正確" });
            if (enabled && !fromEmail) return json(400, { error: "啟用自動寄信前必須設定寄件 Email" });
            if (enabled && !Deno.env.get("RESEND_API_KEY")) {
                return json(409, {
                    error: "啟用自動寄信前必須先設定 RESEND_API_KEY",
                    code: "email_provider_not_configured"
                });
            }

            const projectUrl = Deno.env.get("SUPABASE_URL") || "";
            const { data: schedule, error: scheduleError } = await admin.rpc(
                "configure_guardian_email_cron",
                { p_project_url: projectUrl }
            );
            if (scheduleError) {
                console.error("Guardian email cron configuration failed", scheduleError);
                return json(503, { error: "家長週報排程建立失敗，設定尚未儲存" });
            }

            const { data: settings, error } = await admin
                .from("guardian_email_settings")
                .upsert({
                    id: 1,
                    enabled,
                    send_weekday: sendWeekday,
                    send_hour: sendHour,
                    from_name: fromName,
                    from_email: fromEmail,
                    reply_to: replyTo,
                    updated_by: caller.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: "id" })
                .select("*")
                .single();
            if (error) throw error;
            return json(200, { success: true, settings, schedule });
        }

        return json(400, { error: "不支援的會員操作" });
    } catch (error) {
        console.error("membership-manager unexpected error", error);
        return json(500, {
            error: error instanceof Error ? error.message : "會員服務暫時無法使用"
        });
    }
});
