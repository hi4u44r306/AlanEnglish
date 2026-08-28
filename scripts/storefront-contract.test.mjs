import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260827045227_storefront_orders.sql");
const store = read("supabase/functions/store-commerce/index.ts");
const webhook = read("supabase/functions/stripe-webhook/index.ts");
const routes = read("src/app/App.jsx");
const storeClient = read("src/store/storeSupabase.js");
const storeContext = read("src/store/StoreContext.jsx");
const catalog = read("src/components/Pages/StoreCatalog.jsx");

test("商城與聽力平台使用互不覆蓋的登入 session", () => {
    assert.match(storeClient, /storageKey: "ae-store-auth"/);
    assert.doesNotMatch(storeClient, /from\s+["'][^"']*firebase/i);
    assert.match(store, /admin\.auth\.getUser\(token\)/);
    assert.match(store, /X-Alan-Firebase-Token/);
});

test("商品公開瀏覽，結帳與訂單路由使用商城登入", () => {
    assert.match(routes, /path="\/shop" element=\{<StoreCatalog \/>\}/);
    assert.match(routes, /path="\/materials" element=\{<MaterialCatalog \/>\}/);
    assert.match(routes, /path="\/shop\/checkout" element=\{<StoreCheckout \/>\}/);
    assert.match(routes, /path="\/shop\/orders\/:orderNumber" element=\{<StoreOrders \/>\}/);
    assert.match(routes, /path="\/admin\/store-orders".*allowedRoles=\{\["admin"\]\}/);
    assert.doesNotMatch(catalog, /useAuth|firebaseUser/);
});

test("購物車只保留商品快照，後端仍重新計價", () => {
    assert.match(storeContext, /ae-store-cart-v1/);
    assert.match(store, /standard_price_twd,stripe_standard_price_id/);
    assert.match(store, /prices\.retrieve/);
    assert.match(store, /toStripeTwdMinorUnits\(product\.standard_price_twd\)/);
});

test("商城資料表啟用 RLS 並拒絕前端直接讀寫", () => {
    for (const table of ["store_customer_profiles", "store_shipping_methods", "store_orders", "store_order_items", "store_order_status_history"]) {
        assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    }
    assert.match(migration, /revoke all on public\.store_customer_profiles[\s\S]*from public, anon, authenticated/);
});

test("訂單保存地址、價格與商品快照", () => {
    for (const field of ["recipient_name", "recipient_phone", "postal_code", "city", "district", "address_line1", "subtotal_twd", "shipping_fee_twd", "package_name", "unit_price_twd", "quantity"]) {
        assert.match(migration, new RegExp(field));
    }
    assert.match(store, /validateShipping/);
});

test("庫存在建立結帳時原子保留並在失敗或逾時時釋放", () => {
    assert.match(migration, /reserve_store_order_inventory/);
    assert.match(migration, /for update of mp/);
    assert.match(migration, /release_store_order_inventory/);
    assert.match(store, /rpc\("reserve_store_order_inventory"/);
    assert.match(webhook, /checkout\.session\.expired/);
    assert.match(webhook, /rpc\("release_store_order_inventory"/);
});

test("Stripe 付款完成只能由簽章 webhook 確認", () => {
    assert.match(webhook, /verifyStripeSignature/);
    assert.match(webhook, /metadata\.commerce_type === "store_order"/);
    assert.match(webhook, /Number\(object\.amount_total\) !== toStripeTwdMinorUnits\(order\.total_twd\)/);
    assert.match(webhook, /rpc\("confirm_store_order_payment"/);
    assert.doesNotMatch(store, /confirm_store_order_payment/);
});

test("付款與出貨狀態分離且管理員不能倒退狀態", () => {
    assert.match(migration, /payment_status in \('pending','paid','failed','expired','refunded'\)/);
    assert.match(migration, /fulfillment_status in \('awaiting_payment','preparing','shipping','completed','cancelled'\)/);
    assert.match(store, /fulfillment_reverse_forbidden/);
    assert.match(store, /currentResult\.data\.payment_status !== "paid"/);
});

test("客戶只能讀取自己的訂單，管理端需 Firebase admin", () => {
    assert.match(store, /eq\("customer_user_id", customer\.user_id\)/);
    assert.match(store, /caller\.role !== "admin"/);
    assert.match(store, /checkout_account_mismatch/);
});

test("Hosted Checkout 使用動態付款方式且不自行收集卡號", () => {
    assert.match(store, /stripe\.checkout\.sessions\.create/);
    assert.match(store, /mode: "payment"/);
    assert.doesNotMatch(store, /payment_method_types\s*:/);
    assert.doesNotMatch(store, /card_number|cvc/i);
    assert.match(store, /idempotencyKey: `alanenglish_store_\$\{checkoutRequestId\}`/);
    assert.match(migration, /checkout_request_id uuid not null unique/);
});

test("Stripe 完成與取消頁只回到建立結帳的允許商城網域", () => {
    assert.match(store, /req\.headers\.get\("Origin"\)/);
    assert.match(store, /https:\/\/alanenglish\.com\.tw/);
    assert.match(store, /https:\/\/alanenglish-student-test\.netlify\.app/);
    assert.match(store, /ALLOWED_CHECKOUT_ORIGINS\.has\(requestOrigin\)/);
    assert.match(store, /checkout_origin_forbidden/);
    assert.match(store, /success_url: `\$\{siteUrl\}\/shop\/payment\/success/);
    assert.match(store, /cancel_url: `\$\{siteUrl\}\/shop\/checkout\?cancelled=1`/);
});

test("全額退款會留下獨立付款狀態紀錄", () => {
    assert.match(webhook, /eventType === "charge\.refunded"/);
    assert.match(webhook, /payment_status: "refunded"/);
    assert.match(webhook, /Stripe 已完成全額退款/);
});
