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
const DEFAULT_SITE_URL = "https://alanenglish.com.tw";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const cleanText = (value: unknown, maxLength = 300) => String(value || "")
    .trim()
    .slice(0, maxLength);

const positiveInteger = (value: unknown) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const stripeId = (value: unknown) => {
    if (typeof value === "string") return cleanText(value, 300);
    if (value && typeof value === "object") return cleanText((value as any).id, 300);
    return "";
};

const toIsoFromSeconds = (value: unknown) => {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds > 0
        ? new Date(seconds * 1000).toISOString()
        : null;
};

// Stripe 2025-03-31.basil 起把 current_period_end 移到 subscription item；
// 同時保留舊欄位相容性，避免帳戶 API 版本升級後會員期限失效。
const subscriptionPeriodEnd = (subscription: any) => {
    const candidates = [
        subscription?.current_period_end,
        ...(Array.isArray(subscription?.items?.data)
            ? subscription.items.data.map((item: any) => item?.current_period_end)
            : [])
    ].map(Number).filter(value => Number.isFinite(value) && value > 0);
    return candidates.length > 0 ? Math.max(...candidates) : null;
};

async function verifyFirebaseIdToken(token: string) {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: FIREBASE_PROJECT_ID
    });
    const uid = cleanText(payload.sub, 200);
    if (!uid) throw new Error("Firebase token 缺少 uid");
    return {
        uid,
        email: cleanText(payload.email, 320).toLowerCase()
    };
}

const stripeRequest = async (
    stripeKey: string,
    path: string,
    options: {
        method?: "GET" | "POST";
        params?: URLSearchParams;
    } = {}
) => {
    const method = options.method || "POST";
    const response = await fetch(`https://api.stripe.com${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${stripeKey}`,
            ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
        },
        body: method === "POST" ? options.params?.toString() || "" : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data?.error?.message || `Stripe request failed (${response.status})`);
        (error as any).status = response.status;
        (error as any).code = data?.error?.code || null;
        throw error;
    }
    return data;
};

