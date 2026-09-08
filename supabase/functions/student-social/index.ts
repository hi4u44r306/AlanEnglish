import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { cleanText, verifyFirebaseRequest } from "../_shared/firebase-auth.ts";

const ALLOWED_ORIGINS = new Set([
    "https://alanenglish.com.tw",
    "https://www.alanenglish.com.tw",
    "https://alanenglish-student-test.netlify.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000"
]);
const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000, 6200, 7600, 9200, 11000, 13000, 15200, 17600, 20200];
const REPORT_CATEGORIES = new Set(["inappropriate_nickname", "harassment", "cheating", "other"]);
const FRIEND_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const cors = (req: Request) => {
    const origin = req.headers.get("origin") || "";
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://alanenglish.com.tw",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin"
    };
};
const json = (req: Request, status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" }
});
const adminClient = () => createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { persistSession: false, autoRefreshToken: false } }
);
const positiveInteger = (value: unknown) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const getLevel = (xpValue: unknown) => {
    const xp = Math.max(0, Number(xpValue || 0));
    let level = 1;
    LEVEL_THRESHOLDS.forEach((minimum, index) => { if (xp >= minimum) level = index + 1; });
    if (xp >= LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) {
        level = LEVEL_THRESHOLDS.length + Math.floor((xp - LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) / 3000);
    }
    return level;
};
const presenceLabel = (lastActiveAt: unknown, visible: boolean) => {
    if (!visible || !lastActiveAt) return "hidden";
    const age = Date.now() - new Date(String(lastActiveAt)).getTime();
    if (age <= 2 * 60 * 1000) return "online";
    if (age <= 15 * 60 * 1000) return "recent";
    return "offline";
};
const validNickname = (value: unknown) => {
    const nickname = cleanText(value, 20).replace(/\s+/g, " ");
    if (!/^[\p{L}\p{N}][\p{L}\p{N} _-]{1,19}$/u.test(nickname)) return null;
    return nickname;
};
const makeFriendCode = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return `AE-${Array.from(bytes, value => FRIEND_CODE_CHARS[value % FRIEND_CODE_CHARS.length]).join("")}`;
};
const relationFilter = (firstId: number, secondId: number) => (
    `and(requester_id.eq.${firstId},addressee_id.eq.${secondId}),and(requester_id.eq.${secondId},addressee_id.eq.${firstId})`
);
const blockFilter = (firstId: number, secondId: number) => (
    `and(blocker_id.eq.${firstId},blocked_id.eq.${secondId}),and(blocker_id.eq.${secondId},blocked_id.eq.${firstId})`
);
const writeAudit = async (admin: any, actorId: number, action: string, targetId: number | null = null, metadata: Record<string, unknown> = {}) => {
    const { error } = await admin.from("student_social_audit_events").insert({ actor_id: actorId, target_id: targetId, action, metadata });
    if (error) throw error;
};
const withinLimit = async (admin: any, actorId: number, action: string, since: string, limit: number) => {
    const { count, error } = await admin.from("student_social_audit_events")
        .select("id", { count: "exact", head: true })
        .eq("actor_id", actorId).eq("action", action).gte("created_at", since);
    if (error) throw error;
    return (count || 0) < limit;
};
const ensureFriendCode = async (admin: any) => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const code = makeFriendCode();
        const { count, error } = await admin.from("student_social_profiles").select("student_id", { count: "exact", head: true }).eq("friend_code", code);
        if (error) throw error;
        if (!count) return code;
    }
    throw new Error("FRIEND_CODE_UNAVAILABLE");
};

