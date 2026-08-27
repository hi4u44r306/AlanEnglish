import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import Stripe from "npm:stripe@22.4.0";
import { verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { toStripeTwdMinorUnits } from "../_shared/stripe-price.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-alan-firebase-token, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const DEFAULT_SITE_URL = "https://alanenglish.com.tw";
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const cleanText = (value: unknown, maxLength = 300) => String(value || "").trim().slice(0, maxLength);
const positiveInt = (value: unknown, max = 20) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : null;
};
const stripeId = (value: unknown) => typeof value === "string"
    ? cleanText(value, 300)
    : value && typeof value === "object" ? cleanText((value as any).id, 300) : "";
const fail = (message: string, status = 400, code = "invalid_request") => {
    throw Object.assign(new Error(message), { status, code });
};
const createAdmin = () => {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) fail("商城伺服器設定不完整", 500, "server_config");
    return createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
};
const createStripe = () => {
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) fail("Stripe 尚未完成設定", 503, "stripe_config");
    return new Stripe(key!, { apiVersion: "2026-07-29.dahlia" });
};

async function requireStoreUser(req: Request, admin: any) {
    const token = cleanText(req.headers.get("Authorization"), 5000).replace(/^Bearer\s+/i, "");
    if (!token) fail("請先登入商城帳號", 401, "store_login_required");
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user?.id || !data.user.email) fail("商城登入已失效，請重新登入", 401, "store_session_invalid");
    if (!data.user.email_confirmed_at) fail("請先完成商城 Email 驗證", 403, "store_email_unconfirmed");
    const profile = await admin.from("store_customer_profiles").upsert({
        user_id: data.user.id,
        email: data.user.email.toLowerCase(),
        display_name: cleanText(data.user.user_metadata?.display_name, 80) || null,
        updated_at: new Date().toISOString()
    }, { onConflict: "user_id" }).select("user_id,email,display_name,phone,stripe_customer_id").single();
    if (profile.error) throw profile.error;
    return { ...profile.data, authUser: data.user };
}

