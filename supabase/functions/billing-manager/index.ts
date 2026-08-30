import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";
import Stripe from "npm:stripe@22.4.0";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";
import {
    ACADEMY_AI_ADDON_PLAN_CODE,
    AI_ADDON_PLAN_CODES,
    BASIC_MEMBERSHIP_PLAN_CODE,
    GENERAL_AI_ADDON_PLAN_CODE,
    getMembershipPricingEligibility,
    isAiAddonPlanCode
} from "../_shared/membership-pricing.ts";
import { toStripeTwdMinorUnits } from "../_shared/stripe-price.ts";

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
const RESERVED_EMAIL_DOMAINS = new Set(["example.com", "example.net", "example.org", "example.invalid", "localhost"]);
const isReceivableEmail = (value: unknown) => {
    const email = cleanText(value, 320).toLowerCase();
    const domain = email.split("@")[1] || "";
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        && !RESERVED_EMAIL_DOMAINS.has(domain)
        && !domain.endsWith(".invalid");
};

const positiveInteger = (value: unknown) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const stripeId = (value: unknown) => {
    if (typeof value === "string") return cleanText(value, 300);
    if (value && typeof value === "object") return cleanText((value as any).id, 300);
    return "";
};

const stripeLivemodeValue = (value: unknown): boolean | null => {
    if (value === true) return true;
    if (value === false) return false;
    return null;
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

const subscriptionPeriodStart = (subscription: any) => {
    const candidates = [
        subscription?.current_period_start,
        subscription?.start_date,
        ...(Array.isArray(subscription?.items?.data)
            ? subscription.items.data.map((item: any) => item?.current_period_start)
            : [])
    ].map(Number).filter(value => Number.isFinite(value) && value > 0);
    return candidates.length > 0 ? Math.min(...candidates) : null;
};

const grantStatusFromStripe = (status: string) => {
    if (["active", "trialing"].includes(status)) return "active";
    if (status === "canceled") return "expired";
    return "paused";
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
        const stripe = new Stripe(stripeKey, { apiVersion: "2026-07-29.dahlia" });

        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data: student, error: studentError } = await admin
            .from("students")
            .select("id,firebase_uid,name,email,role,learner_type,account_status")
            .eq("firebase_uid", firebaseUser.uid)
            .maybeSingle();
        if (studentError) throw studentError;
        if (!student) return json(404, { error: "找不到 Alan English 帳號" });
        if (student.role !== "student") {
            return json(400, { error: "工作人員帳號不需要訂閱" });
        }
        if (student.account_status && student.account_status !== "active") {
            return json(403, { error: "這個帳號目前已停用，無法建立或管理訂閱" });
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

        const loadGuardianEmail = async () => {
            const { data, error } = await admin
                .from("guardian_contacts")
                .select("email")
                .eq("student_id", student.id)
                .maybeSingle();
            if (error) throw error;
            const guardianEmail = cleanText(data?.email, 320).toLowerCase();
            if (!isReceivableEmail(guardianEmail)) {
                throw Object.assign(new Error("付費前請先在學生設定補上有效的家長 Email"), {
                    status: 409,
                    code: "guardian_email_required"
                });
            }
            return guardianEmail;
        };

        if (action === "create_material_checkout") {
            const guardianEmail = await loadGuardianEmail();
            const packageId = positiveInteger(body?.package_id);
            if (!packageId) return json(400, { error: "請選擇教材商品包" });
            const { data: materialPackage, error: packageError } = await admin
                .from("material_packages")
                .select(`
                    id,name,standard_price_twd,member_price_twd,includes_90_day_access,status,
                    stripe_product_id,stripe_standard_price_id,stripe_member_price_id,stripe_livemode,
                    material_package_books(book_id,role),material_package_tracks(track_id,role)
                `)
                .eq("id", packageId)
                .eq("status", "published")
                .eq("stripe_livemode", false)
                .maybeSingle();
            if (packageError) throw packageError;
            if (!materialPackage) return json(404, { error: "這個教材商品包目前沒有上架" });

            const effectiveAccess = await loadEffectiveAccess(admin, Number(student.id));
            const memberPrice = effectiveAccess.plan_codes.includes(BASIC_MEMBERSHIP_PLAN_CODE);
            const amountTwd = Number(memberPrice ? materialPackage.member_price_twd : materialPackage.standard_price_twd);
            const selectedPriceId = cleanText(memberPrice ? materialPackage.stripe_member_price_id : materialPackage.stripe_standard_price_id, 300);
            if (!Number.isInteger(amountTwd) || amountTwd <= 0 || !selectedPriceId) {
                return json(409, { error: "教材商品包價格尚未確認，暫時無法購買", code: "material_price_unconfirmed" });
            }
            const price = await stripe.prices.retrieve(selectedPriceId);
            if (
                price.active !== true || price.type !== "one_time" || price.currency !== "twd"
                || price.livemode !== false || Number(price.unit_amount) !== toStripeTwdMinorUnits(amountTwd)
                || stripeId(price.product) !== cleanText(materialPackage.stripe_product_id, 300)
            ) return json(409, { error: "Stripe 教材價格與網站商品包設定不一致", code: "stripe_price_mismatch" });

            let customerId = cleanText(membership.stripe_customer_id, 200);
            if (!customerId) {
                const customer = await stripe.customers.create({
                    email: guardianEmail,
                    name: student.name || "Alan English Student",
                    metadata: { student_id: String(student.id), firebase_uid: student.firebase_uid }
                });
                if (customer.livemode !== false) return json(409, { error: "教材付款僅允許 Stripe 測試模式" });
                customerId = customer.id;
                const saved = await admin.from("memberships").update({
                    stripe_customer_id: customerId, stripe_livemode: false, updated_at: new Date().toISOString()
                }).eq("id", membership.id);
                if (saved.error) throw saved.error;
            }

            const snapshot = {
                package_id: materialPackage.id,
                package_name: materialPackage.name,
                books: materialPackage.material_package_books || [],
                tracks: materialPackage.material_package_tracks || [],
                includes_90_day_access: !memberPrice && materialPackage.includes_90_day_access === true
            };
            const { data: purchase, error: purchaseError } = await admin.from("material_purchases").insert({
                student_id: student.id, package_id: materialPackage.id, status: "pending",
                price_type: memberPrice ? "member" : "standard", amount_twd: amountTwd,
                includes_90_day_access: snapshot.includes_90_day_access, package_snapshot: snapshot,
                stripe_livemode: false
            }).select("id").single();
            if (purchaseError) throw purchaseError;
            const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
            const metadata = {
                commerce_type: "material_package",
                purchase_id: String(purchase.id), package_id: String(materialPackage.id), student_id: String(student.id)
            };
            const session = await stripe.checkout.sessions.create({
                mode: "payment", customer: customerId, client_reference_id: String(student.id),
                line_items: [{ price: selectedPriceId, quantity: 1 }],
                success_url: `${siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${siteUrl}/materials?checkout=cancelled`,
                customer_update: { address: "auto", name: "auto" },
                billing_address_collection: "auto",
                integration_identifier: `alanenglish_material_${suffix}`,
                metadata, payment_intent_data: { metadata }
            });
            const saved = await admin.from("material_purchases").update({ stripe_checkout_session_id: session.id }).eq("id", purchase.id);
            if (saved.error) throw saved.error;
            return json(200, { success: true, checkout_session_id: session.id, url: session.url });
        }

        if (action === "create_checkout") {
            const guardianEmail = await loadGuardianEmail();
            const planId = positiveInteger(body?.plan_id);
            if (!planId) return json(400, { error: "請選擇訂閱方案" });
            const { data: plan, error: planError } = await admin
                .from("subscription_plans")
                .select("id,code,name,price_twd,billing_interval,stripe_price_id,enabled,is_public,access_model")
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
                plan.code !== BASIC_MEMBERSHIP_PLAN_CODE
                && !isAiAddonPlanCode(plan.code)
            ) {
                return json(409, { error: "目前不支援這個訂閱方案" });
            }

            const [enrollmentResult, effectiveAccess] = await Promise.all([
                admin
                    .from("academy_enrollments")
                    .select("id,status")
                    .eq("student_id", student.id),
                loadEffectiveAccess(admin, Number(student.id))
            ]);
            if (enrollmentResult.error) throw enrollmentResult.error;
            const enrollments = Array.isArray(enrollmentResult.data) ? enrollmentResult.data : [];
            const pricingEligibility = getMembershipPricingEligibility({
                role: student.role,
                learnerType: student.learner_type || null,
                hasActiveAcademyEnrollment: enrollments.some((item: any) => item?.status === "active"),
                hasAcademyHistory: enrollments.length > 0,
                hasActiveBasicMembership: effectiveAccess.plan_codes.includes(BASIC_MEMBERSHIP_PLAN_CODE)
            });

            const isAdditivePlan = plan.access_model === "addon";
            if (isAdditivePlan) {
                if (!isAiAddonPlanCode(plan.code)) {
                    return json(409, { error: "目前不支援這個加購方案" });
                }
                if (
                    plan.code === ACADEMY_AI_ADDON_PLAN_CODE
                    && !pricingEligibility.canUseAcademyAiAddon
                ) {
                    return json(403, {
                        error: "英文班在校生可直接加購 AI；離校生需先啟用每月 NT$299 基本會員",
                        code: "academy_ai_membership_required"
                    });
                }
                if (
                    plan.code === GENERAL_AI_ADDON_PLAN_CODE
                    && !pricingEligibility.canUseGeneralAiAddon
                ) {
                    return json(403, {
                        error: "一般會員需先啟用每月 NT$299 基本會員，才能加購 AI 教材",
                        code: "general_ai_membership_required"
                    });
                }

                const { data: aiPlans, error: aiPlansError } = await admin
                    .from("subscription_plans")
                    .select("id")
                    .in("code", [...AI_ADDON_PLAN_CODES]);
                if (aiPlansError) throw aiPlansError;
                const aiPlanIds = (aiPlans || []).map((item: any) => Number(item.id)).filter(Number.isInteger);

                const existingGrantQuery = admin
                    .from("student_access_grants")
                    .select("id,stripe_subscription_id,status")
                    .eq("student_id", student.id)
                    .eq("source", "stripe")
                    .in("status", ["pending", "active", "paused"])
                    .limit(1);
                const { data: existingGrants, error: existingGrantError } = aiPlanIds.length > 0
                    ? await existingGrantQuery.in("plan_id", aiPlanIds)
                    : { data: [], error: null };
                if (existingGrantError) throw existingGrantError;
                if ((existingGrants || []).length > 0) {
                    return json(409, {
                        error: "這個帳號已有 AI 教材與發音練習訂閱，請使用訂閱管理",
                        code: "addon_subscription_already_exists"
                    });
                }
            } else if (
                plan.code === BASIC_MEMBERSHIP_PLAN_CODE
                && !pricingEligibility.canUseBasicMembership
            ) {
                return json(403, { error: "英文班在校生已包含核心網站權限，不需要購買基本會員" });
            }
            if (
                !isAdditivePlan
                &&
                membership.stripe_subscription_id
                && !["cancelled", "expired"].includes(String(membership.status || ""))
            ) {
                return json(409, {
                    error: "這個帳號已有 Stripe 訂閱，請從會員頁管理或變更方案",
                    code: "subscription_already_exists"
                });
            }

            const stripePrice = await stripe.prices.retrieve(plan.stripe_price_id);
            const configuredAmount = Number(stripePrice.unit_amount);
            const expectedAmount = toStripeTwdMinorUnits(plan.price_twd);
            if (
                stripePrice.active !== true
                || stripePrice.type !== "recurring"
                || stripePrice.currency !== "twd"
                || stripePrice.recurring?.interval !== plan.billing_interval
                || !Number.isInteger(configuredAmount)
                || expectedAmount === null
                || configuredAmount !== expectedAmount
            ) {
                return json(409, {
                    error: "Stripe 價格與網站方案設定不一致，請通知管理員檢查價格、幣別與週期",
                    code: "stripe_price_mismatch"
                });
            }

            let customerId = cleanText(membership.stripe_customer_id, 200);
            if (!customerId) {
                const customer = await stripe.customers.create({
                    email: guardianEmail,
                    name: student.name || "Alan English Student",
                    metadata: {
                        student_id: String(student.id),
                        firebase_uid: student.firebase_uid
                    }
                });
                customerId = customer.id;
                const { error: customerSaveError } = await admin
                    .from("memberships")
                    .update({
                        stripe_customer_id: customerId,
                        stripe_livemode: stripeLivemodeValue(customer.livemode),
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", membership.id);
                if (customerSaveError) throw customerSaveError;
            }

            const integrationSuffix = Array.from(crypto.getRandomValues(new Uint8Array(8)))
                .map(value => String.fromCharCode(97 + (value % 26)))
                .join("");
            const checkoutMetadata = {
                student_id: String(student.id),
                membership_id: String(membership.id),
                plan_id: String(plan.id),
                grant_mode: isAdditivePlan ? "additive" : "membership"
            };
            const checkoutParams: any = {
                mode: "subscription",
                customer: customerId,
                client_reference_id: String(student.id),
                line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
                success_url: `${siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${siteUrl}/student/membership?checkout=cancelled`,
                allow_promotion_codes: true,
                billing_address_collection: "auto",
                integration_identifier: `alanenglish_subscription_${integrationSuffix}`,
                metadata: checkoutMetadata,
                subscription_data: { metadata: checkoutMetadata }
            };

            const trialEnd = !isAdditivePlan && membership.status === "trialing" && membership.trial_ends_at
                ? Math.floor(new Date(membership.trial_ends_at).getTime() / 1000)
                : 0;
            const minimumTrialEnd = Math.floor(Date.now() / 1000) + (48 * 60 * 60);
            if (trialEnd > minimumTrialEnd) {
                checkoutParams.subscription_data.trial_end = trialEnd;
            }

            const session = await stripe.checkout.sessions.create(checkoutParams);
            return json(200, {
                success: true,
                checkout_session_id: session.id,
                url: session.url
            });
        }

        if (action === "create_portal") {
            const customerId = cleanText(membership.stripe_customer_id, 200);
            if (!customerId) return json(409, { error: "這個帳號還沒有付款紀錄" });
            const session = await stripe.billingPortal.sessions.create({
                customer: customerId,
                return_url: `${siteUrl}/student/membership`
            });
            return json(200, { success: true, url: session.url });
        }

        if (action === "cancel_at_period_end" || action === "resume_subscription") {
            const requestedSubscriptionId = cleanText(body?.subscription_id, 300);
            let subscriptionId = cleanText(membership.stripe_subscription_id, 300);
            let grantId: number | null = null;
            if (requestedSubscriptionId && requestedSubscriptionId !== subscriptionId) {
                const { data: grant, error: grantError } = await admin
                    .from("student_access_grants")
                    .select("id,stripe_subscription_id")
                    .eq("student_id", student.id)
                    .eq("stripe_subscription_id", requestedSubscriptionId)
                    .eq("source", "stripe")
                    .maybeSingle();
                if (grantError) throw grantError;
                if (!grant) return json(403, { error: "這筆訂閱不屬於目前登入帳號" });
                subscriptionId = requestedSubscriptionId;
                grantId = Number(grant.id);
            }
            if (!subscriptionId) return json(409, { error: "這個帳號目前沒有可管理的 Stripe 訂閱" });
            const existing = await stripe.subscriptions.retrieve(subscriptionId);
            if (existing.status === "canceled") {
                return json(409, {
                    error: "這個方案已真正到期，請重新完成 Checkout 開始新的付款週期",
                    code: "subscription_expired"
                });
            }
            const cancelAtPeriodEnd = action === "cancel_at_period_end";
            const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: cancelAtPeriodEnd });
            const currentPeriodEnd = toIsoFromSeconds(subscriptionPeriodEnd(updated));
            if (grantId) {
                const saved = await admin.from("student_access_grants").update({
                    cancel_at_period_end: cancelAtPeriodEnd,
                    current_period_end: currentPeriodEnd,
                    ends_at: currentPeriodEnd,
                    stripe_subscription_status: updated.status,
                    updated_at: new Date().toISOString()
                }).eq("id", grantId);
                if (saved.error) throw saved.error;
            } else {
                const saved = await admin.from("memberships").update({
                    cancel_at_period_end: cancelAtPeriodEnd,
                    current_period_end: currentPeriodEnd,
                    access_ends_at: currentPeriodEnd,
                    stripe_subscription_status: updated.status,
                    updated_at: new Date().toISOString()
                }).eq("id", membership.id);
                if (saved.error) throw saved.error;
            }
            return json(200, {
                success: true,
                cancel_at_period_end: cancelAtPeriodEnd,
                current_period_end: currentPeriodEnd
            });
        }

        if (action === "sync") {
            const checkoutSessionId = cleanText(body?.checkout_session_id, 300);
            let subscriptionId = cleanText(membership.stripe_subscription_id, 300);
            let sessionPlanId: number | null = null;
            let sessionCustomerId = "";
            let sessionGrantMode = "";
            let sessionLivemode: boolean | null = null;

            if (checkoutSessionId) {
                if (!/^cs_[A-Za-z0-9_]+$/.test(checkoutSessionId)) {
                    return json(400, { error: "付款工作階段編號格式不正確" });
                }
                const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
                sessionLivemode = stripeLivemodeValue(session?.livemode);
                const sessionStudentId = positiveInteger(
                    session?.client_reference_id || session?.metadata?.student_id
                );
                sessionCustomerId = stripeId(session?.customer);
                const sessionCommerceType = cleanText(session?.metadata?.commerce_type, 40);

                if (sessionCommerceType === "material_package") {
                    const purchaseId = positiveInteger(session?.metadata?.purchase_id);
                    const packageId = positiveInteger(session?.metadata?.package_id);
                    if (
                        session?.mode !== "payment"
                        || sessionStudentId !== Number(student.id)
                        || !purchaseId
                        || !packageId
                        || sessionLivemode !== false
                        || (membership.stripe_customer_id && sessionCustomerId !== membership.stripe_customer_id)
                    ) {
                        return json(403, { error: "這筆教材付款不屬於目前登入帳號" });
                    }

                    const { data: purchase, error: purchaseError } = await admin
                        .from("material_purchases")
                        .select("id,student_id,package_id,status,stripe_checkout_session_id")
                        .eq("id", purchaseId)
                        .eq("student_id", student.id)
                        .eq("package_id", packageId)
                        .eq("stripe_checkout_session_id", checkoutSessionId)
                        .maybeSingle();
                    if (purchaseError) throw purchaseError;
                    if (!purchase) {
                        return json(403, { error: "這筆教材付款不屬於目前登入帳號" });
                    }

                    const stripePaymentComplete = session?.status === "complete"
                        && session?.payment_status === "paid";
                    if (!stripePaymentComplete || purchase.status !== "paid") {
                        return json(200, {
                            success: true,
                            synced: false,
                            message: stripePaymentComplete
                                ? "付款已完成，教材權限正在建立中，請稍後重新整理。"
                                : "Stripe 教材付款工作階段尚未完成",
                            material_purchase: {
                                id: purchase.id,
                                package_id: purchase.package_id,
                                status: purchase.status
                            }
                        });
                    }

                    return json(200, {
                        success: true,
                        synced: true,
                        message: "教材付款已確認，教材權限已更新。",
                        material_purchase: {
                            id: purchase.id,
                            package_id: purchase.package_id,
                            status: purchase.status
                        }
                    });
                }

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
                sessionGrantMode = cleanText(session?.metadata?.grant_mode, 40);
                if (
                    sessionGrantMode !== "additive"
                    &&
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
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const subscriptionLivemode = stripeLivemodeValue(subscription?.livemode);
            const verifiedLivemode = subscriptionLivemode ?? sessionLivemode;
            const stripeStatus = cleanText(subscription.status, 40);
            const subscriptionPlanId = positiveInteger(subscription?.metadata?.plan_id) || sessionPlanId;
            const grantMode = cleanText(subscription?.metadata?.grant_mode, 40) || sessionGrantMode;
            const currentPeriodEnd = toIsoFromSeconds(subscriptionPeriodEnd(subscription));
            const subscriptionCustomerId = stripeId(subscription.customer);
            if (
                membership.stripe_customer_id
                && subscriptionCustomerId
                && membership.stripe_customer_id !== subscriptionCustomerId
            ) {
                return json(403, { error: "Stripe 訂閱客戶與目前帳號不一致" });
            }

            if (grantMode === "additive") {
                if (!subscriptionPlanId) return json(409, { error: "AI 加購訂閱缺少方案資料" });
                const { data: addonPlan, error: addonPlanError } = await admin
                    .from("subscription_plans")
                    .select("id,code,access_model")
                    .eq("id", subscriptionPlanId)
                    .eq("enabled", true)
                    .maybeSingle();
                if (addonPlanError) throw addonPlanError;
                if (!addonPlan || addonPlan.access_model !== "addon" || !isAiAddonPlanCode(addonPlan.code)) {
                    return json(409, { error: "Stripe 訂閱不是有效的加購方案" });
                }
                const grantStatus = grantStatusFromStripe(stripeStatus);
                if (grantStatus === "active" && !currentPeriodEnd) {
                    return json(409, { error: "Stripe 訂閱缺少目前計費週期" });
                }
                const startsAt = toIsoFromSeconds(subscriptionPeriodStart(subscription)) || new Date().toISOString();
                const endsAt = currentPeriodEnd || (grantStatus === "expired" ? new Date().toISOString() : null);
                const { data: accessGrant, error: grantError } = await admin
                    .from("student_access_grants")
                    .upsert({
                        student_id: student.id,
                        plan_id: addonPlan.id,
                        source: "stripe",
                        status: grantStatus,
                        starts_at: startsAt,
                        ends_at: endsAt,
                        revoked_at: grantStatus === "expired" ? new Date().toISOString() : null,
                        revoke_reason: grantStatus === "expired" ? "stripe_subscription_cancelled" : null,
                        stripe_customer_id: subscriptionCustomerId || sessionCustomerId || membership.stripe_customer_id,
                        stripe_subscription_id: subscriptionId,
                        stripe_checkout_session_id: checkoutSessionId || null,
                        stripe_subscription_status: stripeStatus,
                        stripe_livemode: verifiedLivemode,
                        current_period_end: currentPeriodEnd,
                        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
                        metadata: {
                            plan_code: addonPlan.code,
                            grant_mode: "additive",
                            synced_by: "billing-manager"
                        },
                        updated_at: new Date().toISOString()
                    }, { onConflict: "stripe_subscription_id" })
                    .select("id,status,ends_at,stripe_subscription_status,cancel_at_period_end")
                    .single();
                if (grantError) throw grantError;
                return json(200, {
                    success: true,
                    synced: true,
                    checkout_session_id: checkoutSessionId || null,
                    access_grant: accessGrant,
                    membership: { is_active: grantStatus === "active" }
                });
            }

            const status = stripeStatus === "trialing"
                ? "trialing"
                : stripeStatus === "active"
                    ? "active"
                    : ["past_due", "unpaid", "incomplete", "incomplete_expired", "paused"].includes(stripeStatus)
                        ? "past_due"
                        : stripeStatus === "canceled"
                            ? "cancelled"
                            : membership.status;
            const updates: Record<string, unknown> = {
                status,
                source: "stripe",
                stripe_customer_id: subscriptionCustomerId || sessionCustomerId || membership.stripe_customer_id,
                stripe_subscription_id: subscriptionId,
                stripe_subscription_status: stripeStatus,
                stripe_livemode: verifiedLivemode,
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
        const status = Number((error as any)?.statusCode || (error as any)?.status || 0);
        return json(status >= 400 && status < 500 ? status : 500, {
            error: error instanceof Error ? error.message : "付款服務暫時無法使用",
            code: cleanText((error as any)?.code, 100) || null
        });
    }
});