const getSiteUrl = () => {
    const configured = cleanText(Deno.env.get("SITE_URL"), 500) || DEFAULT_SITE_URL;
    try {
        const url = new URL(configured);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error("invalid protocol");
        return url.origin;
    } catch {
        return DEFAULT_SITE_URL;
    }
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    try {
        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
        if (!token) return json(401, { error: "請先登入 Alan English" });

        let firebaseUser: { uid: string; email: string };
        try {
            firebaseUser = await verifyFirebaseIdToken(token);
        } catch {
            return json(401, { error: "登入驗證失敗，請重新登入" });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Supabase 伺服器設定不完整" });
        if (!stripeKey) {
            return json(503, {
                error: "付款服務尚未完成商家金鑰設定",
                code: "stripe_not_configured"
            });
        }

        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data: student, error: studentError } = await admin
            .from("students")
            .select("id,firebase_uid,name,email,role")
            .eq("firebase_uid", firebaseUser.uid)
            .maybeSingle();
        if (studentError) throw studentError;
        if (!student) return json(404, { error: "找不到 Alan English 帳號" });
        if (student.role !== "student") {
            return json(400, { error: "工作人員帳號不需要訂閱" });
        }

        const { data: membership, error: membershipError } = await admin
            .from("memberships")
            .select("*,subscription_plans(id,code,name,stripe_price_id,price_twd,enabled,is_public)")
            .eq("student_id", student.id)
            .maybeSingle();
        if (membershipError) throw membershipError;
        if (!membership) return json(409, { error: "會員資料尚未建立，請重新登入後再試" });

        const body = await req.json().catch(() => ({}));
        const action = cleanText(body?.action || "create_checkout", 60);
        const siteUrl = getSiteUrl();

        if (action === "create_checkout") {
            const planId = positiveInteger(body?.plan_id);
            if (!planId) return json(400, { error: "請選擇訂閱方案" });
            const { data: plan, error: planError } = await admin
                .from("subscription_plans")
                .select("id,code,name,price_twd,billing_interval,stripe_price_id,enabled,is_public")
                .eq("id", planId)
                .maybeSingle();
            if (planError) throw planError;
            if (!plan || !plan.enabled || !plan.is_public) {
                return json(404, { error: "這個訂閱方案目前沒有開放" });
            }
            if (!plan.stripe_price_id || plan.price_twd === null) {
                return json(409, { error: "這個方案尚未完成付款設定" });
            }
            if (
                membership.stripe_subscription_id
                && !["cancelled", "expired"].includes(String(membership.status || ""))
            ) {
                return json(409, {
                    error: "這個帳號已有 Stripe 訂閱，請從會員頁管理或變更方案",
                    code: "subscription_already_exists"
                });
            }

            const stripePrice = await stripeRequest(
                stripeKey,
                `/v1/prices/${encodeURIComponent(plan.stripe_price_id)}`,
                { method: "GET" }
            );
            const configuredAmount = Number(stripePrice.unit_amount);
            if (
                stripePrice.active !== true
                || stripePrice.type !== "recurring"
                || stripePrice.currency !== "twd"
                || stripePrice.recurring?.interval !== plan.billing_interval
                || !Number.isInteger(configuredAmount)
                || configuredAmount !== Number(plan.price_twd)
            ) {
                return json(409, {
                    error: "Stripe 價格與網站方案設定不一致，請通知管理員檢查價格、幣別與週期",
                    code: "stripe_price_mismatch"
                });
            }

            let customerId = cleanText(membership.stripe_customer_id, 200);
            if (!customerId) {
                const customerParams = new URLSearchParams();
                customerParams.set("email", student.email || firebaseUser.email);
                customerParams.set("name", student.name || "Alan English Student");
                customerParams.set("metadata[student_id]", String(student.id));
                customerParams.set("metadata[firebase_uid]", student.firebase_uid);
                const customer = await stripeRequest(stripeKey, "/v1/customers", {
                    method: "POST",
                    params: customerParams
                });
                customerId = customer.id;
                const { error: customerSaveError } = await admin
                    .from("memberships")
                    .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
                    .eq("id", membership.id);
                if (customerSaveError) throw customerSaveError;
            }

            const checkoutParams = new URLSearchParams();
            checkoutParams.set("mode", "subscription");
            checkoutParams.set("customer", customerId);
            checkoutParams.set("client_reference_id", String(student.id));
            checkoutParams.set("line_items[0][price]", plan.stripe_price_id);
            checkoutParams.set("line_items[0][quantity]", "1");
            checkoutParams.set("success_url", `${siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`);
            checkoutParams.set("cancel_url", `${siteUrl}/membership?checkout=cancelled`);
            checkoutParams.set("allow_promotion_codes", "true");
            checkoutParams.set("billing_address_collection", "auto");
            checkoutParams.set("metadata[student_id]", String(student.id));
            checkoutParams.set("metadata[membership_id]", String(membership.id));
            checkoutParams.set("metadata[plan_id]", String(plan.id));
            checkoutParams.set("subscription_data[metadata][student_id]", String(student.id));
            checkoutParams.set("subscription_data[metadata][membership_id]", String(membership.id));
            checkoutParams.set("subscription_data[metadata][plan_id]", String(plan.id));

            const trialEnd = membership.status === "trialing" && membership.trial_ends_at
                ? Math.floor(new Date(membership.trial_ends_at).getTime() / 1000)
                : 0;
            const minimumTrialEnd = Math.floor(Date.now() / 1000) + (48 * 60 * 60);
            if (trialEnd > minimumTrialEnd) {
                checkoutParams.set("subscription_data[trial_end]", String(trialEnd));
            }

            const session = await stripeRequest(stripeKey, "/v1/checkout/sessions", {
                method: "POST",
                params: checkoutParams
            });
            return json(200, {
                success: true,
                checkout_session_id: session.id,
                url: session.url
            });
        }

        if (action === "create_portal") {
            const customerId = cleanText(membership.stripe_customer_id, 200);
            if (!customerId) return json(409, { error: "這個帳號還沒有付款紀錄" });
            const params = new URLSearchParams();
            params.set("customer", customerId);
            params.set("return_url", `${siteUrl}/membership`);
            const session = await stripeRequest(stripeKey, "/v1/billing_portal/sessions", {
                method: "POST",
                params
            });
            return json(200, { success: true, url: session.url });
        }

        if (action === "sync") {
            const checkoutSessionId = cleanText(body?.checkout_session_id, 300);
            let subscriptionId = cleanText(membership.stripe_subscription_id, 300);
            let sessionPlanId: number | null = null;
            let sessionCustomerId = "";

            if (checkoutSessionId) {
                if (!/^cs_[A-Za-z0-9_]+$/.test(checkoutSessionId)) {
                    return json(400, { error: "付款工作階段編號格式不正確" });
                }
                const session = await stripeRequest(
                    stripeKey,
                    `/v1/checkout/sessions/${encodeURIComponent(checkoutSessionId)}`,
                    { method: "GET" }
                );
                const sessionStudentId = positiveInteger(
                    session?.client_reference_id || session?.metadata?.student_id
                );
                sessionCustomerId = stripeId(session?.customer);
                if (
                    session?.mode !== "subscription"
                    || sessionStudentId !== Number(student.id)
                    || (membership.stripe_customer_id && sessionCustomerId !== membership.stripe_customer_id)
                ) {
                    return json(403, { error: "這筆付款不屬於目前登入帳號" });
                }
                if (session?.status !== "complete") {
                    return json(200, {
                        success: true,
                        synced: false,
                        message: "Stripe 付款工作階段尚未完成"
                    });
                }

                const sessionSubscriptionId = stripeId(session?.subscription);
                if (
                    subscriptionId
                    && sessionSubscriptionId
                    && subscriptionId !== sessionSubscriptionId
                ) {
                    return json(409, { error: "付款工作階段與目前訂閱不一致，請聯絡管理員" });
                }
                subscriptionId = sessionSubscriptionId || subscriptionId;
                sessionPlanId = positiveInteger(session?.metadata?.plan_id);
                if (sessionPlanId) {
                    const { data: sessionPlan, error: sessionPlanError } = await admin
                        .from("subscription_plans")
                        .select("id")
                        .eq("id", sessionPlanId)
                        .eq("enabled", true)
                        .maybeSingle();
                    if (sessionPlanError) throw sessionPlanError;
                    if (!sessionPlan) return json(409, { error: "付款方案已停用，請聯絡管理員" });
                }
            }

            if (!subscriptionId) {
                return json(200, { success: true, synced: false, message: "尚無 Stripe 訂閱" });
            }
            const subscription = await stripeRequest(
                stripeKey,
                `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
                { method: "GET" }
            );
            const stripeStatus = cleanText(subscription.status, 40);
            const status = stripeStatus === "trialing"
                ? "trialing"
                : stripeStatus === "active"
                    ? "active"
                    : ["past_due", "unpaid", "incomplete", "incomplete_expired", "paused"].includes(stripeStatus)
                        ? "past_due"
                        : stripeStatus === "canceled"
                            ? "cancelled"
                            : membership.status;
            const currentPeriodEnd = toIsoFromSeconds(subscriptionPeriodEnd(subscription));
            const subscriptionCustomerId = stripeId(subscription.customer);
            if (
                membership.stripe_customer_id
                && subscriptionCustomerId
                && membership.stripe_customer_id !== subscriptionCustomerId
            ) {
                return json(403, { error: "Stripe 訂閱客戶與目前帳號不一致" });
            }
            const updates: Record<string, unknown> = {
                status,
                source: "stripe",
                stripe_customer_id: subscriptionCustomerId || sessionCustomerId || membership.stripe_customer_id,
                stripe_subscription_id: subscriptionId,
                stripe_subscription_status: stripeStatus,
                current_period_end: currentPeriodEnd,
                access_ends_at: currentPeriodEnd || membership.access_ends_at,
                cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
                updated_at: new Date().toISOString()
            };
            if (sessionPlanId) updates.plan_id = sessionPlanId;
            const { data: updated, error: updateError } = await admin
                .from("memberships")
                .update(updates)
                .eq("id", membership.id)
                .select("*")
                .single();
            if (updateError) throw updateError;
            return json(200, {
                success: true,
                synced: true,
                checkout_session_id: checkoutSessionId || null,
                membership: updated
            });
        }

        return json(400, { error: "不支援的付款操作" });
    } catch (error) {
        console.error("billing-manager unexpected error", error);
        const status = Number((error as any)?.status || 0);
        return json(status >= 400 && status < 500 ? 400 : 500, {
            error: error instanceof Error ? error.message : "付款服務暫時無法使用"
        });
    }
});