async function requireAlanAdmin(req: Request, admin: any) {
    const token = cleanText(req.headers.get("X-Alan-Firebase-Token"), 5000);
    if (!token) fail("需要管理員登入", 401, "admin_login_required");
    const headers = new Headers(req.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const caller = await verifyFirebaseRequest(new Request(req.url, { method: "GET", headers }), admin);
    if (caller.role !== "admin") fail("只有管理員可以管理商城訂單", 403, "admin_required");
    return caller;
}

async function shippingMethods(admin: any) {
    const result = await admin.from("store_shipping_methods")
        .select("code,name,fee_twd,sort_order").eq("enabled", true).order("sort_order").order("id");
    if (result.error) throw result.error;
    return result.data || [];
}

const sanitizeOrder = (order: any) => {
    if (!order) return null;
    const {
        stripe_checkout_session_id: _session,
        stripe_payment_intent_id: _intent,
        stripe_customer_id: _customer,
        stripe_livemode: _livemode,
        customer_user_id: _user,
        ...safe
    } = order;
    return safe;
};

function validateShipping(input: any) {
    const shipping = {
        recipient_name: cleanText(input?.recipient_name, 80),
        recipient_phone: cleanText(input?.recipient_phone, 20),
        postal_code: cleanText(input?.postal_code, 6),
        city: cleanText(input?.city, 40),
        district: cleanText(input?.district, 40),
        address_line1: cleanText(input?.address_line1, 160),
        address_line2: cleanText(input?.address_line2, 120) || null,
        delivery_note: cleanText(input?.delivery_note, 300) || null,
        shipping_method_code: cleanText(input?.shipping_method_code, 50)
    };
    if (!shipping.recipient_name || !shipping.city || !shipping.district || !shipping.address_line1) {
        fail("請完整填寫收件人與台灣寄送地址", 400, "shipping_incomplete");
    }
    if (!/^[0-9+() -]{8,20}$/.test(shipping.recipient_phone)) fail("聯絡電話格式不正確", 400, "phone_invalid");
    if (!/^\d{3,6}$/.test(shipping.postal_code)) fail("郵遞區號格式不正確", 400, "postal_code_invalid");
    if (!shipping.shipping_method_code) fail("請選擇配送方式", 400, "shipping_method_required");
    return shipping;
}

function makeOrderNumber() {
    const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const date = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    return `AE${date}-${Array.from(bytes, byte => byte.toString(36).padStart(2, "0")).join("").toUpperCase().slice(0, 8)}`;
}

async function ensureStripeCustomer(admin: any, stripe: Stripe, customer: any, shipping: any) {
    let customerId = cleanText(customer.stripe_customer_id, 300);
    if (customerId) {
        try {
            const existing = await stripe.customers.retrieve(customerId);
            if ((existing as any)?.deleted || (existing as any)?.livemode === true) customerId = "";
        } catch { customerId = ""; }
    }
    if (!customerId) {
        const created = await stripe.customers.create({
            email: customer.email,
            name: shipping.recipient_name,
            phone: shipping.recipient_phone,
            metadata: { store_user_id: customer.user_id, account_scope: "alanenglish_store" }
        });
        if (created.livemode) fail("商城目前只允許 Stripe 測試模式", 503, "stripe_mode_mismatch");
        customerId = created.id;
        const saved = await admin.from("store_customer_profiles").update({
            stripe_customer_id: customerId,
            display_name: shipping.recipient_name,
            phone: shipping.recipient_phone,
            updated_at: new Date().toISOString()
        }).eq("user_id", customer.user_id);
        if (saved.error) throw saved.error;
    }
    return customerId;
}

async function createCheckout(admin: any, req: Request, body: any) {
    const customer = await requireStoreUser(req, admin);
    const shipping = validateShipping(body.shipping);
    const checkoutRequestId = cleanText(body.checkout_request_id, 50);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkoutRequestId)) {
        fail("結帳請求識別碼不正確，請重新整理後再試", 400, "checkout_request_invalid");
    }
    const previous = await admin.from("store_orders")
        .select("id,order_number,payment_status,stripe_checkout_session_id,checkout_expires_at")
        .eq("customer_user_id", customer.user_id).eq("checkout_request_id", checkoutRequestId).maybeSingle();
    if (previous.error) throw previous.error;
    if (previous.data?.stripe_checkout_session_id && previous.data.payment_status === "pending"
        && new Date(previous.data.checkout_expires_at || 0).getTime() > Date.now()) {
        const checkout = await createStripe().checkout.sessions.retrieve(previous.data.stripe_checkout_session_id);
        if (checkout.url && checkout.status === "open") return { url: checkout.url, order_number: previous.data.order_number, reused: true };
    }
    if (previous.data) fail("這次結帳請求已處理，請重新整理購物車", 409, "checkout_request_used");
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length || rawItems.length > 20) fail("購物車必須包含 1 至 20 種商品", 400, "cart_invalid");
    const quantities = new Map<number, number>();
    for (const item of rawItems) {
        const packageId = positiveInt(item?.package_id, Number.MAX_SAFE_INTEGER);
        const quantity = positiveInt(item?.quantity);
        if (!packageId || !quantity || quantities.has(packageId)) fail("購物車商品或數量不正確", 400, "cart_invalid");
        quantities.set(packageId, quantity);
    }

    const [methodResult, packageResult] = await Promise.all([
        admin.from("store_shipping_methods").select("code,name,fee_twd").eq("code", shipping.shipping_method_code).eq("enabled", true).maybeSingle(),
        admin.from("material_packages").select("id,name,cover_url,standard_price_twd,stripe_standard_price_id,stripe_product_id,stripe_livemode,status,inventory_quantity,max_quantity_per_order").in("id", [...quantities.keys()])
    ]);
    if (methodResult.error) throw methodResult.error;
    if (packageResult.error) throw packageResult.error;
    if (!methodResult.data) fail("配送方式已停用，請重新選擇", 409, "shipping_method_unavailable");
    if ((packageResult.data || []).length !== quantities.size) fail("部分商品已不存在，請重新整理購物車", 409, "product_missing");

    const stripe = createStripe();
    const items = [];
    for (const product of packageResult.data || []) {
        const quantity = quantities.get(Number(product.id))!;
        if (product.status !== "published" || product.stripe_livemode !== false) fail(`${product.name} 目前無法購買`, 409, "product_unavailable");
        if (!positiveInt(product.standard_price_twd, Number.MAX_SAFE_INTEGER) || !cleanText(product.stripe_standard_price_id, 300)) fail(`${product.name} 尚未完成售價設定`, 409, "product_price_missing");
        if (quantity > Number(product.max_quantity_per_order || 10)) fail(`${product.name} 每筆最多購買 ${product.max_quantity_per_order || 10} 件`, 409, "quantity_limit");
        if (product.inventory_quantity !== null && Number(product.inventory_quantity) < quantity) fail(`${product.name} 庫存不足`, 409, "inventory_insufficient");
        const price = await stripe.prices.retrieve(product.stripe_standard_price_id);
        if (price.livemode || !price.active || price.type !== "one_time" || price.currency !== "twd"
            || Number(price.unit_amount) !== toStripeTwdMinorUnits(product.standard_price_twd)
            || stripeId(price.product) !== cleanText(product.stripe_product_id, 300)) {
            fail(`${product.name} 的 Stripe 售價驗證失敗`, 409, "stripe_price_mismatch");
        }
        items.push({ ...product, quantity });
    }

    const subtotal = items.reduce((sum, item) => sum + Number(item.standard_price_twd) * item.quantity, 0);
    const shippingFee = Number(methodResult.data.fee_twd || 0);
    const total = subtotal + shippingFee;
    const customerId = await ensureStripeCustomer(admin, stripe, customer, shipping);
    let order: any = null;
    for (let attempt = 0; attempt < 3 && !order; attempt += 1) {
        const inserted = await admin.from("store_orders").insert({
            order_number: makeOrderNumber(), checkout_request_id: checkoutRequestId, customer_user_id: customer.user_id, customer_email: customer.email,
            ...shipping, shipping_method_name: methodResult.data.name,
            subtotal_twd: subtotal, shipping_fee_twd: shippingFee, total_twd: total,
            stripe_customer_id: customerId, stripe_livemode: false
        }).select("*").single();
        if (!inserted.error) order = inserted.data;
        else if (inserted.error.code !== "23505") throw inserted.error;
        else {
            const duplicate = await admin.from("store_orders").select("id").eq("checkout_request_id", checkoutRequestId).maybeSingle();
            if (duplicate.error) throw duplicate.error;
            if (duplicate.data) fail("結帳正在建立中，請稍後查看歷史訂單", 409, "checkout_in_progress");
        }
    }
    if (!order) fail("無法建立唯一訂單編號，請重試", 500, "order_number_failed");
    const itemInsert = await admin.from("store_order_items").insert(items.map(item => ({
        order_id: order.id, package_id: item.id, package_name: item.name, cover_url: item.cover_url || null,
        unit_price_twd: item.standard_price_twd, quantity: item.quantity
    })));
    if (itemInsert.error) {
        await admin.from("store_orders").update({ payment_status: "failed", fulfillment_status: "cancelled", updated_at: new Date().toISOString() }).eq("id", order.id);
        throw itemInsert.error;
    }
    const reserved = await admin.rpc("reserve_store_order_inventory", { p_order_id: order.id });
    if (reserved.error) {
        await admin.from("store_orders").update({ payment_status: "failed", fulfillment_status: "cancelled", updated_at: new Date().toISOString() }).eq("id", order.id);
        if (String(reserved.error.message || "").includes("store_order_inventory_insufficient")) {
            fail("商品剛好售完，請重新整理購物車", 409, "inventory_insufficient");
        }
        throw reserved.error;
    }
    await admin.from("store_order_status_history").insert({
        order_id: order.id, payment_status: "pending", fulfillment_status: "awaiting_payment",
        note: "訂單已建立，等待 Stripe 付款確認。", changed_by: "customer"
    });

    try {
        const siteUrl = cleanText(Deno.env.get("PUBLIC_SITE_URL") || DEFAULT_SITE_URL, 500).replace(/\/$/, "");
        const metadata = {
            commerce_type: "store_order", store_order_id: String(order.id), order_number: order.order_number,
            store_user_id: customer.user_id
        };
        const lineItems: any[] = items.map(item => ({ price: item.stripe_standard_price_id, quantity: item.quantity }));
        if (shippingFee > 0) lineItems.push({
            price_data: { currency: "twd", unit_amount: toStripeTwdMinorUnits(shippingFee), product_data: { name: methodResult.data.name } }, quantity: 1
        });
        const checkout = await stripe.checkout.sessions.create({
            mode: "payment", customer: customerId, line_items: lineItems,
            client_reference_id: String(order.id), metadata,
            payment_intent_data: { metadata },
            success_url: `${siteUrl}/shop/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${siteUrl}/shop/checkout?cancelled=1`,
            billing_address_collection: "auto",
            expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
            locale: "zh-TW"
        }, { idempotencyKey: `alanenglish_store_${checkoutRequestId}` });
        if (checkout.livemode) fail("商城目前只允許 Stripe 測試模式", 503, "stripe_mode_mismatch");
        const saved = await admin.from("store_orders").update({
            stripe_checkout_session_id: checkout.id,
            checkout_expires_at: checkout.expires_at ? new Date(checkout.expires_at * 1000).toISOString() : null,
            updated_at: new Date().toISOString()
        }).eq("id", order.id);
        if (saved.error) throw saved.error;
        return { url: checkout.url, order_number: order.order_number };
    } catch (error) {
        await admin.rpc("release_store_order_inventory", { p_order_id: order.id });
        await admin.from("store_orders").update({ payment_status: "failed", fulfillment_status: "cancelled", updated_at: new Date().toISOString() }).eq("id", order.id);
        await admin.from("store_order_status_history").insert({
            order_id: order.id, payment_status: "failed", fulfillment_status: "cancelled",
            note: "Stripe 結帳建立失敗，訂單不會出貨。", changed_by: "system"
        });
        throw error;
    }
}

