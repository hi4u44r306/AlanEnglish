import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

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
const ADMIN_ROLE = "admin";
const PERIODS = new Set(["week", "month", "all"]);
const AVATAR_BUCKET = "student-avatars";
const REWARD_BUCKET = "reward-images";
const DEFAULT_AVATAR_PATHS = new Set([
    "/default-avatars/alan-cat.png",
    "/default-avatars/alan-fox.png",
    "/default-avatars/alan-rabbit.png",
    "/default-avatars/alan-bear.png",
    "/default-avatars/alan-owl.png"
]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"]
]);
const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000, 6200, 7600, 9200, 11000, 13000, 15200, 17600, 20200];

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const cleanText = (value: unknown, maxLength = 500) => String(value || "").trim().slice(0, maxLength);
const positiveInteger = (value: unknown) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const nonNegativeInteger = (value: unknown, fallback = 0) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};
const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
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

const getLevelInfo = (xpValue: unknown) => {
    const xp = Math.max(0, Number(xpValue || 0));
    let level = 1;
    let currentMin = 0;
    let nextMin = LEVEL_THRESHOLDS[1];

    for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1) {
        if (xp >= LEVEL_THRESHOLDS[index]) {
            level = index + 1;
            currentMin = LEVEL_THRESHOLDS[index];
            nextMin = LEVEL_THRESHOLDS[index + 1] ?? (LEVEL_THRESHOLDS[index] + 3000);
        }
    }

    if (xp >= LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) {
        const baseLevel = LEVEL_THRESHOLDS.length;
        const baseXp = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
        const extraLevels = Math.floor((xp - baseXp) / 3000);
        level = baseLevel + extraLevels;
        currentMin = baseXp + extraLevels * 3000;
        nextMin = currentMin + 3000;
    }

    const range = Math.max(1, nextMin - currentMin);
    return {
        level,
        current_level_xp: currentMin,
        next_level_xp: nextMin,
        progress_percent: Math.min(100, Math.max(0, Math.round(((xp - currentMin) / range) * 100)))
    };
};