const buildPeople = async (admin: any, ids: number[], viewerId: number, friendIds: Set<number>) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (!uniqueIds.length) return new Map<number, any>();
    const [{ data: students, error: studentError }, { data: profiles, error: profileError }, { data: balances, error: balanceError }] = await Promise.all([
        admin.from("students").select("id,account_status").in("id", uniqueIds).eq("role", "student"),
        admin.from("student_social_profiles").select("student_id,nickname,friend_code,stats_visibility,presence_visibility,last_active_at").in("student_id", uniqueIds),
        admin.from("student_gamification_balances").select("student_id,total_xp").in("student_id", uniqueIds)
    ]);
    if (studentError || profileError || balanceError) throw studentError || profileError || balanceError;
    const activeIds = new Set((students || []).filter((item: any) => item.account_status === "active").map((item: any) => Number(item.id)));
    const balanceById = new Map((balances || []).map((item: any) => [Number(item.student_id), Number(item.total_xp || 0)]));
    return new Map((profiles || []).filter((profile: any) => activeIds.has(Number(profile.student_id))).map((profile: any) => {
        const id = Number(profile.student_id);
        const isSelf = id === viewerId;
        const isFriend = friendIds.has(id);
        const canSeeStats = isSelf || (isFriend && profile.stats_visibility === "friends");
        const totalXp = canSeeStats ? Number(balanceById.get(id) || 0) : null;
        return [id, {
            student_id: id,
            nickname: profile.nickname,
            friend_code: isSelf ? profile.friend_code : undefined,
            presence: presenceLabel(profile.last_active_at, isSelf || (isFriend && profile.presence_visibility === "friends")),
            stats: canSeeStats ? { total_xp: totalXp, level: getLevel(totalXp) } : null
        }];
    }));
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    if (req.method !== "POST") return json(req, 405, { success: false, error: "Method not allowed" });
    const origin = req.headers.get("origin") || "";
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json(req, 403, { success: false, error: "這個網站來源不允許使用好友功能" });

    try {
        const admin = adminClient();
        const caller = await verifyFirebaseRequest(req, admin);
        if (caller.role !== "student") return json(req, 403, { success: false, error: "好友功能只提供學生帳號使用" });
        const { data: access, error: accessError } = await admin.rpc("get_student_effective_access", { p_student_id: caller.id, p_as_of: new Date().toISOString() });
        if (accessError) throw accessError;
        if (access?.is_active !== true) return json(req, 403, { success: false, error: "學習方案目前未啟用，暫時無法使用好友功能" });

        const body = await req.json().catch(() => ({}));
        const action = cleanText(body.action, 40) || "overview";
        await admin.from("student_social_profiles").update({ last_active_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("student_id", caller.id);

        if (action === "heartbeat") return json(req, 200, { success: true });

        if (action === "update_profile") {
            const nickname = validNickname(body.nickname);
            const statsVisibility = cleanText(body.stats_visibility, 20) || "friends";
            const presenceVisibility = cleanText(body.presence_visibility, 20) || "friends";
            if (!nickname || !["self", "friends"].includes(statsVisibility) || !["hidden", "friends"].includes(presenceVisibility)) {
                return json(req, 400, { success: false, error: "暱稱需為 2～20 個中英文字、數字、空格、底線或連字號" });
            }
            const { data: existing } = await admin.from("student_social_profiles").select("friend_code").eq("student_id", caller.id).maybeSingle();
            const friendCode = existing?.friend_code || await ensureFriendCode(admin);
            const { data, error } = await admin.from("student_social_profiles").upsert({
                student_id: caller.id,
                nickname,
                friend_code: friendCode,
                stats_visibility: statsVisibility,
                presence_visibility: presenceVisibility,
                last_active_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: "student_id" }).select("student_id,nickname,friend_code,stats_visibility,presence_visibility,last_active_at").single();
            if (error?.code === "23505") return json(req, 409, { success: false, error: "這個暱稱已有人使用，請換一個暱稱" });
            if (error) throw error;
            await writeAudit(admin, caller.id, "profile_update");
            return json(req, 200, { success: true, profile: data });
        }

        if (action === "overview") {
            const { data: relations, error } = await admin.from("student_friendships").select("id,requester_id,addressee_id,status,created_at,updated_at").or(`requester_id.eq.${caller.id},addressee_id.eq.${caller.id}`).order("updated_at", { ascending: false });
            if (error) throw error;
            const accepted = (relations || []).filter((item: any) => item.status === "accepted");
            const friendIds = new Set<number>(accepted.map((item: any) => Number(item.requester_id) === caller.id ? Number(item.addressee_id) : Number(item.requester_id)));
            const incoming = (relations || []).filter((item: any) => item.status === "pending" && Number(item.addressee_id) === caller.id);
            const outgoing = (relations || []).filter((item: any) => item.status === "pending" && Number(item.requester_id) === caller.id);
            const { data: blocks, error: blockError } = await admin.from("student_social_blocks").select("blocked_id").eq("blocker_id", caller.id);
            if (blockError) throw blockError;
            const ids = [caller.id, ...friendIds, ...incoming.map((item: any) => Number(item.requester_id)), ...outgoing.map((item: any) => Number(item.addressee_id)), ...(blocks || []).map((item: any) => Number(item.blocked_id))];
            const people = await buildPeople(admin, ids, caller.id, friendIds);
            const relationPerson = (item: any, id: number) => ({ id: item.id, created_at: item.created_at, person: people.get(id) || null });
            return json(req, 200, {
                success: true,
                profile: people.get(caller.id) || null,
                settings: people.get(caller.id) ? (await admin.from("student_social_profiles").select("stats_visibility,presence_visibility").eq("student_id", caller.id).single()).data : null,
                friends: accepted.map((item: any) => relationPerson(item, Number(item.requester_id) === caller.id ? Number(item.addressee_id) : Number(item.requester_id))).filter((item: any) => item.person),
                incoming_requests: incoming.map((item: any) => relationPerson(item, Number(item.requester_id))).filter((item: any) => item.person),
                outgoing_requests: outgoing.map((item: any) => relationPerson(item, Number(item.addressee_id))).filter((item: any) => item.person),
                blocked: (blocks || []).map((item: any) => people.get(Number(item.blocked_id))).filter(Boolean)
            });
        }

        if (action === "search") {
            const query = cleanText(body.query, 24).replace(/\s+/g, " ");
            if (query.length < 2) return json(req, 400, { success: false, error: "請輸入完整暱稱或好友碼" });
            const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            if (!await withinLimit(admin, caller.id, "search", since, 30)) return json(req, 429, { success: false, error: "搜尋次數太頻繁，請稍後再試" });
            await writeAudit(admin, caller.id, "search", null, { query_type: /^AE-/i.test(query) ? "friend_code" : "nickname" });
            const lookup = /^AE-[A-Z2-9]{8}$/i.test(query)
                ? admin.from("student_social_profiles").select("student_id,nickname").eq("friend_code", query.toUpperCase()).maybeSingle()
                : admin.from("student_social_profiles").select("student_id,nickname").eq("nickname_normalized", query.toLowerCase()).maybeSingle();
            const { data: found, error } = await lookup;
            if (error) throw error;
            if (!found || Number(found.student_id) === caller.id) return json(req, 200, { success: true, result: null });
            const targetId = Number(found.student_id);
            const [{ data: targetAccess }, { data: block }, { data: relation }] = await Promise.all([
                admin.rpc("get_student_effective_access", { p_student_id: targetId, p_as_of: new Date().toISOString() }),
                admin.from("student_social_blocks").select("blocker_id").or(blockFilter(caller.id, targetId)).limit(1).maybeSingle(),
                admin.from("student_friendships").select("id,requester_id,addressee_id,status").or(relationFilter(caller.id, targetId)).maybeSingle()
            ]);
            if (block || targetAccess?.is_active !== true) return json(req, 200, { success: true, result: null });
            return json(req, 200, { success: true, result: { student_id: targetId, nickname: found.nickname, relationship: relation || null } });
        }

        if (action === "send_request") {
            const targetId = positiveInteger(body.student_id);
            if (!targetId || targetId === caller.id) return json(req, 400, { success: false, error: "好友邀請資料不正確" });
            const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            if (!await withinLimit(admin, caller.id, "friend_request", since, 5)) return json(req, 429, { success: false, error: "一小時最多送出 5 次好友邀請，請稍後再試" });
            const [{ data: target }, { data: targetProfile }, { data: targetAccess }, { data: block }, { data: existing }] = await Promise.all([
                admin.from("students").select("id,role,account_status").eq("id", targetId).maybeSingle(),
                admin.from("student_social_profiles").select("nickname").eq("student_id", targetId).maybeSingle(),
                admin.rpc("get_student_effective_access", { p_student_id: targetId, p_as_of: new Date().toISOString() }),
                admin.from("student_social_blocks").select("blocker_id").or(blockFilter(caller.id, targetId)).limit(1).maybeSingle(),
                admin.from("student_friendships").select("id,requester_id,addressee_id,status").or(relationFilter(caller.id, targetId)).maybeSingle()
            ]);
            if (!targetProfile || target?.role !== "student" || target?.account_status !== "active" || targetAccess?.is_active !== true) return json(req, 404, { success: false, error: "找不到可邀請的學生" });
            if (block) return json(req, 403, { success: false, error: "目前無法傳送好友邀請" });
            if (existing?.status === "accepted") return json(req, 409, { success: false, error: "你們已經是好友" });
            if (existing?.status === "pending") return json(req, 409, { success: false, error: Number(existing.addressee_id) === caller.id ? "對方已邀請你，請到待處理邀請接受" : "好友邀請已送出" });
            const payload = { requester_id: caller.id, addressee_id: targetId, status: "pending", responded_at: null, updated_at: new Date().toISOString() };
            const request = existing
                ? admin.from("student_friendships").update(payload).eq("id", existing.id).select("id,status,created_at").single()
                : admin.from("student_friendships").insert(payload).select("id,status,created_at").single();
            const { data, error } = await request;
            if (error) throw error;
            const { data: callerProfile } = await admin.from("student_social_profiles").select("nickname").eq("student_id", caller.id).maybeSingle();
            await Promise.all([
                writeAudit(admin, caller.id, "friend_request", targetId),
                admin.from("student_notifications").insert({ student_id: targetId, notification_type: "social", title: "新的好友邀請", body: `${callerProfile?.nickname || "一位同學"} 想加你為好友`, metadata: { friendship_id: data.id } })
            ]);
            return json(req, 200, { success: true, request: data });
        }

        if (action === "respond_request") {
            const requestId = positiveInteger(body.request_id);
            const decision = cleanText(body.decision, 12);
            if (!requestId || !["accept", "reject"].includes(decision)) return json(req, 400, { success: false, error: "邀請回覆資料不正確" });
            const { data: relation } = await admin.from("student_friendships").select("id,requester_id,addressee_id,status").eq("id", requestId).maybeSingle();
            if (!relation || relation.status !== "pending" || Number(relation.addressee_id) !== caller.id) return json(req, 404, { success: false, error: "這筆好友邀請已不存在" });
            const status = decision === "accept" ? "accepted" : "rejected";
            const { error } = await admin.from("student_friendships").update({ status, responded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", requestId);
            if (error) throw error;
            await writeAudit(admin, caller.id, `friend_request_${status}`, Number(relation.requester_id));
            if (status === "accepted") {
                const { data: callerProfile } = await admin.from("student_social_profiles").select("nickname").eq("student_id", caller.id).maybeSingle();
                await admin.from("student_notifications").insert({ student_id: relation.requester_id, notification_type: "social", title: "好友邀請已接受", body: `${callerProfile?.nickname || "一位同學"} 已接受你的好友邀請`, metadata: { friendship_id: requestId } });
            }
            return json(req, 200, { success: true, status });
        }

        if (action === "remove_friend") {
            const targetId = positiveInteger(body.student_id);
            if (!targetId) return json(req, 400, { success: false, error: "好友資料不正確" });
            const { error } = await admin.from("student_friendships").delete().eq("status", "accepted").or(relationFilter(caller.id, targetId));
            if (error) throw error;
            await writeAudit(admin, caller.id, "friend_remove", targetId);
            return json(req, 200, { success: true });
        }

        if (action === "block") {
            const targetId = positiveInteger(body.student_id);
            if (!targetId || targetId === caller.id) return json(req, 400, { success: false, error: "封鎖資料不正確" });
            const { error } = await admin.from("student_social_blocks").upsert({ blocker_id: caller.id, blocked_id: targetId }, { onConflict: "blocker_id,blocked_id" });
            if (error) throw error;
            await Promise.all([
                admin.from("student_friendships").delete().or(relationFilter(caller.id, targetId)),
                writeAudit(admin, caller.id, "block", targetId)
            ]);
            return json(req, 200, { success: true });
        }

        if (action === "unblock") {
            const targetId = positiveInteger(body.student_id);
            if (!targetId) return json(req, 400, { success: false, error: "解除封鎖資料不正確" });
            const { error } = await admin.from("student_social_blocks").delete().eq("blocker_id", caller.id).eq("blocked_id", targetId);
            if (error) throw error;
            await writeAudit(admin, caller.id, "unblock", targetId);
            return json(req, 200, { success: true });
        }

        if (action === "report") {
            const targetId = positiveInteger(body.student_id);
            const category = cleanText(body.category, 40);
            const details = cleanText(body.details, 500) || null;
            if (!targetId || targetId === caller.id || !REPORT_CATEGORIES.has(category)) return json(req, 400, { success: false, error: "檢舉資料不完整" });
            const { data: target } = await admin.from("students").select("id,role,account_status").eq("id", targetId).maybeSingle();
            if (target?.role !== "student" || target?.account_status !== "active") return json(req, 404, { success: false, error: "找不到可檢舉的學生" });
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            if (!await withinLimit(admin, caller.id, "report", since, 3)) return json(req, 429, { success: false, error: "今天的檢舉次數已達上限，若有立即危險請直接告訴老師或家長" });
            const { data, error } = await admin.from("student_social_reports").insert({ reporter_id: caller.id, reported_id: targetId, category, details }).select("id,created_at").single();
            if (error) throw error;
            await writeAudit(admin, caller.id, "report", targetId, { report_id: data.id, category });
            return json(req, 200, { success: true, report: data });
        }

        return json(req, 400, { success: false, error: "不支援的好友操作" });
    } catch (error) {
        const status = Number((error as any)?.status || 500);
        console.error("student-social error", status, (error as Error)?.message);
        return json(req, status, { success: false, error: status < 500 ? (error as Error).message : "好友服務暫時無法使用" });
    }
});