async function customerOrders(admin: any, req: Request, body: any, detail = false) {
    const customer = await requireStoreUser(req, admin);
    let query = admin.from("store_orders").select(detail
        ? "*,store_order_items(*),store_order_status_history(*)"
        : "*,store_order_items(*)")
        .eq("customer_user_id", customer.user_id).order("created_at", { ascending: false });
    if (detail) {
        const number = cleanText(body.order_number, 40);
        if (!number) fail("缺少訂單編號", 400, "order_number_required");
        query = query.eq("order_number", number).limit(1);
    } else query = query.limit(100);
    const result = await query;
    if (result.error) throw result.error;
    if (detail) {
        const order = result.data?.[0];
        if (!order) fail("找不到這筆訂單", 404, "order_not_found");
        order.store_order_status_history = (order.store_order_status_history || []).sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)));
        return { order: sanitizeOrder(order) };
    }
    return { orders: (result.data || []).map(sanitizeOrder) };
}

async function syncCheckout(admin: any, req: Request, body: any) {
    const customer = await requireStoreUser(req, admin);
    const sessionId = cleanText(body.checkout_session_id, 300);
    if (!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId)) fail("Stripe 結帳編號不正確", 400, "checkout_session_invalid");
    const orderResult = await admin.from("store_orders")
        .select("id,order_number,payment_status,fulfillment_status,stripe_checkout_session_id")
        .eq("customer_user_id", customer.user_id).eq("stripe_checkout_session_id", sessionId).maybeSingle();
    if (orderResult.error) throw orderResult.error;
    if (!orderResult.data) fail("這筆付款不屬於目前的商城帳號", 403, "checkout_account_mismatch");
    const checkout = await createStripe().checkout.sessions.retrieve(sessionId);
    if (checkout.livemode || checkout.metadata?.store_user_id !== customer.user_id
        || checkout.metadata?.store_order_id !== String(orderResult.data.id)) {
        fail("Stripe 付款資料與訂單不一致", 409, "checkout_metadata_mismatch");
    }
    return {
        order_number: orderResult.data.order_number,
        payment_status: orderResult.data.payment_status,
        fulfillment_status: orderResult.data.fulfillment_status,
        stripe_payment_status: checkout.payment_status
    };
}