const signedImage = async (admin: any, bucket: string, path: unknown, expiresIn = 3600) => {
    const normalized = cleanText(path, 1000);
    if (!normalized) return null;
    if (DEFAULT_AVATAR_PATHS.has(normalized)) return normalized;
    if (/^https?:\/\//i.test(normalized)) return normalized;
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(normalized, expiresIn);
    if (error) return null;
    return data?.signedUrl || null;
};

const mapDbError = (error: any) => {
    const message = cleanText(error?.message, 500);
    if (message.includes("INSUFFICIENT_POINTS")) return { status: 409, message: "點數不足，還不能兌換這個獎品" };
    if (message.includes("OUT_OF_STOCK")) return { status: 409, message: "這個獎品目前已兌換完" };
    if (message.includes("CLASS_NOT_ELIGIBLE")) return { status: 403, message: "這個獎品目前不開放你的班級兌換" };
    if (message.includes("REDEMPTION_LIMIT_REACHED")) return { status: 409, message: "你已達到這個獎品的兌換上限" };
    if (message.includes("TRIAL_REDEMPTION_LOCKED")) return { status: 403, message: "試用期間可以累積 XP 與 AE Points，升級正式方案後才能兌換獎品" };
    if (message.includes("PHYSICAL_REDEMPTION_COOLDOWN")) return { status: 409, message: "每 30 天最多兌換一次實體獎品，請稍後再試" };
    if (message.includes("REWARD_UNAVAILABLE")) return { status: 404, message: "這個獎品目前無法兌換" };
    if (message.includes("INVALID_STATUS_TRANSITION")) return { status: 409, message: "這筆兌換目前不能切換到指定狀態" };
    return { status: 500, message: message || "系統處理失敗" };
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
            .select("id,name,english_name,chinese_name,class,role,learner_type,user_image,account_status,archived_at")
            .eq("firebase_uid", firebaseUid)
            .maybeSingle();
        if (studentError) throw studentError;
        if (!student || student.archived_at || student.account_status === "archived") {
            return json(404, { error: "找不到可使用的 Alan English 帳號" });
        }

        const contentType = req.headers.get("content-type") || "";
        if (contentType.includes("multipart/form-data")) {
            const form = await req.formData();
            const kind = cleanText(form.get("kind"), 30);
            const file = form.get("file");
            if (!(file instanceof File)) return json(400, { error: "請選擇圖片檔案" });
            const extension = IMAGE_TYPES.get(file.type);
            if (!extension) return json(400, { error: "只支援 JPG、PNG、WebP 圖片" });

            if (kind === "avatar") {
                if (file.size > MAX_AVATAR_BYTES) return json(400, { error: "學生頭像請控制在 5MB 以內" });
                const path = `student-${student.id}/${crypto.randomUUID()}.${extension}`;
                const { error: uploadError } = await admin.storage.from(AVATAR_BUCKET).upload(path, file, {
                    contentType: file.type,
                    cacheControl: "3600",
                    upsert: false
                });
                if (uploadError) throw uploadError;

                const oldPath = cleanText(student.user_image, 1000);
                const { error: updateError } = await admin.from("students").update({
                    user_image: path,
                    updated_at: new Date().toISOString()
                }).eq("id", student.id);
                if (updateError) {
                    await admin.storage.from(AVATAR_BUCKET).remove([path]);
                    throw updateError;
                }
                if (oldPath && !DEFAULT_AVATAR_PATHS.has(oldPath) && !/^https?:\/\//i.test(oldPath) && oldPath !== path) {
                    await admin.storage.from(AVATAR_BUCKET).remove([oldPath]).catch(() => null);
                }
                return json(200, {
                    success: true,
                    path,
                    image_url: await signedImage(admin, AVATAR_BUCKET, path, 3600)
                });
            }

            if (kind === "reward") {
                if (student.role !== ADMIN_ROLE) return json(403, { error: "只有管理員可以上傳獎品圖片" });
                if (file.size > 4 * 1024 * 1024) return json(400, { error: "獎品圖片請控制在 4MB 以內" });
                const path = `admin-${student.id}/${crypto.randomUUID()}.${extension}`;
                const { error: uploadError } = await admin.storage.from(REWARD_BUCKET).upload(path, file, {
                    contentType: file.type,
                    cacheControl: "3600",
                    upsert: false
                });
                if (uploadError) throw uploadError;
                return json(200, {
                    success: true,
                    path,
                    image_url: await signedImage(admin, REWARD_BUCKET, path, 3600)
                });
            }

            return json(400, { error: "不支援的圖片用途" });
        }

        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action || "summary", 80);

        if (action === "summary") {
            const [{ data: balance, error: balanceError }, { data: ledger, error: ledgerError }] = await Promise.all([
                admin.from("student_gamification_balances").select("student_id,total_xp,points_balance,updated_at").eq("student_id", student.id).maybeSingle(),
                admin.from("student_gamification_ledger").select("id,xp_delta,points_delta,source_type,description,created_at").eq("student_id", student.id).order("created_at", { ascending: false }).limit(12)
            ]);
            if (balanceError || ledgerError) throw balanceError || ledgerError;
            const totalXp = Number(balance?.total_xp || 0);
            return json(200, {
                success: true,
                profile: {
                    id: student.id,
                    name: student.english_name || student.name,
                    class: student.class,
                    avatar_url: await signedImage(admin, AVATAR_BUCKET, student.user_image, 3600)
                },
                balance: {
                    total_xp: totalXp,
                    points_balance: Number(balance?.points_balance || 0),
                    ...getLevelInfo(totalXp)
                },
                recent_ledger: ledger || []
            });
        }

        if (action === "select_avatar_preset") {
            const path = cleanText(body?.avatar_path, 200);
            if (!DEFAULT_AVATAR_PATHS.has(path)) return json(400, { error: "請選擇系統提供的預設頭像" });

            const oldPath = cleanText(student.user_image, 1000);
            const { error: updateError } = await admin.from("students").update({
                user_image: path,
                updated_at: new Date().toISOString()
            }).eq("id", student.id);
            if (updateError) throw updateError;

            if (oldPath && !DEFAULT_AVATAR_PATHS.has(oldPath) && !/^https?:\/\//i.test(oldPath)) {
                await admin.storage.from(AVATAR_BUCKET).remove([oldPath]).catch(() => null);
            }
            return json(200, { success: true, path, image_url: path });
        }

        if (action === "classes") {
            if (!STAFF_ROLES.has(student.role)) return json(200, { success: true, classes: student.class ? [student.class] : [] });
            const { data, error } = await admin.from("students").select("class").eq("role", "student").is("archived_at", null);
            if (error) throw error;
            const classes = [...new Set((data || []).map((row: any) => cleanText(row.class, 30)).filter(Boolean))].sort();
            return json(200, { success: true, classes });
        }

        if (action === "leaderboard") {
            const requestedPeriod = cleanText(body?.period || "week", 20);
            const period = PERIODS.has(requestedPeriod) ? requestedPeriod : "week";
            const requestedClass = cleanText(body?.class_code, 30) || null;
            const classCode = student.role === "student" ? (cleanText(student.class, 30) || null) : requestedClass;
            const { data: rows, error } = await admin.rpc("get_gamification_leaderboard", {
                p_period: period,
                p_class: classCode,
                p_limit: 100
            });
            if (error) throw error;
            const leaderboard = await Promise.all((rows || []).map(async (row: any) => ({
                ...row,
                avatar_url: await signedImage(admin, AVATAR_BUCKET, row.avatar_path, 3600),
                level: getLevelInfo(row.total_xp).level,
                is_current_user: Number(row.student_id) === Number(student.id)
            })));
            return json(200, { success: true, period, class_code: classCode, leaderboard });
        }

        if (action === "rewards") {
            const { data: rewards, error: rewardError } = await admin
                .from("rewards")
                .select("id,name,description,image_path,points_cost,stock_quantity,enabled,per_student_limit,applicable_classes,fulfillment_type,sort_order")
                .eq("enabled", true)
                .order("sort_order", { ascending: true })
                .order("id", { ascending: true });
            if (rewardError) throw rewardError;
            const eligible = (rewards || []).filter((reward: any) => {
                const classes = Array.isArray(reward.applicable_classes) ? reward.applicable_classes : [];
                return classes.length === 0 || classes.includes(student.class);
            });
            const [{ data: balance, error: balanceError }, { data: redemptions, error: redemptionError }] = await Promise.all([
                admin.from("student_gamification_balances").select("total_xp,points_balance").eq("student_id", student.id).maybeSingle(),
                student.role === "student"
                    ? admin.from("reward_redemptions").select("id,reward_id,reward_name,points_cost,status,admin_note,requested_at,updated_at").eq("student_id", student.id).order("requested_at", { ascending: false }).limit(30)
                    : Promise.resolve({ data: [], error: null })
            ]);
            if (balanceError || redemptionError) throw balanceError || redemptionError;
            const signedRewards = await Promise.all(eligible.map(async (reward: any) => ({
                ...reward,
                image_url: await signedImage(admin, REWARD_BUCKET, reward.image_path, 3600)
            })));
            return json(200, {
                success: true,
                balance: {
                    total_xp: Number(balance?.total_xp || 0),
                    points_balance: Number(balance?.points_balance || 0),
                    ...getLevelInfo(balance?.total_xp || 0)
                },
                redemption_allowed: student.role === "student" && student.learner_type !== "trial_user",
                redemption_block_reason: student.learner_type === "trial_user"
                    ? "試用期間可以累積 XP 與 AE Points，升級正式方案後才能兌換獎品"
                    : null,
                rewards: signedRewards,
                redemptions: redemptions || []
            });
        }

        if (action === "redeem") {
            if (student.role !== "student") return json(400, { error: "請使用學生帳號兌換獎品" });
            if (student.learner_type === "trial_user") {
                return json(403, { error: "試用期間可以累積 XP 與 AE Points，升級正式方案後才能兌換獎品" });
            }
            const rewardId = positiveInteger(body?.reward_id);
            if (!rewardId) return json(400, { error: "獎品編號不正確" });
            const { data, error } = await admin.rpc("request_reward_redemption", {
                p_student_id: student.id,
                p_reward_id: rewardId
            });
            if (error) {
                const mapped = mapDbError(error);
                return json(mapped.status, { error: mapped.message });
            }
            return json(200, { success: true, redemption: Array.isArray(data) ? data[0] : data });
        }

        if (action === "game_result") {
            if (student.role !== "student") return json(400, { error: "請使用學生帳號累積遊戲獎勵" });
            const gameKey = cleanText(body?.game_key, 100);
            const sessionKey = cleanText(body?.session_key, 160);
            if (!gameKey || !sessionKey) return json(400, { error: "遊戲紀錄不完整" });
            const { data, error } = await admin.rpc("record_game_gamification", {
                p_student_id: student.id,
                p_game_key: gameKey,
                p_session_key: sessionKey,
                p_won: Boolean(body?.won)
            });
            if (error) throw error;
            return json(200, { success: true, reward: Array.isArray(data) ? data[0] : data });
        }

        if (action.startsWith("admin_")) {
            if (student.role !== ADMIN_ROLE) return json(403, { error: "只有管理員可以管理獎品" });

            if (action === "admin_catalog") {
                const [{ data: rewards, error: rewardError }, { data: redemptions, error: redemptionError }] = await Promise.all([
                    admin.from("rewards").select("*").order("sort_order", { ascending: true }).order("id", { ascending: true }),
                    admin.from("reward_redemptions").select("*").order("requested_at", { ascending: false }).limit(200)
                ]);
                if (rewardError || redemptionError) throw rewardError || redemptionError;
                const studentIds = [...new Set((redemptions || []).map((row: any) => Number(row.student_id)).filter(Boolean))];
                let studentMap = new Map<number, any>();
                if (studentIds.length > 0) {
                    const { data: students, error: studentsError } = await admin.from("students").select("id,name,english_name,class").in("id", studentIds);
                    if (studentsError) throw studentsError;
                    studentMap = new Map((students || []).map((row: any) => [Number(row.id), row]));
                }
                const signedRewards = await Promise.all((rewards || []).map(async (reward: any) => ({
                    ...reward,
                    image_url: await signedImage(admin, REWARD_BUCKET, reward.image_path, 3600)
                })));
                return json(200, {
                    success: true,
                    rewards: signedRewards,
                    redemptions: (redemptions || []).map((row: any) => ({
                        ...row,
                        student: studentMap.get(Number(row.student_id)) || null
                    }))
                });
            }

            if (action === "admin_save_reward") {
                const rewardId = positiveInteger(body?.reward?.id);
                const name = cleanText(body?.reward?.name, 120);
                const description = cleanText(body?.reward?.description, 1000) || null;
                const pointsCost = positiveInteger(body?.reward?.points_cost);
                const stockQuantity = nonNegativeInteger(body?.reward?.stock_quantity, 0);
                const perStudentLimit = body?.reward?.per_student_limit === null || body?.reward?.per_student_limit === ""
                    ? null
                    : positiveInteger(body?.reward?.per_student_limit);
                const applicableClasses = Array.isArray(body?.reward?.applicable_classes)
                    ? [...new Set(body.reward.applicable_classes.map((value: unknown) => cleanText(value, 30)).filter(Boolean))].slice(0, 20)
                    : [];
                const fulfillmentType = body?.reward?.fulfillment_type === "digital" ? "digital" : "physical";
                if (!name || !pointsCost) return json(400, { error: "請填寫獎品名稱與正確點數" });
                const payload = {
                    name,
                    description,
                    image_path: cleanText(body?.reward?.image_path, 1000) || null,
                    points_cost: pointsCost,
                    stock_quantity: stockQuantity,
                    enabled: body?.reward?.enabled !== false,
                    per_student_limit: perStudentLimit,
                    applicable_classes: applicableClasses,
                    fulfillment_type: fulfillmentType,
                    sort_order: clampInt(body?.reward?.sort_order, -9999, 9999, 0),
                    updated_at: new Date().toISOString()
                };
                const query = rewardId
                    ? admin.from("rewards").update(payload).eq("id", rewardId)
                    : admin.from("rewards").insert({ ...payload, created_by: student.id });
                const { data, error } = await query.select("*").single();
                if (error) throw error;
                return json(200, {
                    success: true,
                    reward: {
                        ...data,
                        image_url: await signedImage(admin, REWARD_BUCKET, data.image_path, 3600)
                    }
                });
            }

            if (action === "admin_delete_reward") {
                const rewardId = positiveInteger(body?.reward_id);
                if (!rewardId) return json(400, { error: "獎品編號不正確" });
                const { count, error: countError } = await admin.from("reward_redemptions").select("id", { count: "exact", head: true }).eq("reward_id", rewardId);
                if (countError) throw countError;
                if ((count || 0) > 0) {
                    const { error } = await admin.from("rewards").update({ enabled: false, updated_at: new Date().toISOString() }).eq("id", rewardId);
                    if (error) throw error;
                    return json(200, { success: true, archived: true });
                }
                const { error } = await admin.from("rewards").delete().eq("id", rewardId);
                if (error) throw error;
                return json(200, { success: true, deleted: true });
            }

            if (action === "admin_update_redemption") {
                const redemptionId = positiveInteger(body?.redemption_id);
                const status = cleanText(body?.status, 30);
                if (!redemptionId || !status) return json(400, { error: "兌換資料不完整" });
                const { data, error } = await admin.rpc("update_reward_redemption_status", {
                    p_redemption_id: redemptionId,
                    p_status: status,
                    p_admin_id: student.id,
                    p_note: cleanText(body?.note, 1000) || null
                });
                if (error) {
                    const mapped = mapDbError(error);
                    return json(mapped.status, { error: mapped.message });
                }
                return json(200, { success: true, redemption: Array.isArray(data) ? data[0] : data });
            }
        }

        return json(400, { error: "不支援的操作" });
    } catch (error) {
        console.error("gamification error", error);
        return json(500, { error: cleanText((error as Error)?.message, 500) || "遊戲化服務暫時無法使用" });
    }
});
