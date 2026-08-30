import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

const callStore = async (action, payload = {}, session = null, firebaseUser = null) => {
    const headers = { "Content-Type": "application/json", apikey: supabaseKey };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    if (firebaseUser) headers["X-Alan-Firebase-Token"] = await firebaseUser.getIdToken();
    const response = await fetch(`${supabaseUrl}/functions/v1/store-commerce`, {
        method: "POST", headers, body: JSON.stringify({ action, ...payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(result?.error || "教材商城服務暫時無法使用");
        error.code = result?.code || null;
        error.status = response.status;
        throw error;
    }
    return result;
};

export const loadStoreConfig = () => callStore("catalog");
export const createStoreCheckout = (session, payload) => callStore("create_checkout", payload, session);
export const loadStoreOrders = session => callStore("orders", {}, session);
export const loadStoreOrder = (session, orderNumber) => callStore("order", { order_number: orderNumber }, session);
export const syncStoreCheckout = (session, checkoutSessionId) => callStore("sync", { checkout_session_id: checkoutSessionId }, session);
export const cancelStoreCheckout = (session, orderNumber) => callStore("cancel_checkout", { order_number: orderNumber }, session);
export const loadAdminStoreOrders = firebaseUser => callStore("admin_orders", {}, null, firebaseUser);
export const updateStoreFulfillment = (firebaseUser, payload) => callStore("update_fulfillment", payload, null, firebaseUser);
export const updateStoreShippingMethod = (firebaseUser, payload) => callStore("update_shipping_method", payload, null, firebaseUser);