async function adminOrders(admin: any, req: Request) {
    await requireAlanAdmin(req, admin);
    const [orders, methods] = await Promise.all([
        admin.from("store_orders").select("*,store_order_items(*)").order("created_at", { ascending: false }).limit(200),
        admin.from("store_shipping_methods").select("code,name,fee_twd,enabled,sort_order").order("sort_order").order("id")
    ]);
    if (orders.error) throw orders.error;
    if (methods.error) throw methods.error;
    return { orders: (orders.data || []).map(sanitizeOrder), shipping_methods: methods.data || [] };
}

async function updateShippingMethod(admin: any, req: Request, body: any) {
    await requireAlanAdmin(req, admin);
    const code = cleanText(body.code, 50);
    const name = cleanText(body.name, 100);
    const fee = Number(body.fee_twd);
    if (!code || !name || !Number.isInteger(fee) || fee < 0 || fee > 10000) fail("配送名稱或運費不正確", 400, "shipping_method_invalid");
    const result = await admin.from("store_shipping_methods").update({
        name, fee_twd: fee, enabled: body.enabled !== false, updated_at: new Date().toISOString()
    }).eq("code", code).select("code").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) fail("找不到配送方式", 404, "shipping_method_not_found");
    return { success: true };
}

async function updateFulfillment(admin: any, req: Request, body: any) {
    const caller = await requireAlanAdmin(req, admin);
    const orderId = positiveInt(body.order_id, Number.MAX_SAFE_INTEGER);
    const requested = cleanText(body.fulfillment_status, 30);
    if (!orderId || !new Set(["preparing", "shipping", "completed"]).has(requested)) fail("出貨狀態不正確", 400, "fulfillment_invalid");
    const currentResult = await admin.from("store_orders").select("id,payment_status,fulfillment_status").eq("id", orderId).maybeSingle();
    if (currentResult.error) throw currentResult.error;
    if (!currentResult.data) fail("找不到訂單", 404, "order_not_found");
    if (currentResult.data.payment_status !== "paid") fail("Stripe 尚未確認付款，不能出貨", 409, "order_unpaid");
    const allowed: Record<string, string[]> = { preparing: ["preparing", "shipping"], shipping: ["shipping", "completed"], completed: ["completed"] };
    if (!(allowed[currentResult.data.fulfillment_status] || []).includes(requested)) fail("不能把出貨進度改回較早狀態", 409, "fulfillment_reverse_forbidden");
    const carrier = cleanText(body.carrier, 80) || null;
    const trackingNumber = cleanText(body.tracking_number, 100) || null;
    const trackingUrl = cleanText(body.tracking_url, 500) || null;
    if (requested === "shipping" && (!carrier || !trackingNumber)) fail("運送中必須填寫物流公司與物流單號", 400, "tracking_required");
    if (trackingUrl && !/^https:\/\//i.test(trackingUrl)) fail("物流查詢網址必須使用 https://", 400, "tracking_url_invalid");
    const now = new Date().toISOString();
    const update: any = { fulfillment_status: requested, carrier, tracking_number: trackingNumber, tracking_url: trackingUrl, updated_at: now };
    if (requested === "shipping") update.shipped_at = now;
    if (requested === "completed") update.completed_at = now;
    const saved = await admin.from("store_orders").update(update).eq("id", orderId).eq("payment_status", "paid").select("id").maybeSingle();
    if (saved.error) throw saved.error;
    if (!saved.data) fail("訂單狀態已改變，請重新整理", 409, "order_changed");
    const history = await admin.from("store_order_status_history").insert({
        order_id: orderId, payment_status: "paid", fulfillment_status: requested,
        note: requested === "shipping" ? `教材已交由 ${carrier} 配送。` : requested === "completed" ? "訂單已完成。" : "訂單正在準備中。",
        changed_by: `admin:${caller.id}`
    });
    if (history.error) throw history.error;
    return { success: true };
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    try {
        const body = await req.json().catch(() => ({}));
        const admin = createAdmin();
        let result: any;
        switch (cleanText(body.action, 50)) {
            case "catalog": result = { shipping_methods: await shippingMethods(admin) }; break;
            case "create_checkout": result = await createCheckout(admin, req, body); break;
            case "orders": result = await customerOrders(admin, req, body); break;
            case "order": result = await customerOrders(admin, req, body, true); break;
            case "sync": result = await syncCheckout(admin, req, body); break;
            case "admin_orders": result = await adminOrders(admin, req); break;
            case "update_fulfillment": result = await updateFulfillment(admin, req, body); break;
            case "update_shipping_method": result = await updateShippingMethod(admin, req, body); break;
            default: fail("不支援的商城操作", 400, "unknown_action");
        }
        return json(200, result);
    } catch (error) {
        const status = Number((error as any)?.status || 500);
        if (status >= 500) console.error("Store commerce request failed", (error as any)?.message);
        return json(status, { error: status >= 500 ? "教材商城服務暫時無法使用" : (error as any)?.message, code: (error as any)?.code || "store_error" });
    }
});
