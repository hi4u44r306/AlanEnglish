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

    if (callerError) return json(500, { error: "無法確認目前使用者權限" });
    if (!caller || !["teacher", "admin"].includes(caller.role)) {
      return json(403, { error: "只有教師或管理員可以編輯帳號" });
    }

    const body = await req.json();
    const targetId = Number(body?.id);
    const name = String(body?.name || "").trim();
    const requestedRole = String(body?.role || "").trim();
    const classType = body?.class == null ? null : String(body.class).trim();
    const plan = body?.plan == null ? null : String(body.plan).trim();

    if (!Number.isFinite(targetId) || targetId <= 0) return json(400, { error: "帳號 ID 不正確" });
    if (!name) return json(400, { error: "Name 不可空白" });

    const { data: target, error: targetError } = await admin
      .from("students")
      .select("id, firebase_uid, email, name, role, class, plan")
      .eq("id", targetId)
      .maybeSingle();

    if (targetError) return json(500, { error: "讀取目標帳號失敗" });
    if (!target) return json(404, { error: "找不到帳號" });

    if (caller.role === "teacher") {
      if (target.role !== "student") {
        return json(403, { error: "教師只能編輯學生帳號" });
      }

      if (requestedRole && requestedRole !== "student") {
        return json(403, { error: "教師不能修改帳號角色" });
      }
    }

    let nextRole = target.role;
    if (caller.role === "admin" && requestedRole) {
      if (!["student", "teacher", "admin"].includes(requestedRole)) {
        return json(400, { error: "Role 不正確" });
      }

      if (target.firebase_uid === callerUid && requestedRole !== "admin") {
        return json(403, { error: "不能把目前登入中的管理員帳號降權" });
      }

      nextRole = requestedRole;
    }

    let nextClass: string | null = null;
    let nextPlan: string | null = null;

    if (nextRole === "student") {
      if (!classType || !["A", "B", "C", "D"].includes(classType)) {
        return json(400, { error: "學生必須選擇正確的 Class" });
      }

      if (!plan || !["listeningonly", "allcover"].includes(plan)) {
        return json(400, { error: "學生必須選擇正確的 Plan" });
      }

      nextClass = classType;
      nextPlan = plan;
    }

    const { data: updatedUser, error: updateError } = await admin
      .from("students")
      .update({
        name,
        role: nextRole,
        class: nextClass,
        plan: nextPlan,
        updated_at: new Date().toISOString()
      })
      .eq("id", targetId)
      .select("id, firebase_uid, email, name, role, class, plan, updated_at")
      .single();

    if (updateError) {
      console.error("update user error", updateError);
      return json(500, { error: `帳號更新失敗：${updateError.message}` });
    }

    return json(200, { success: true, user: updatedUser });
  } catch (error) {
    console.error("update-user unexpected error", error);
    return json(500, { error: error instanceof Error ? error.message : "帳號更新失敗" });
  }
});
