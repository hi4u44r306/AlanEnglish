import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

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
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

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
    const firebaseToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!firebaseToken) return json(401, { error: "缺少登入驗證" });

    let callerUid = "";
    try {
      callerUid = await verifyFirebaseIdToken(firebaseToken);
    } catch (error) {
      console.error("Firebase token verify error", error);
      return json(401, { error: "Firebase 登入驗證失敗" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "伺服器設定不完整" });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: caller, error: callerError } = await admin
      .from("students")
      .select("id, firebase_uid, role")
      .eq("firebase_uid", callerUid)
      .maybeSingle();

    if (callerError) {
      console.error("caller lookup error", callerError);
      return json(500, { error: "無法確認目前使用者權限" });
    }

    if (!caller || !["teacher", "admin"].includes(caller.role)) {
      return json(403, { error: "只有教師或管理員可以建立帳號" });
    }

    const body = await req.json();
    const firebaseUid = String(body?.firebase_uid || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const name = String(body?.name || "").trim();
    const targetRole = String(body?.role || "student").trim();
    const classType = body?.class == null ? null : String(body.class).trim();
    const plan = body?.plan == null ? null : String(body.plan).trim();
    const accessDays = Number(body?.access_days ?? 30);
    const requestedSource = String(body?.access_source || "material_purchase").trim();

    if (!firebaseUid || !email || !name || !targetRole) {
      return json(400, { error: "帳號資料不完整" });
    }

    if (!["student", "teacher", "admin"].includes(targetRole)) {
      return json(400, { error: "Role 不正確" });
    }

    if (caller.role === "teacher" && targetRole !== "student") {
      return json(403, { error: "教師只能建立學生帳號" });
    }

    if (targetRole === "student") {
      if (!classType || !["A", "B", "C", "D"].includes(classType)) {
        return json(400, { error: "學生必須選擇正確的 Class" });
      }

      if (!plan || !["listeningonly", "allcover"].includes(plan)) {
        return json(400, { error: "學生必須選擇正確的 Plan" });
      }
      if (!Number.isInteger(accessDays) || accessDays < 1 || accessDays > 3660) {
        return json(400, { error: "學生使用天數必須介於 1～3660 天" });
      }
      if (!["material_purchase", "admin_grant", "legacy"].includes(requestedSource)) {
        return json(400, { error: "學生權限來源不正確" });
      }
    }

    const ensureProductAccess = async (user: Record<string, unknown>) => {
      const studentId = Number(user.id);
      if (!studentId) throw new Error("建立的帳號缺少資料庫編號");

      const { data: existingMembership, error: existingMembershipError } = await admin
        .from("memberships")
        .select("id")
        .eq("student_id", studentId)
        .maybeSingle();
      if (existingMembershipError) throw existingMembershipError;

      if (!existingMembership) {
        let subscriptionPlanId: number | null = null;
        if (targetRole === "student") {
          const planCode = plan === "allcover" ? "all_access_monthly" : "listening_monthly";
          const { data: subscriptionPlan, error: subscriptionPlanError } = await admin
            .from("subscription_plans")
            .select("id")
            .eq("code", planCode)
            .maybeSingle();
          if (subscriptionPlanError) throw subscriptionPlanError;
          subscriptionPlanId = subscriptionPlan?.id || null;
        }
        const now = new Date();
        const { error: membershipError } = await admin.from("memberships").insert({
          student_id: studentId,
          plan_id: subscriptionPlanId,
          status: targetRole === "student" ? "active" : "complimentary",
          source: targetRole === "student" ? requestedSource : "admin_grant",
          access_started_at: now.toISOString(),
          access_ends_at: targetRole === "student"
            ? new Date(now.getTime() + accessDays * 86400000).toISOString()
            : null
        });
        if (membershipError) throw membershipError;
      }

      const { data: existingLevel, error: existingLevelError } = await admin
        .from("student_level_progress")
        .select("student_id")
        .eq("student_id", studentId)
        .maybeSingle();
      if (existingLevelError) throw existingLevelError;
      if (!existingLevel) {
        const { data: starter, error: starterError } = await admin
          .from("learning_levels")
          .select("id,rank")
          .eq("rank", 1)
          .eq("enabled", true)
          .maybeSingle();
        if (starterError) throw starterError;
        if (!starter) throw new Error("找不到起始學習等級");
        const { error: levelError } = await admin.from("student_level_progress").insert({
          student_id: studentId,
          current_level_id: starter.id,
          unlocked_rank: starter.rank
        });
        if (levelError) throw levelError;
      }

      const { data: membership, error: membershipReadError } = await admin
        .from("memberships")
        .select("id,status,source,access_started_at,access_ends_at")
        .eq("student_id", studentId)
        .single();
      if (membershipReadError) throw membershipReadError;
      return membership;
    };

    const { data: existingByEmail, error: existingEmailError } = await admin
      .from("students")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existingEmailError) {
      console.error("existing email lookup error", existingEmailError);
      return json(500, { error: "檢查既有帳號失敗" });
    }

    const nextData = {
      firebase_uid: firebaseUid,
      name,
      email,
      class: targetRole === "student" ? classType : null,
      role: targetRole,
      plan: targetRole === "student" ? plan : null,
      updated_at: new Date().toISOString()
    };

    if (existingByEmail) {
      if (existingByEmail.firebase_uid && existingByEmail.firebase_uid !== firebaseUid) {
        return json(409, { error: "這個 Email 已綁定其他 Firebase 帳號" });
      }

      const { data: repairedUser, error: repairError } = await admin
        .from("students")
        .update(nextData)
        .eq("id", existingByEmail.id)
        .select("*")
        .single();

      if (repairError) {
        console.error("repair user error", repairError);
        return json(500, { error: `帳號資料修復失敗：${repairError.message}` });
      }
      const membership = await ensureProductAccess(repairedUser);
      return json(200, { success: true, repaired: true, user: repairedUser, membership });
    }

    const { data: existingByUid, error: existingUidError } = await admin
      .from("students")
      .select("id,email")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (existingUidError) {
      console.error("existing uid lookup error", existingUidError);
      return json(500, { error: "檢查 Firebase UID 失敗" });
    }

    if (existingByUid) {
      return json(409, { error: "這個 Firebase 帳號已經存在資料" });
    }

    const { data: createdUser, error: insertError } = await admin
      .from("students")
      .insert({
        ...nextData,
        user_image: "6C9570CC-B276-424C-857F-11BBDD21C99B.png",
        total_time_played: 0,
        current_time_played: 0
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("insert user error", insertError);
      return json(500, { error: `帳號資料寫入失敗：${insertError.message}` });
    }
    try {
      const membership = await ensureProductAccess(createdUser);
      return json(201, { success: true, repaired: false, user: createdUser, membership });
    } catch (accessError) {
      await admin.from("students").delete().eq("id", createdUser.id);
      throw accessError;
    }
  } catch (error) {
    console.error("create-user unexpected error", error);
    return json(500, { error: error instanceof Error ? error.message : "建立帳號失敗" });
  }
});
