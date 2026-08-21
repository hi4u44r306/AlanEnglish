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
      return json(403, { error: "只有教師或管理員可以建立學生" });
    }

    const body = await req.json();
    const firebaseUid = String(body?.firebase_uid || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const name = String(body?.name || "").trim();
    const classType = String(body?.class || "").trim();
    const plan = String(body?.plan || "").trim();

    if (!firebaseUid || !email || !name || !classType || !plan) {
      return json(400, { error: "學生資料不完整" });
    }

    if (!["A", "B", "C", "D"].includes(classType)) {
      return json(400, { error: "Class 不正確" });
    }

    if (!["listeningonly", "allcover"].includes(plan)) {
      return json(400, { error: "Plan 不正確" });
    }

    const { data: existingByEmail, error: existingEmailError } = await admin
      .from("students")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existingEmailError) {
      console.error("existing email lookup error", existingEmailError);
      return json(500, { error: "檢查既有學生資料失敗" });
    }

    if (existingByEmail) {
      if (existingByEmail.firebase_uid && existingByEmail.firebase_uid !== firebaseUid) {
        return json(409, { error: "這個 Email 已綁定其他 Firebase 帳號" });
      }

      const { data: repairedStudent, error: repairError } = await admin
        .from("students")
        .update({
          firebase_uid: firebaseUid,
          name,
          class: classType,
          role: "student",
          plan,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingByEmail.id)
        .select("*")
        .single();

      if (repairError) {
        console.error("repair student error", repairError);
        return json(500, { error: `學生資料修復失敗：${repairError.message}` });
      }

      return json(200, { success: true, repaired: true, student: repairedStudent });
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
      return json(409, { error: "這個 Firebase 帳號已經存在學生資料" });
    }

    const { data: student, error: insertError } = await admin
      .from("students")
      .insert({
        firebase_uid: firebaseUid,
        name,
        email,
        class: classType,
        role: "student",
        plan,
        user_image: "6C9570CC-B276-424C-857F-11BBDD21C99B.png",
        total_time_played: 0,
        current_time_played: 0
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("insert student error", insertError);
      return json(500, { error: `學生資料寫入失敗：${insertError.message}` });
    }

    return json(201, { success: true, repaired: false, student });
  } catch (error) {
    console.error("create-student unexpected error", error);
    return json(500, { error: error instanceof Error ? error.message : "建立學生失敗" });
  }
});
